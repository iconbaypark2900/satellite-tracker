/**
 * Celestrak TLE API client — fetch, parse, and cache Two-Line Element sets.
 */

import { TleSet, CelestrakGroup } from "@/types";
import {
  CELESTRAK_TLE_GROUPS,
  TLE_CACHE_TTL,
  DEFAULT_SATELLITES,
} from "@/lib/constants";
import { classifySatellite } from "@/lib/classify-satellite";

// ─── Types ─�────────────────────────────────────────────── //

interface FetchResult {
  group: CelestrakGroup;
  tles: TleSet[];
  fetchedAt: number;
}

// ─── In-memory Cache ───────────────────────────────────── //

/** Module-level cache for TLE data (5-minute TTL). */
const tleCache = new Map<CelestrakGroup, FetchResult>();

/**
 * Check if cached data is still fresh.
 */
function isCacheFresh(group: CelestrakGroup, ttlSec: number = TLE_CACHE_TTL): boolean {
  const entry = tleCache.get(group);
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < ttlSec * 1000;
}

// ─── TLE Parsing ───────────────────────────────────────── //

/**
 * Parse raw TLE text into structured TleSet objects.
 *
 * Celestrak and the amateur mirrors both return text in the format:
 *   SATELLITE NAME
 *   1 NORAD_ID ... (line 1)
 *   2 NORAD_ID ... (line 2)
 *   (blank line separator)
 *
 * Each object is filed by name, so a set parses to the same categories no
 * matter which feed it came from.
 */
export function parseTleText(raw: string): TleSet[] {
  const lines = raw.trim().split(/\r?\n/);
  const tles: TleSet[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // TLE line 1 starts with "1 "
    if (line.startsWith("1 ")) {
      const nameLine = i > 0 ? lines[i - 1].trim() : "";
      const line2 = i + 1 < lines.length ? lines[i + 1].trim() : "";

      if (!line2.startsWith("2 ")) continue;

      // Extract NORAD ID from column 3-7 of line 1, normalized without
      // leading zeros ("07530" and " 7530" are the same satellite —
      // sources disagree on padding)
      const noradId = line.substring(2, 7).trim().replace(/^0+(?=\d)/, "");
      const epoch = line.substring(18, 32).trim();
      const name = nameLine || `NORAD ${noradId}`;

      tles.push({
        name,
        noradId,
        line1: line,
        line2,
        epoch,
        group: classifySatellite(name),
      });
      i += 1; // Skip line 2 on next iteration
    }
  }

  return tles;
}

// ─── Fetch Functions ───────────────────────────────────── //

/**
 * Fetch TLE data for a single Celestrak group.
 * Uses in-memory cache with a 5-minute TTL.
 */
export async function fetchTleForGroup(
  group: CelestrakGroup,
  signal?: AbortSignal
): Promise<TleSet[]> {
  // Check cache
  if (isCacheFresh(group)) {
    return tleCache.get(group)!.tles;
  }

  const url = CELESTRAK_TLE_GROUPS[group];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      signal: signal ?? controller.signal,
      headers: { Accept: "text/plain" },
      // Use Next.js caching for server-side
      next: process.env.NODE_ENV === "production"
        ? { revalidate: TLE_CACHE_TTL }
        : undefined,
    });

    if (!response.ok) {
      throw new Error(
        `Celestrak returned ${response.status} ${response.statusText}`
      );
    }

    const text = await response.text();
    const tles = parseTleText(text);

    tleCache.set(group, { group, tles, fetchedAt: Date.now() });

    return tles;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`TLE fetch timed out for group ${group}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch TLE data for all Celestrak feeds in parallel, deduped by NORAD ID —
 * the feeds overlap (a GOES satellite appears in both `goes` and `weather`).
 * Falls back to default satellite list if all feeds fail.
 */
export async function fetchAllTles(signal?: AbortSignal): Promise<TleSet[]> {
  const groups = Object.keys(CELESTRAK_TLE_GROUPS) as CelestrakGroup[];

  // Fetch all groups in parallel for speed
  const results = await Promise.allSettled(
    groups.map((group) => fetchTleForGroup(group, signal))
  );

  const byNorad = new Map<string, TleSet>();
  const errors: string[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value.length > 0) {
      result.value.forEach((tle) => {
        if (!byNorad.has(tle.noradId)) byNorad.set(tle.noradId, tle);
      });
    } else if (result.status === "rejected") {
      errors.push(`${groups[index]}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
    }
  });

  const allTles = [...byNorad.values()];

  // If all groups failed, surface the failure — callers decide what to
  // fall back to (stale local cache beats synthetic data).
  if (allTles.length === 0 && errors.length === groups.length) {
    throw new Error(`All Celestrak TLE fetches failed: ${errors.join("; ")}`);
  }

  if (errors.length > 0) {
    console.warn("Some TLE fetches failed:", errors);
  }

  return allTles;
}

/**
 * Last-resort synthetic satellite list. The elements are approximate and
 * the epochs are stale — only for keeping the UI alive with zero data.
 */
export function getFallbackTles(): TleSet[] {
  return DEFAULT_SATELLITES.map((s) => ({
    name: s.name,
    noradId: s.norad,
    line1: s.line1 ?? "",
    line2: s.line2 ?? "",
    epoch: "",
    group: classifySatellite(s.name),
  }));
}

/**
 * Get a single TLE by NORAD ID.
 */
export function getTleByNorad(noradId: string): TleSet | undefined {
  for (const entry of tleCache.values()) {
    const found = entry.tles.find((t) => t.noradId === noradId);
    if (found) return found;
  }
  return undefined;
}

/**
 * Clear the TLE cache (force refresh on next fetch).
 */
export function clearTleCache(): void {
  tleCache.clear();
}

/**
 * Get the age of cached TLE data for a group (seconds, or Infinity if not cached).
 */
export function getTleAge(group: CelestrakGroup): number {
  const entry = tleCache.get(group);
  if (!entry) return Infinity;
  return (Date.now() - entry.fetchedAt) / 1000;
}
