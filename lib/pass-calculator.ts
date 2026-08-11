/**
 * Pass prediction calculator — topocentric look angles, eclipse checks,
 * and visible-pass prediction for a given observer location.
 *
 * Look angles use satellite.js's ECI→ECF→topocentric pipeline
 * (ecfToLookAngles), which accounts for orbital altitude and Earth's
 * oblateness. Rise/set are the el=0 horizon crossings, refined by
 * bisection; a pass is reported iff its refined culmination elevation
 * reaches MIN_PASS_ELEVATION_DEG.
 */

import * as satellite from "satellite.js";
import { propagateSatellite, dateToJulian } from "@/lib/orbit-utils";
import {
  DEG_TO_RAD,
  RAD_TO_DEG,
  EARTH_RADIUS_KM,
  AU_KM,
  MIN_PASS_ELEVATION_DEG,
} from "@/lib/constants";
import { PassPrediction, ObserverLocation, TleSet } from "@/types";

// ─── Observer Setup ──────────────────────────────────── //

/** Default observer locations for quick selection. */
export const DEFAULT_LOCATIONS: ObserverLocation[] = [
  { lat: 40.7128, lon: -74.006, alt: 0.01, label: "New York, NY, USA" },
  { lat: 51.5074, lon: -0.1278, alt: 0.03, label: "London, UK" },
  { lat: 35.6895, lon: 139.6917, alt: 0.04, label: "Tokyo, Japan" },
  { lat: -33.8688, lon: 151.2093, alt: 0.06, label: "Sydney, Australia" },
  { lat: 48.8566, lon: 2.3522, alt: 0.04, label: "Paris, France" },
  { lat: 34.0522, lon: -118.2437, alt: 0.09, label: "Los Angeles, CA, USA" },
];

// ─── Az/El Calculation ────────────────────────────────── //

function observerGd(observer: ObserverLocation) {
  return {
    latitude: observer.lat * DEG_TO_RAD,
    longitude: observer.lon * DEG_TO_RAD,
    height: observer.alt, // km
  };
}

/**
 * Compute the topocentric (observer-relative) look angles for a satellite.
 *
 * @returns azimuth [0, 360) and elevation [-90, 90] in degrees, slant
 *   range in km — or null if propagation fails. Negative elevations are
 *   real data (below the horizon), not clamped.
 */
export function computeAzEl(
  tle: TleSet,
  date: Date,
  observer: ObserverLocation
): { azimuth: number; elevation: number; range: number } | null {
  const result = propagateSatellite(tle, date);
  if (!result.isValid) return null;

  const gmst = satellite.gstime(date);
  const ecf = satellite.eciToEcf(
    { x: result.position[0], y: result.position[1], z: result.position[2] },
    gmst
  );
  const look = satellite.ecfToLookAngles(observerGd(observer), ecf);

  return {
    azimuth: ((look.azimuth * RAD_TO_DEG) % 360 + 360) % 360,
    elevation: look.elevation * RAD_TO_DEG,
    range: look.rangeSat,
  };
}

// ─── Sun ─────────────────────────────────────────────── //

/** Sun position in ECI kilometers at a given time. */
export function sunEciKm(date: Date): [number, number, number] {
  const { rsun } = satellite.sunPos(dateToJulian(date));
  return [rsun[0] * AU_KM, rsun[1] * AU_KM, rsun[2] * AU_KM];
}

/**
 * Sun look angles for an observer — reused by the sky view.
 */
export function sunAzEl(
  date: Date,
  observer: ObserverLocation
): { azimuth: number; elevation: number } {
  const sun = sunEciKm(date);
  const gmst = satellite.gstime(date);
  const ecf = satellite.eciToEcf({ x: sun[0], y: sun[1], z: sun[2] }, gmst);
  const look = satellite.ecfToLookAngles(observerGd(observer), ecf);
  return {
    azimuth: ((look.azimuth * RAD_TO_DEG) % 360 + 360) % 360,
    elevation: look.elevation * RAD_TO_DEG,
  };
}

/**
 * Cylindrical-umbra eclipse test: the satellite is in Earth's shadow iff
 * it is on the anti-sun side AND within one Earth radius of the
 * Earth–anti-sun axis.
 */
export function isSatEclipsed(
  satEci: [number, number, number],
  sunEci: [number, number, number]
): boolean {
  const sunLen = Math.hypot(sunEci[0], sunEci[1], sunEci[2]);
  if (sunLen === 0) return false;
  const ux = sunEci[0] / sunLen;
  const uy = sunEci[1] / sunLen;
  const uz = sunEci[2] / sunLen;

  const along = satEci[0] * ux + satEci[1] * uy + satEci[2] * uz;
  if (along >= 0) return false; // on the sun side

  const px = satEci[0] - along * ux;
  const py = satEci[1] - along * uy;
  const pz = satEci[2] - along * uz;
  return Math.hypot(px, py, pz) < EARTH_RADIUS_KM;
}

// ─── Pass Prediction ─────────────────────────────────── //

const COARSE_STEP_MS = 30_000;
const REFINE_TOLERANCE_MS = 1_000;

/** Elevation at a time, or -90 when propagation fails (treated as below horizon). */
function elevationAt(tle: TleSet, ms: number, observer: ObserverLocation): number {
  const azEl = computeAzEl(tle, new Date(ms), observer);
  return azEl ? azEl.elevation : -90;
}

