import * as satellite from "satellite.js";
import {
  computeShellParams,
  shellsOverlap,
  buildEphemerisChunk,
  intervalMinDistance,
  refineTca,
  screenConjunctions,
} from "@/lib/conjunction-core";
import { buildSatrecs } from "@/lib/propagation-core";
import { propagateSatellite } from "@/lib/orbit-utils";
import { ISS, GOES_16, NOAA_19, FIXTURE_START } from "../fixtures/tles";
import { TleSet } from "@/types";

/** Clone a TLE with its RAAN shifted (line 2 cols 18-25) and a new
 *  catalog number. satellite.js ignores TLE checksums. */
function cloneWithRaanShift(tle: TleSet, deltaDeg: number, newNoradId: string): TleSet {
  const raan = parseFloat(tle.line2.substring(17, 25));
  const newRaan = (((raan + deltaDeg) % 360) + 360) % 360;
  const raanStr = newRaan.toFixed(4).padStart(8, " ");
  const id = newNoradId.padStart(5, " ");
  return {
    ...tle,
    noradId: newNoradId,
    name: `${tle.name}-CLONE`,
    line1: tle.line1.slice(0, 2) + id + tle.line1.slice(7),
    line2: tle.line2.slice(0, 2) + id + tle.line2.slice(7, 17) + raanStr + tle.line2.slice(25),
  };
}

const START_MS = FIXTURE_START.getTime();
const H24 = 24 * 3600_000;

function screen(tles: TleSet[], thresholdKm: number, windowMs = H24) {
  return screenConjunctions(tles, {
    startMs: START_MS,
    windowMs,
    thresholdKm,
    stepSec: 60,
  });
}

describe("shell prescreen", () => {
  const [issRec] = buildSatrecs([ISS]).satrecs;
  const [goesRec] = buildSatrecs([GOES_16]).satrecs;
  const [noaaRec] = buildSatrecs([NOAA_19]).satrecs;
  const issShell = computeShellParams(issRec!);
  const goesShell = computeShellParams(goesRec!);
  const noaaShell = computeShellParams(noaaRec!);

  it("rejects cross-regime and separated-shell pairs", () => {
    expect(shellsOverlap(issShell, goesShell, 25)).toBe(false);
    expect(shellsOverlap(noaaShell, goesShell, 25)).toBe(false);
    expect(shellsOverlap(issShell, noaaShell, 25)).toBe(false); // ~400km gap
  });

  it("accepts a same-shell pair", () => {
    const clone = cloneWithRaanShift(ISS, 0.5, "90000");
    const [cloneRec] = buildSatrecs([clone]).satrecs;
    expect(shellsOverlap(issShell, computeShellParams(cloneRec!), 25)).toBe(true);
  });

  it("end-to-end: mixed catalog with disjoint shells yields no events", () => {
    const result = screen([ISS, GOES_16, NOAA_19], 25);
    expect(result.events).toHaveLength(0);
  });
});

describe("ephemeris fast path", () => {
  it("matches propagateSatellite within Float32 resolution", () => {
    const { satrecs } = buildSatrecs([ISS]);
    const nSteps = 3;
    const stepMs = 60_000;
    const pos = new Float32Array(nSteps * 3);
    const vel = new Float32Array(nSteps * 3);
    const valid = new Uint8Array(nSteps);
    buildEphemerisChunk(satrecs, START_MS, stepMs, nSteps, pos, vel, valid);

    for (let k = 0; k < nSteps; k++) {
      expect(valid[k]).toBe(1);
      const ref = propagateSatellite(ISS, new Date(START_MS + k * stepMs));
      expect(ref.isValid).toBe(true);
      for (let c = 0; c < 3; c++) {
        expect(Math.abs(pos[k * 3 + c] - ref.position[c])).toBeLessThan(0.005);
      }
    }
  });
});

