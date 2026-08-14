/**
 * /conjunctions — All-vs-all close-approach screening.
 *
 * Screens every visible satellite pair for close approaches over a
 * chosen window/threshold, off the main thread, and lists refined
 * events (TCA to <0.1s) sorted by miss distance.
 */

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/ui/Sidebar";
import { useSatelliteStore } from "@/lib/satellite-store";
import { useSatelliteInitializer } from "@/hooks/useSatelliteInitializer";
import { useConjunctionScreener } from "@/hooks/useConjunctionScreener";
import { getGroupColor } from "@/lib/color-utils";
import { SatelliteGroup, TleSet } from "@/types";
import PcCell from "@/components/ui/PcCell";
import { PC_ASSUMPTION_NOTE } from "@/lib/collision-probability";
import Icon, { IconLabel } from "@/components/ui/Icon";

const DISPLAY_CAP = 200;

export default function ConjunctionsPage() {
  useSatelliteInitializer();
  const router = useRouter();
  const satellites = useSatelliteStore((s) => s.satellites);
  const filters = useSatelliteStore((s) => s.constellationFilters);
  const setSelectedSatellite = useSatelliteStore((s) => s.setSelectedSatellite);
  const setTimeOffset = useSatelliteStore((s) => s.setTimeOffset);
  const error = useSatelliteStore((s) => s.error);

  const [hours, setHours] = useState(24);
  const [thresholdKm, setThresholdKm] = useState(10);
  const screener = useConjunctionScreener();

  const visibleTles = useMemo(() => {
    const tles: TleSet[] = [];
    satellites.forEach((sat) => {
      if (filters[sat.group as string] === false) return;
      if (sat.tle) tles.push(sat.tle);
    });
    return tles;
  }, [satellites, filters]);

  const canRun = visibleTles.length >= 2 && screener.status !== "running";

  const handleViewAtTca = (idA: string, tcaMs: number) => {
    const sat = satellites.get(idA);
    if (sat) setSelectedSatellite(sat);
    setTimeOffset((tcaMs - Date.now()) / 60000);
    router.push("/globe");
  };

  const shown = screener.events.slice(0, DISPLAY_CAP);

  return (
    <main className="relative h-screen w-full">
      <Header />

      <div className="absolute top-14 left-0 right-80 bottom-10 overflow-auto">
        <div className="max-w-5xl mx-auto p-4">
          <h1 className="text-xl font-bold mb-1 flex items-center gap-2">
            <Icon name="alert" />
            Conjunction Screening
          </h1>
          <p className="text-xs text-[#6f6d69] mb-4">
            All-vs-all close-approach search: spatial-hash screening on a
            coarse grid with a velocity-aware interval test, golden-section
            TCA refinement against full SGP4. Screening accuracy is bounded
            by TLE quality (~km-scale) — this is situational awareness, not
            operational conjunction assessment.
          </p>

          {/* Controls */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="text-xs text-[#6f6d69]">Window:</span>
            {[24, 48].map((h) => (
              <button
                key={h}
                className="sb"
                style={{
                  width: "auto",
                  marginBottom: 0,
                  padding: "0.2rem 0.7rem",
                  borderColor: hours === h ? "#4a9eff" : "#222",
                  color: hours === h ? "#4a9eff" : "#e0e0ff",
                }}
                onClick={() => setHours(h)}
                disabled={screener.status === "running"}
              >
                {h}h
              </button>
            ))}
            <span className="text-xs text-[#6f6d69] ml-2">Threshold:</span>
            {[5, 10, 25].map((d) => (
              <button
                key={d}
                className="sb"
                style={{
                  width: "auto",
                  marginBottom: 0,
                  padding: "0.2rem 0.7rem",
                  borderColor: thresholdKm === d ? "#4a9eff" : "#222",
                  color: thresholdKm === d ? "#4a9eff" : "#e0e0ff",
                }}
                onClick={() => setThresholdKm(d)}
                disabled={screener.status === "running"}
              >
                {d} km
              </button>
            ))}

            {screener.status === "running" ? (
              <button
                className="sb"
                style={{ width: "auto", marginBottom: 0, padding: "0.2rem 1rem", marginLeft: "auto", color: "#ff80ab" }}
                onClick={screener.cancel}
              >
                <IconLabel icon="close">Cancel</IconLabel>
              </button>
            ) : (
              <button
                className="sb"
                style={{
                  width: "auto",
                  marginBottom: 0,
                  padding: "0.2rem 1rem",
                  marginLeft: "auto",
                  borderColor: canRun ? "#4a9eff" : "#222",
                  color: canRun ? "#4a9eff" : "#6f6d69",
                }}
                onClick={() => screener.run(visibleTles, hours, thresholdKm)}
                disabled={!canRun}
              >
                <IconLabel icon="play">Run screening</IconLabel>
              </button>
            )}
          </div>

          <p className="text-xs text-[#6f6d69] mb-3">
            Screening {visibleTles.length} visible satellites
            {visibleTles.length > 4000 &&
              " — large fleet: expect a multi-minute 48h run; 24h recommended"}
            {visibleTles.length < 2 && " — need at least 2 satellites with TLEs"}
          </p>

          {/* Progress */}
          {screener.status === "running" && (
            <div className="mb-4">
              <div
                style={{
                  height: "6px",
                  background: "rgba(20,20,35,0.8)",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round(screener.progress * 100)}%`,
                    background: "#4137ff",
                    transition: "width 0.2s",
                  }}
                />
              </div>
              <p className="text-xs text-[#6f6d69] mt-1">{screener.phase}…</p>
            </div>
          )}

          {screener.status === "error" && (
            <p className="text-sm text-[#ff80ab] mb-3">
              Screening failed: {screener.error}{" "}
              <button
                className="underline text-[#4a9eff]"
                onClick={() => screener.run(visibleTles, hours, thresholdKm)}
              >
                Retry
              </button>
            </p>
          )}

          {/* Results */}
          {screener.status === "done" && (
            <>
              <p className="text-xs text-[#6f6d69] mb-2">
                {screener.stats && (
                  <>
                    {screener.ranWith?.satCount} satellites · {screener.ranWith?.hours}h ·
                    ≤{screener.ranWith?.thresholdKm} km · {screener.stats.refinements} candidates
                    refined · {(screener.elapsedMs / 1000).toFixed(1)}s ·
                    computed {new Date(screener.ranWith?.at ?? 0).toISOString().slice(11, 16)}Z
                  </>
                )}
              </p>

              {screener.events.length === 0 ? (
                <p className="text-sm text-[#6f6d69] py-4">
                  No approaches within {screener.ranWith?.thresholdKm} km over the
                  next {screener.ranWith?.hours} hours among the screened
                  satellites.
                </p>
              ) : (
                <>
                  <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr className="text-[#6f6d69] text-left">
                        <th className="py-1 pr-2">Pair</th>
                        <th className="py-1 pr-2">TCA (UTC)</th>
                        <th className="py-1 pr-2">Miss (km)</th>
                        <th className="py-1 pr-2">Rel speed</th>
                        <th className="py-1 pr-2">Pc</th>
                        <th className="py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((ev, i) => (
                        <tr key={i} className="border-t border-[#222233]">
                          <td className="py-1.5 pr-2">
                            <PairCell
                              nameA={ev.nameA}
                              groupA={ev.groupA}
                              nameB={ev.nameB}
                              groupB={ev.groupB}
                            />
                          </td>
                          <td className="py-1.5 pr-2 font-mono">
                            {new Date(ev.tcaMs).toISOString().slice(5, 19).replace("T", " ")}
                          </td>
                          <td className="py-1.5 pr-2 font-mono" style={{ color: ev.missKm < 5 ? "#ff80ab" : "#e0e0ff" }}>
                            {ev.missKm.toFixed(2)}
                          </td>
                          <td className="py-1.5 pr-2 font-mono">
                            {ev.relSpeedKmS.toFixed(2)} km/s
                          </td>
                          <PcCell pc={ev.pc} sigmaKm={ev.pcSigmaKm} missKm={ev.missKm} />
                          <td className="py-1.5">
                            <button
                              className="underline text-[#4a9eff]"
                              onClick={() => handleViewAtTca(ev.idA, ev.tcaMs)}
                            >
                              View at TCA
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[0.62rem] leading-relaxed text-text-tertiary">
                    <span className="text-text-secondary">Pc:</span>{" "}
                    {PC_ASSUMPTION_NOTE} Hard-body radius assumed at 10 m
                    combined. Values marked <span className="font-mono">≈σ</span>{" "}
                    are dominated by that assumed uncertainty rather than by the
                    encounter geometry, and should not be used to rank
                    encounters.
                  </p>
                  {screener.stats && screener.stats.totalFound > shown.length && (
                    <p className="text-xs text-[#6f6d69] mt-2">
                      {screener.stats.totalFound - shown.length} more not shown
                      (closest {shown.length} by miss distance).
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right sidebar */}
      <div className="absolute top-14 right-0 bottom-10 w-80">
        <Sidebar />
      </div>

      <Footer />

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

function PairCell({
  nameA,
  groupA,
  nameB,
  groupB,
}: {
  nameA: string;
  groupA?: string;
  nameB: string;
  groupB?: string;
}) {
  const dot = (group?: string) => (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: getGroupColor((group ?? "OTHER") as SatelliteGroup),
        marginRight: 4,
      }}
    />
  );
  return (
    <span>
      {dot(groupA)}
      {nameA}
      <span style={{ color: "#6f6d69" }}> ↔ </span>
      {dot(groupB)}
      {nameB}
    </span>
  );
}
