/**
 * useTimeControl — Manage the simulation time state.
 *
 * Provides real-time clock synchronization, time offset (warp),
 * and playback controls. The simulated time is derived from
 * real time + offset minutes.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useSatelliteStore } from "@/lib/satellite-store";
import { TimeControlState } from "@/types";
import { TIME_SLIDER_MIN, TIME_SLIDER_MAX } from "@/lib/constants";

export function useTimeControl() {
  const store = useSatelliteStore();
  const { timeControl, setTimeOffset, setPlaying, setSpeed, setSimTime } = store;

  const { offsetMinutes, isPlaying, speed, simTime } = timeControl;
  const rafRef = useRef<number>();

  // Real-time animation loop for time advancement
  useEffect(() => {
    if (!isPlaying) return;

    let last = performance.now();

    const tick = (now: number) => {
      const deltaSec = (now - last) / 1000;
      const deltaMin = (deltaSec * speed * 60); // speed multiplier

      // Only update if there's a meaningful delta
      const newOffset = offsetMinutes + deltaMin;

      // Clamp to slider range
      const clampedOffset = Math.max(TIME_SLIDER_MIN, Math.min(TIME_SLIDER_MAX, newOffset));
      setTimeOffset(clampedOffset);
      setSimTime(new Date(Date.now() + clampedOffset * 60000));

      last = now;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, speed, offsetMinutes, setTimeOffset, setPlaying, setSpeed, setSimTime]);

  const setTime = useCallback((minutes: number) => {
    setTimeOffset(minutes);
    setSimTime(new Date(Date.now() + minutes * 60000));
  }, [setTimeOffset, setSimTime]);

  const reset = useCallback(() => {
    setTime(0);
  }, [setTime]);

  const play = useCallback(() => setPlaying(true), [setPlaying]);
  const pause = useCallback(() => setPlaying(false), [setPlaying]);

  const setTimeSpeed = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
  }, [setSpeed]);

  return {
    offsetMinutes,
    isPlaying,
    speed,
    simTime,
    setTime,
    reset,
    play,
    pause,
    setSpeed: setTimeSpeed,
  };
}