/** Bisect the el=0 crossing between loMs and hiMs (exactly one crossing). */
function bisectCrossing(
  tle: TleSet,
  observer: ObserverLocation,
  loMs: number,
  hiMs: number,
  risingAtHi: boolean
): number {
  let lo = loMs;
  let hi = hiMs;
  while (hi - lo > REFINE_TOLERANCE_MS) {
    const mid = (lo + hi) / 2;
    const above = elevationAt(tle, mid, observer) >= 0;
    if (above === risingAtHi) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return (lo + hi) / 2;
}

/** Ternary-search the culmination time near a coarse maximum. */
function refineCulmination(
  tle: TleSet,
  observer: ObserverLocation,
  coarseMaxMs: number,
  windowStartMs: number,
  windowEndMs: number
): number {
  let lo = Math.max(windowStartMs, coarseMaxMs - COARSE_STEP_MS);
  let hi = Math.min(windowEndMs, coarseMaxMs + COARSE_STEP_MS);
  while (hi - lo > REFINE_TOLERANCE_MS) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (elevationAt(tle, m1, observer) < elevationAt(tle, m2, observer)) {
      lo = m1;
    } else {
      hi = m2;
    }
  }
  return (lo + hi) / 2;
}

/** Rough visual magnitude placeholder (no phase-angle model). */
function estimateMagnitude(tle: TleSet, rangeKm: number): number {
  const isStation = /ISS|ZARYA|TIANGONG|TIANHE|CSS|STATION/i.test(tle.name);
  const stdMag = isStation ? -1.8 : 4.0;
  const mag = stdMag + 5 * Math.log10(Math.max(rangeKm, 1) / 1000);
  return Math.max(-6, Math.min(8, Math.round(mag * 10) / 10));
}

/**
 * Compute passes for a satellite over an observer location.
 *
 * Rise/set are el=0 horizon crossings (bisection-refined to 1s); a pass
 * is kept iff its refined maximum elevation ≥ minElevation. A satellite
 * that never sets within the window (e.g. geostationary in view) yields
 * a single pass spanning the window with `neverSets: true`.
 */
export function predictPasses(
  tle: TleSet,
  observer: ObserverLocation,
  startTime: Date = new Date(),
  hours: number = 24,
  minElevation: number = MIN_PASS_ELEVATION_DEG
): PassPrediction[] {
  const passes: PassPrediction[] = [];
  const startMs = startTime.getTime();
  const endMs = startMs + hours * 3600_000;
  const totalSteps = Math.floor((endMs - startMs) / COARSE_STEP_MS);

  // Bail out early if the TLE never propagates
  if (!computeAzEl(tle, startTime, observer)) return [];

  let inPass = elevationAt(tle, startMs, observer) >= 0;
  let riseMs = startMs;
  let roseAtWindowStart = inPass;
  let coarseMaxEl = -90;
  let coarseMaxMs = startMs;

  const closePass = (setMs: number, setAtWindowEnd: boolean) => {
    const maxMs = refineCulmination(tle, observer, coarseMaxMs, riseMs, setMs);
    const maxLook = computeAzEl(tle, new Date(maxMs), observer);
    if (!maxLook || maxLook.elevation < minElevation) return;

    const startLook = computeAzEl(tle, new Date(riseMs), observer);
    const endLook = computeAzEl(tle, new Date(setMs), observer);

    const maxTime = new Date(maxMs);
    const satAtMax = propagateSatellite(tle, maxTime);
    const sun = sunEciKm(maxTime);
    const isLit = satAtMax.isValid && !isSatEclipsed(satAtMax.position, sun);
    const observerSunElevation = sunAzEl(maxTime, observer).elevation;

    passes.push({
      startTime: new Date(riseMs),
      maxTime,
      endTime: new Date(setMs),
      maxElevation: maxLook.elevation,
      startAz: startLook?.azimuth ?? maxLook.azimuth,
      maxAz: maxLook.azimuth,
      endAz: endLook?.azimuth ?? maxLook.azimuth,
      isLit,
      isVisible: isLit && observerSunElevation < -6,
      neverSets: roseAtWindowStart && setAtWindowEnd,
      magnitude: estimateMagnitude(tle, maxLook.range),
    });
  };

  for (let i = 1; i <= totalSteps; i++) {
    const t = startMs + i * COARSE_STEP_MS;
    const el = elevationAt(tle, t, observer);

    if (!inPass && el >= 0) {
      riseMs = bisectCrossing(tle, observer, t - COARSE_STEP_MS, t, true);
      roseAtWindowStart = false;
      inPass = true;
      coarseMaxEl = el;
      coarseMaxMs = t;
    } else if (inPass && el < 0) {
      const setMs = bisectCrossing(tle, observer, t - COARSE_STEP_MS, t, false);
      closePass(setMs, false);
      inPass = false;
      coarseMaxEl = -90;
    } else if (inPass && el > coarseMaxEl) {
      coarseMaxEl = el;
      coarseMaxMs = t;
    }
  }

  // Still above the horizon at the end of the window
  if (inPass) {
    closePass(endMs, true);
  }

  return passes;
}

/**
 * Next pass worth watching: the first pass that is actually visible
 * (sunlit satellite, dark observer sky), else the first pass at all.
 */
export function getNextVisiblePass(
  tle: TleSet,
  observer: ObserverLocation,
  startTime: Date = new Date()
): PassPrediction | null {
  const passes = predictPasses(tle, observer, startTime, 24, MIN_PASS_ELEVATION_DEG);
  return passes.find((p) => p.isVisible) ?? passes[0] ?? null;
}
