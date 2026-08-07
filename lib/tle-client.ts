/**
 * Celestrak TLE API client — fetch, parse, and cache Two-Line Element sets.
 */

import { TleSet, SatelliteGroup } from "@/types";
import {
  CELESTRAK_TLE_GROUPS,
  TLE_CACHE_TTL,
  DEFAULT_SATELLITES,
} from "@/lib/constants";

// ─── Types ─�────────────────────────────────────────────── //

interface FetchResult {
  group: SatelliteGroup;
  tles: TleSet[];
  fetchedAt: number;
}

// ─── In-memory Cache ───────────────────────────────────── //

/** Module-level cache for TLE data (5-minute TTL). */
const tleCache = new Map<SatelliteGroup, FetchResult>();

/**
 * Check if cached data is still fresh.
 */
function isCacheFresh(group: SatelliteGroup, ttlSec: number = TLE_CACHE_TTL): boolean {
  const entry = tleCache.get(group);
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < ttlSec * 1000;
}

// ─── TLE Parsing ───────────────────────────────────────── //

/**
 * Parse raw Celestrak TLE text into structured TleSet objects.
 *
 * Celestrak returns text in the format:
 *   SATELLITE NAME
 *   1 NORAD_ID ... (line 1)
 *   2 NORAD_ID ... (line 2)
 *   (blank line separator)
 */
export function parseTleText(raw: string, group: SatelliteGroup): TleSet[] {
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

      // Extract NORAD ID from column 3-7 of line 1
      const noradId = line.substring(2, 7).trim();
      const epoch = line.substring(18, 32).trim();

      tles.push({
        name: nameLine || `NORAD ${noradId}`,
        noradId,
        line1: line,
        line2,
        epoch,
        group,
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
  group: SatelliteGroup,
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
    const tles = parseTleText(text, group);

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
 * Fetch TLE data for all Celestrak groups in parallel.
 * Falls back to default satellite list if all groups fail.
 */
export async function fetchAllTles(signal?: AbortSignal): Promise<TleSet[]> {
  const groups: SatelliteGroup[] = [
    "STATIONS", "STARLINK", "ONEWEB", "GPS-OPS", "GOES",
    "SES", "INTREPID", "OTHER",
  ];

  // Fetch all groups in parallel for speed
  const results = await Promise.allSettled(
    groups.map((group) => fetchTleForGroup(group, signal))
  );

  const allTles: TleSet[] = [];
  const errors: string[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value.length > 0) {
      allTles.push(...result.value);
    } else if (result.status === "rejected") {
      errors.push(`${groups[index]}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
    }
  });

  // If all groups failed, fall back to default satellite list
  if (allTles.length === 0 && errors.length === groups.length) {
    console.warn("All Celestrak TLE fetches failed, using default satellite list");
    return DEFAULT_SATELLITES
      .filter((s) => groups.includes(s.group as SatelliteGroup))
      .map((s) => ({
        name: s.name,
        noradId: s.norad,
        line1: s.line1 ?? "",
        line2: s.line2 ?? "",
        epoch: "",
        group: s.group as SatelliteGroup,
      }));
  }

  if (errors.length > 0) {
    console.warn("Some TLE fetches failed:", errors);
  }

  return allTles;
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
export function getTleAge(group: SatelliteGroup): number {
  const entry = tleCache.get(group);
  if (!entry) return Infinity;
  return (Date.now() - entry.fetchedAt) / 1000;
}
