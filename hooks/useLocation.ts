/**
 * useLocation — Geolocation and saved-location management.
 *
 * Uses the browser Geolocation API and stores the last-used
 * location in localStorage.
 */

import { useEffect } from "react";
import { useSatelliteStore } from "@/lib/satellite-store";
import { ObserverLocation, DEFAULT_LOCATIONS } from "@/lib/pass-calculator";

const STORAGE_KEY = "satellite-tracker:observer-location";

export function useLocation() {
  const { observer, setObserver } = useSatelliteStore();
  const setObserverFn = useSatelliteStore((s) => s.setObserver);

  // Load saved location from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setObserverFn(parsed);
      } catch {
        // Ignore parse errors
      }
    }
  }, [setObserverFn]);

  // Save location to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(observer));
  }, [observer]);

  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      return Promise.reject(new Error("Geolocation not supported"));
    }

    return new Promise<ObserverLocation>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: ObserverLocation = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            alt: (pos.coords.altitude ?? 0) / 1000, // m → km
            label: "Your Location",
          };
          setObserver(loc);
          resolve(loc);
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const setManualLocation = (lat: number, lon: number, alt: number = 0, label: string = "Custom") => {
    setObserver({ lat, lon, alt, label });
  };

  const setDefaultLocation = (loc: ObserverLocation) => {
    setObserver(loc);
  };

  return {
    observer,
    setLocation: setObserver,
    requestGeolocation,
    setManualLocation,
    setDefaultLocation,
    defaultLocations: DEFAULT_LOCATIONS,
  };
}
