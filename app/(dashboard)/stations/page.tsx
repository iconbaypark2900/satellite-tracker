/**
 * /stations — Ground-station access planner.
 *
 * Manage a set of ground stations, pick satellites, and see all access
 * windows on a timeline. Exportable to .ics for calendar apps.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/ui/Sidebar";
import StationManager from "@/components/stations/StationManager";
import SatellitePicker from "@/components/stations/SatellitePicker";
import AccessTimeline from "@/components/stations/AccessTimeline";
import { useSatelliteStore } from "@/lib/satellite-store";
import { useSatelliteInitializer } from "@/hooks/useSatelliteInitializer";
import { useGroundStations } from "@/hooks/useGroundStations";
import { computeAccessWindows } from "@/lib/access-windows";
import { accessEventsToIcs } from "@/lib/ics-export";
import { Satellite } from "@/types";
import Icon, { IconLabel } from "@/components/ui/Icon";
import PassStatus from "@/components/ui/PassStatus";

export default function StationsPage() {
  useSatelliteInitializer();
  const satellites = useSatelliteStore((s) => s.satellites);
  const selectedSatellite = useSatelliteStore((s) => s.selectedSatellite);
  const error = useSatelliteStore((s) => s.error);
  const { stations } = useGroundStations();

  const [picked, setPicked] = useState<string[]>([]);
  const [hours, setHours] = useState(24);
  // Quantized start so the memo doesn't churn (5-min buckets)
  const startMs = useMemo(() => Math.floor(Date.now() / 300000) * 300000, []);

  // Seed the picker with the currently selected satellite
  useEffect(() => {
    if (selectedSatellite && picked.length === 0) {
      setPicked([selectedSatellite.noradId]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSatellite]);

  const pickedSats = useMemo(
    () =>
      picked
        .map((id) => satellites.get(id))
        .filter((s): s is Satellite => !!s?.tle),
    [picked, satellites]
  );

  const events = useMemo(() => {
    if (pickedSats.length === 0 || stations.length === 0) return [];
    return computeAccessWindows(pickedSats, stations, new Date(startMs), hours);
  }, [pickedSats, stations, startMs, hours]);

  const handleExport = () => {
    const ics = accessEventsToIcs(events);
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `satellite-passes-${new Date(startMs).toISOString().slice(0, 10)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="relative h-screen w-full">
      <Header />

      <div className="absolute top-14 left-0 right-80 bottom-10 overflow-auto">
        <div className="max-w-5xl mx-auto p-4">
          <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Icon name="signal" />
            Ground-Station Access Planner
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <StationManager />
            <SatellitePicker picked={picked} onChange={setPicked} />
          </div>

          {/* Window + export controls */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-[#6f6d69]">Window:</span>
            {[24, 48].map((h) => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className="sb"
                style={{
                  width: "auto",
                  marginBottom: 0,
                  padding: "0.2rem 0.7rem",
                  borderColor: hours === h ? "#4a9eff" : "#222",
                  color: hours === h ? "#4a9eff" : "#e0e0ff",
                }}
              >
                {h}h
              </button>
            ))}
            <span className="text-xs text-[#6f6d69] ml-2">
              {events.length} access window{events.length === 1 ? "" : "s"}
            </span>
            <button
              className="sb"
              style={{ width: "auto", marginBottom: 0, padding: "0.2rem 0.7rem", marginLeft: "auto" }}
              onClick={handleExport}
              disabled={events.length === 0}
            >
              <IconLabel icon="calendar">Export .ics</IconLabel>
            </button>
          </div>

          {pickedSats.length === 0 ? (
            <p className="text-sm text-[#6f6d69]">
              Pick at least one satellite (search above, or select one in the
              sidebar) to compute access windows.
            </p>
          ) : (
            <AccessTimeline events={events} startMs={startMs} hours={hours} />
          )}

          {/* Event table */}
          {events.length > 0 && (
            <div className="mt-4">
              <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr className="text-[#6f6d69] text-left">
                    <th className="py-1 pr-2">Station</th>
                    <th className="py-1 pr-2">Satellite</th>
                    <th className="py-1 pr-2">AOS (UTC)</th>
                    <th className="py-1 pr-2">LOS (UTC)</th>
                    <th className="py-1 pr-2">Dur</th>
                    <th className="py-1 pr-2">Max el</th>
                    <th className="py-1">Visibility</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, i) => {
                    const p = ev.pass;
                    const durMin = (p.endTime.getTime() - p.startTime.getTime()) / 60000;
                    return (
                      <tr key={i} className="border-t border-[#222233]">
                        <td className="py-1 pr-2">{ev.stationName}</td>
                        <td className="py-1 pr-2">{ev.satelliteName}</td>
                        <td className="py-1 pr-2 font-mono">
                          {p.startTime.toISOString().slice(5, 16).replace("T", " ")}
                        </td>
                        <td className="py-1 pr-2 font-mono">
                          {p.endTime.toISOString().slice(11, 16)}
                        </td>
                        <td className="py-1 pr-2">{durMin.toFixed(0)}m</td>
                        <td className="py-1 pr-2">{p.maxElevation.toFixed(0)}°</td>
                        <td className="py-1">
                          <PassStatus pass={p} terse />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
