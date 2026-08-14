/**
 * GET /api/tle — Proxy to Celestrak TLE API.
 *
 * Fetches and caches TLE data for satellite groups.
 * Returns parsed TLE sets grouped by constellation.
 *
 * Query params:
 *   ?group=STATIONS|STARLINK|ONEWEB|GPS-OPS|GOES|SES|INTREPID
 *   ?norad=25544 (fetch a single satellite by NORAD ID)
 *   ?refresh=true (force live fetch, bypassing local cache)
 *
 * Cache: 5 minutes (server-side), 5 minutes (client via SWR)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllTles,
  fetchTleForGroup,
  getTleByNorad,
  getFallbackTles,
} from "@/lib/tle-client";
import {
  readLocalTleCache,
  getLocalCacheAgeMs,
  LOCAL_CACHE_FRESH_MS,
  findCachedTle,
} from "@/lib/tle-cache-file";
import { CELESTRAK_TLE_GROUPS } from "@/lib/constants";
import { CelestrakGroup } from "@/types";
import { TleSet } from "@/types";

// Revalidate every 5 minutes (300 seconds)
export const revalidate = 300;

// After a failed live fetch, don't re-attempt (and eat the ~5s timeout)
// on every request — serve the stale cache and retry after this interval.
let lastLiveFailureAt = 0;
const LIVE_RETRY_INTERVAL_MS = 5 * 60 * 1000;

/** Shape a TLE list into the response payload. */
function tleResponse(
  tles: TleSet[],
  fetchedAt: string | null,
  source: string
) {
  const byGroup: Record<string, TleSet[]> = {};
  tles.forEach((tle) => {
    const g = tle.group ?? "OTHER";
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(tle);
  });
  return NextResponse.json({
    tles,
    byGroup,
    fetchedAt,
    count: tles.length,
    source,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupParam = searchParams.get("group") as CelestrakGroup | null;
  const noradParam = searchParams.get("norad");
  const refresh = searchParams.get("refresh") === "true";

  try {
    // Single satellite lookup
    if (noradParam) {
      const tle = getTleByNorad(noradParam) ?? findCachedTle(noradParam);
      if (!tle) {
        return NextResponse.json(
          { error: `TLE not found for NORAD ID ${noradParam}` },
          { status: 404 }
        );
      }
      return NextResponse.json({ tle });
    }

    // Single group
    if (groupParam && CELESTRAK_TLE_GROUPS[groupParam]) {
      const tles = await fetchTleForGroup(groupParam);
      return NextResponse.json({ group: groupParam, tles, count: tles.length });
    }

    // All groups — serve the local cache file only while it is fresh;
    // once stale, attempt a live fetch (falling back to the stale cache below).
    const localCache = readLocalTleCache();
    if (!refresh && localCache?.tles?.length) {
      const cacheAge = getLocalCacheAgeMs(localCache);
      const inFailureBackoff =
        Date.now() - lastLiveFailureAt < LIVE_RETRY_INTERVAL_MS;
      if (cacheAge < LOCAL_CACHE_FRESH_MS || inFailureBackoff) {
        return tleResponse(
          localCache.tles,
          localCache.generatedAt ?? localCache.fetchedAt ?? null,
          cacheAge < LOCAL_CACHE_FRESH_MS ? "cache" : "cache-stale"
        );
      }
    }

    // Fetch live TLE data from Celestrak
    const allTles = await fetchAllTles();
    lastLiveFailureAt = 0;
    return tleResponse(allTles, new Date().toISOString(), "live");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`TLE live fetch failed (${message}); falling back`);
    lastLiveFailureAt = Date.now();

    // Prefer stale-but-real cached data over synthetic data
    const localCache = readLocalTleCache();
    if (localCache?.tles?.length) {
      return tleResponse(
        localCache.tles,
        localCache.generatedAt ?? localCache.fetchedAt ?? null,
        "cache-stale"
      );
    }

    // Absolute last resort: synthetic demo satellites (approximate orbits)
    return tleResponse(getFallbackTles(), null, "synthetic-fallback");
  }
}
