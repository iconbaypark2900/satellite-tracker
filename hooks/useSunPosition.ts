/**
 * useSunPosition — Memoized Sun direction calculation for the current
 * simulation time. Uses astronomical algorithms (VSOP87 approximation).
 */

import { useMemo } from "react";
import { useSatelliteStore } from "@/lib/satellite-store";
import { getSunPositionFromDate } from "@/lib/sun-position";
import { SunPosition } from "@/lib/sun-position";

/** The sun moves ~0.25°/min — recomputing more often than once per
 *  sim-minute is invisible, and the coarse selector keeps consumers from
 *  re-rendering on every 10Hz time tick. */
const SUN_TIME_BUCKET_MS = 60000;

export function useSunPosition(): SunPosition | null {
  const timeBucket = useSatelliteStore((s) =>
    Math.floor(s.timeControl.simTime.getTime() / SUN_TIME_BUCKET_MS)
  );

  return useMemo(() => {
    return getSunPositionFromDate(new Date(timeBucket * SUN_TIME_BUCKET_MS));
  }, [timeBucket]);
}

export function useSunIllumination(
  position: [number, number, number] | null,
  date: Date
) {
  const sun = useMemo(() => getSunPositionFromDate(date), [date]);

  return useMemo(() => {
    if (!position) return false;
    const dot =
      position[0] * sun.eci[0] +
      position[1] * sun.eci[1] +
      position[2] * sun.eci[2];
    return dot > 0;
  }, [position, sun]);
}

// Re-export type
export type { SunPosition };
