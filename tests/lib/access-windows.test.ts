import { computeAccessWindows } from "@/lib/access-windows";
import { accessEventsToIcs } from "@/lib/ics-export";
import { predictPasses } from "@/lib/pass-calculator";
import { ISS, NYC, FIXTURE_START } from "../fixtures/tles";
import { GroundStation, Satellite } from "@/types";

const NYC_STATION: GroundStation = {
  id: "nyc",
  name: "NYC Station",
  lat: NYC.lat,
  lon: NYC.lon,
  alt: NYC.alt,
  minElevation: 10,
};

const TOKYO_STATION: GroundStation = {
  id: "tokyo",
  name: "Tokyo Station",
  lat: 35.6895,
  lon: 139.6917,
  alt: 0.04,
  minElevation: 20,
};

const ISS_SAT = {
  noradId: ISS.noradId,
  name: ISS.name,
  tle: ISS,
  group: "STATIONS",
} as unknown as Satellite;

describe("computeAccessWindows", () => {
  it("matches predictPasses output per station", () => {
    const events = computeAccessWindows([ISS_SAT], [NYC_STATION], FIXTURE_START, 24);
    const direct = predictPasses(ISS, NYC, FIXTURE_START, 24, 10);
    expect(events.length).toBe(direct.length);
    expect(events.map((e) => e.pass.startTime.getTime())).toEqual(
      direct.map((p) => p.startTime.getTime())
    );
    for (const ev of events) {
      expect(ev.stationId).toBe("nyc");
      expect(ev.noradId).toBe("25544");
    }
  });

  it("applies per-station minimum elevation", () => {
    const strict = { ...NYC_STATION, id: "strict", minElevation: 40 };
    const loose = computeAccessWindows([ISS_SAT], [NYC_STATION], FIXTURE_START, 24);
    const tight = computeAccessWindows([ISS_SAT], [strict], FIXTURE_START, 24);
    expect(tight.length).toBeLessThanOrEqual(loose.length);
  });

  it("sorts events chronologically across stations", () => {
    const events = computeAccessWindows(
      [ISS_SAT],
      [NYC_STATION, TOKYO_STATION],
      FIXTURE_START,
      24
    );
    for (let i = 1; i < events.length; i++) {
      expect(events[i].pass.startTime.getTime()).toBeGreaterThanOrEqual(
        events[i - 1].pass.startTime.getTime()
      );
    }
    const stationIds = new Set(events.map((e) => e.stationId));
    expect(stationIds.size).toBe(2);
  });
});

describe("accessEventsToIcs", () => {
  it("produces a structurally valid VCALENDAR", () => {
    const events = computeAccessWindows([ISS_SAT], [NYC_STATION], FIXTURE_START, 24);
    expect(events.length).toBeGreaterThan(0);
    const ics = accessEventsToIcs(events);

    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(events.length);
    expect((ics.match(/END:VEVENT/g) ?? []).length).toBe(events.length);
    expect((ics.match(/UID:/g) ?? []).length).toBe(events.length);
    // UTC basic-format timestamps
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    // Commas in text values must be escaped
    const summaryLines = ics.split("\r\n").filter((l) => l.startsWith("SUMMARY:"));
    for (const line of summaryLines) {
      expect(line).not.toMatch(/[^\\],/);
    }
  });

  it("escapes special characters in names", () => {
    const events = computeAccessWindows(
      [ISS_SAT],
      [{ ...NYC_STATION, name: "Base; Alpha, NY" }],
      FIXTURE_START,
      24
    );
    const ics = accessEventsToIcs(events);
    expect(ics).toContain("Base\\; Alpha\\, NY");
  });
});
