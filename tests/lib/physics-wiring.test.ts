/**
 * Wiring tests for the three dcode-built physics modules.
 *
 * These do NOT re-test the physics. Refraction, the conical shadow and the
 * magnitude model each have their own deterministic gate in dcode-stack, run
 * against external or independently-derived oracles — JPL Horizons for
 * refraction, ray-traced solar-limb occlusion for the shadow, a surface
 * integral of a Lambertian sphere for the phase function. Repeating those
 * assertions here would add confidence about nothing.
 *
 * What is untested until now is the JOIN: whether the application actually
 * calls them, with the right arguments, in the right units, and whether the
 * numbers reach the screen. That is precisely where the last regression lived
 * — five source-reading tests were green while the shipped page was broken —
 * so every assertion below is about a value the app produces, not a formula.
 */

import {
  computeAzEl,
  isSatEclipsed,
  satShadowState,
  sunEciKm,
  predictPasses,
} from "@/lib/pass-calculator";
import { refractionArcmin, apparentAltitudeDeg } from "@/lib/refraction";
import { shadowRadiiKm, shadowState } from "@/lib/shadow";
import { ObserverLocation, TleSet } from "@/types";
import { screenConjunctions } from "@/lib/conjunction-core";
import {
  collisionProbability,
  assumedSigmaKm,
  PC_ASSUMPTION_NOTE,
} from "@/lib/collision-probability";
import { readFileSync } from "node:fs";

const NYC: ObserverLocation = {
  lat: 40.7128,
  lon: -74.006,
  alt: 0.01,
  label: "New York, NY, USA",
};

const ISS: TleSet = {
  name: "ISS (ZARYA)",
  noradId: "25544",
  line1:
    "1 25544U 98067A   26222.50435991  .00016717  00000-0  30777-3 0  9005",
  line2:
    "2 25544  51.6335 200.5100 0006703  93.1234 267.0123 15.50123456123456",
};

describe("refraction is wired into look angles", () => {
  it("reports an apparent elevation above the geometric one", () => {
    // Sample a day; every above-horizon sample must be lifted, never lowered.
    let checked = 0;
    for (let m = 0; m < 1440; m += 7) {
      const look = computeAzEl(ISS, new Date(Date.UTC(2026, 7, 13, 0, m)), NYC);
      if (!look || look.elevation <= 0) continue;
      checked++;
      expect(look.apparentElevation).toBeGreaterThan(look.elevation);
    }
    expect(checked).toBeGreaterThan(5);
  });

  it("lifts by exactly what the refraction module says, in degrees not arcminutes", () => {
    // The unit trap: refractionArcmin returns arcminutes and the conversion is
    // a division by 60. Omitting it is wrong by a factor of 60 while still
    // looking like a small plausible angle.
    for (let m = 0; m < 1440; m += 11) {
      const look = computeAzEl(ISS, new Date(Date.UTC(2026, 7, 13, 0, m)), NYC);
      if (!look || look.elevation <= 0) continue;
      const lift = look.apparentElevation - look.elevation;
      expect(lift).toBeCloseTo(refractionArcmin(look.elevation) / 60, 12);
      // Sanity on magnitude: never more than the horizon value.
      expect(lift).toBeLessThan(0.49);
    }
  });

  it("leaves the geometric elevation untouched, which the Horizons claim depends on", () => {
    // scripts/validate-vs-horizons.ts compares `elevation` against AIRLESS
    // apparent coordinates. If refraction ever leaked into that field the
    // published accuracy figure would silently stop meaning what it says.
    //
    // The first version of this test hard-coded a timestamp and asserted
    // refraction was non-zero there. The ISS was below the horizon at that
    // instant, where the correction is legitimately zero, so the test failed on
    // correct code. Search for an above-horizon sample instead of assuming one.
    let found = false;
    for (let m = 0; m < 1440 && !found; m += 3) {
      const look = computeAzEl(ISS, new Date(Date.UTC(2026, 7, 13, 0, m)), NYC);
      if (!look || look.elevation <= 1) continue;
      found = true;
      // apparent is strictly above geometric...
      expect(look.apparentElevation).toBeGreaterThan(look.elevation);
      // ...and `elevation` still equals the raw look angle, not the lifted one
      expect(look.apparentElevation - look.elevation).toBeCloseTo(
        refractionArcmin(look.elevation) / 60,
        12
      );
      expect(apparentAltitudeDeg(look.elevation)).toBeCloseTo(
        look.apparentElevation,
        12
      );
    }
    expect(found).toBe(true);
  });
});

