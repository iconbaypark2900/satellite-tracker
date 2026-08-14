import { useSatelliteStore } from "@/lib/satellite-store";
import { GROUP_ORDER } from "@/lib/constants";
import { Satellite, SatelliteGroup } from "@/types";

function sat(noradId: string, group: SatelliteGroup): Satellite {
  return {
    noradId,
    name: `SAT-${noradId}`,
    tle: null,
    group,
    type: "Research",
    operator: { name: "Unknown", country: "Unknown" },
    period: 95,
    inclination: 51,
    raan: 0,
    apogee: 420,
    perigee: 410,
    altitude: 415,
    color: "#FFFFFF",
  };
}

describe("constellation filters", () => {
  beforeEach(() => {
    useSatelliteStore.setState({
      satellites: new Map(),
      constellationFilters: Object.fromEntries(GROUP_ORDER.map((g) => [g, true])),
    });
  });

  it("starts with every renderable category toggleable", () => {
    const filters = useSatelliteStore.getState().constellationFilters;
    // toggleConstellation is a no-op for keys the filter map doesn't know, so
    // a category missing here would be permanently stuck on.
    GROUP_ORDER.forEach((g) => expect(filters[g]).toBe(true));
  });

  it("hides only the toggled category", () => {
    const store = useSatelliteStore.getState();
    store.setSatellites([sat("1", "AMATEUR"), sat("2", "WEATHER"), sat("3", "AMATEUR")]);
    useSatelliteStore.getState().toggleConstellation("AMATEUR", false);

    const visible = useSatelliteStore.getState().getVisibleSatellites();
    expect(visible.map((s) => s.noradId)).toEqual(["2"]);
  });

  it("keeps hidden satellites in the catalogue so their count survives", () => {
    // The filter panel counts from `satellites`, not from the visible subset:
    // counting after filtering would show a hidden category as 0, drop it out
    // of the "non-empty" list, and leave no control to switch it back on.
    const store = useSatelliteStore.getState();
    store.setSatellites([sat("1", "AMATEUR"), sat("2", "WEATHER")]);
    useSatelliteStore.getState().toggleConstellation("AMATEUR", false);

    const all = [...useSatelliteStore.getState().satellites.values()];
    expect(all.filter((s) => s.group === "AMATEUR")).toHaveLength(1);
  });
});
