import { classifySatellite } from "@/lib/classify-satellite";
import { GROUP_COLORS, GROUP_LABELS, GROUP_ORDER } from "@/lib/constants";

describe("classifySatellite", () => {
  it.each([
    ["ISS", "STATIONS"],
    ["CSS (TIANHE-1)", "STATIONS"],
    ["STARLINK-30001", "STARLINK"],
    ["ONEWEB-2001", "ONEWEB"],
    ["GPS IIR-10 (USA-183)", "NAVIGATION"],
    ["TRANSIT 5B-5", "NAVIGATION"],
    ["NOAA-19", "WEATHER"],
    ["METOP-B", "WEATHER"],
    ["EWS-G2 (GOES-15)", "WEATHER"],
    ["INMARSAT 4-F1", "COMMS"],
    ["SITRO-AIS-25", "COMMS"],
    ["MERIDIAN-9", "COMMS"],
    ["ZORKIY-2M 4", "EARTH-OBS"],
    ["JILIN-01 GAOFEN 2F", "EARTH-OBS"],
    ["CZ-4B R/B", "DEBRIS"],
    ["CSTP-4.1", "RESEARCH"],
    ["ZACUBE-1", "RESEARCH"],
  ] as const)("files %s under %s", (name, group) => {
    expect(classifySatellite(name)).toBe(group);
  });

  describe("amateur radio", () => {
    it.each(["AO-07", "FO-29", "QO-100", "CO-128"])(
      "recognises the OSCAR designator %s",
      (name) => expect(classifySatellite(name)).toBe("AMATEUR")
    );

    it.each(["RS-44", "UmKA 1 (RS40S)", "GEOSCAN-6 (RS92S6)", "AIST-2 (RS-43)"])(
      "recognises the RS designator in %s",
      (name) => expect(classifySatellite(name)).toBe("AMATEUR")
    );

    it("prefers an amateur designator over an opaque serial", () => {
      // The serial alone says nothing; the RS suffix says what can be heard.
      expect(classifySatellite("COSMOS-2499 (RS-47) [i]")).toBe("AMATEUR");
      expect(classifySatellite("COSMOS 2504 [i]")).toBe("OTHER");
    });

    it("does not mistake a mission name for a designator", () => {
      // "Suomi 100" is a Finnish cubesat, not the Suomi NPP weather satellite.
      expect(classifySatellite("Suomi 100")).toBe("RESEARCH");
      expect(classifySatellite("GOMX-1")).toBe("RESEARCH");
    });
  });

  it("falls back to RESEARCH, never to an empty string", () => {
    expect(classifySatellite("")).toBe("RESEARCH");
    expect(classifySatellite("SOMETHING ENTIRELY NEW")).toBe("RESEARCH");
  });

  it("only returns groups the UI can render", () => {
    const names = [
      "ISS", "STARLINK-1", "ONEWEB-1", "NAVSTAR 81", "METEOR M2-4",
      "INTELSAT 902", "SENTINEL-3A", "AO-91", "KNACKSAT-2", "CZ-4B R/B",
      "COSMOS-2407 [+]",
    ];
    names.forEach((name) => {
      const group = classifySatellite(name);
      expect(GROUP_ORDER).toContain(group);
      expect(GROUP_LABELS[group]).toBeTruthy();
      expect(GROUP_COLORS[group]).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });
});
