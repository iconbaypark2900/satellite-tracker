/**
 * propagation-engine — the globe's render path, checked against SGP4.
 *
 * The app has two propagation paths. `pass-calculator` is validated against
 * JPL Horizons — see docs/VALIDATION.md for the current figure and its TLE epoch. This one — what the globe
 * actually draws — had no test at all, and was extrapolating linearly across a
 * 30-second window, putting the ISS 3.9 km from its true position.
 *
 * The oracle is `satellite.propagate()` itself: a direct SGP4 solve at the
 * instant being rendered is by definition what the globe should be drawing.
 */
import * as satellite from "satellite.js";
import fs from "node:fs";
import path from "node:path";
import { propagationEngine } from "@/lib/propagation-engine";

/** Bound from the spec: no worse than the Horizons-validated path. */
const BOUND_KM = 0.5;
/** The engine's own staleness window; extrapolation never runs longer. */
const WINDOW_S = 30;

function issTle() {
  const raw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "public/tle-cache.json"), "utf8")
  );
  const sats = Array.isArray(raw) ? raw : (raw.satellites ?? raw.tles ?? []);
  const iss = sats.find((s: { name?: string }) => /ISS/i.test(s.name ?? ""));
  if (!iss) throw new Error("no ISS TLE in public/tle-cache.json");
  return iss;
}

describe("propagationEngine.getPositionInto", () => {
  const iss = issTle();
  const rec = satellite.twoline2satrec(iss.line1, iss.line2);
  const t0 = new Date();

  beforeAll(() => {
    propagationEngine.init([
      { noradId: "25544", name: "ISS", line1: iss.line1, line2: iss.line2 },
    ]);
    propagationEngine.requestTick(t0.getTime());
  });

  /** Worst extrapolation error over a window, in km. */
  function worstError(sign: 1 | -1): { worst: number; at: number } {
    const out = { x: 0, y: 0, z: 0 };
    let worst = 0;
    let at = 0;
    for (let dt = 0; dt <= WINDOW_S; dt += 1) {
      const when = t0.getTime() + sign * dt * 1000;
      if (!propagationEngine.getPositionInto(0, when, out)) continue;
      const truth = satellite.propagate(rec, new Date(when)) as {
        position?: { x: number; y: number; z: number };
      };
      if (!truth?.position) continue;
      const { x, y, z } = truth.position;
      const err = Math.hypot(out.x - x, out.y - y, out.z - z);
      if (err > worst) {
        worst = err;
        at = sign * dt;
      }
    }
    return { worst, at };
  }

  it("stays within the error bound across the whole staleness window", () => {
    const { worst, at } = worstError(1);
    expect(worst).toBeLessThanOrEqual(BOUND_KM);
    // Guard against a vacuous pass: the sweep must have found something.
    expect(Math.abs(at)).toBeGreaterThan(0);
  });

  it("stays within the bound with time running backwards", () => {
    // The time slider allows it, and an extrapolator correct forwards can be
    // wrong in reverse.
    expect(worstError(-1).worst).toBeLessThanOrEqual(BOUND_KM);
  });

  it("beats linear dead-reckoning by a wide margin", () => {
    // The regression this test exists for. If someone reverts to p + v·dt,
    // this fails loudly rather than drifting back unnoticed.
    const out = { x: 0, y: 0, z: 0 };
    const dt = WINDOW_S;
    const when = t0.getTime() + dt * 1000;
    propagationEngine.getPositionInto(0, when, out);

    const seed = satellite.propagate(rec, t0) as {
      position: { x: number; y: number; z: number };
      velocity: { x: number; y: number; z: number };
    };
    const truth = satellite.propagate(rec, new Date(when)) as {
      position: { x: number; y: number; z: number };
    };
    const linear = Math.hypot(
      seed.position.x + seed.velocity.x * dt - truth.position.x,
      seed.position.y + seed.velocity.y * dt - truth.position.y,
      seed.position.z + seed.velocity.z * dt - truth.position.z
    );
    const actual = Math.hypot(
      out.x - truth.position.x,
      out.y - truth.position.y,
      out.z - truth.position.z
    );
    expect(actual).toBeLessThan(linear / 10);
  });

  it("returns false for an out-of-range index rather than throwing", () => {
    const out = { x: 0, y: 0, z: 0 };
    expect(propagationEngine.getPositionInto(999, t0.getTime(), out)).toBe(false);
  });

  it("writes into the caller's object rather than allocating", () => {
    // It runs per satellite per frame; allocating here is a GC problem at
    // ~400 objects and 60 fps.
    const out = { x: 1, y: 2, z: 3 };
    expect(propagationEngine.getPositionInto(0, t0.getTime(), out)).toBe(true);
    expect(out.x).not.toBe(1);
  });
});
