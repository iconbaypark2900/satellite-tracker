/**
 * validate-vs-horizons.ts — Validate this app's look-angle predictions
 * against JPL Horizons.
 *
 * Method: fetch a topocentric az/el/range ephemeris for the ISS from the
 * Horizons API (observer table for an NYC site, 1-minute steps, 48h from
 * our TLE's epoch), compute the same quantities with our SGP4 pipeline
 * (lib/pass-calculator computeAzEl), and report error statistics.
 *
 * Usage: pnpm validate    (writes docs/validation-results.json and prints
 *                          a markdown summary — paste into docs/VALIDATION.md)
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { computeAzEl } from "@/lib/pass-calculator";
import { tleEpochToDate } from "@/lib/orbit-utils";
import { AU_KM } from "@/lib/constants";
import { ObserverLocation, TleSet } from "@/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.resolve(__dirname, "../public/tle-cache.json");
const OUT_FILE = path.resolve(__dirname, "../docs/validation-results.json");

const SITE: ObserverLocation = {
  lat: 40.7128,
  lon: -74.006,
  alt: 0.01,
  label: "New York, NY, USA",
};

const WINDOW_HOURS = 48;
const STEP_MINUTES = 1;

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

interface Sample {
  t: number;
  az: number;
  el: number;
  rangeKm: number;
}

function fmtHorizonsTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** Parse one $$SOE row: "2026-Aug-11 00:00 C   137.34 -54.34  0.0000725826  2.155" */
function parseHorizonsRow(line: string): Sample | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 6) return null;
  const dateM = tokens[0].match(/^(\d{4})-([A-Z][a-z]{2})-(\d{2})$/);
  const timeM = tokens[1].match(/^(\d{2}):(\d{2})$/);
  if (!dateM || !timeM || !(dateM[2] in MONTHS)) return null;

  // Flags (solar presence / interference) sit between time and numbers —
  // take the last four tokens as az, el, delta (AU), deltadot.
  const az = parseFloat(tokens[tokens.length - 4]);
  const el = parseFloat(tokens[tokens.length - 3]);
  const deltaAu = parseFloat(tokens[tokens.length - 2]);
  if (!Number.isFinite(az) || !Number.isFinite(el) || !Number.isFinite(deltaAu)) {
    return null;
  }

  const t = Date.UTC(
    parseInt(dateM[1], 10),
    MONTHS[dateM[2]],
    parseInt(dateM[3], 10),
    parseInt(timeM[1], 10),
    parseInt(timeM[2], 10)
  );
  return { t, az, el, rangeKm: deltaAu * AU_KM };
}

async function fetchHorizons(startMs: number, stopMs: number): Promise<Sample[]> {
  const params = new URLSearchParams({
    format: "text",
    COMMAND: "'-125544'", // ISS
    EPHEM_TYPE: "OBSERVER",
    CENTER: "'coord@399'",
    COORD_TYPE: "GEODETIC",
    SITE_COORD: `'${SITE.lon},${SITE.lat},${SITE.alt}'`,
    START_TIME: `'${fmtHorizonsTime(new Date(startMs))}'`,
    STOP_TIME: `'${fmtHorizonsTime(new Date(stopMs))}'`,
    STEP_SIZE: `'${STEP_MINUTES}m'`,
    QUANTITIES: "'4,20'", // apparent az/el (airless), range + range-rate
    ANG_FORMAT: "DEG",
  });

  const res = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`, {
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Horizons returned ${res.status}`);
  const text = await res.text();

  const soe = text.indexOf("$$SOE");
  const eoe = text.indexOf("$$EOE");
  if (soe < 0 || eoe < 0) {
    throw new Error(`Horizons response missing ephemeris block:\n${text.slice(0, 500)}`);
  }

  return text
    .slice(soe + 5, eoe)
    .split("\n")
    .map(parseHorizonsRow)
    .filter((s): s is Sample => s !== null);
}

/** Great-circle separation (deg) between two az/el directions. */
function angularSeparationDeg(a: Sample, b: Sample): number {
  const rad = Math.PI / 180;
  const ua = [
    Math.cos(a.el * rad) * Math.sin(a.az * rad),
    Math.cos(a.el * rad) * Math.cos(a.az * rad),
    Math.sin(a.el * rad),
  ];
  const ub = [
    Math.cos(b.el * rad) * Math.sin(b.az * rad),
    Math.cos(b.el * rad) * Math.cos(b.az * rad),
    Math.sin(b.el * rad),
  ];
  const dot = Math.min(1, Math.max(-1, ua[0] * ub[0] + ua[1] * ub[1] + ua[2] * ub[2]));
  return Math.acos(dot) / rad;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function stats(values: number[]) {
  const sorted = [...values].sort((x, y) => x - y);
  return {
    n: sorted.length,
    median: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1] ?? NaN,
  };
}

/** Find local maxima above minEl in a sample series. */
function findCulminations(samples: Sample[], minEl: number): Sample[] {
  const out: Sample[] = [];
  for (let i = 1; i < samples.length - 1; i++) {
    const s = samples[i];
    if (
      s.el > minEl &&
      s.el >= samples[i - 1].el &&
      s.el >= samples[i + 1].el
    ) {
      out.push(s);
    }
  }
  return out;
}

