/**
 * useGroundStations — Ground-station list with localStorage persistence.
 * Hydrates once per app load (same pattern as useLocation); defaults to
 * a "Home" station at the current observer location.
 */

import { useEffect } from "react";
import { useSatelliteStore } from "@/lib/satellite-store";
import { GroundStation } from "@/types";

const STORAGE_KEY = "satellite-tracker:ground-stations";

let hasHydrated = false;

function isValidStation(s: unknown): s is GroundStation {
  if (typeof s !== "object" || s === null) return false;
  const g = s as Record<string, unknown>;
  return (
    typeof g.id === "string" &&
    typeof g.name === "string" &&
    typeof g.lat === "number" &&
    Math.abs(g.lat as number) <= 90 &&
    typeof g.lon === "number" &&
    Math.abs(g.lon as number) <= 180 &&
    typeof g.minElevation === "number"
  );
}

export function useGroundStations() {
  const stations = useSatelliteStore((s) => s.groundStations);
  const addGroundStation = useSatelliteStore((s) => s.addGroundStation);
  const updateGroundStation = useSatelliteStore((s) => s.updateGroundStation);
  const removeGroundStation = useSatelliteStore((s) => s.removeGroundStation);
  const setGroundStations = useSatelliteStore((s) => s.setGroundStations);
  const observer = useSatelliteStore((s) => s.observer);

  // Hydrate once per app load
  useEffect(() => {
    if (hasHydrated) return;
    hasHydrated = true;

    let restored: GroundStation[] = [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          restored = parsed.filter(isValidStation).map((s) => ({
            ...s,
            alt: typeof s.alt === "number" && Number.isFinite(s.alt) ? s.alt : 0,
          }));
        }
      }
    } catch {
      // Ignore parse errors
    }

    if (restored.length > 0) {
      setGroundStations(restored);
    } else {
      // Seed with a Home station at the current observer location
      setGroundStations([
        {
          id: "home",
          name: `Home (${observer.label})`,
          lat: observer.lat,
          lon: observer.lon,
          alt: observer.alt,
          minElevation: 10,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on change (skip the initial empty state)
  useEffect(() => {
    if (stations.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stations));
    } catch {
      // Storage full/blocked — non-fatal
    }
  }, [stations]);

  return {
    stations,
    addGroundStation,
    updateGroundStation,
    removeGroundStation,
  };
}
