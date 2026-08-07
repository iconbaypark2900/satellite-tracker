/**
 * /globe — Main 3D globe view.
 *
 * Renders the Three.js Earth with live satellite positions,
 * orbit paths, and ground tracks. Sidebar shows satellite list
 * and details. Time slider at the bottom.
 */

"use client";

import dynamic from "next/dynamic";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import LoadingScreen from "@/components/layout/LoadingScreen";
import SatelliteList from "@/components/ui/SatelliteList";
import SatelliteDetail from "@/components/ui/SatelliteDetail";
import TimeSlider from "@/components/ui/TimeSlider";
import ConstellationFilter from "@/components/ui/ConstellationFilter";
import { useSatelliteInitializer } from "@/hooks/useSatelliteInitializer";
import { useSatelliteStore } from "@/lib/satellite-store";
import { computeOrbitalParams } from "@/lib/orbit-utils";

// Dynamically import GlobeScene (heavy Three.js bundle, client-only)
const GlobeScene = dynamic(() => import("@/components/globe/GlobeScene"), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

export default function GlobePage() {
  // Initialize TLE data on first load
  useSatelliteInitializer();

  const { isLoading, error } = useSatelliteStore();

  return (
    <main className="relative h-screen w-full">
      <Header />

      {/* 3D Globe Canvas (full viewport) */}
      <div style={{ position: 'absolute', top: '56px', left: 0, right: 0, bottom: 0, height: 'calc(100vh - 96px)' }}>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <GlobeScene />
        </div>
      </div>

      {/* Sidebar */}
      <div className="absolute top-14 right-0 h-[calc(100vh-3.5rem)] w-80">
        <SatelliteList />
      </div>

      {/* Satellite Detail Panel (below list) */}
      <div className="absolute bottom-14 right-0 w-80 p-2">
        <SatelliteDetail />
      </div>

      {/* Constellation Filter */}
      <div className="absolute top-16 left-4 w-64">
        <ConstellationFilter />
      </div>

      {/* Time Slider */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md">
        <TimeSlider />
      </div>

      {/* Footer */}
      <Footer />

      {isLoading && <LoadingScreen />}
    </main>
  );
}
