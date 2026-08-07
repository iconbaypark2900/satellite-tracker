/**
 * PassPredictionCard.tsx — UI row/component for a single satellite
 * pass prediction. Shows time, max elevation, azimuth, and illumination status.
 */

"use client";

import { PassPrediction } from "@/types";
import { formatTime, formatDuration } from "@/lib/time-utils";

interface Props {
  pass: PassPrediction;
  satelliteName: string;
}

export default function PassPredictionCard({ pass, satelliteName }: Props) {
  const riseTime = formatTime(pass.startTime);
  const setTime = formatTime(pass.endTime);
  const transitTime = formatTime(pass.maxTime);
  const duration = formatDuration(
    (pass.endTime.getTime() - pass.startTime.getTime()) / 1000
  );

  const isVisible = pass.isLit;
  const maxElStr = pass.maxElevation.toFixed(0);

  return (
    <div
      className="dr"
      style={{
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "0.2rem",
        padding: "0.4rem",
        borderRadius: "6px",
        border: `1px solid ${pass.isLit ? "rgba(74,158,255,0.3)" : "rgba(111,109,105,0.3)"}`,
        background: "rgba(20,20,35,0.3)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
        <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#c0c0ff" }}>
          {riseTime} → {setTime}
        </span>
        <span
          className="dot"
          style={{
            background: pass.isLit ? "#8aff8a" : "#6f6d69",
            boxShadow: pass.isLit ? "0 0 6px #8aff8a" : "none",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: "1rem", fontSize: "0.65rem" }}>
        <span className="lab">Max El:</span>
        <span className="val">{maxElStr}°</span>
        <span className="lab">Dur:</span>
        <span className="val">{duration}</span>
        <span className="lab">Transit:</span>
        <span className="val">{transitTime}</span>
      </div>

      <div style={{ fontSize: "0.62rem", color: "#6f6d69" }}>
        Az: {pass.startAz.toFixed(0)}° → {pass.maxAz.toFixed(0)}° → {pass.endAz.toFixed(0)}°
        {"  "}
        {pass.isLit ? "☀️ Visible" : "🌙 Dark"}
        {"  "}
        Mag: {pass.magnitude.toFixed(1)}
      </div>
    </div>
  );
}

// Import time utilities
export { formatTime, formatDuration };
