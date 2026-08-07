/**
 * usePassPredictions — Fetch and compute satellite pass predictions
 * for the observer's location.
 */

import useSWR from "swr";
import { predictPasses, getNextVisiblePass } from "@/lib/pass-calculator";
import { useSatelliteStore } from "@/lib/satellite-store";
import { Satellite, PassPrediction, ObserverLocation } from "@/types";

export function usePassPredictions(
  satellite: Satellite | null,
  hours: number = 24
) {
  const observer = useSatelliteStore((s) => s.observer);

  return useSWR<PassPrediction[]>(
    satellite && satellite.tle
      ? ["passes", satellite.noradId, observer.lat, observer.lon, hours]
      : null,
    async () => {
      if (!satellite || !satellite.tle) return [];
      return predictPasses(
        satellite.tle,
        observer,
        new Date(),
        hours,
        10
      );
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 min
    }
  );
}

export function useNextVisiblePass(
  satellite: Satellite | null
) {
  const observer = useSatelliteStore((s) => s.observer);

  return useSWR<PassPrediction | null>(
    satellite && satellite.tle
      ? ["next-visible-pass", satellite.noradId, observer.lat, observer.lon]
      : null,
    async () => {
      if (!satellite || !satellite.tle) return null;
      return getNextVisiblePass(satellite.tle, observer, new Date());
    },
    {
      refreshInterval: 60000, // 1 min
      revalidateOnFocus: false,
    }
  );
}

export function useObserver(): ObserverLocation {
  return useSatelliteStore((s) => s.observer);
}
