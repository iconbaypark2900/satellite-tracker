/**
 * Footer.tsx — App footer with credits, data source attribution, and
 * quick links to docs, demo, and GitHub.
 */

"use client";

import { useSatelliteStore } from "@/lib/satellite-store";

export default function Footer() {
  const tleAge = useSatelliteStore((s) => s.tleAge);

  return (
    <footer
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "2.5rem",
        padding: "0 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(10,10,20,0.85)",
        borderTop: "1px solid #222",
        fontSize: "0.65rem",
        color: "#6f6d69",
        zIndex: 90,
      }}
    >
      <div>
        Data: <a href="https://celestrak.org" target="_blank" rel="noopener noreferrer" style={{ color: "#4a9eff" }}>Celestrak</a> +{" "}
        <a href="https://nasa.gov" target="_blank" rel="noopener noreferrer" style={{ color: "#4a9eff" }}>NASA</a> |{" "}
        <span>⚡ SGP4 via satellite.js</span>
      </div>

      <div style={{ display: "flex", gap: "1rem" }}>
        <a href="https://github.com/Quantum-Global-Group/satellite-tracker" target="_blank" rel="noopener noreferrer" style={{ color: "#4a9eff" }}>GitHub</a>
        <a href="/demo/index.html" style={{ color: "#4a9eff" }}>Demo</a>
        <a href="/docs/PRD.md" style={{ color: "#4a9eff" }}>PRD</a>
      </div>
    </footer>
  );
}
