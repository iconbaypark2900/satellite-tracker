/**
 * /globe — Main 3D globe view.
 *
 * Renders the Three.js Earth with live satellite positions,
 * orbit paths, and ground tracks. Right sidebar shows the satellite
 * list and details. Time slider at the bottom.
 */

"use client";

import dynamic from "next/dynamic";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import LoadingScreen from "@/components/layout/LoadingScreen";
import Sidebar from "@/components/ui/Sidebar";
import TimeSlider from "@/components/ui/TimeSlider";
import { useSatelliteStore } from "@/lib/satellite-store";
import { useSatelliteInitializer } from "@/hooks/useSatelliteInitializer";

// Dynamically import GlobeScene (heavy Three.js bundle, client-only)
const GlobeScene = dynamic(() => import("@/components/globe/GlobeScene"), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

export default function GlobePage() {
  // Initialize TLE data on first load
  useSatelliteInitializer();

  const { error } = useSatelliteStore();

  return (
    <main className="relative h-screen w-full">
      <Header />

      {/* 3D Globe Canvas (fills area below header, left of sidebar, above footer) */}
      <div className="absolute top-14 left-0 right-80 bottom-10">
        <div className="relative w-full h-full">
          <GlobeScene />
        </div>
      </div>

      {/* Right sidebar: constellation filter + satellite list + detail */}
      <div className="absolute top-14 right-0 bottom-10 w-80">
        <Sidebar />
      </div>

      {/* Time Slider (positioned above the footer) */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md">
        <TimeSlider />
      </div>

      {/* Footer */}
      <Footer />

      {/* Error overlay (only when there's a real error) */}
      {error && (
        <div className="fixed inset-0 bg-space/90 flex items-center justify-center z-[100]">
          <div className="p-6 text-center">
            <div className="text-2xl mb-2">⚠️</div>
            <p className="text-sm text-text-muted mb-1">{error}</p>
            <p className="text-xs text-text-muted">Retrying…</p>
          </div>
        </div>
      )}
    </main>
  );
}
