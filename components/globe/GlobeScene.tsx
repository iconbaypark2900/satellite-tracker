/**
 * GlobeScene.tsx — Three.js scene container for the 3D globe view.
 *
 * Orchestrates Earth rendering, satellite positions, orbit paths,
 * ground tracks, sun lighting, and starfield within a React Three Fiber
 * <Canvas>. Handles performance optimizations (InstancedMesh, frustum culling).
 *
 * Falls back to a static info panel when WebGL is unavailable.
 */

"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stats } from "@react-three/drei";
import { useEffect, Suspense, useState, useMemo } from "react";
import { useSatelliteStore } from "@/lib/satellite-store";
import Earth from "./Earth";
import SunLighting from "./SunLighting";
import Starfield from "./Starfield";
import SatelliteLayer from "./SatelliteLayer";
import { TleSet, Satellite } from "@/types";
import Icon from "@/components/ui/Icon";

/** Earth radius used for rendering (km). */
const EARTH_RADIUS = 6371;

/** Check if the browser supports WebGL. */
function isWebGLAvailable(): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return (
      !!canvas.getContext("webgl2") ||
      !!canvas.getContext("webgl") ||
      !!canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

export default function GlobeScene() {
  // Granular subscriptions — never to simTime, which ticks at 10Hz.
  // Per-frame consumers read time via getState() inside useFrame.
  const satellites = useSatelliteStore((s) => s.satellites);
  const filters = useSatelliteStore((s) => s.constellationFilters);
  const [webglAvailable, setWebglAvailable] = useState(true);

  // Check WebGL availability on mount (client-side only)
  useEffect(() => {
    setWebglAvailable(isWebGLAvailable());
  }, []);

  // Visible satellites + lookup structures, stable across time ticks
  const { tleSets, satMap } = useMemo(() => {
    const tleSets: TleSet[] = [];
    const satMap = new Map<string, Satellite>();
    satellites.forEach((sat) => {
      if (filters[sat.group as string] === false) return;
      satMap.set(sat.noradId, sat);
      if (sat.tle) tleSets.push(sat.tle);
    });
    return { tleSets, satMap };
  }, [satellites, filters]);

  // Fallback UI when WebGL is not available
  if (!webglAvailable) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="p-8 text-center">
          <div className="mb-4 flex justify-center text-text-muted">
            <Icon name="globe" size={40} />
          </div>
          <h3 className="mb-2 font-bold text-lg">WebGL Not Available</h3>
          <p className="text-sm text-gray-400 max-w-md">
            Your browser does not support WebGL or it is disabled.
            Please enable hardware acceleration and use a modern browser
            (Chrome, Firefox, Edge, or Safari) to view the 3D globe.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Canvas
      camera={{
        // Scene Z is the polar axis — view from above the equator, mid-latitude
        position: [EARTH_RADIUS * 2.1, -EARTH_RADIUS * 0.9, EARTH_RADIUS * 0.9],
        fov: 45,
        near: 10,
        far: 150000,
      }}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false }}
    >
      {/* Lighting & Environment */}
      <Suspense fallback={null}>
        <SunLighting />
        <Starfield />
        <Earth />
        <SatelliteLayer tles={tleSets} satellites={satMap} />
      </Suspense>

      {/* Controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.8}
        zoomSpeed={0.8}
        minDistance={EARTH_RADIUS * 1.15}
        maxDistance={EARTH_RADIUS * 5}
      />

      {/* Optional performance stats (development only) */}
      {process.env.NODE_ENV === "development" && <Stats />}
    </Canvas>
  );
}