async function main() {
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  const tle: TleSet | undefined = (cache.tles ?? []).find(
    (t: TleSet) => t.noradId === "25544"
  );
  if (!tle) throw new Error("ISS (25544) not found in public/tle-cache.json — run pnpm cache:tle");

  const epochDate = tleEpochToDate(tle.epoch);
  if (!epochDate) throw new Error(`Unparseable TLE epoch: ${tle.epoch}`);
  const startMs = epochDate.getTime();
  const stopMs = startMs + WINDOW_HOURS * 3600_000;

  console.log(`ISS TLE epoch: ${epochDate.toISOString()}`);
  console.log(`Window: ${WINDOW_HOURS}h @ ${STEP_MINUTES}m steps | Site: ${SITE.label}`);
  console.log("Fetching JPL Horizons ephemeris…");

  const horizons = await fetchHorizons(startMs, stopMs);
  console.log(`Horizons samples: ${horizons.length}`);
  if (horizons.length < 100) throw new Error("Suspiciously few Horizons samples");

  // Compute ours on the identical grid
  const pairs: Array<{ h: Sample; ours: Sample }> = [];
  for (const h of horizons) {
    const look = computeAzEl(tle, new Date(h.t), SITE);
    if (!look) continue;
    pairs.push({
      h,
      ours: { t: h.t, az: look.azimuth, el: look.elevation, rangeKm: look.range },
    });
  }

  const angAll = pairs.map((p) => angularSeparationDeg(p.h, p.ours));
  const highPairs = pairs.filter((p) => p.h.el > 10 && p.ours.el > 10);
  const angHigh = highPairs.map((p) => angularSeparationDeg(p.h, p.ours));
  const rangeErrHigh = highPairs.map((p) => Math.abs(p.h.rangeKm - p.ours.rangeKm));

  // Culmination (pass-peak) timing comparison
  const hCulms = findCulminations(horizons, 10);
  const oursSeries = pairs.map((p) => p.ours);
  const oCulms = findCulminations(oursSeries, 10);
  const culmMatches = hCulms
    .map((hc) => {
      const oc = oCulms.reduce(
        (best, c) =>
          Math.abs(c.t - hc.t) < Math.abs((best?.t ?? Infinity) - hc.t) ? c : best,
        null as Sample | null
      );
      if (!oc || Math.abs(oc.t - hc.t) > 10 * 60000) return null;
      return {
        horizonsTcaUtc: new Date(hc.t).toISOString(),
        deltaTcaSec: (oc.t - hc.t) / 1000,
        horizonsPeakEl: hc.el,
        deltaPeakElDeg: oc.el - hc.el,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  // Error growth vs prediction horizon (hours since TLE epoch)
  const buckets = [0, 12, 24, 36, 48];
  const byHorizon = buckets.slice(0, -1).map((lo, i) => {
    const hi = buckets[i + 1];
    const subset = pairs.filter((p) => {
      const hours = (p.h.t - startMs) / 3600_000;
      return hours >= lo && hours < hi && p.h.el > 10 && p.ours.el > 10;
    });
    return {
      horizon: `${lo}-${hi}h`,
      ...stats(subset.map((p) => angularSeparationDeg(p.h, p.ours))),
    };
  });

  const results = {
    generatedAt: new Date().toISOString(),
    satellite: "ISS (25544)",
    tleEpoch: epochDate.toISOString(),
    tleSource: "AMSAT/r4uab mirror snapshot",
    reference: "JPL Horizons observer table (-125544), airless apparent az/el, 1-min steps",
    site: SITE,
    windowHours: WINDOW_HOURS,
    samples: pairs.length,
    angularErrorDeg: { allSky: stats(angAll), above10El: stats(angHigh) },
    rangeErrorKmAbove10El: stats(rangeErrHigh),
    culminations: {
      matched: culmMatches.length,
      horizonsTotal: hCulms.length,
      deltaTcaSec: stats(culmMatches.map((m) => Math.abs(m.deltaTcaSec))),
      deltaPeakElDeg: stats(culmMatches.map((m) => Math.abs(m.deltaPeakElDeg))),
      detail: culmMatches,
    },
    errorVsHorizon: byHorizon,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${OUT_FILE}\n`);

  // Markdown summary
  const f = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "—");
  console.log(`## Results (generated ${results.generatedAt})

| Metric | Median | 95th pct | Max | N |
|---|---|---|---|---|
| Angular error, all sky (deg) | ${f(results.angularErrorDeg.allSky.median)} | ${f(results.angularErrorDeg.allSky.p95)} | ${f(results.angularErrorDeg.allSky.max)} | ${results.angularErrorDeg.allSky.n} |
| Angular error, el>10° (deg) | ${f(results.angularErrorDeg.above10El.median)} | ${f(results.angularErrorDeg.above10El.p95)} | ${f(results.angularErrorDeg.above10El.max)} | ${results.angularErrorDeg.above10El.n} |
| Range error, el>10° (km) | ${f(results.rangeErrorKmAbove10El.median, 1)} | ${f(results.rangeErrorKmAbove10El.p95, 1)} | ${f(results.rangeErrorKmAbove10El.max, 1)} | ${results.rangeErrorKmAbove10El.n} |
| Pass-peak timing error (s) | ${f(results.culminations.deltaTcaSec.median, 1)} | ${f(results.culminations.deltaTcaSec.p95, 1)} | ${f(results.culminations.deltaTcaSec.max, 1)} | ${results.culminations.matched}/${results.culminations.horizonsTotal} passes |
| Pass-peak elevation error (deg) | ${f(results.culminations.deltaPeakElDeg.median, 2)} | ${f(results.culminations.deltaPeakElDeg.p95, 2)} | ${f(results.culminations.deltaPeakElDeg.max, 2)} | ${results.culminations.matched} |

### Error vs prediction horizon (el>10°, angular deg)

| Hours since TLE epoch | Median | 95th pct | Max | N |
|---|---|---|---|---|
${byHorizon.map((b) => `| ${b.horizon} | ${f(b.median)} | ${f(b.p95)} | ${f(b.max)} | ${b.n} |`).join("\n")}
`);
}

main().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
