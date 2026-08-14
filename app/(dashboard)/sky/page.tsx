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
import SkyView from "@/components/sky/SkyView";
import { useSatelliteStore } from "@/lib/satellite-store";
import { useSatelliteInitializer } from "@/hooks/useSatelliteInitializer";
import Icon from "@/components/ui/Icon";

export default function SkyPage() {
  useSatelliteInitializer();
  const error = useSatelliteStore((s) => s.error);
  const observer = useSatelliteStore((s) => s.observer);

  return (
    <main className="relative h-screen w-full">
      <Header />

      {/* Celestial sphere view */}
      <div className="absolute top-14 left-0 right-80 bottom-20 flex items-center justify-center">
        <div className="relative w-full h-full">
          <SkyView />
          <div className="absolute top-2 left-2 text-xs text-[#6f6d69]">
            Alt/Az View — looking up from {observer.label}
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
            <div className="mb-2 flex justify-center text-satellite-orange">
              <Icon name="alert" size={26} />
            </div>
            <p className="text-sm text-text-muted mb-1">{error}</p>
            <p className="text-xs text-text-muted">Retrying…</p>
          </div>
        </div>
      )}
    </main>
  );
}
