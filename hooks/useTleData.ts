/**
 * useTleData — SWR hook for fetching and caching TLE data from Celestrak.
 *
 * Automatically refreshes every 5 minutes. Returns parsed TLE sets grouped
 * by constellation.
 */

import useSWR from "swr";
import { fetchAllTles, fetchTleForGroup, clearTleCache, getTleAge } from "@/lib/tle-client";
import { TleSet, CelestrakGroup } from "@/types";
import { TLE_CACHE_TTL, CELESTRAK_TLE_GROUPS } from "@/lib/constants";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useTleData() {
  const { data, error, isValidating, isLoading, mutate } = useSWR<{
    tles: TleSet[];
    age: number;
  }>(
    "tle-data",
    async () => {
      const tles = await fetchAllTles();
      return { tles, age: 0 };
    },
    {
      refreshInterval: TLE_CACHE_TTL * 1000,
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  return {
    tles: data?.tles ?? [],
    isLoading: isLoading || (!error && !data),
    isError: error,
    isRefreshing: isValidating,
    mutate,
  };
}

export function useTleForGroup(group: CelestrakGroup) {
  const { data, error, isValidating, mutate } = useSWR<TleSet[]>(
    group ? ["tle-group", group] : null,
    () => fetchTleForGroup(group),
    {
      refreshInterval: TLE_CACHE_TTL * 1000,
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  return {
    tles: data ?? [],
    isLoading: !error && !data,
    isError: error,
    isRefreshing: isValidating,
    mutate,
  };
}

export function useTleAge() {
  return useSWR(
    "tle-age",
    () => {
      const groups = Object.keys(CELESTRAK_TLE_GROUPS) as CelestrakGroup[];
      return Math.max(...groups.map((g) => getTleAge(g)));
    },
    {
      refreshInterval: 1000,
      revalidateOnFocus: false,
      dedupingInterval: 1000,
    }
  );
}
