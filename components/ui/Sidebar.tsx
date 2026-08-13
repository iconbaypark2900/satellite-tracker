/**
 * Sidebar.tsx — Cohesive right-side panel containing the satellite list
 * and detail view.
 *
 * Replaces the previous approach of two separate absolutely-positioned divs
 * (which overlapped). This component manages:
 * - Group expand/collapse state
 * - Clean layout: constellation filter strip → satellite list → detail
 */

"use client";

import { useState } from "react";
import SatelliteList from "@/components/ui/SatelliteList";
import SatelliteDetail from "@/components/ui/SatelliteDetail";
import ConstellationFilter from "@/components/ui/ConstellationFilter";
import SpaceWeatherPanel from "@/components/ui/SpaceWeatherPanel";
import { useSatelliteStore } from "@/lib/satellite-store";

export default function Sidebar() {
  const { selectedSatellite, setSelectedSatellite } = useSatelliteStore();

  // Track which groups are collapsed (keyed by group name)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  const selectedNorad = selectedSatellite?.noradId ?? null;

  return (
    <aside className="flex flex-col h-full bg-space-panel border-l border-space-border text-text-primary overflow-hidden">
      {/* Constellation filter strip */}
      <div className="p-2.5 border-b border-space-border">
        <ConstellationFilter compact />
      </div>

      {/* Satellite list (scrollable) */}
      <div className="flex-1 overflow-y-auto">
        <SatelliteList
          selectedNorad={selectedNorad}
          onSelect={setSelectedSatellite}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroup}
        />
      </div>

      {/* Live NOAA space weather */}
      <div className="border-t border-space-border shrink-0">
        <SpaceWeatherPanel />
      </div>

      {/* Selected satellite detail (pinned to bottom) */}
      <div className="border-t border-space-border shrink-0 overflow-y-auto">
        <SatelliteDetail />
      </div>
    </aside>
  );
}
