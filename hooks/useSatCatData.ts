/**
 * useSatCatData — SWR hook for fetching SATCAT satellite metadata.
 *
 * Fetches metadata for a list of NORAD IDs. Cached for 24 hours.
 */

import useSWR from "swr";
import { fetchSatCatRecords, getCachedSatCat } from "@/lib/satcat-client";
import { SatCatRecord } from "@/types/satellite";
import { SATCAT_CACHE_TTL } from "@/lib/constants";

export function useSatCatData(noradIds: string[]) {
  const idKey = noradIds.length > 0 ? noradIds.join(",") : "none";

  const { data, error, isValidating, mutate } = useSWR<SatCatRecord[]>(
    noradIds.length > 0 ? ["satcat", idKey] : null,
    () => fetchSatCatRecords(noradIds),
    {
      refreshInterval: SATCAT_CACHE_TTL * 1000,
      revalidateOnFocus: false,
      dedupingInterval: 600000, // 10 min deduping
    }
  );

  return {
    records: data ?? [],
    isLoading: !error && !data,
    isError: error,
    isRefreshing: isValidating,
    mutate,
  };
}

export function useSatCatRecord(noradId: string) {
  const { data, error, isValidating, mutate } = useSWR<SatCatRecord | null>(
    noradId ? ["satcat-record", noradId] : null,
    () => fetchSatCatRecords([noradId]).then((r) => r[0] ?? null),
    {
      refreshInterval: SATCAT_CACHE_TTL * 1000,
      revalidateOnFocus: false,
      dedupingInterval: 600000,
    }
  );

  return {
    record: data ?? getCachedSatCat(noradId),
    isLoading: !error && !data,
    isError: error,
    isRefreshing: isValidating,
    mutate,
  };
}