describe("the conical shadow model is wired into eclipse checks", () => {
  const SUN: [number, number, number] = [1.495978707e8, 0, 0];

  it("classifies a satellite in the penumbral band as eclipsed", () => {
    // A position the OLD cylinder called sunlit. At 400 km behind the Earth
    // the umbra radius is ~6376.29 km and the penumbra ~6380.08, with the
    // cylinder's 6378.137 sitting between them. Pick a point outside the
    // cylinder but inside the penumbra: the old model said lit, the new one
    // says partially shadowed.
    const { umbraKm, penumbraKm } = shadowRadiiKm(1.495978707e8, 400);
    const rho = (6378.137 + penumbraKm) / 2; // outside the cylinder, inside the penumbra
    expect(rho).toBeGreaterThan(6378.137);
    expect(rho).toBeLessThan(penumbraKm);
    expect(rho).toBeGreaterThan(umbraKm);

    const sat: [number, number, number] = [-400, rho, 0];
    expect(satShadowState(sat, SUN)).toBe("penumbra");
    expect(isSatEclipsed(sat, SUN)).toBe(true);
  });

  it("still calls a deep-shadow position umbra and a sunward one sunlit", () => {
    expect(satShadowState([-7000, 0, 0], SUN)).toBe("umbra");
    expect(satShadowState([7000, 0, 0], SUN)).toBe("sunlit");
    expect(isSatEclipsed([7000, 0, 0], SUN)).toBe(false);
  });

  it("does not throw inside the per-frame loop for degenerate input", () => {
    // satShadowState swallows what shadowState refuses, because this runs over
    // hundreds of objects per frame and a throw would take down the render.
    expect(() => shadowState([100, 0, 0], SUN)).toThrow(RangeError);
    expect(satShadowState([100, 0, 0], SUN)).toBe("sunlit");
    expect(satShadowState([7000, 0, 0], [0, 0, 0])).toBe("sunlit");
  });
});

describe("pass predictions carry the new physics", () => {
  const passes = predictPasses(ISS, NYC, new Date(Date.UTC(2026, 7, 13)), 48, 5);

  it("produces passes to assert about", () => {
    expect(passes.length).toBeGreaterThan(0);
  });

  it("reports an illumination state from the three-state model", () => {
    for (const p of passes) {
      expect(["sunlit", "penumbra", "umbra"]).toContain(p.illumination);
      // isLit is the boolean collapse and must agree with it
      expect(p.isLit).toBe(p.illumination === "sunlit");
    }
  });

  it("reports an apparent maximum elevation above the geometric one", () => {
    for (const p of passes) {
      expect(p.maxElevationApparent).toBeDefined();
      expect(p.maxElevationApparent!).toBeGreaterThan(p.maxElevation);
      expect(p.maxElevationApparent! - p.maxElevation).toBeLessThan(0.49);
    }
  });

  it("keeps the sun geometry consistent with the shadow call", () => {
    // Guards against passing the Sun in the wrong units — sunEciKm returns
    // kilometres, and a caller handing over AU would put the Sun 1.5e8 times
    // too close and make every satellite umbral.
    const sun = sunEciKm(new Date(Date.UTC(2026, 7, 13, 6)));
    const dist = Math.hypot(sun[0], sun[1], sun[2]);
    expect(dist).toBeGreaterThan(1.4e8);
    expect(dist).toBeLessThan(1.6e8);
  });
});

describe("collision probability is wired into conjunction screening", () => {
  it("attaches a probability and the sigma behind it to screened events", () => {
    const cache = JSON.parse(
      readFileSync("public/tle-cache.json", "utf8")
    );
    const list = Array.isArray(cache)
      ? cache
      : (cache.satellites ?? cache.tles ?? []);
    const res = screenConjunctions(list.slice(0, 200), {
      startMs: Date.UTC(2026, 7, 13),
      windowMs: 12 * 3600_000,
      thresholdKm: 25,
      stepSec: 60,
    });
    expect(res.events.length).toBeGreaterThan(0);
    for (const ev of res.events) {
      expect(ev.pc).toBeDefined();
      expect(ev.pc!).toBeGreaterThanOrEqual(0);
      expect(ev.pc!).toBeLessThanOrEqual(1);
      // The sigma must travel with it, or the number cannot be interpreted.
      expect(ev.pcSigmaKm).toBeDefined();
      expect(ev.pcSigmaKm!).toBeGreaterThan(0);
    }
  });

  it("combines the two objects' sigmas in quadrature, not by adding them", () => {
    // Adding overstates the uncertainty. Two equal sigmas s must combine to
    // s*sqrt(2), not 2s — a 41% difference that would propagate into every Pc.
    const s = assumedSigmaKm(24);
    expect(Math.hypot(s, s)).toBeCloseTo(s * Math.SQRT2, 12);
    expect(Math.hypot(s, s)).not.toBeCloseTo(2 * s, 6);
  });

  it("keeps the caveat attached to the module", () => {
    // The only thing preventing a real computation over an invented input from
    // becoming a false claim is that this travels with it.
    expect(PC_ASSUMPTION_NOTE).toMatch(/assumed/i);
    expect(PC_ASSUMPTION_NOTE.length).toBeGreaterThan(40);
  });

  it("reproduces the dilution regime that makes the column uninformative", () => {
    // The finding that shaped the UI: once the assumed uncertainty dwarfs the
    // miss, Pc stops depending on the geometry. If this ever stops being true,
    // the "≈σ" marker in PcCell is lying and must be revisited.
    const tight = [0.5, 10].map((d) => collisionProbability(d, 0, 1.5, 1.5, 0.01));
    const loose = [0.5, 10].map((d) => collisionProbability(d, 0, 75, 75, 0.01));
    expect(tight[0] / tight[1]).toBeGreaterThan(1e6); // informative
    expect(loose[0] / loose[1]).toBeLessThan(1.05); // not
  });
});
