/**
 * SATCAT metadata client — fetch satellite metadata from Celestrak.
 *
 * Celestrak's SATCAT endpoint takes one catalog number per request, so a
 * lookup is inherently serial. When Celestrak is unreachable — it blocks
 * whole IP ranges, which is the normal state on some networks — that turned
 * every satellite selection into a stack of 5-second timeouts before the UI
 * could admit it had nothing. This client fails fast and stays failed:
 *
 *   - a circuit breaker trips on the first connection failure and short-
 *     circuits every lookup for the next few minutes, so the cost of an
 *     outage is paid once rather than once per selection
 *   - IDs Celestrak answers for but has no record of are cached as misses,
 *     so re-selecting the same satellite never refetches
 *   - an outage is reported as an outcome, not thrown, so callers can tell
 *     "the catalogue has no record" from "we could not reach the catalogue"
 */

import { SatCatRecord } from "@/types/satellite";
import { SATCAT_API_URL, SATCAT_CACHE_TTL } from "@/lib/constants";

// ─── Tunables ────────────────────────────────────────── //

/** Per-request timeout. Celestrak answers in well under a second when up. */
const REQUEST_TIMEOUT_MS = 3500;

/** How long the breaker stays open after a connection failure. */
const BREAKER_COOLDOWN_MS = 5 * 60_000;

/** Ceiling on IDs fetched per call, so one request cannot fan out wide. */
const MAX_IDS_PER_CALL = 12;

// ─── Cache ───────────────────────────────────────────── //

/** In-memory cache for SATCAT metadata, keyed by NORAD ID. */
const satcatCache = new Map<string, { data: SatCatRecord; fetchedAt: number }>();

/**
 * IDs Celestrak successfully answered for with no record. Without this, an
 * object that simply is not in SATCAT is re-requested on every selection.
 */
const knownMisses = new Map<string, number>();

/** Timestamp of the last transport-level failure, or 0 when healthy. */
let breakerTrippedAt = 0;

function isCacheFresh(noradId: string): boolean {
  const entry = satcatCache.get(noradId);
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < SATCAT_CACHE_TTL * 1000;
}

function isKnownMiss(noradId: string): boolean {
  const at = knownMisses.get(noradId);
  return at !== undefined && Date.now() - at < SATCAT_CACHE_TTL * 1000;
}

/** True while the breaker is open — Celestrak is presumed unreachable. */
export function isSatCatUnreachable(): boolean {
  if (breakerTrippedAt === 0) return false;
  if (Date.now() - breakerTrippedAt < BREAKER_COOLDOWN_MS) return true;
  breakerTrippedAt = 0; // cooldown elapsed; allow one probe through
  return false;
}

/** Seconds until the breaker allows another attempt, or 0 when closed. */
export function satCatRetryInSeconds(): number {
  if (!isSatCatUnreachable()) return 0;
  return Math.ceil((BREAKER_COOLDOWN_MS - (Date.now() - breakerTrippedAt)) / 1000);
}

// ─── Fetch Functions ─────────────────────────────────── //

export interface SatCatLookup {
  records: SatCatRecord[];
  /** True when Celestrak could not be reached for at least one requested ID. */
  unavailable: boolean;
  /** Human-readable cause, present only when `unavailable`. */
  reason?: string;
}

/**
 * Fetch SATCAT metadata for a list of NORAD IDs.
 *
 * Never throws for an upstream outage — an unreachable catalogue is a normal
 * operating condition here, not an exception. Returns whatever is cached
 * alongside a flag saying whether the result is complete.
 */
export async function fetchSatCatRecords(
  noradIds: string[],
  signal?: AbortSignal
): Promise<SatCatLookup> {
  const uncachedIds = noradIds
    .filter((id) => !isCacheFresh(id) && !isKnownMiss(id))
    .slice(0, MAX_IDS_PER_CALL);

  const cached = () =>
    noradIds
      .map((id) => satcatCache.get(id)?.data)
      .filter((r): r is SatCatRecord => !!r);

  // Breaker open: answer from cache immediately rather than queueing more
  // timeouts behind a host we already know is not responding.
  if (uncachedIds.length > 0 && isSatCatUnreachable()) {
    return {
      records: cached(),
      unavailable: true,
      reason: `Celestrak unreachable; retrying in ${satCatRetryInSeconds()}s`,
    };
  }

  let unavailable = false;
  let reason: string | undefined;

  for (const id of uncachedIds) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const url = `${SATCAT_API_URL}?CATNR=${encodeURIComponent(id)}&FORMAT=JSON`;
      const response = await fetch(url, {
        signal: signal ?? controller.signal,
        headers: { Accept: "application/json" },
        next: process.env.NODE_ENV === "production"
          ? { revalidate: SATCAT_CACHE_TTL }
          : undefined,
      });

      if (!response.ok) {
        // A refusal is still an answer: the host is up, so this is not a
        // transport failure and must not trip the breaker.
        knownMisses.set(id, Date.now());
        unavailable = true;
        reason = `SATCAT returned ${response.status} ${response.statusText}`;
        continue;
      }

      const body = await response.json();
      // Celestrak returns an array; tolerate a bare object too
      const records: SatCatRecord[] = Array.isArray(body) ? body : [body];
      const matched = records.filter((r) => r?.NORAD_CAT_ID);

      matched.forEach((record) => {
        satcatCache.set(String(record.NORAD_CAT_ID), {
          data: record,
          fetchedAt: Date.now(),
        });
      });

      // Answered, but this object is not catalogued — remember that.
      if (matched.length === 0) knownMisses.set(id, Date.now());

      breakerTrippedAt = 0; // a success closes the breaker
    } catch (error) {
      // Timeouts and DNS/connect errors mean the host is not answering.
      // Trip the breaker and stop: the remaining IDs would time out too.
      breakerTrippedAt = Date.now();
      unavailable = true;
      reason =
        error instanceof Error && error.name === "AbortError"
          ? `SATCAT timed out after ${REQUEST_TIMEOUT_MS}ms`
          : `SATCAT unreachable: ${error instanceof Error ? error.message : String(error)}`;
      clearTimeout(timeoutId);
      break;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { records: cached(), unavailable, ...(reason ? { reason } : {}) };
}

/**
 * Fetch SATCAT metadata for a single NORAD ID.
 */
export async function fetchSatCatRecord(
  noradId: string,
  signal?: AbortSignal
): Promise<SatCatRecord | null> {
  const { records } = await fetchSatCatRecords([noradId], signal);
  return records[0] ?? null;
}

/**
 * Get a cached SATCAT record without fetching.
 */
export function getCachedSatCat(noradId: string): SatCatRecord | null {
  const entry = satcatCache.get(noradId);
  return entry?.data ?? null;
}

/**
 * Clear the SATCAT cache, the miss list, and the breaker.
 */
export function clearSatCatCache(): void {
  satcatCache.clear();
  knownMisses.clear();
  breakerTrippedAt = 0;
}
