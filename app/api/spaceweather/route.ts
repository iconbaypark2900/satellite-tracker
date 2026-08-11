/**
 * GET /api/spaceweather — Aggregated NOAA SWPC space-weather summary.
 *
 * Sources (all public, no key):
 *   - services.swpc.noaa.gov/json/planetary_k_index_1m.json
 *   - services.swpc.noaa.gov/products/summary/solar-wind-speed.json
 *   - services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json
 *   - services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json
 *
 * 5-minute in-module cache; individual source failures degrade to null.
 */

import { NextResponse } from "next/server";
import { xrayFluxToClass, SpaceWeatherSummary } from "@/lib/space-weather";

export const revalidate = 300;

const SWPC = "https://services.swpc.noaa.gov";
const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: { at: number; data: SpaceWeatherSummary } | null = null;

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET() {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...cached.data, source: "cache" });
  }

  const [kpRaw, windRaw, magRaw, xrayRaw] = await Promise.all([
    fetchJson(`${SWPC}/json/planetary_k_index_1m.json`),
    fetchJson(`${SWPC}/products/summary/solar-wind-speed.json`),
    fetchJson(`${SWPC}/products/summary/solar-wind-mag-field.json`),
    fetchJson(`${SWPC}/json/goes/primary/xrays-1-day.json`),
  ]);

  // Kp: array of 1-min estimates; take latest + max over the trailing 3h
  let kp: SpaceWeatherSummary["kp"] = null;
  if (Array.isArray(kpRaw) && kpRaw.length > 0) {
    const last = kpRaw[kpRaw.length - 1] as {
      estimated_kp?: number;
      time_tag?: string;
    };
    const tail = kpRaw.slice(-180) as Array<{ estimated_kp?: number }>;
    const max3h = Math.max(
      ...tail.map((r) => (typeof r.estimated_kp === "number" ? r.estimated_kp : 0))
    );
    if (typeof last.estimated_kp === "number") {
      kp = {
        value: Math.round(last.estimated_kp * 100) / 100,
        max3h: Math.round(max3h * 100) / 100,
        timeTag: last.time_tag ?? "",
      };
    }
  }

  let solarWind: SpaceWeatherSummary["solarWind"] = null;
  if (Array.isArray(windRaw) && windRaw.length > 0) {
    const w = windRaw[0] as { proton_speed?: number; time_tag?: string };
    if (typeof w.proton_speed === "number") {
      solarWind = { speedKmS: w.proton_speed, timeTag: w.time_tag ?? "" };
    }
  }

  let imf: SpaceWeatherSummary["imf"] = null;
  if (Array.isArray(magRaw) && magRaw.length > 0) {
    const m = magRaw[0] as { bt?: number; bz_gsm?: number; time_tag?: string };
    if (typeof m.bt === "number" && typeof m.bz_gsm === "number") {
      imf = { btNt: m.bt, bzGsmNt: m.bz_gsm, timeTag: m.time_tag ?? "" };
    }
  }

  let xray: SpaceWeatherSummary["xray"] = null;
  if (Array.isArray(xrayRaw) && xrayRaw.length > 0) {
    // Latest long-band (0.1-0.8nm) sample
    const longBand = (xrayRaw as Array<{ energy?: string; flux?: number; time_tag?: string }>)
      .filter((r) => r.energy === "0.1-0.8nm" && typeof r.flux === "number");
    const last = longBand[longBand.length - 1];
    if (last?.flux !== undefined) {
      xray = {
        flux: last.flux,
        class: xrayFluxToClass(last.flux),
        timeTag: last.time_tag ?? "",
      };
    }
  }

  const data: SpaceWeatherSummary = {
    fetchedAt: new Date().toISOString(),
    kp,
    solarWind,
    imf,
    xray,
  };

  // Cache even partial results (avoid hammering SWPC on partial outages),
  // but not total failures
  if (kp || solarWind || imf || xray) {
    cached = { at: Date.now(), data };
  }

  return NextResponse.json({ ...data, source: "live" });
}
