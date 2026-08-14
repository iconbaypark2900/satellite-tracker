/**
 * PassPredictionCard.tsx — UI row/component for a single satellite
 * pass prediction. Shows time, max elevation, azimuth, and illumination status.
 */

"use client";

import { PassPrediction } from "@/types";
import { formatTime, formatDuration } from "@/lib/time-utils";
import PassStatus from "@/components/ui/PassStatus";

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

  // Apparent elevation is what an observer sees; the geometric value is what
  // the satellite is at. They differ by ~0.09° at 10° and ~0.48° at the
  // horizon, so show the apparent one and only mention the difference when it
  // rounds to something visible at this precision.
  const maxElStr = (pass.maxElevationApparent ?? pass.maxElevation).toFixed(1);
  const refractionLift =
    pass.maxElevationApparent !== undefined
      ? pass.maxElevationApparent - pass.maxElevation
      : 0;

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
        <span
          className="val"
          title={
            refractionLift > 0
              ? `Apparent elevation. Geometric ${pass.maxElevation.toFixed(2)}°, ` +
                `lifted ${(refractionLift * 60).toFixed(1)}′ by refraction.`
              : undefined
          }
        >
          {maxElStr}°
        </span>
        <span className="lab">Dur:</span>
        <span className="val">{duration}</span>
        <span className="lab">Transit:</span>
        <span className="val">{transitTime}</span>
      </div>

      <div style={{ fontSize: "0.62rem", color: "#6f6d69" }}>
        Az: {pass.startAz.toFixed(0)}° → {pass.maxAz.toFixed(0)}° → {pass.endAz.toFixed(0)}°
        {"  "}
        <PassStatus pass={pass} />
        {"  "}
        <span
          title={
            pass.magnitudeIsCurated
              ? "From a curated standard magnitude for this NORAD id, with a phase-angle model. Published estimates carry roughly ±0.5 mag."
              : "No curated standard magnitude for this object — a class default was used. Treat as indicative only."
          }
        >
          Mag:{" "}
          {Number.isFinite(pass.magnitude) ? pass.magnitude.toFixed(1) : "—"}
          {pass.magnitudeIsCurated ? "" : "?"}
        </span>
      </div>
    </div>
  );
}
