/**
 * /passes — Pass prediction list view.
 *
 * Shows upcoming visible passes for the selected satellite,
 * sorted by time. Includes location picker and visibility filters.
 */

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import LoadingScreen from "@/components/layout/LoadingScreen";
import TimeSlider from "@/components/ui/TimeSlider";
import LocationInput from "@/components/ui/LocationInput";
import ConstellationFilter from "@/components/ui/ConstellationFilter";
import SatelliteList from "@/components/ui/SatelliteList";
import { useSatelliteStore } from "@/lib/satellite-store";
import { useSatelliteInitializer } from "@/hooks/useSatelliteInitializer";
import PassPredictionCard from "@/components/ui/PassPredictionCard";

export default function PassesPage() {
  useSatelliteInitializer();
  const { selectedSatellite, getVisibleSatellites } = useSatelliteStore();
  const { isLoading } = useSatelliteStore();

  const visible = getVisibleSatellites();

  return (
    <main className="relative h-screen w-full">
      <Header />

      <div className="absolute inset-0 pt-14 pb-10 overflow-auto">
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

          {/* Visible satellite summary */}
          <div className="mb-4">
            <h2 className="text-sm text-[#6f6d69] mb-2">Tracked Satellites</h2>
            <div className="text-xs text-[#6f6d69]">
              {visible.length} satellites in {new Set(visible.map((s) => s.group)).size} constellations
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="absolute top-14 right-0 h-[calc(100vh-3.5rem)] w-80">
        <SatelliteList />
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
