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
import { usePassPredictions } from "@/hooks/usePassPredictions";
import Icon, { IconLabel } from "@/components/ui/Icon";

export default function PassesPage() {
  useSatelliteInitializer();
  const selectedSatellite = useSatelliteStore((s) => s.selectedSatellite);
  const error = useSatelliteStore((s) => s.error);
  const observer = useSatelliteStore((s) => s.observer);
  const {
    passes,
    nextVisible,
    isLoading,
    error: passError,
    mutate,
  } = usePassPredictions(selectedSatellite);

  const neverSetsPass = passes.find((p) => p.neverSets);

  return (
    <main className="relative h-screen w-full">
      <Header />

      {/* Main content area (left of sidebar) */}
      <div className="absolute top-14 left-0 right-80 bottom-20 overflow-auto">
        <div className="max-w-4xl mx-auto p-4">
          <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Icon name="satellite" />
            Pass Predictions
          </h1>

          {/* Location picker */}
          <div className="mb-4">
            <LocationInput />
          </div>

          {/* Selected satellite passes */}
          {selectedSatellite ? (
            <div className="mb-4">
              <h2 className="text-sm text-[#6f6d69] mb-2">
                Passes for {selectedSatellite.name} ({selectedSatellite.noradId}) over{" "}
                {observer.label} — next 24h
              </h2>

              {isLoading && (
                <p className="text-sm text-[#6f6d69]">
                    <IconLabel icon="reset">Computing passes…</IconLabel>
                  </p>
              )}

              {passError && (
                <div className="text-sm text-[#ff80ab] mb-2">
                  Failed to compute passes.{" "}
                  <button
                    className="underline text-[#4a9eff]"
                    onClick={() => mutate()}
                  >
                    Retry
                  </button>
                </div>
              )}

              {!isLoading && !passError && neverSetsPass && (
                <div className="mb-3 p-3 rounded border border-[#4a9eff]/40 bg-[#4a9eff]/10 text-sm">
                  <Icon name="satellite" /> {selectedSatellite.name} is above the horizon from{" "}
                  {observer.label} for the entire day (elevation{" "}
                  {neverSetsPass.maxElevation.toFixed(0)}°) — typical for a
                  geostationary satellite. There are no rise/set passes to list.
                </div>
              )}

              {!isLoading && !passError && !neverSetsPass && passes.length === 0 && (
                <p className="text-sm text-[#6f6d69]">
                  No passes above 10° elevation in the next 24 hours from{" "}
                  {observer.label}.
                </p>
              )}

              {!isLoading && !passError && !neverSetsPass && passes.length > 0 && (
                <div id="passes-list" className="flex flex-col gap-2">
                  {nextVisible?.isVisible && (
                    <div className="p-2 rounded border border-[#8aff8a]/40 bg-[#8aff8a]/10 text-xs">
                      <Icon name="eye" /> Next visible pass:{" "}
                      {nextVisible.startTime.toLocaleString(undefined, {
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      — max elevation {nextVisible.maxElevation.toFixed(0)}°,
                      magnitude {nextVisible.magnitude.toFixed(1)}
                    </div>
                  )}
                  {passes.map((pass) => (
                    <PassPredictionCard
                      key={pass.startTime.getTime()}
                      pass={pass}
                      satelliteName={selectedSatellite.name}
                    />
                  ))}
                </div>
              )}
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
