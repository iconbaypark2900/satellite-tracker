/**
 * useSatCatData — SWR hooks for SATCAT satellite metadata, fetched via
 * the app's /api/satcat proxy (server-side fetch avoids browser CORS).
 *
 * The proxy answers 200 with `unavailable: true` when Celestrak cannot be
 * reached, rather than erroring, so an outage is a value the UI can render
 * rather than an exception. `isError` is therefore reserved for the proxy
 * itself failing.
 */

import useSWR from "swr";
import { SatCatRecord } from "@/types/satellite";
import { SATCAT_CACHE_TTL } from "@/lib/constants";

interface SatCatResponse {
  records: SatCatRecord[];
  unavailable?: boolean;
  reason?: string;
}

async function fetchViaProxy(ids: string): Promise<SatCatResponse> {
  const res = await fetch(`/api/satcat?ids=${encodeURIComponent(ids)}`);
  if (!res.ok) throw new Error(`SATCAT proxy returned ${res.status}`);
  const body = await res.json();
  return {
    records: body.records ?? [],
    unavailable: Boolean(body.unavailable),
    reason: body.reason,
  };
}

export function useSatCatData(noradIds: string[]) {
  const idKey = noradIds.join(",");

  const { data, error, isValidating, mutate } = useSWR<SatCatResponse>(
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
    records: data?.records ?? [],
    /** Celestrak could not be reached — distinct from "no record exists". */
    isUnavailable: Boolean(data?.unavailable) || Boolean(error),
    unavailableReason: data?.reason,
    isLoading: !error && !data,
    isError: error,
    isRefreshing: isValidating,
    mutate,
  };
}

export function useSatCatRecord(noradId: string | null) {
  const { records, isUnavailable, unavailableReason, isLoading, isError, isRefreshing, mutate } =
    useSatCatData(noradId ? [noradId] : []);
  return {
    record:
      records.find((r) => String(r.NORAD_CAT_ID) === String(noradId)) ?? null,
    isUnavailable,
    unavailableReason,
    isLoading,
    isError,
    isRefreshing,
    mutate,
  };
}
