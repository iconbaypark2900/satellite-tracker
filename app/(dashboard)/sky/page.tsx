/**
 * /sky — Celestial sphere (alt/az) view.
 *
 * Shows satellites in a celestial coordinate system with
 * constellation lines, altitude/azimuth grid, and brightness-based
 * visibility indicators.
 */

"use client";

"use client";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import LoadingScreen from "@/components/layout/LoadingScreen";
import TimeSlider from "@/components/ui/TimeSlider";
import ConstellationFilter from "@/components/ui/ConstellationFilter";
import SatelliteList from "@/components/ui/SatelliteList";
import SatelliteDetail from "@/components/ui/SatelliteDetail";
import { useSatelliteStore } from "@/lib/satellite-store";
import { useSatelliteInitializer } from "@/hooks/useSatelliteInitializer";
import { useSunPosition } from "@/hooks/useSunPosition";
import { Satellite } from "@/types";
import { SunPosition } from "@/lib/sun-position";

interface SkyCanvasProps {
  satellites: Satellite[];
  sun: SunPosition | null;
}

export default function SkyPage() {
  useSatelliteInitializer();
  const { isLoading, getVisibleSatellites } = useSatelliteStore();
  const sun = useSunPosition();

  const satellites = getVisibleSatellites().filter((s) => s.tle);

  return (
    <main className="relative h-screen w-full">
      <Header />

      <div className="absolute inset-0 pt-14 pb-10 flex items-center justify-center">
        <div className="relative w-full max-w-3xl h-full">
          {/* Celestial sphere canvas (placeholder) */}
          <div
            className="w-full h-full rounded-full border border-[#222] relative overflow-hidden"
            style={{
              background:
                "radial-gradient(circle, #0a2040 0%, #05051a 100%)",
            }}
          >
            <SkyCanvas satellites={satellites} sun={sun} />
          </div>

          <div className="absolute top-2 left-2 text-xs text-[#6f6d69]">
            Alt/Az View
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="absolute top-14 right-0 h-[calc(100vh-3.5rem)] w-80">
        <SatelliteList />
      </div>

      <div className="absolute bottom-14 right-0 w-80 p-2">
        <SatelliteDetail />
      </div>

      <div className="absolute top-16 left-4 w-64">
        <ConstellationFilter />
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md">
        <TimeSlider />
      </div>

      <Footer />
      {isLoading && <LoadingScreen />}
    </main>
  );
}

/** Placeholder for the celestial sphere canvas. */
function SkyCanvas({ satellites, sun }: SkyCanvasProps) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <p className="text-[#6f6d69] text-sm">
        Celestial sphere view (coming soon — altitude/azimuth projection)
      </p>
    </div>
  );
}
