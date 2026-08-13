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
      <div className="shrink-0 p-2.5 border-b border-space-border">
        <ConstellationFilter compact />
      </div>

      {/*
        The satellite list.

        `min-h` is the whole fix. Previously this was `flex-1` against a
        `shrink-0` detail panel, so selecting a satellite drove the list from
        399px to 71px — and because SatelliteList carries ~102px of fixed
        chrome above its own scroll area (heading, search box, status line),
        71px left the list itself at ZERO height with the search box clipped.
        Selecting one satellite made it impossible to reach another, which
        breaks the app's primary interaction on first use.

        `overflow-hidden` rather than `overflow-y-auto`: SatelliteList already
        owns an internal scroll container, and two nested scrollers means the
        outer one moves the search box off-screen while the inner one moves the
        rows, which feels broken even when nothing is clipped.
      */}
      <div className="flex-1 min-h-[220px] overflow-hidden">
        <SatelliteList
          selectedNorad={selectedNorad}
          onSelect={setSelectedSatellite}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroup}
        />
      </div>

      {/* Live NOAA space weather */}
      <div className="shrink-0 border-t border-space-border">
        <SpaceWeatherPanel />
      </div>

      {/*
        Selected satellite detail.

        Capped and internally scrollable, and deliberately NOT `shrink-0`: on a
        short viewport the cap alone would still overflow the sidebar, and
        since the sidebar is `overflow-hidden` that content would be
        unreachable rather than merely cramped. Allowing it to shrink below its
        content — with `min-h-0` so flex actually permits that — means it gives
        way first and scrolls internally, which is the right thing to sacrifice.
      */}
      <div className="min-h-0 max-h-[34vh] overflow-y-auto border-t border-space-border">
        <SatelliteDetail />
      </div>
    </aside>
  );
}
