/**
 * GET /api/satcat — Proxy to Celestrak SATCAT metadata API.
 *
 * Fetches metadata (operator, country, launch date, orbit type)
 * for satellites by NORAD ID.
 *
 * Query params:
 *   ?ids=25544,20580,48793 (comma-separated NORAD IDs)
 *
 * Cache: 24 hours (satellite metadata rarely changes)
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchSatCatRecords } from "@/lib/satcat-client";
import { SATCAT_CACHE_TTL } from "@/lib/constants";

export const revalidate = SATCAT_CACHE_TTL;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");

  if (!idsParam) {
    return NextResponse.json(
      { error: "Missing 'ids' parameter (comma-separated NORAD IDs)" },
      { status: 400 }
    );
  }

  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ error: "No valid NORAD IDs provided" }, { status: 400 });
  }

  // Limit to 100 IDs per request (Celestrak limit)
  const limitedIds = ids.slice(0, 100);

  try {
    const records = await fetchSatCatRecords(limitedIds);

    return NextResponse.json({
      records,
      count: records.length,
      requested: ids.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch SATCAT data: ${message}` },
      { status: 502 }
    );
  }
}
