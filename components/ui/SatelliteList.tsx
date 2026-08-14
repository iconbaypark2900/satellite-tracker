/**
 * SatelliteList.tsx — Searchable, groupable list of all tracked satellites.
 *
 * Shows name, NORAD ID, orbit type, and altitude. Clicking selects a satellite.
 * Supports live search, group expand/collapse, and keyboard navigation.
 */

"use client";

import { useState, useMemo, KeyboardEvent } from "react";
import { useSatelliteStore } from "@/lib/satellite-store";
import { Satellite, SatelliteGroup } from "@/types";
import { GROUP_LABELS, GROUP_COLORS, GROUP_ORDER } from "@/lib/constants";
import { orbitType } from "@/lib/orbit-utils";
import Icon from "@/components/ui/Icon";

interface Props {
  /** NORAD ID of the currently selected satellite, or null. */
  selectedNorad: string | null;
  /** Callback when a satellite is selected. */
  onSelect: (sat: Satellite | null) => void;
  /** Collapsed state per group, keyed by group name. */
  collapsedGroups: Record<string, boolean>;
  /** Toggle a group's collapsed state. */
  onToggleGroup: (group: string) => void;
}

export default function SatelliteList({
  selectedNorad,
  onSelect,
  collapsedGroups,
  onToggleGroup,
}: Props) {
  const { getVisibleSatellites, isLoading } = useSatelliteStore();
  const [searchQuery, setSearchQuery] = useState("");

  const visible = getVisibleSatellites();

  // Filter by search query (name, NORAD ID, or group)
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

  // Group filtered satellites, in the canonical category order rather than
  // the order the feed happened to list them in. Empty categories are absent
  // by construction — a category only appears if something landed in it.
  const grouped = useMemo(() => {
    const byGroup = new Map<SatelliteGroup, Satellite[]>();
    filtered.forEach((sat) => {
      const g = (sat.group ?? "OTHER") as SatelliteGroup;
      const bucket = byGroup.get(g);
      if (bucket) bucket.push(sat);
      else byGroup.set(g, [sat]);
    });
    return GROUP_ORDER.filter((g) => byGroup.has(g)).map(
      (g) => [g, byGroup.get(g)!] as const
    );
  }, [filtered]);

  const totalCount = visible.length;
  const filteredCount = filtered.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-3">
        <h1 className="text-primary text-lg font-bold mb-0.5 flex items-center gap-2">
          <Icon name="satellite" />
          Satellite Tracker
        </h1>
        <p className="text-text-muted text-xs">
          Real-time orbital visualization with SGP4 propagation
        </p>
      </div>

      {/* Search */}
      <div className="mb-2">
        <input
          type="text"
          placeholder="Search by name or NORAD ID…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2.5 py-1.5 bg-space-panel border border-space-border rounded text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          suppressHydrationWarning
        />
      </div>

      {/* Status line */}
      <p className="text-xs text-satellite-blue mb-2 font-medium">
        Tracking {totalCount} satellites ({filteredCount} visible)
      </p>

      {/* Satellite groups */}
      <div className="overflow-y-auto flex-1 space-y-1 pr-1">
        {filteredCount === 0 && searchQuery ? (
          <div className="py-6 text-center text-text-muted text-xs">
            No satellites match your search.
          </div>
        ) : filteredCount === 0 && isLoading ? (
          <div className="py-6 text-center text-text-muted text-xs">
            <span className="animate-spin inline-block w-3 h-3 border border-text-muted border-t-transparent rounded-full mr-1" />
            Loading orbital data…
          </div>
        ) : filteredCount === 0 ? (
          <div className="py-6 text-center text-text-muted text-xs">
            No satellites match your search.
          </div>
        ) : (
          grouped.map(([group, sats]) => (
            <GroupSection
              key={group}
              group={group}
              satellites={sats}
              selectedNorad={selectedNorad}
              onSelect={onSelect}
              isCollapsed={collapsedGroups[group] ?? false}
              onToggle={onToggleGroup}
            />
          ))
        )}
      </div>
    </div>
  );
}

/** Render a single constellation group with expand/collapse. */
function GroupSection({
  group,
  satellites,
  selectedNorad,
  onSelect,
  isCollapsed,
  onToggle,
}: {
  group: SatelliteGroup;
  satellites: Satellite[];
  selectedNorad: string | null;
  onSelect: (sat: Satellite | null) => void;
  isCollapsed: boolean;
  onToggle: (group: string) => void;
}) {
  const color = GROUP_COLORS[group] ?? GROUP_COLORS.OTHER;

  const handleKeyDown = (e: KeyboardEvent<HTMLLIElement>, sat: Satellite) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(sat);
    }
  };

  return (
    <div className="border-b border-space-border/30 last:border-0">
      {/* Group header — clickable to expand/collapse */}
      <div
        className="group-header flex items-center justify-between px-1 py-0.5 cursor-pointer select-none"
        onClick={() => onToggle(group)}
        role="button"
        aria-expanded={!isCollapsed}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle(group);
          }
        }}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              background: color,
              boxShadow: `0 0 4px ${color}`,
            }}
          />
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
            {GROUP_LABELS[group]}
          </span>
        </span>
        <span className="flex items-center gap-1 text-xs text-text-muted">
          <span className="px-1.5 py-0.25 rounded-full bg-space-panel text-text-muted">
            {satellites.length}
          </span>
          <span
            className="transition-transform text-text-muted"
            style={{
              transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
            }}
          >
            <Icon name="chevron" />
          </span>
        </span>
      </div>

      {/* Satellite items */}
      {!isCollapsed && (
        <ul className="pl-3 mt-0.5 space-y-0.25">
          {satellites.map((sat) => {
            const active = selectedNorad === sat.noradId;

            return (
              <li
                key={sat.noradId}
                className={`si relative cursor-pointer text-xs py-1 px-1.5 rounded transition-all duration-150 ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "hover:bg-space-panel text-text-primary"
                }`}
                onClick={() => onSelect(sat)}
                onKeyDown={(e) => handleKeyDown(e, sat)}
                role="button"
                tabIndex={0}
                aria-pressed={active}
              >
                <span className="flex items-center gap-1.5">
                  {/* Selection indicator */}
                  {active && (
                    <span className="w-1 h-4 bg-primary rounded-sm flex-shrink-0" />
                  )}
                  {/* Color dot */}
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      active ? "ring-2 ring-primary/40" : ""
                    }`}
                    style={{
                      background: color,
                      boxShadow: `0 0 5px ${color}`,
                    }}
                  />
                  {/* Name + NORAD ID */}
                  <span className="font-medium truncate">
                    {sat.name}
                  </span>
                  <span className="text-text-muted/60 ml-1 font-mono">
                    #{sat.noradId}
                  </span>
                </span>

                {/* Metadata row */}
                <div className="flex justify-between items-center mt-0.5 ml-4 pl-2">
                  <span className="text-text-muted font-mono text-xs">
                    {(() => {
                      const oType = orbitType(sat.altitude, sat.inclination);
                      return oType;
                    })()}
                  </span>
                  <span className="text-text-muted font-mono text-xs">
                    {sat.altitude > 1000
                      ? `${(sat.altitude / 1000).toFixed(1)}k km`
                      : `${sat.altitude} km`}
                    {" · "}
                    {sat.inclination}°
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
