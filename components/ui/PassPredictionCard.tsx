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
  // Prefix with the weekday when the pass isn't today
  const dayPrefix =
    pass.startTime.toDateString() === new Date().toDateString()
      ? ""
      : pass.startTime.toLocaleDateString(undefined, { weekday: "short" }) + " ";
  const riseTime = dayPrefix + formatTime(pass.startTime);
  const setTime = formatTime(pass.endTime);
  const transitTime = formatTime(pass.maxTime);
  const duration = formatDuration(
    (pass.endTime.getTime() - pass.startTime.getTime()) / 1000
  );

  const isVisible = pass.isVisible ?? pass.isLit;
  const statusText = isVisible
    ? "☀️ Visible"
    : pass.isLit
      ? "🌤️ Sunlit (sky too bright)"
      : "🌙 In shadow";
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
        border: `1px solid ${isVisible ? "rgba(138,255,138,0.35)" : pass.isLit ? "rgba(74,158,255,0.3)" : "rgba(111,109,105,0.3)"}`,
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
            background: isVisible ? "#8aff8a" : pass.isLit ? "#4a9eff" : "#6f6d69",
            boxShadow: isVisible ? "0 0 6px #8aff8a" : "none",
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
        {statusText}
        {"  "}
        Mag: {pass.magnitude.toFixed(1)}
      </div>
    </div>
  );
}
