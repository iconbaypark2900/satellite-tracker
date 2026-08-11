/**
 * tle-cache-file.ts — Server-only access to the local TLE cache file
 * (public/tle-cache.json, written by `npm run cache:tle`).
 *
 * Kept separate from tle-client.ts because that module is also bundled
 * client-side and must not import `fs`.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { TleSet } from "@/types";

export interface LocalTleCache {
  generatedAt?: string;
  fetchedAt?: string;
  tleCount?: number;
  count?: number;
  groups?: Record<string, { count: number; fetchedAt: string }>;
  tles?: TleSet[];
}

/** How long the on-disk cache is considered fresh enough to skip live fetches. */
export const LOCAL_CACHE_FRESH_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Read and parse public/tle-cache.json, or null if missing/corrupt. */
export function readLocalTleCache(): LocalTleCache | null {
  try {
    const cachePath = join(process.cwd(), "public", "tle-cache.json");
    return JSON.parse(readFileSync(cachePath, "utf-8"));
  } catch {
    return null;
  }
}

/** Age of the cache in milliseconds, or Infinity if unknown. */
export function getLocalCacheAgeMs(cache: LocalTleCache): number {
  const stamp = Date.parse(cache.generatedAt ?? cache.fetchedAt ?? "");
  return Number.isFinite(stamp) ? Date.now() - stamp : Infinity;
}

/** Look up a single TLE in the local cache file by NORAD ID. */
export function findCachedTle(noradId: string): TleSet | undefined {
  const cache = readLocalTleCache();
  return cache?.tles?.find((t) => t.noradId === noradId);
}
