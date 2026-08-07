/**
 * LoadingScreen.tsx — Splash screen shown while TLE data loads.
 *
 * Displays a progress indicator and loading status text.
 */

"use client";

import { useSatelliteStore } from "@/lib/satellite-store";

export default function LoadingScreen() {
  const { isLoading, error, tleAge } = useSatelliteStore();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#05051a",
        color: "#e0e0ff",
        zIndex: 1000,
      }}
    >
      <div style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
        🛰️ Satellite Tracker
      </div>

      <div style={{ fontSize: "0.72rem", color: "#6f6d69", marginBottom: "1.5rem" }}>
        Loading orbital data…
      </div>

      <div
        style={{
          width: "32px",
          height: "32px",
          border: "2px solid rgba(65, 55, 139, 0.3)",
          borderTopColor: "#4137ff",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {error && (
        <p style={{ color: "#ff80ab", fontSize: "0.7rem", marginTop: "1rem" }}>
          ⚠️ {error} — retrying…
        </p>
      )}
    </div>
  );
}
