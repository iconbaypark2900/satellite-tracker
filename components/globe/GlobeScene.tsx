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
import SatelliteIcons from "./SatelliteIcons";
import OrbitPaths from "./OrbitPaths";
import GroundTracks from "./GroundTracks";
import SunLighting from "./SunLighting";
import Starfield from "./Starfield";
import { TleSet } from "@/types";

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
  const { timeControl, selectedSatellite, getVisibleSatellites } = useSatelliteStore();
  const [webglAvailable, setWebglAvailable] = useState(true);

  // Check WebGL availability on mount (client-side only)
  useEffect(() => {
    setWebglAvailable(isWebGLAvailable());
  }, []);

  // Extract visible satellites with TLEs for rendering
  const visibleSats = getVisibleSatellites();
  const tleSets: TleSet[] = visibleSats
    .filter((s) => s.tle)
    .map((s) => s.tle!);

  // Fallback UI when WebGL is not available
  if (!webglAvailable) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="p-8 text-center">
          <div className="mb-4 text-4xl">🌍</div>
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
      camera={{ position: [0, 0, EARTH_RADIUS * 2.5], fov: 45, near: 1, far: EARTH_RADIUS * 10 }}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false }}
      onPointerMissed={() => useSatelliteStore.getState().setSelectedSatellite(null)}
    >
      {/* Lighting & Environment */}
      <Suspense fallback={null}>
        <SunLighting simTime={timeControl.simTime} />
        <Starfield />
        <Earth />
        <OrbitPaths tles={tleSets} simTime={timeControl.simTime} />
        <GroundTracks tles={tleSets} simTime={timeControl.simTime} />
        <SatelliteIcons
          tles={tleSets}
          simTime={timeControl.simTime}
          selectedNorad={selectedSatellite?.noradId ?? null}
          onSelect={useSatelliteStore.getState().setSelectedSatellite}
        />
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
