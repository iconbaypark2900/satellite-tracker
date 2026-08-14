/**
 * ConstellationFilter.tsx — Toggle visibility for each mission category
 * (stations, weather, amateur radio, research, …).
 *
 * Only categories with satellites in the current catalogue are listed: which
 * ones are populated depends on whether the data came from Celestrak or the
 * amateur mirrors, and a permanently-empty row is a dead control taking up
 * sidebar height.
 *
 * Shows a per-category count and a master "All" toggle. In compact mode, the
 * layout is tighter for use inside the sidebar strip.
 */

"use client";

import { useMemo } from "react";
import { useSatelliteStore } from "@/lib/satellite-store";
import { SatelliteGroup } from "@/types";
import { GROUP_LABELS, GROUP_COLORS, GROUP_ORDER } from "@/lib/constants";

interface Props {
  /** When true, renders a tighter layout suitable for sidebar strips. */
  compact?: boolean;
}

export default function ConstellationFilter({ compact = false }: Props) {
  const { constellationFilters, toggleConstellation, setConstellationFilters, satellites } = useSatelliteStore();

  // Counted over the whole catalogue, not the visible subset — a category
  // counted after filtering would read 0 the moment it was switched off, and
  // then vanish from the list with no way to switch it back on.
  const counts = useMemo(() => {
    const tally = new Map<SatelliteGroup, number>();
    satellites.forEach((sat) => {
      const g = (sat.group ?? "OTHER") as SatelliteGroup;
      tally.set(g, (tally.get(g) ?? 0) + 1);
    });
    return tally;
  }, [satellites]);

  const presentGroups = useMemo(
    () => GROUP_ORDER.filter((g) => (counts.get(g) ?? 0) > 0),
    [counts]
  );

  const isGroupVisible = (group: SatelliteGroup) => constellationFilters[group] !== false;

  const toggleAll = (show: boolean) => {
    const filters: Record<string, boolean> = { ...constellationFilters };
    presentGroups.forEach((g) => { filters[g] = show; });
    setConstellationFilters(filters);
  };

  const allVisible = presentGroups.every((g) => isGroupVisible(g));

  return (
    <div className="dp">
      {!compact && (
        <h2 className="text-primary mb-1 text-xs font-semibold">
          Categories
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
        {presentGroups.map((group) => {
          const visible = isGroupVisible(group);
          const count = counts.get(group) ?? 0;
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
          {allVisible ? "All categories visible" : "Some categories hidden"}
        </div>
      )}
    </div>
  );
}
