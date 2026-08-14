/**
 * Sidebar.tsx — Right-hand panel: filters, the satellite list, ambient
 * readouts, and the detail view for whatever is selected.
 *
 * The column has to divide a fixed height between four things, only two of
 * which are actively worked in. The category filter and the space-weather
 * readout are reference material — you set filters once and glance at Kp
 * occasionally — so both fold, and space weather starts folded. That hands
 * their height to the list and the detail panel, which are where the work
 * happens.
 */

"use client";

import { useState } from "react";
import SatelliteList from "@/components/ui/SatelliteList";
import SatelliteDetail from "@/components/ui/SatelliteDetail";
import ConstellationFilter from "@/components/ui/ConstellationFilter";
import SpaceWeatherPanel from "@/components/ui/SpaceWeatherPanel";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { useSatelliteStore } from "@/lib/satellite-store";

export default function Sidebar() {
  const { selectedSatellite, setSelectedSatellite, satellites } = useSatelliteStore();

  // Track which groups are collapsed (keyed by group name)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [weatherOpen, setWeatherOpen] = useState(false);

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  const selectedNorad = selectedSatellite?.noradId ?? null;

  // Count from the whole catalogue, not the filtered view — see the note in
  // ConstellationFilter on why the visible subset is the wrong denominator.
  const visibleCount = useSatelliteStore((s) => s.getVisibleSatellites().length);

  return (
    <aside className="flex h-full flex-col overflow-hidden border-l border-space-border bg-space-panel text-text-primary">
      <CollapsibleSection
        title="Categories"
        icon="satellite"
        open={filtersOpen}
        onToggle={() => setFiltersOpen((v) => !v)}
        summary={`${visibleCount} of ${satellites.size} shown`}
      >
        <div className="px-2.5">
          <ConstellationFilter compact />
        </div>
      </CollapsibleSection>

      {/*
        The satellite list.

        `min-h` is the whole fix. Previously this was `flex-1` against a
        `shrink-0` detail panel, so selecting a satellite drove the list from
        399px to 71px — and because SatelliteList carries fixed chrome above
        its own scroll area (search box, status line), 71px left the list
        itself at ZERO height with the search box clipped. Selecting one
        satellite made it impossible to reach another, which breaks the app's
        primary interaction on first use.

        `overflow-hidden` rather than `overflow-y-auto`: SatelliteList already
        owns an internal scroll container, and two nested scrollers means the
        outer one moves the search box off-screen while the inner one moves the
        rows, which feels broken even when nothing is clipped.
      */}
      <div className="min-h-[200px] flex-1 overflow-hidden px-2.5 pt-2">
        <SatelliteList
          selectedNorad={selectedNorad}
          onSelect={setSelectedSatellite}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroup}
        />
      </div>

      <CollapsibleSection
        title="Space Weather"
        icon="sun"
        open={weatherOpen}
        onToggle={() => setWeatherOpen((v) => !v)}
        summary="NOAA SWPC"
      >
        <SpaceWeatherPanel hideTitle />
      </CollapsibleSection>

      {/*
        Selected satellite detail.

        Capped and internally scrollable, and deliberately NOT `shrink-0`: on a
        short viewport the cap alone would still overflow the sidebar, and
        since the sidebar is `overflow-hidden` that content would be
        unreachable rather than merely cramped. Allowing it to shrink below its
        content — with `min-h-0` so flex actually permits that — means it gives
        way first and scrolls internally, which is the right thing to sacrifice.

        The cap is generous when something is selected because the panel now
        carries prose (mission and orbit explanations), and near-zero when
        nothing is, so an empty placeholder is not holding open half the column.
      */}
      <div
        className={`min-h-0 overflow-y-auto border-t border-space-border ${
          selectedSatellite ? "max-h-[44vh]" : "max-h-[20vh]"
        }`}
      >
        <SatelliteDetail />
      </div>
    </aside>
  );
}
