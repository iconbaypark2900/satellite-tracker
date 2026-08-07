/**
 * useSunPosition — Memoized Sun direction calculation for the current
 * simulation time. Uses astronomical algorithms (VSOP87 approximation).
 */

import { useMemo } from "react";
import { useTimeControl } from "@/hooks/useTimeControl";
import { getSunPositionFromDate } from "@/lib/sun-position";
import { SunPosition } from "@/lib/sun-position";

export function useSunPosition(): SunPosition | null {
  const { simTime } = useTimeControl();

  return useMemo(() => {
    return getSunPositionFromDate(simTime);
  }, [simTime]);
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
