/**
 * /sky — Celestial sphere (alt/az) view.
 *
 * Shows satellites in a celestial coordinate system with
 * constellation lines, altitude/azimuth grid, and brightness-based
 * visibility indicators.
 */

"use client";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/ui/Sidebar";
import TimeSlider from "@/components/ui/TimeSlider";
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
  const { error } = useSatelliteStore();
  const sun = useSunPosition();

  const { getVisibleSatellites } = useSatelliteStore();
  const visibleSats = getVisibleSatellites().filter((s) => s.tle);

  return (
    <main className="relative h-screen w-full">
      <Header />

      {/* Celestial sphere view */}
      <div className="absolute top-14 left-0 right-80 bottom-20 flex items-center justify-center">
        <div className="relative w-full max-w-3xl h-full">
          {/* Celestial sphere canvas (placeholder) */}
          <div
            className="w-full h-full rounded-full border border-[#222] relative overflow-hidden"
            style={{
              background:
                "radial-gradient(circle, #0a2040 0%, #05051a 100%)",
            }}
          >
            <SkyCanvas satellites={visibleSats} sun={sun} />
          </div>

          <div className="absolute top-2 left-2 text-xs text-[#6f6d69]">
            Alt/Az View
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="absolute top-14 right-0 bottom-10 w-80">
        <Sidebar />
      </div>

      {/* Time Slider */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md">
        <TimeSlider />
      </div>

      <Footer />

      {/* Error overlay */}
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
