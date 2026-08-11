/**
 * useSatCatData — SWR hooks for SATCAT satellite metadata, fetched via
 * the app's /api/satcat proxy (server-side fetch avoids browser CORS;
 * degrades gracefully when Celestrak is unreachable).
 */

import useSWR from "swr";
import { SatCatRecord } from "@/types/satellite";
import { SATCAT_CACHE_TTL } from "@/lib/constants";

async function fetchViaProxy(ids: string): Promise<SatCatRecord[]> {
  const res = await fetch(`/api/satcat?ids=${encodeURIComponent(ids)}`);
  if (!res.ok) throw new Error(`SATCAT proxy returned ${res.status}`);
  const body = await res.json();
  return body.records ?? [];
}

export function useSatCatData(noradIds: string[]) {
  const idKey = noradIds.join(",");

  const { data, error, isValidating, mutate } = useSWR<SatCatRecord[]>(
    noradIds.length > 0 ? ["satcat", idKey] : null,
    () => fetchViaProxy(idKey),
    {
      refreshInterval: SATCAT_CACHE_TTL * 1000,
      revalidateOnFocus: false,
      dedupingInterval: 600000, // 10 min
      shouldRetryOnError: false, // unreachable SATCAT should stay quiet
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

export function useSatCatRecord(noradId: string | null) {
  const { records, isLoading, isError, isRefreshing, mutate } = useSatCatData(
    noradId ? [noradId] : []
  );
  return {
    record:
      records.find((r) => String(r.NORAD_CAT_ID) === String(noradId)) ?? null,
    isLoading,
    isError,
    isRefreshing,
    mutate,
  };
}
