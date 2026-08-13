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
import { apparentAltitudeDeg } from "./refraction";
import { shadowState, type ShadowState } from "./shadow";
import { phaseAngleRad, standardMagnitude, visualMagnitude } from "./magnitude";

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
 * Topocentric look angles.
 *
 * `elevation` is the GEOMETRIC elevation — where the satellite is. It stays
 * geometric deliberately: `scripts/validate-vs-horizons.ts` compares it against
 * Horizons' *airless* apparent coordinates, and that comparison is the source
 * of the accuracy claim this project makes (docs/VALIDATION.md). Folding refraction
 * into this field would silently invalidate the claim while appearing to
 * improve the physics.
 *
 * `apparentElevation` is where an observer actually sees it, after the
 * atmosphere lifts it toward the zenith. That difference is not small at the
 * elevations people care about: about 0.090 degrees at 10 degrees, 0.161 at 5,
 * and 0.483 at the horizon — more than twice this app's own median error above
 * 10 degrees.
 */
export function computeAzEl(
  tle: TleSet,
  date: Date,
  observer: ObserverLocation
): {
  azimuth: number;
  elevation: number;
  apparentElevation: number;
  range: number;
} | null {
  const result = propagateSatellite(tle, date);
  if (!result.isValid) return null;

  const gmst = satellite.gstime(date);
  const ecf = satellite.eciToEcf(
    { x: result.position[0], y: result.position[1], z: result.position[2] },
    gmst
  );
  const look = satellite.ecfToLookAngles(observerGd(observer), ecf);
  const elevation = look.elevation * RAD_TO_DEG;

  return {
    azimuth: ((look.azimuth * RAD_TO_DEG) % 360 + 360) % 360,
    elevation,
    // Below the model's domain the correction is zero, so this equals the
    // geometric value rather than throwing on every below-horizon sample —
    // and computeAzEl is called for far more of those than for visible ones.
    apparentElevation:
      elevation < -1 ? elevation : apparentAltitudeDeg(elevation),
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
 * Is the satellite in Earth's shadow at all — umbra or penumbra?
 *
 * This used to be a cylinder: on the anti-sun side and within one Earth radius
 * of the axis. The Sun is not a point, so the real shadow is a converging
 * umbra cone inside a diverging penumbra cone, and the cylinder's radius sits
 * BETWEEN the two — it was wrong in both directions depending on where the
 * satellite was, not merely imprecise.
 *
 * "Eclipsed" here means anything other than fully sunlit, which is the
 * conservative reading for visibility: a satellite in penumbra is lit by a
 * partial Sun and is dimming, so it should not be promised as a bright pass.
 * Callers wanting the distinction should use `satShadowState` directly.
 */
export function isSatEclipsed(
  satEci: [number, number, number],
  sunEci: [number, number, number]
): boolean {
  return satShadowState(satEci, sunEci) !== "sunlit";
}

/**
 * The three-state illumination of a satellite: sunlit, penumbra, or umbra.
 *
 * Returns "sunlit" rather than throwing for input the geometric model refuses
 * (a zero Sun vector, a position inside the Earth). Those indicate a caller
 * bug, not an eclipse, and this runs inside a per-frame loop over hundreds of
 * objects where throwing would take down the render.
 */
export function satShadowState(
  satEci: [number, number, number],
  sunEci: [number, number, number]
): ShadowState {
  try {
    return shadowState(satEci, sunEci);
  } catch {
    return "sunlit";
  }
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

/**
 * Standard magnitude used when the object is not in the curated table.
 *
 * Deliberately a named constant rather than an inline literal: it is a guess
 * applied to 389 of the 396 objects currently tracked, and every magnitude
 * derived from it is reported with `magnitudeIsCurated: false` so the UI can
 * say so. The number itself is inherited from the placeholder this replaced.
 */
const FALLBACK_STD_MAG = 4.0;

/** The observer's own position in the same ECI frame as the satellite. */
function observerEciKm(
  observer: ObserverLocation,
  date: Date
): [number, number, number] {
  const gmst = satellite.gstime(date);
  const ecf = satellite.geodeticToEcf(observerGd(observer));
  const eci = satellite.ecfToEci(ecf, gmst);
  return [eci.x, eci.y, eci.z];
}

/**
 * Apparent visual magnitude at culmination.
 *
 * Replaces a placeholder that read the satellite's NAME with a regular
 * expression, picked one of two constants from it, and modelled no
 * illumination geometry at all. Phase angle is worth about 3.7 magnitudes
 * between full and crescent — a factor of 30 in brightness — so an overhead
 * pass and a thin crescent used to get the same answer at the same range.
 *
 * Returns the magnitude and whether the standard magnitude behind it was
 * curated for this NORAD id or is the class fallback. That flag exists because
 * a caller receiving only a number cannot tell the two apart, and would present
 * a guess to an observer with the same confidence as a measurement.
 */
function estimateMagnitude(
  tle: TleSet,
  rangeKm: number,
  satEci: [number, number, number],
  sunEci: [number, number, number],
  obsEci: [number, number, number]
): { magnitude: number; curated: boolean } {
  const curatedStd = standardMagnitude(tle.noradId);
  const stdMag = curatedStd ?? FALLBACK_STD_MAG;
  try {
    const beta = phaseAngleRad(satEci, sunEci, obsEci);
    return {
      magnitude: visualMagnitude(stdMag, Math.max(rangeKm, 1), beta),
      curated: curatedStd !== null,
    };
  } catch {
    // Degenerate geometry — report the range-only brightness rather than
    // failing the whole pass, and flag it as uncurated either way.
    return {
      magnitude: stdMag - 15 + 5 * Math.log10(Math.max(rangeKm, 1)),
      curated: false,
    };
  }
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
    const illumination = satAtMax.isValid
      ? satShadowState(satAtMax.position, sun)
      : "umbra";
    const isLit = satAtMax.isValid && illumination === "sunlit";
    const observerSunElevation = sunAzEl(maxTime, observer).elevation;
    const mag = satAtMax.isValid
      ? estimateMagnitude(
          tle,
          maxLook.range,
          satAtMax.position as [number, number, number],
          sun,
          observerEciKm(observer, maxTime)
        )
      : { magnitude: Number.POSITIVE_INFINITY, curated: false };

    passes.push({
      startTime: new Date(riseMs),
      maxTime,
      endTime: new Date(setMs),
      maxElevation: maxLook.elevation,
      maxElevationApparent: maxLook.apparentElevation,
      startAz: startLook?.azimuth ?? maxLook.azimuth,
      maxAz: maxLook.azimuth,
      endAz: endLook?.azimuth ?? maxLook.azimuth,
      isLit,
      illumination,
      isVisible: isLit && observerSunElevation < -6,
      neverSets: roseAtWindowStart && setAtWindowEnd,
      magnitude: mag.magnitude,
      magnitudeIsCurated: mag.curated,
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
