/**
 * usePassPredictions — Compute satellite pass predictions for the
 * observer's location.
 *
 * Runs client-side: with cached satrecs a 24h scan is a few milliseconds,
 * and the TLEs in the store are exactly what the globe renders. The
 * POST /api/passes route remains for non-UI consumers.
 */

import useSWR from "swr";
import { predictPasses } from "@/lib/pass-calculator";
import { useSatelliteStore } from "@/lib/satellite-store";
import { Satellite, PassPrediction, ObserverLocation } from "@/types";

export function usePassPredictions(satellite: Satellite | null, hours: number = 24) {
  const observer = useSatelliteStore((s) => s.observer);

  const { data, error, isLoading, mutate } = useSWR<PassPrediction[]>(
    satellite?.tle
      ? ["passes", satellite.noradId, observer.lat, observer.lon, hours]
      : null,
    async () => {
      if (!satellite?.tle) return [];
      return predictPasses(satellite.tle, observer, new Date(), hours);
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 min
    }
  );

  const passes = data ?? [];
  return {
    passes,
    count: passes.length,
    /** First actually-watchable pass (sunlit sat, dark sky), else first pass. */
    nextVisible: passes.find((p) => p.isVisible) ?? passes[0] ?? null,
    isLoading,
    error,
    mutate,
  };
}

export function useObserver(): ObserverLocation {
  return useSatelliteStore((s) => s.observer);
}
