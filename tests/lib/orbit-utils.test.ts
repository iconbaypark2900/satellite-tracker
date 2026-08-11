import {
  propagateSatellite,
  eciToGeodetic,
  parseIntlDesignator,
  computeOrbitalParams,
  tleEpochToDate,
} from "@/lib/orbit-utils";
import { ISS, GOES_16, FIXTURE_START } from "../fixtures/tles";

describe("propagateSatellite + eciToGeodetic", () => {
  it("puts the ISS at a LEO altitude (350-460 km)", () => {
    const result = propagateSatellite(ISS, FIXTURE_START);
    expect(result.isValid).toBe(true);
    const geo = eciToGeodetic(result.position, FIXTURE_START);
    expect(geo.altitude).toBeGreaterThan(350);
    expect(geo.altitude).toBeLessThan(460);
    expect(Math.abs(geo.latitude)).toBeLessThanOrEqual(52);
  });

  it("puts GOES-16 at geostationary altitude (~35786 km)", () => {
    const result = propagateSatellite(GOES_16, FIXTURE_START);
    expect(result.isValid).toBe(true);
    const geo = eciToGeodetic(result.position, FIXTURE_START);
    expect(geo.altitude).toBeGreaterThan(35_000);
    expect(geo.altitude).toBeLessThan(36_500);
  });

  it("returns isValid: false for garbage TLE lines", () => {
    const bad = { ...ISS, line1: "1 garbage", line2: "2 garbage" };
    expect(propagateSatellite(bad, FIXTURE_START).isValid).toBe(false);
  });
});

describe("parseIntlDesignator", () => {
  it("parses the ISS designator", () => {
    expect(parseIntlDesignator(ISS.line1)).toEqual({
      intlDesignator: "1998-067A",
      launchYear: 1998,
    });
  });

  it("handles Sputnik-era years as 19xx", () => {
    const line1 = "1 00005U 58002B   26222.00000000  .00000000  00000-0  00000-0 0  9995";
    expect(parseIntlDesignator(line1)).toEqual({
      intlDesignator: "1958-002B",
      launchYear: 1958,
    });
  });

  it("returns null for malformed input", () => {
    expect(parseIntlDesignator("")).toBeNull();
    expect(parseIntlDesignator("1 25544U")).toBeNull();
    expect(parseIntlDesignator("1 25544U XXXXXXX 26222")).toBeNull();
  });
});

describe("computeOrbitalParams", () => {
  it("derives ISS period and inclination from the TLE", () => {
    const params = computeOrbitalParams(ISS);
    expect(params.period).toBeGreaterThan(90);
    expect(params.period).toBeLessThan(95);
    expect(params.inclination).toBeCloseTo(51.63, 1);
    expect(params.altitude).toBeGreaterThan(350);
    expect(params.altitude).toBeLessThan(460);
  });
});

describe("tleEpochToDate", () => {
  it("parses the ISS fixture epoch", () => {
    const d = tleEpochToDate("26222.18186727");
    expect(d).not.toBeNull();
    expect(d!.toISOString().startsWith("2026-08-10T04:21")).toBe(true);
  });

  it("treats years >= 57 as 19xx", () => {
    const d = tleEpochToDate("58001.00000000");
    expect(d!.getUTCFullYear()).toBe(1958);
    expect(d!.getUTCMonth()).toBe(0);
    expect(d!.getUTCDate()).toBe(1);
  });

  it("returns null for malformed input", () => {
    expect(tleEpochToDate("")).toBeNull();
    expect(tleEpochToDate("garbage")).toBeNull();
    expect(tleEpochToDate("26999.5")).toBeNull();
  });
});
