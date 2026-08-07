/**
 * Header.tsx — Top navigation bar.
 *
 * Displays the app title, connection status, time info, and
 * navigation links to the dashboard views (Globe, Sky, Passes).
 */

"use client";

import { useSatelliteStore } from "@/lib/satellite-store";
import { useTleAge } from "@/hooks/useTleData";
import { formatMinutes } from "@/lib/time-utils";

export default function Header() {
  const { timeControl, isLoading, error } = useSatelliteStore();
  const { data: tleAgeData } = useTleAge();
  const tleAgeMin = tleAgeData ? tleAgeData / 60 : 0;

  return (
    <header
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "3.5rem",
        padding: "0 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(10,10,20,0.85)",
        borderBottom: "1px solid #222",
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <h1 style={{ fontSize: "1.1rem", color: "#4137ff", margin: 0 }}>
          🛰️ Satellite Tracker
        </h1>
        {error && (
          <span style={{ color: "#ff80ab", fontSize: "0.7rem" }}>
            ⚠️ {error}
          </span>
        )}
      </div>

      <div
        id="sb-stats"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          background: "rgba(15,15,25,0.7)",
          padding: "0.3rem 0.8rem",
          borderRadius: "5px",
          border: "1px solid #222",
          fontSize: "0.68rem",
          color: "#6f6d69",
        }}
      >
        <span>🛰️ <span style={{ color: "#4a9eff" }}>{useSatelliteStore.getState().satellites.size}</span> tracked</span>
        <span>🌞 Sun: <span style={{ color: "#4a9eff" }}>--°</span></span>
        <span>⏱️ <span style={{ color: "#4a9eff" }}>{formatMinutes(timeControl.offsetMinutes)}</span></span>
        <span>📡 TLE age: <span style={{ color: "#4a9eff" }}>{tleAgeMin.toFixed(1)}m</span></span>
        {isLoading && <span style={{ color: "#4a9eff" }}>⏳ Loading…</span>}
      </div>
    </header>
  );
}
