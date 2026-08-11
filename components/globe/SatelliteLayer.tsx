/**
 * SatelliteLayer.tsx — Leaf component grouping everything satellite-related
 * in the globe scene: dots, orbit paths, ground tracks, and labels.
 *
 * Owns the hover state so pointer movement re-renders only this subtree,
 * not the whole Canvas. Subscribes to the store with granular selectors —
 * never to simTime, which ticks at 10Hz (per-frame consumers read it via
 * getState() inside useFrame).
 */

"use client";

import { useState } from "react";
import { useSatelliteStore } from "@/lib/satellite-store";
import SatelliteIcons from "./SatelliteIcons";
import OrbitPaths from "./OrbitPaths";
import GroundTracks from "./GroundTracks";
import SatelliteLabels from "./SatelliteLabels";
import { TleSet, Satellite } from "@/types";

interface Props {
  tles: TleSet[];
  satellites: Map<string, Satellite>;
}

export default function SatelliteLayer({ tles, satellites }: Props) {
  const selectedNorad = useSatelliteStore(
    (s) => s.selectedSatellite?.noradId ?? null
  );
  const setSelectedSatellite = useSatelliteStore((s) => s.setSelectedSatellite);
  const [hoveredNorad, setHoveredNorad] = useState<string | null>(null);

  return (
    <>
      <OrbitPaths
        tles={tles}
        selectedNorad={selectedNorad}
        hoveredNorad={hoveredNorad}
      />
      <GroundTracks
        tles={tles}
        selectedNorad={selectedNorad}
        hoveredNorad={hoveredNorad}
      />
      <SatelliteIcons
        tles={tles}
        satellites={satellites}
        selectedNorad={selectedNorad}
        onSelect={setSelectedSatellite}
        onHover={setHoveredNorad}
      />
      <SatelliteLabels
        tles={tles}
        selectedNorad={selectedNorad}
        satellites={satellites}
        hoveredNorad={hoveredNorad}
      />
    </>
  );
}
