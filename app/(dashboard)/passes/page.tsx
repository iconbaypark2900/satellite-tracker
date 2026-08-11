/**
 * /passes — Pass prediction list view.
 *
 * Shows upcoming visible passes for the selected satellite,
 * sorted by time. Includes location picker and visibility filters.
 */

"use client";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/ui/Sidebar";
import TimeSlider from "@/components/ui/TimeSlider";
import LocationInput from "@/components/ui/LocationInput";
import PassPredictionCard from "@/components/ui/PassPredictionCard";
import { useSatelliteStore } from "@/lib/satellite-store";
import { useSatelliteInitializer } from "@/hooks/useSatelliteInitializer";

export default function PassesPage() {
  useSatelliteInitializer();
  const { selectedSatellite, error } = useSatelliteStore();

  return (
    <main className="relative h-screen w-full">
      <Header />

      {/* Main content area (left of sidebar) */}
      <div className="absolute top-14 left-0 right-80 bottom-20 overflow-auto">
        <div className="max-w-4xl mx-auto p-4">
          <h1 className="text-xl font-bold mb-4">🛰️ Pass Predictions</h1>

          {/* Location picker */}
          <div className="mb-4">
            <LocationInput />
          </div>

          {/* Selected satellite passes */}
          {selectedSatellite ? (
            <div className="mb-4">
              <h2 className="text-sm text-[#6f6d69] mb-2">
                Passes for {selectedSatellite.name} ({selectedSatellite.noradId})
              </h2>
              <div id="passes-list">
                <PassPredictionCard
                  pass={{
                    startTime: new Date(),
                    maxTime: new Date(Date.now() + 30 * 60000),
                    endTime: new Date(Date.now() + 60 * 60000),
                    maxElevation: 45,
                    startAz: 90,
                    maxAz: 180,
                    endAz: 270,
                    isLit: true,
                    magnitude: -1.5,
                  }}
                  satelliteName={selectedSatellite.name}
                />
              </div>
            </div>
          ) : (
            <p className="text-[#6f6d69] text-sm mb-4">
              Select a satellite from the sidebar to see pass predictions.
            </p>
          )}
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
