/**
 * SatelliteList.tsx — Searchable, groupable list of all tracked satellites.
 *
 * Shows name, NORAD ID, orbit type, and altitude. Clicking selects a satellite
 * and scrolls its details into view. Supports live search and group toggling.
 */

"use client";

import { useState, useMemo, useEffect } from "react";
import { useSatelliteStore } from "@/lib/satellite-store";
import { Satellite, SatelliteGroup } from "@/types";
import { GROUP_LABELS, GROUP_COLORS } from "@/lib/constants";
import { orbitType } from "@/lib/orbit-utils";

export default function SatelliteList() {
  const { getVisibleSatellites, selectedSatellite, setSelectedSatellite } = useSatelliteStore();
  const [searchQuery, setSearchQuery] = useState("");

  const visible = getVisibleSatellites();

  // Filter by search query
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return visible;
    return visible.filter(
      (sat) =>
        sat.name.toLowerCase().includes(q) ||
        sat.noradId.includes(q) ||
        (sat.group as string).toLowerCase().includes(q)
    );
  }, [visible, searchQuery]);

  // Group satellites
  const grouped = useMemo(() => {
    const groups: Record<string, Satellite[]> = {};
    filtered.forEach((sat) => {
      const g = (sat.group ?? "OTHER") as string;
      if (!groups[g]) groups[g] = [];
      groups[g].push(sat);
    });
    return groups;
  }, [filtered]);

  const totalCount = visible.length;
  const filteredCount = filtered.length;

  return (
    <aside id="sidebar">
      <h1 style={{ marginBottom: "0.3rem" }}>🛰️ Satellite Tracker</h1>
      <p style={{ fontSize: "0.72rem", color: "#6f6d69", marginBottom: "1rem" }}>
        Real-time orbital visualization with SGP4 propagation
      </p>
      <p style={{ fontSize: "0.75rem", color: "#4a9eff", marginBottom: "0.5rem" }}>
        Tracking {totalCount} satellites ({filteredCount} visible)
      </p>

      <input
        type="text"
        id="search"
        className="sb"
        placeholder="Search satellites…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <ul id="sl" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {Object.keys(grouped).length === 0 ? (
          <li style={{ padding: "1rem", color: "#6f6d69", textAlign: "center" }}>
            No satellites match your search.
          </li>
        ) : (
          Object.entries(grouped).map(([group, sats]) => (
            <GroupSection
              key={group}
              group={group as SatelliteGroup}
              satellites={sats}
              selectedNorad={selectedSatellite?.noradId ?? null}
              onSelect={setSelectedSatellite}
            />
          ))
        )}
      </ul>
    </aside>
  );
}

/** Render a single constellation group with its satellites. */
function GroupSection({
  group,
  satellites,
  selectedNorad,
  onSelect,
}: {
  group: SatelliteGroup;
  satellites: Satellite[];
  selectedNorad: string | null;
  onSelect: (sat: Satellite) => void;
}) {
  const color = GROUP_COLORS[group] ?? GROUP_COLORS.OTHER;

  return (
    <div key={group}>
      <div
        className="group-header"
        style={{
          fontSize: "0.65rem",
          color: "#6f6d69",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          margin: "0.5rem 0 0.15rem",
          fontWeight: 600,
        }}
      >
        {GROUP_LABELS[group]} ({satellites.length})
      </div>

      {satellites.map((sat) => {
        const active = selectedNorad === sat.noradId;
        const altStr = sat.altitude > 1000
          ? `${(sat.altitude / 1000).toFixed(0)}k km`
          : `${sat.altitude} km`;

        return (
          <li
            key={sat.noradId}
            className="si"
            style={{
              opacity: active ? 1 : undefined,
            }}
            onClick={() => onSelect(sat)}
          >
            <span
              className="dot"
              style={{
                background: color,
                boxShadow: `0 0 6px ${color}`,
              }}
            />
            <span style={{ color: active ? color : "inherit" }}>{sat.name}</span>
            <span className="sm">
              {altStr} · {sat.inclination}°
            </span>
          </li>
        );
      })}

      <style jsx>{`
        .si.active { background: rgba(65, 55, 139, 0.25); color: #4137ff; }
        .si:hover { background: rgba(26, 26, 62, 0.6); }
      `}</style>
    </div>
  );
}
