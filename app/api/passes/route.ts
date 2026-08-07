/**
 * POST /api/passes — Compute satellite pass predictions.
 *
 * Computes visible passes for a satellite over a given location,
 * using SGP4 propagation and solar illumination checks.
 *
 * Body:
 *   {
 *     "noradId": "25544",
 *     "observer": { "lat": 40.71, "lon": -74.0, "alt": 0.01, "label": "NYC" },
 *     "hours": 24,
 *     "minElevation": 10
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { predictPasses, getNextVisiblePass } from "@/lib/pass-calculator";
import { fetchAllTles, getTleByNorad } from "@/lib/tle-client";
import { ObserverLocation } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { noradId, observer, hours = 24, minElevation = 10 } = body;

    if (!noradId || !observer) {
      return NextResponse.json(
        { error: "noradId and observer are required" },
        { status: 400 }
      );
    }

    // Try to get TLE from cache
    let tle = getTleByNorad(noradId);

    // If not cached, fetch fresh TLEs
    if (!tle) {
      const allTles = await fetchAllTles();
      tle = allTles.find((t) => t.noradId === noradId);
    }

    if (!tle) {
      return NextResponse.json(
        { error: `TLE not found for NORAD ID ${noradId}` },
        { status: 404 }
      );
    }

    const obs: ObserverLocation = {
      lat: observer.lat,
      lon: observer.lon,
      alt: observer.alt ?? 0,
      label: observer.label ?? "Unknown",
    };

    const passes = predictPasses(tle, obs, new Date(), hours, minElevation);
    const nextVisible = getNextVisiblePass(tle, obs, new Date());

    return NextResponse.json({
      noradId,
      observer,
      passes,
      count: passes.length,
      nextVisible,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to compute pass predictions: ${message}` },
      { status: 500 }
    );
  }
}
