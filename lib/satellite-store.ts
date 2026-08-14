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
import { GROUP_ORDER } from "@/lib/constants";
import {
  SatelliteStoreState,
  Satellite,
  ConstellationFilter,
  TimeControlState,
  ObserverLocation,
  PassPrediction,
  TleSet,
  GroundStation,
} from "@/types";

// ─── Initial State ───────────────────────────────────── //

function initialConstellationFilters(): ConstellationFilter {
  return Object.fromEntries(GROUP_ORDER.map((g) => [g, true]));
}

export interface SatelliteStore extends SatelliteStoreState {
  // ── Ground stations (access planner) ────────────────── //
  groundStations: GroundStation[];
  addGroundStation: (station: GroundStation) => void;
  updateGroundStation: (id: string, updates: Partial<GroundStation>) => void;
  removeGroundStation: (id: string) => void;
  setGroundStations: (stations: GroundStation[]) => void;

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
  /** Where the current elements came from: live Celestrak, or a cache/mirror. */
  tleSource: string | null;
  setTleSource: (source: string | null) => void;
  /** Rendered frames per second, sampled once a second by the globe. */
  renderFps: number;
  setRenderFps: (fps: number) => void;

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
    tleSource: null,
    renderFps: 0,
    isLoading: true,
    error: null,
    groundStations: [],

    // ── Ground stations ────────────────────────────────── //
    addGroundStation: (station) =>
      set((state) => {
        state.groundStations.push(station);
      }),

    updateGroundStation: (id, updates) =>
      set((state) => {
        const idx = state.groundStations.findIndex((s) => s.id === id);
        if (idx >= 0) {
          state.groundStations[idx] = { ...state.groundStations[idx], ...updates };
        }
      }),

    removeGroundStation: (id) =>
      set((state) => {
        state.groundStations = state.groundStations.filter((s) => s.id !== id);
      }),

    setGroundStations: (stations) =>
      set((state) => {
        state.groundStations = stations;
      }),

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

    setTleSource: (source) =>
      set((state) => {
        state.tleSource = source;
      }),

    setRenderFps: (fps) =>
      set((state) => {
        state.renderFps = fps;
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
