/**
 * Sidebar.tsx — Cohesive right-side panel containing the satellite list
 * and detail view.
 *
 * Replaces the previous approach of two separate absolutely-positioned divs
 * (which overlapped). This component manages:
 * - Group expand/collapse state
 * - Clean layout: constellation filter strip → satellite list → detail
 *
 * VISUAL HIERARCHY
 *
 * The four panels used to carry equal weight, separated only by a 1.26:1
 * border — so everything shouted at the same volume and the eye had nowhere to
 * land. They are now ranked by what a user is actually here to do:
 *
 *   1. the satellite list   — the reason the panel exists; takes all spare height
 *   2. the selected detail  — what you asked for; capped so it cannot crowd out 1
 *   3. the filter strip     — a control, not content; quiet and fixed
 *   4. space weather        — ambient context; quietest, collapsible
 *
 * Rank is expressed with space and type weight rather than more borders. Adding
 * rules between equal-weight blocks is what made it look like a form.
 */

"use client";

import { useState } from "react";
import SatelliteList from "@/components/ui/SatelliteList";
import SatelliteDetail from "@/components/ui/SatelliteDetail";
import ConstellationFilter from "@/components/ui/ConstellationFilter";
import SpaceWeatherPanel from "@/components/ui/SpaceWeatherPanel";
import AccuracyBadge from "@/components/ui/AccuracyBadge";
import { useSatelliteStore } from "@/lib/satellite-store";

/** Small caps section label — establishes rank without adding a rule. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-tertiary">
      {children}
    </div>
  );
}

export default function Sidebar() {
  const { selectedSatellite, setSelectedSatellite } = useSatelliteStore();

  // Track which groups are collapsed (keyed by group name)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  // Space weather is ambient context; let it fold away.
  const [weatherOpen, setWeatherOpen] = useState(false);

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  const selectedNorad = selectedSatellite?.noradId ?? null;

  return (
    <aside className="flex h-full flex-col overflow-hidden border-l border-space-border bg-space-panel text-text-primary">
      {/* 3 — a control. Quiet, fixed height, no heading of its own. */}
      <div className="shrink-0 border-b border-space-border px-2.5 py-2">
        <ConstellationFilter compact />
      </div>

      {/* 1 — the reason this panel exists. Takes every spare pixel. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <SectionLabel>Satellites</SectionLabel>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SatelliteList
            selectedNorad={selectedNorad}
            onSelect={setSelectedSatellite}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
          />
        </div>
      </div>

      {/* 2 — what you asked for. Capped at 40vh so a long detail view cannot
          squeeze the list it was selected from down to nothing. */}
      {selectedSatellite && (
        <div className="max-h-[40vh] shrink-0 overflow-y-auto border-t border-space-border">
          <SectionLabel>Selected</SectionLabel>
          <SatelliteDetail />
        </div>
      )}

      {/* 4 — ambient. Folded away by default; the header stays as a summary. */}
      <div className="shrink-0 border-t border-space-border">
        <button
          type="button"
          onClick={() => setWeatherOpen((v) => !v)}
          aria-expanded={weatherOpen}
          className="flex w-full items-center justify-between px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-text-tertiary transition-colors hover:text-text-secondary"
        >
          <span>Space weather</span>
          <span aria-hidden className="text-text-tertiary">
            {weatherOpen ? "−" : "+"}
          </span>
        </button>
        {weatherOpen && <SpaceWeatherPanel />}
      </div>

      {/* Provenance. Last, quietest, and the one claim competitors cannot
          casually make — so it belongs in the frame rather than in a doc. */}
      <AccuracyBadge />
    </aside>
  );
}
