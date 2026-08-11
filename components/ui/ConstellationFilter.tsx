/**
 * ConstellationFilter.tsx — Toggle visibility for each satellite
 * constellation group (ISS, Starlink, GPS, GOES, etc.).
 *
 * Shows a count of visible satellites per group and a master "All" toggle.
 * In compact mode, the layout is tighter for use inside the sidebar strip.
 */

"use client";

import { useSatelliteStore } from "@/lib/satellite-store";
import { SatelliteGroup } from "@/types";
import { GROUP_LABELS, GROUP_COLORS } from "@/lib/constants";

const ALL_GROUPS: SatelliteGroup[] = [
  "STATIONS", "STARLINK", "ONEWEB", "GPS-OPS", "GOES", "SES", "INTREPID", "OTHER",
];

interface Props {
  /** When true, renders a tighter layout suitable for sidebar strips. */
  compact?: boolean;
}

export default function ConstellationFilter({ compact = false }: Props) {
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

  const allVisible = ALL_GROUPS.every((g) => isGroupVisible(g));

  return (
    <div className="dp">
      {!compact && (
        <h2 className="text-primary mb-1 text-xs font-semibold">
          Constellations
        </h2>
      )}

      <div className={`flex gap-1 ${compact ? "mb-1" : "mb-2"}`}>
        <button
          className="sb"
          style={{
            fontSize: "0.62rem",
            padding: "0.15rem 0.4rem",
            flex: 1,
          }}
          onClick={() => toggleAll(true)}
        >
          All
        </button>
        <button
          className="sb"
          style={{
            fontSize: "0.62rem",
            padding: "0.15rem 0.4rem",
            flex: 1,
          }}
          onClick={() => toggleAll(false)}
        >
          None
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-1 gap-y-0.5">
        {ALL_GROUPS.map((group) => {
          const visible = isGroupVisible(group);
          const count = getGroupCount(group);
          const color = GROUP_COLORS[group];
          const label = GROUP_LABELS[group];

          return (
            <div
              key={group}
              className="si"
              style={{
                justifyContent: "space-between",
                opacity: visible ? 1 : 0.4,
                fontSize: compact ? "0.6rem" : "0.65rem",
                padding: compact ? "0.15rem 0.2rem" : "0.2rem 0.2rem",
              }}
              onClick={() => toggleConstellation(group, !visible)}
            >
              <span className="flex items-center gap-1">
                <span
                  className="dot"
                  style={{
                    background: color,
                    boxShadow: `0 0 6px ${color}`,
                    width: compact ? "5px" : "6px",
                    height: compact ? "5px" : "6px",
                  }}
                />
                <span>{label}</span>
              </span>
              <span style={{ color: "#6f6d69", fontSize: "0.6rem" }}>{count}</span>
            </div>
          );
        })}
      </div>

      {!compact && (
        <div style={{ fontSize: "0.62rem", color: "#6f6d69", marginTop: "0.3rem" }}>
          {allVisible ? "All constellations visible" : "Some constellations hidden"}
        </div>
      )}
    </div>
  );
}
