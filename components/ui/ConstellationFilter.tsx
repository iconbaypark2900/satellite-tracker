/**
 * ConstellationFilter.tsx — Toggle visibility for each satellite
 * constellation group (ISS, Starlink, GPS, GOES, etc.).
 *
 * Shows a count of visible satellites per group and a master "All" toggle.
 */

"use client";

import { useSatelliteStore } from "@/lib/satellite-store";
import { SatelliteGroup } from "@/types";
import { GROUP_LABELS, GROUP_COLORS } from "@/lib/constants";

const ALL_GROUPS: SatelliteGroup[] = [
  "STATIONS", "STARLINK", "ONEWEB", "GPS-OPS", "GOES", "SES", "INTREPID", "OTHER",
];

export default function ConstellationFilter() {
  const { constellationFilters, toggleConstellation, setConstellationFilters, getVisibleSatellites } = useSatelliteStore();
  const allSatellites = getVisibleSatellites();

  const getGroupCount = (group: SatelliteGroup) => {
    return allSatellites.filter((s) => (s.group as SatelliteGroup) === group).length;
  };

  const isGroupVisible = (group: SatelliteGroup) => constellationFilters[group] !== false;

  const toggleAll = (show: boolean) => {
    const filters: Record<string, boolean> = {};
    ALL_GROUPS.forEach((g) => { filters[g] = show; });
    setConstellationFilters(filters);
  };

  return (
    <div className="dp">
      <h2 style={{ marginBottom: "0.3rem" }}>Constellations</h2>

      <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.5rem" }}>
        <button
          className="sb"
          style={{ fontSize: "0.65rem", padding: "0.2rem 0.5rem", flex: 1 }}
          onClick={() => toggleAll(true)}
        >
          All
        </button>
        <button
          className="sb"
          style={{ fontSize: "0.65rem", padding: "0.2rem 0.5rem", flex: 1 }}
          onClick={() => toggleAll(false)}
        >
          None
        </button>
      </div>

      {ALL_GROUPS.map((group) => {
        const visible = isGroupVisible(group);
        const count = getGroupCount(group);
        const color = GROUP_COLORS[group];

        return (
          <div
            key={group}
            className="si"
            style={{
              justifyContent: "space-between",
              opacity: visible ? 1 : 0.4,
            }}
            onClick={() => toggleConstellation(group, !visible)}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span
                className="dot"
                style={{ background: color, boxShadow: `0 0 6px ${color}` }}
              />
              {GROUP_LABELS[group]}
            </span>
            <span style={{ fontSize: "0.65rem", color: "#6f6d69" }}>{count}</span>
          </div>
        );
      })}
    </div>
  );
}
