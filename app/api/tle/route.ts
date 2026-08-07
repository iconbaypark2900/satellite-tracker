/**
 * GET /api/tle — Proxy to Celestrak TLE API.
 *
 * Fetches and caches TLE data for satellite groups.
 * Returns parsed TLE sets grouped by constellation.
 *
 * Query params:
 *   ?group=STATIONS|STARLINK|ONEWEB|GPS-OPS|GOES|SES|INTREPID
 *   ?norad=25544 (fetch a single satellite by NORAD ID)
 *
 * Cache: 5 minutes (server-side), 5 minutes (client via SWR)
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchAllTles, fetchTleForGroup, getTleByNorad } from "@/lib/tle-client";
import { CELESTRAK_TLE_GROUPS, TLE_CACHE_TTL } from "@/lib/constants";
import { SatelliteGroup } from "@/types";

// Revalidate every 5 minutes
export const revalidate = TLE_CACHE_TTL;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupParam = searchParams.get("group") as SatelliteGroup | null;
  const noradParam = searchParams.get("norad");

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

    // All groups
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
    return NextResponse.json(
      { error: `Failed to fetch TLE data: ${message}` },
      { status: 502 }
    );
  }
}
