import { missionProfile, orbitInsight } from "@/lib/mission-profiles";
import { classifySatellite } from "@/lib/classify-satellite";
import { Satellite, SatelliteGroup } from "@/types";

const ref = (name: string, noradId = "1") => ({
  noradId,
  name,
  group: classifySatellite(name) as SatelliteGroup,
});

describe("missionProfile", () => {
  it("prefers a curated object entry over its family", () => {
    const p = missionProfile(ref("ISS", "25544"));
    expect(p.tier).toBe("object");
    expect(p.purpose).toMatch(/International Space Station/);
  });

  it.each([
    ["NOAA-19", /AVHRR|APT/],
    ["METOP-B", /EUMETSAT/],
    ["METEOR M2-4", /LRPT/],
    ["SITRO-AIS-25", /AIS/],
    ["MERIDIAN-9", /Molniya/],
    ["TEVEL2-3", /students/],
    ["TRANSIT 5B-5", /Doppler/],
  ])("recognises the %s family", (name, pattern) => {
    const p = missionProfile(ref(name));
    expect(p.tier).toBe("family");
    expect(p.purpose).toMatch(pattern);
  });

  it("supplies an operator that SATCAT would otherwise have to provide", () => {
    expect(missionProfile(ref("NOAA-15")).operator).toBe("NOAA");
    expect(missionProfile(ref("SITRO-AIS-44")).operator).toBe("Sputnix");
  });

  it("falls back to class text for an unknown object, and says so", () => {
    // CSTP is deliberately not in the family table — its mission is not known,
    // and inventing one would be worse than saying less.
    const p = missionProfile(ref("CSTP-4.1"));
    expect(p.tier).toBe("class");
    expect(p.purpose).toMatch(/research or technology-demonstration/i);
  });

  it("always returns a non-empty purpose for every category", () => {
    const groups: SatelliteGroup[] = [
      "STATIONS", "STARLINK", "ONEWEB", "NAVIGATION", "WEATHER", "COMMS",
      "EARTH-OBS", "AMATEUR", "RESEARCH", "DEBRIS", "OTHER",
    ];
    groups.forEach((group) => {
      const p = missionProfile({ noradId: "0", name: "ZZZ-UNKNOWN", group });
      expect(p.purpose.length).toBeGreaterThan(20);
    });
  });

  it("never claims object-tier specificity it does not have", () => {
    // Anything not in the curated table must not be reported as "object".
    ["NOAA-19", "CSTP-4.1", "AO-07", "SOMETHING NEW"].forEach((name) => {
      expect(missionProfile(ref(name)).tier).not.toBe("object");
    });
  });
});

describe("orbitInsight", () => {
  const sat = (o: Partial<Satellite>): Satellite =>
    ({
      noradId: "1", name: "X", tle: null, group: "OTHER", type: "", period: 95,
      inclination: 51, raan: 0, apogee: 420, perigee: 410, altitude: 415,
      color: "#fff", ...o,
    }) as Satellite;

  it("identifies geostationary", () => {
    const i = orbitInsight(sat({ period: 1436, inclination: 0.4, apogee: 35800, perigee: 35780, altitude: 35790 }));
    expect(i?.label).toBe("Geostationary");
  });

  it("identifies a Molniya orbit by its eccentricity and inclination", () => {
    const i = orbitInsight(sat({ period: 718, inclination: 63.4, apogee: 39000, perigee: 1000, altitude: 20000 }));
    expect(i?.label).toBe("Molniya orbit");
  });

  it("identifies sun-synchronous", () => {
    const i = orbitInsight(sat({ period: 101, inclination: 98.9, apogee: 864, perigee: 845, altitude: 855 }));
    expect(i?.label).toBe("Sun-synchronous");
    expect(i?.text).toMatch(/local solar time/);
  });

  it("reports revolutions per day for a general LEO", () => {
    const i = orbitInsight(sat({ period: 96, inclination: 51.6, altitude: 426 }));
    expect(i?.label).toBe("Low Earth orbit");
    expect(i?.text).toMatch(/about 15\.0 revolutions/);
  });

  it("keeps the half revolution rather than rounding it away", () => {
    // The ISS does ~15.5/day; reporting 16 loses the reason its ground
    // track walks west between passes.
    const i = orbitInsight(sat({ period: 92.9, inclination: 51.6, altitude: 426 }));
    expect(i?.text).toMatch(/about 15\.5 revolutions/);
  });
});
