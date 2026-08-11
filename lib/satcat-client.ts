/**
 * SATCAT metadata client — fetch satellite metadata from Celestrak.
 */

import { SatCatRecord } from "@/types/satellite";
import { SATCAT_API_URL, SATCAT_CACHE_TTL } from "@/lib/constants";

// ─── Cache ───────────────────────────────────────────── //

/**
 * In-memory cache for SATCAT metadata.
 * Keyed by NORAD ID.
 */
const satcatCache = new Map<string, { data: SatCatRecord; fetchedAt: number }>();

/**
 * Check if SATCAT cache entry is fresh.
 */
function isCacheFresh(noradId: string): boolean {
  const entry = satcatCache.get(noradId);
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < SATCAT_CACHE_TTL * 1000;
}

// ─── Fetch Functions ─────────────────────────────────── //

/**
 * Fetch SATCAT metadata for a list of NORAD IDs.
 * Uses batch fetching where possible.
 */
export async function fetchSatCatRecords(
  noradIds: string[],
  signal?: AbortSignal
): Promise<SatCatRecord[]> {
  // Celestrak's CATNR parameter takes a SINGLE catalog number — fetch
  // sequentially, capped, so one detail-panel request can't fan out wide.
  const uncachedIds = noradIds
    .filter((id) => !satcatCache.has(id) || !isCacheFresh(id))
    .slice(0, 12);

  for (const id of uncachedIds) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

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
        throw new Error(
          `SATCAT returned ${response.status} ${response.statusText}`
        );
      }

      const body = await response.json();
      // Celestrak returns an array; tolerate a bare object too
      const records: SatCatRecord[] = Array.isArray(body) ? body : [body];

      records.forEach((record) => {
        if (record?.NORAD_CAT_ID) {
          satcatCache.set(String(record.NORAD_CAT_ID), {
            data: record,
            fetchedAt: Date.now(),
          });
        }
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("SATCAT fetch timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Return cached records for all requested IDs
  return noradIds
    .map((id) => satcatCache.get(id)?.data)
    .filter((r): r is SatCatRecord => !!r);
}

/**
 * Fetch SATCAT metadata for a single NORAD ID.
 */
export async function fetchSatCatRecord(
  noradId: string,
  signal?: AbortSignal
): Promise<SatCatRecord | null> {
  const records = await fetchSatCatRecords([noradId], signal);
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
 * Clear the SATCAT cache.
 */
export function clearSatCatCache(): void {
  satcatCache.clear();
}
