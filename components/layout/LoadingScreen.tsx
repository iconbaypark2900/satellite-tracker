/**
 * LoadingScreen.tsx — Loading indicator shown while the 3D globe
 * bundle loads or while TLE data initializes.
 *
 * Renders as an inline (container-filling) spinner, NOT a full-screen
 * overlay, so the header, sidebar, and footer remain visible.
 */

"use client";

import Icon from "@/components/ui/Icon";

export default function LoadingScreen() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#05051a",
        color: "#e0e0ff",
        zIndex: 10,
      }}
    >
      <div
        style={{
          fontSize: "1rem",
          marginBottom: "0.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <Icon name="satellite" />
        Loading globe…
      </div>

      <div style={{ fontSize: "0.7rem", color: "#6f6d69", marginBottom: "1rem" }}>
        Initializing orbital data…
      </div>

      <div
        style={{
          width: "28px",
          height: "28px",
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
    </div>
  );
}
