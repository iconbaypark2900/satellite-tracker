import { parseTleText } from "@/lib/tle-client";
import { ISS, NOAA_19 } from "../fixtures/tles";

describe("parseTleText", () => {
  it("parses named 3-line TLE blocks", () => {
    const raw = [ISS.name, ISS.line1, ISS.line2, NOAA_19.name, NOAA_19.line1, NOAA_19.line2].join("\n");
    const tles = parseTleText(raw, "OTHER");
    expect(tles).toHaveLength(2);
    expect(tles[0]).toMatchObject({
      name: "ISS",
      noradId: "25544",
      epoch: "26222.18186727",
    });
    expect(tles[1].noradId).toBe("33591");
  });

  it("skips orphaned line1 without a following line2", () => {
    const raw = [ISS.name, ISS.line1, "garbage", NOAA_19.name, NOAA_19.line1, NOAA_19.line2].join("\n");
    const tles = parseTleText(raw, "OTHER");
    expect(tles).toHaveLength(1);
    expect(tles[0].noradId).toBe("33591");
  });

  it("returns empty array for empty input", () => {
    expect(parseTleText("", "OTHER")).toHaveLength(0);
  });
});