describe("intervalMinDistance", () => {
  it("catches a fast crossing whose endpoint samples are far apart", () => {
    // Sat0 at origin, stationary; sat1 210km away closing at 14 km/s.
    // Sampled distance ≈ 210km, but the true minimum inside ±30s is 5km.
    const pos = new Float32Array([0, 0, 0, -210, 5, 0]);
    const vel = new Float32Array([0, 0, 0, 14, 0, 0]);
    const dMin = intervalMinDistance(pos, vel, 0, 3, 30);
    expect(dMin).toBeCloseTo(5, 3);
  });

  it("clamps to the interval when the minimum lies outside it", () => {
    // Receding pair: minimum is at τ<0, outside a [0-centered] half-step of 1s
    const pos = new Float32Array([0, 0, 0, -100, 0, 0]);
    const vel = new Float32Array([0, 0, 0, -14, 0, 0]);
    const dMin = intervalMinDistance(pos, vel, 0, 3, 1);
    expect(dMin).toBeCloseTo(86, 0); // 100 - 14·1
  });
});

describe("screenConjunctions", () => {
  it("detects same-shell close approaches and is deterministic", () => {
    const clone = cloneWithRaanShift(ISS, 0.05, "90001");
    const a = screen([ISS, clone], 10);
    const b = screen([ISS, clone], 10);

    expect(a.events.length).toBeGreaterThanOrEqual(1);
    for (const ev of a.events) {
      expect(ev.missKm).toBeLessThanOrEqual(10);
      expect(ev.tcaMs).toBeGreaterThanOrEqual(START_MS);
      expect(ev.tcaMs).toBeLessThanOrEqual(START_MS + H24);
      expect(ev.relSpeedKmS).toBeGreaterThanOrEqual(0);
      expect(ev.relSpeedKmS).toBeLessThan(16);
    }
    expect(a.events).toEqual(b.events);
  });

  it("ignores duplicate catalog entries (same noradId)", () => {
    const dup = { ...ISS, name: "ISS-B" };
    const result = screen([ISS, dup], 25);
    expect(result.events).toHaveLength(0);
  });

  it("is monotonic in threshold", () => {
    // 0.15° RAAN shift → separation oscillates ≈11-18km: events at 25km,
    // none at 10 or 5.
    const clone = cloneWithRaanShift(ISS, 0.15, "90002");
    const at25 = screen([ISS, clone], 25).events.length;
    const at10 = screen([ISS, clone], 10).events.length;
    const at5 = screen([ISS, clone], 5).events.length;
    expect(at25).toBeGreaterThanOrEqual(at10);
    expect(at10).toBeGreaterThanOrEqual(at5);
    expect(at25).toBeGreaterThan(0);
    expect(at5).toBe(0);
  });
});

describe("refineTca", () => {
  it("converges to the brute-force minimum within 0.1s", () => {
    // Find a coarse local minimum of ISS↔NOAA-19 distance, then refine
    const { satrecs } = buildSatrecs([ISS, NOAA_19]);
    const [recA, recB] = satrecs;

    const dist = (tMs: number) => {
      const a = satellite.sgp4(recA!, (tMs / 86400000 + 2440587.5 - recA!.jdsatepoch) * 1440);
      const b = satellite.sgp4(recB!, (tMs / 86400000 + 2440587.5 - recB!.jdsatepoch) * 1440);
      const pa = a!.position as { x: number; y: number; z: number };
      const pb = b!.position as { x: number; y: number; z: number };
      return Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
    };

    // Coarse scan (60s) over 3h for a local minimum
    let bestT = START_MS;
    let bestD = Infinity;
    for (let t = START_MS; t < START_MS + 3 * 3600_000; t += 60_000) {
      const d = dist(t);
      if (d < bestD) {
        bestD = d;
        bestT = t;
      }
    }

    // Brute-force at 1s resolution around it
    let trueT = bestT;
    let trueD = Infinity;
    for (let t = bestT - 60_000; t <= bestT + 60_000; t += 1000) {
      const d = dist(t);
      if (d < trueD) {
        trueD = d;
        trueT = t;
      }
    }

    const refined = refineTca(recA!, recB!, bestT - 60_000, bestT + 60_000);
    expect(refined).not.toBeNull();
    expect(Math.abs(refined!.tcaMs - trueT)).toBeLessThanOrEqual(1100);
    expect(Math.abs(refined!.missKm - trueD)).toBeLessThan(0.05);
  });
});
