/**
 * useTimeControl — Manage the simulation time state.
 *
 * Provides real-time clock synchronization, time offset (warp),
 * and playback controls. The simulated time is derived from
 * real time + offset minutes.
 */

import { useEffect, useRef, useCallback } from "react";
import { useSatelliteStore } from "@/lib/satellite-store";
import { TIME_SLIDER_MIN, TIME_SLIDER_MAX, MIN_REPROPAGATE_MS } from "@/lib/constants";

export function useTimeControl() {
  const { timeControl, setTimeOffset, setPlaying, setSpeed, setSimTime } = useSatelliteStore();
  const { offsetMinutes, isPlaying, speed, simTime } = timeControl;

  // Refs to avoid re-creating the animation loop on every state change.
  // The tick function reads current values via getState() to avoid
  // stale closures and dependency explosions.
  const stateRef = useRef({ isPlaying, speed });
  stateRef.current = { isPlaying, speed };

  // Real-time animation loop for time advancement.
  // Only re-creates the loop when isPlaying or speed changes —
  // NOT when offsetMinutes changes (that would cause infinite loops).
  useEffect(() => {
    if (!isPlaying) return;

    let last = performance.now();

    const tick = (now: number) => {
      const current = stateRef.current;

      const deltaMs = now - last;
      if (deltaMs < MIN_REPROPAGATE_MS) {
        // Throttle: only update when enough time has passed
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const deltaSec = deltaMs / 1000;
      const deltaMin = deltaSec * current.speed * 60;

      // Read the current offset directly from the store (no stale closure)
      const currentOffset = useSatelliteStore.getState().timeControl.offsetMinutes;
      const newOffset = currentOffset + deltaMin;

      // Clamp to slider range
      const clampedOffset = Math.max(
        TIME_SLIDER_MIN,
        Math.min(TIME_SLIDER_MAX, newOffset)
      );

      setTimeOffset(clampedOffset);
      setSimTime(new Date(Date.now() + clampedOffset * 60000));
      last = now;

      rafRef.current = requestAnimationFrame(tick);
    };

    const rafRef = { current: 0 as number | undefined };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, speed, setTimeOffset, setSimTime]);

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
