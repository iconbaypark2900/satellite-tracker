/**
 * Zustand store for global satellite tracker state.
 *
 * Uses Immer for immutable state updates.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";

// The store keeps satellites in a Map; immer needs the MapSet plugin to
// draft it (addSatellite/updateSatellite throw without this).
enableMapSet();
import {
  SatelliteStoreState,
  Satellite,
  SatelliteGroup,
  ConstellationFilter,
  TimeControlState,
  ObserverLocation,
  PassPrediction,
  TleSet,
} from "@/types";

// ─── Initial State ───────────────────────────────────── //

const ALL_GROUPS: SatelliteGroup[] = [
  "STATIONS",
  "STARLINK",
  "ONEWEB",
  "GPS-OPS",
  "GOES",
  "SES",
  "INTREPID",
  "OTHER",
];

function initialConstellationFilters(): ConstellationFilter {
  return Object.fromEntries(ALL_GROUPS.map((g) => [g, true]));
}

export interface SatelliteStore extends SatelliteStoreState {
  // ── Mutators ────────────────────────────────────────── //
  setSatellites: (sats: Map<string, Satellite> | Satellite[]) => void;
  addSatellite: (sat: Satellite) => void;
  updateSatellite: (noradId: string, updates: Partial<Satellite>) => void;
  setSelectedSatellite: (sat: Satellite | null) => void;
  toggleConstellation: (group: string, visible: boolean) => void;
  setConstellationFilters: (filters: ConstellationFilter) => void;
  setTimeOffset: (minutes: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  setSimTime: (date: Date) => void;
  setObserver: (loc: ObserverLocation) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTleAge: (age: number) => void;

  // ── Computed / Actions ──────────────────────────────── //
  /** Get satellites filtered by visible constellations. */
  getVisibleSatellites: () => Satellite[];
  /** Get satellites filtered by search query. */
  searchSatellites: (query: string) => Satellite[];
  /** Compute pass predictions for the selected satellite. */
  getPassPredictions: (sat: Satellite, hours?: number) => Promise<PassPrediction[]>;
}

// ─── Store Factory ───────────────────────────────────── //

export const useSatelliteStore = create<SatelliteStore>()(
  immer<SatelliteStore>((set, get) => ({
    // ── State ──────────────────────────────────────────── //
    satellites: new Map<string, Satellite>(),
    selectedSatellite: null,
    constellationFilters: initialConstellationFilters(),
    timeControl: {
      offsetMinutes: 0,
      isPlaying: true,
      speed: 1,
      simTime: new Date(),
    },
    observer: {
      lat: 40.7128,
      lon: -74.006,
      alt: 0.01,
      label: "New York, NY, USA",
    },
    tleAge: Infinity,
    isLoading: true,
    error: null,

    // ── Mutators ───────────────────────────────────────── //
    setSatellites: (sats) =>
      set((state) => {
        if (sats instanceof Map) {
          state.satellites = sats as any;
        } else {
          state.satellites = new Map(
            sats.map((s) => [s.noradId, s])
          ) as any;
        }
      }),

    addSatellite: (sat) =>
      set((state) => {
        state.satellites.set(sat.noradId, sat);
      }),

    updateSatellite: (noradId, updates) =>
      set((state) => {
        const existing = state.satellites.get(noradId);
        if (existing) {
          state.satellites.set(noradId, { ...existing, ...updates });
        }
      }),

    setSelectedSatellite: (sat) =>
      set((state) => {
        state.selectedSatellite = sat;
      }),

    toggleConstellation: (group, visible) =>
      set((state) => {
        if (state.constellationFilters[group] !== undefined) {
          state.constellationFilters[group] = visible;
        }
      }),

    setConstellationFilters: (filters) =>
      set((state) => {
        state.constellationFilters = filters;
      }),

    setTimeOffset: (minutes) =>
      set((state) => {
        state.timeControl.offsetMinutes = minutes;
        state.timeControl.simTime = new Date(
          Date.now() + minutes * 60000
        );
      }),

    setPlaying: (playing) =>
      set((state) => {
        state.timeControl.isPlaying = playing;
      }),

    setSpeed: (speed) =>
      set((state) => {
        state.timeControl.speed = speed;
      }),

    setSimTime: (date) =>
      set((state) => {
        state.timeControl.simTime = date;
      }),

    setObserver: (loc) =>
      set((state) => {
        state.observer = loc;
      }),

    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading;
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
      }),

    setTleAge: (age) =>
      set((state) => {
        state.tleAge = age;
      }),

    // ── Computed / Actions ──────────────────────────────── //
    getVisibleSatellites: () => {
      const filters = get().constellationFilters;
      const satellites = get().satellites;
      return Array.from(satellites.values()).filter((sat) => {
        const group = sat.group as string;
        return filters[group] !== false;
      });
    },

    searchSatellites: (query) => {
      const q = query.toLowerCase();
      return get().getVisibleSatellites().filter(
        (sat) =>
          sat.name.toLowerCase().includes(q) ||
          sat.noradId.includes(q)
      );
    },

    getPassPredictions: async (sat, hours = 24) => {
      if (!sat.tle) return [];
      const { predictPasses } = await import("@/lib/pass-calculator");
      const observer = get().observer;
      return predictPasses(sat.tle, observer, new Date(), hours);
    },
  }))
);

// ─── Selectors ───────────────────────────────────────── //

export const useSatellites = () => useSatelliteStore((s) => s.satellites);
export const useSelectedSatellite = () =>
  useSatelliteStore((s) => s.selectedSatellite);
export const useConstellationFilters = () =>
  useSatelliteStore((s) => s.constellationFilters);
export const useTimeControl = () =>
  useSatelliteStore((s) => s.timeControl);
export const useObserver = () => useSatelliteStore((s) => s.observer);
export const useLoading = () => useSatelliteStore((s) => s.isLoading);
export const useError = () => useSatelliteStore((s) => s.error);
