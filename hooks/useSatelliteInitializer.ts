/**
 * useSatelliteInitializer — Bootstraps the global satellite store on first
 * load by fetching TLE data from the Next.js API route and enriching it
 * with metadata.
 *
 * Also sets up periodic refresh to keep TLEs fresh (< 5 min lag).
 */

import { useEffect } from "react";
import useSWR, { mutate } from "swr";
import { useSatelliteStore } from "@/lib/satellite-store";
import { TLE_CACHE_TTL } from "@/lib/constants";
import { Satellite, TleSet, SatelliteGroup } from "@/types";
import { GROUP_COLORS } from "@/lib/constants";
import { getGroupColor } from "@/lib/color-utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Direct fetch fallback — bypasses SWR if it's stuck. */
async function directFetchTle(): Promise<TleSet[] | null> {
  try {
    const res = await fetch("/api/tle");
    if (!res.ok) return null;
    const data = await res.json();
    return data.tles || [];
  } catch {
    return null;
  }
}

export function useSatelliteInitializer() {
  const {
    setSatellites,
    setLoading,
    setError,
    setTleAge,
  } = useSatelliteStore();

  const { data, error, isValidating } = useSWR(
    "/api/tle",
    fetcher,
    {
      refreshInterval: TLE_CACHE_TTL * 1000,
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  useEffect(() => {
    if (isValidating && !data) {
      setLoading(true);
    }

    if (data) {
      try {
        const tleSets: TleSet[] = data.tles || [];

        // Build satellite objects from TLE data
        const satellites = new Map<string, Satellite>();
        const seenIds = new Set<string>();

        tleSets.forEach((tle) => {
          if (tle.noradId && !seenIds.has(tle.noradId)) {
            seenIds.add(tle.noradId);
            const group = (tle.group || "OTHER") as SatelliteGroup;

            satellites.set(tle.noradId, {
              noradId: tle.noradId,
              name: tle.name,
              tle: tle,
              group,
              type: inferType(group),
              operator: inferOperator(group),
              country: inferCountry(group),
              period: 0, // Will be computed from TLE
              inclination: 0,
              raan: 0,
              apogee: 0,
              perigee: 0,
              altitude: 0,
              color: getGroupColor(group),
              launchDate: undefined,
            });
          }
        });

        setSatellites(satellites);
        setLoading(false);
        setError(null);

        // Record TLE age
        if (data.fetchedAt) {
          const age = (Date.now() - new Date(data.fetchedAt).getTime()) / 1000;
          setTleAge(age);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize");
        setLoading(false);
      }
    } else if (error) {
      setError(error.message || "Failed to fetch satellite data");
      setLoading(false);
    } else if (!isValidating) {
      // SWR has finished but returned no data and no error —
      // clear the loading state to prevent infinite loading screen
      setLoading(false);
    }
  }, [data, error, isValidating, setSatellites, setLoading, setError, setTleAge]);

  // Safety: if the initial SWR fetch takes longer than 8s (e.g., Celestrak
  // timeout), fall back to a direct fetch from the local cache so the UI unblocks.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const store = useSatelliteStore.getState();
      if (store.isLoading && store.satellites.size === 0) {
        const tleSets = await directFetchTle();
        if (!cancelled && tleSets && tleSets.length > 0) {
          const satellites = new Map<string, Satellite>();
          const seenIds = new Set<string>();
          tleSets.forEach((tle) => {
            if (tle.noradId && !seenIds.has(tle.noradId)) {
              seenIds.add(tle.noradId);
              const group = (tle.group || "OTHER") as SatelliteGroup;
              satellites.set(tle.noradId, {
                noradId: tle.noradId,
                name: tle.name,
                tle: tle,
                group,
                type: inferType(group),
                operator: inferOperator(group),
                country: inferCountry(group),
                period: 0,
                inclination: 0,
                raan: 0,
                apogee: 0,
                perigee: 0,
                altitude: 0,
                color: getGroupColor(group),
                launchDate: undefined,
              });
            }
          });
          store.setSatellites(satellites);
          store.setLoading(false);
          store.setError(null);
        }
      }
    }, 8000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return { data, error, isValidating };
}

// ─── Helpers ─────────────────────────────────────────── //

function inferType(group: SatelliteGroup): string {
  const map: Record<SatelliteGroup, string> = {
    STATIONS: "Station",
    STARLINK: "Comms",
    ONEWEB: "Comms",
    "GPS-OPS": "Nav",
    GOES: "Weather",
    SES: "Comms",
    INTREPID: "Comms",
    OTHER: "Unknown",
  };
  return map[group] ?? "Unknown";
}

function inferOperator(group: SatelliteGroup): string {
  const map: Record<SatelliteGroup, string> = {
    STATIONS: "NASA/ESA/CNSA",
    STARLINK: "SpaceX",
    ONEWEB: "OneWeb",
    "GPS-OPS": "USAF",
    GOES: "NOAA/NASA",
    SES: "SES",
    INTREPID: "Intelsat",
    OTHER: "Unknown",
  };
  return map[group] ?? "Unknown";
}

function inferCountry(group: SatelliteGroup): string {
  const map: Record<SatelliteGroup, string> = {
    STATIONS: "ISS/China/Russia",
    STARLINK: "USA",
    ONEWEB: "UK/USA",
    "GPS-OPS": "USA",
    GOES: "USA",
    SES: "Luxembourg",
    INTREPID: "Luxembourg",
    OTHER: "Unknown",
  };
  return map[group] ?? "Unknown";
}
