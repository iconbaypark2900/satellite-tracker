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
import { fetchAllTles, fetchTleForGroup, getTleByNorad } from "@/lib/tle-client";
import { CELESTRAK_TLE_GROUPS, TLE_CACHE_TTL } from "@/lib/constants";
import { SatelliteGroup } from "@/types";
import { readFileSync } from "fs";
import { join } from "path";

// Revalidate every 5 minutes
export const revalidate = TLE_CACHE_TTL;

/** Read the local TLE cache file (public/tle-cache.json). */
function readLocalTleCache() {
  try {
    const cachePath = join(process.cwd(), "public", "tle-cache.json");
    const raw = readFileSync(cachePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupParam = searchParams.get("group") as SatelliteGroup | null;
  const noradParam = searchParams.get("norad");
  const refresh = searchParams.get("refresh") === "true";

  try {
    // Single satellite lookup
    if (noradParam) {
      const tle = getTleByNorad(noradParam);
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

    // All groups — try local cache first for instant response
    if (!refresh) {
      const localCache = readLocalTleCache();
      if (localCache) {
        // Group by constellation from cache tles
        const byGroup: Record<string, any[]> = {};
        (localCache.tles || []).forEach((tle: any) => {
          const g = tle.group ?? "OTHER";
          if (!byGroup[g]) byGroup[g] = [];
          byGroup[g].push({
            noradId: tle.noradId,
            name: tle.name,
            line1: tle.line1,
            line2: tle.line2,
            epoch: tle.epoch,
            group: tle.group,
          });
        });

        return NextResponse.json({
          tles: localCache.tles || [],
          byGroup,
          fetchedAt: localCache.generatedAt || localCache.fetchedAt || new Date().toISOString(),
          count: localCache.tleCount || localCache.count || (localCache.tles || []).length,
          source: "cache",
        });
      }
    }

    // Fetch live TLE data from Celestrak
    const allTles = await fetchAllTles();

    // Group by constellation
    const byGroup: Record<string, any[]> = {};
    allTles.forEach((tle) => {
      const g = tle.group ?? "OTHER";
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push({
        noradId: tle.noradId,
        name: tle.name,
        line1: tle.line1,
        line2: tle.line2,
        epoch: tle.epoch,
        group: tle.group,
      });
    });

    return NextResponse.json({
      tles: allTles,
      byGroup,
      fetchedAt: new Date().toISOString(),
      count: allTles.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // Last resort: try local cache on error
    const localCache = readLocalTleCache();
    if (localCache) {
      return NextResponse.json({
        tles: localCache.tles || [],
        fetchedAt: localCache.generatedAt || localCache.fetchedAt || new Date().toISOString(),
        count: localCache.tleCount || localCache.count || (localCache.tles || []).length,
        source: "cache-fallback",
      });
    }
    return NextResponse.json(
      { error: `Failed to fetch TLE data: ${message}` },
      { status: 502 }
    );
  }
}
