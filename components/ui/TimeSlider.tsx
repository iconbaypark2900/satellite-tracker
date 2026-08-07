/**
 * TimeSlider.tsx — Time warp control with a draggable slider ranging
 * from -24h to +30d. Displays current simulated time.
 *
 * Supports keyboard shortcuts: Space = reset, ←/→ = step, +/- = speed.
 */

"use client";

import { useEffect, useCallback } from "react";
import { useTimeControl } from "@/hooks/useTimeControl";
import { TIME_SLIDER_MIN, TIME_SLIDER_MAX, TIME_SLIDER_STEP } from "@/lib/constants";
import { useSatelliteStore } from "@/lib/satellite-store";

export default function TimeSlider() {
  const { offsetMinutes, isPlaying, speed, simTime, setTime, reset, play, pause, setSpeed } = useTimeControl();
  const { setTimeOffset } = useSatelliteStore();

  // Format time offset for display
  const formatOffset = useCallback((minutes: number) => {
    const abs = Math.abs(minutes);
    if (abs < 60) return `${minutes >= 0 ? "+" : "-"}${Math.round(abs)} min`;
    if (abs < 1440) {
      const h = Math.floor(abs / 60);
      const m = Math.round(abs % 60);
      return `${minutes >= 0 ? "+" : "-"}${h}h ${m}min`;
    }
    const d = Math.floor(abs / 1440);
    const h = Math.floor((abs % 1440) / 60);
    return `${minutes >= 0 ? "+" : "-"}${d}d ${h}h`;
  }, []);

  const displayOffset = formatOffset(offsetMinutes);
  const displayTime = simTime.toUTCString().slice(4, 22);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (isPlaying) pause();
        else play();
      }
      if (e.key === "Escape") {
        reset();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPlaying, play, pause, reset]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimeOffset(parseInt(e.target.value));
  };

  return (
    <div id="tc">
      <div className="td" id="td">{displayOffset}</div>
      <div className="ts" id="ts">Simulated: {displayTime}</div>

      <input
        type="range"
        id="tslider"
        min={TIME_SLIDER_MIN}
        max={TIME_SLIDER_MAX}
        step={TIME_SLIDER_STEP}
        value={offsetMinutes}
        onChange={handleSliderChange}
      />

      <div className="ts" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>-24h</span>
        <span>+24h</span>
        <span>+30d</span>
      </div>

      {/* Speed & Play controls */}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}>
        <button
          className="sb"
          style={{ fontSize: "0.65rem", padding: "0.2rem 0.5rem" }}
          onClick={isPlaying ? pause : play}
        >
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          className="sb"
          style={{ fontSize: "0.65rem", padding: "0.2rem 0.5rem" }}
          onClick={reset}
        >
          ⟲ Now
        </button>
        <select
          className="sb"
          style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem", width: "auto" }}
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
        >
          <option value={1}>1x</option>
          <option value={5}>5x</option>
          <option value={60}>1h/min</option>
          <option value={1440}>1d/min</option>
        </select>
      </div>
    </div>
  );
}
