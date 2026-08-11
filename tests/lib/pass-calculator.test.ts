/**
 * Deterministic tests for the pass calculator, pinned to fixture TLE epochs.
 */

import {
  computeAzEl,
  predictPasses,
  isSatEclipsed,
  sunAzEl,
} from "@/lib/pass-calculator";
import { ISS, GOES_16, NOAA_19, NYC, TOKYO, FIXTURE_START } from "../fixtures/tles";

describe("computeAzEl", () => {
  it("returns azimuth in [0, 360) and elevation in [-90, 90] across 24h", () => {
    for (let h = 0; h < 24; h += 0.25) {
      const date = new Date(FIXTURE_START.getTime() + h * 3600_000);
      const azEl = computeAzEl(ISS, date, NYC);
      expect(azEl).not.toBeNull();
      expect(azEl!.azimuth).toBeGreaterThanOrEqual(0);
      expect(azEl!.azimuth).toBeLessThan(360);
      expect(azEl!.elevation).toBeGreaterThanOrEqual(-90);
      expect(azEl!.elevation).toBeLessThanOrEqual(90);
      expect(azEl!.range).toBeGreaterThan(0);
    }
  });
});

describe("predictPasses — ISS over NYC", () => {
  const passes = predictPasses(ISS, NYC, FIXTURE_START, 24);

  it("finds a plausible number of passes (2-9 above 10° in 24h)", () => {
    expect(passes.length).toBeGreaterThanOrEqual(2);
    expect(passes.length).toBeLessThanOrEqual(9);
  });

  it("every reported pass culminates at or above the minimum elevation", () => {
    for (const p of passes) {
      expect(p.maxElevation).toBeGreaterThanOrEqual(10);
      expect(p.maxElevation).toBeLessThanOrEqual(90);
    }
  });

  it("orders start < max < end within each pass, and passes chronologically", () => {
    for (const p of passes) {
      expect(p.startTime.getTime()).toBeLessThan(p.maxTime.getTime());
      expect(p.maxTime.getTime()).toBeLessThan(p.endTime.getTime());
    }
    for (let i = 1; i < passes.length; i++) {
      expect(passes[i].startTime.getTime()).toBeGreaterThanOrEqual(
        passes[i - 1].endTime.getTime()
      );
    }
  });

  it("has LEO-plausible durations (1-20 min horizon to horizon)", () => {
    for (const p of passes) {
      const minutes = (p.endTime.getTime() - p.startTime.getTime()) / 60000;
      expect(minutes).toBeGreaterThanOrEqual(1);
      expect(minutes).toBeLessThanOrEqual(20);
    }
  });

  it("refines rise/set to the horizon (|elevation| < 0.5°)", () => {
    for (const p of passes) {
      expect(Math.abs(computeAzEl(ISS, p.startTime, NYC)!.elevation)).toBeLessThan(0.5);
      expect(Math.abs(computeAzEl(ISS, p.endTime, NYC)!.elevation)).toBeLessThan(0.5);
    }
  });

  it("start and end azimuths differ (satellite crosses the sky)", () => {
    for (const p of passes) {
      const diff = Math.abs(p.startAz - p.endAz);
      expect(Math.min(diff, 360 - diff)).toBeGreaterThan(5);
    }
  });

  it("slant range at culmination is 400-2400 km and closer than at rise", () => {
    for (const p of passes) {
      const atMax = computeAzEl(ISS, p.maxTime, NYC)!;
      const atRise = computeAzEl(ISS, p.startTime, NYC)!;
      expect(atMax.range).toBeGreaterThan(400);
      expect(atMax.range).toBeLessThan(2400);
      expect(atMax.range).toBeLessThan(atRise.range);
    }
  });
});

describe("predictPasses — geostationary handling", () => {
  it("GOES-16 from NYC: exactly one always-visible pass", () => {
    const passes = predictPasses(GOES_16, NYC, FIXTURE_START, 24);
    expect(passes.length).toBe(1);
    expect(passes[0].neverSets).toBe(true);
  });

  it("GOES-16 from Tokyo: zero passes", () => {
    const passes = predictPasses(GOES_16, TOKYO, FIXTURE_START, 24);
    expect(passes.length).toBe(0);
  });
});

describe("predictPasses — polar orbiter", () => {
  it("NOAA-19 gets passes from both NYC and Tokyo", () => {
    expect(predictPasses(NOAA_19, NYC, FIXTURE_START, 24).length).toBeGreaterThan(0);
    expect(predictPasses(NOAA_19, TOKYO, FIXTURE_START, 24).length).toBeGreaterThan(0);
  });
});

describe("isSatEclipsed", () => {
  const sun: [number, number, number] = [149_597_870, 0, 0];

  it("a satellite on the sun side is lit", () => {
    expect(isSatEclipsed([7000, 0, 0], sun)).toBe(false);
  });

  it("a satellite directly anti-sun inside the shadow cylinder is eclipsed", () => {
    expect(isSatEclipsed([-7000, 0, 0], sun)).toBe(true);
  });

  it("a satellite anti-sun but outside the cylinder is lit", () => {
    expect(isSatEclipsed([-7000, 42_000, 0], sun)).toBe(false);
  });
});

describe("sunAzEl", () => {
  it("noon sun is high over NYC, midnight sun is below the horizon", () => {
    // FIXTURE_START is 12:00 UTC = 08:00 EDT; local solar noon ≈ 17:00 UTC
    const noon = sunAzEl(new Date("2026-08-10T17:00:00Z"), NYC);
    const midnight = sunAzEl(new Date("2026-08-10T05:00:00Z"), NYC);
    expect(noon.elevation).toBeGreaterThan(45);
    expect(midnight.elevation).toBeLessThan(-10);
  });
});
