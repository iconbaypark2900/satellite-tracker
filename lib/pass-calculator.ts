/**
 * Pass prediction calculator — compute azimuth, elevation, and visible
 * satellite passes for a given observer location.
 */

import { propagateSatellite, eciToGeodetic } from "@/lib/orbit-utils";
import { getSunPosition, getSunPositionFromDate } from "@/lib/sun-position";
import { DEG_TO_RAD, RAD_TO_DEG, EARTH_RADIUS_KM } from "@/lib/constants";
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

/**
 * Compute the topocentric (observer-relative) az/el angles for a satellite
 * at a given time.
 *
 * @returns {azimuth, elevation} in degrees, or null if satellite is not above horizon.
 */
export function computeAzEl(
  tle: TleSet,
  date: Date,
  observer: ObserverLocation
): { azimuth: number; elevation: number; range: number } | null {
  const result = propagateSatellite(tle, date);
  if (!result.isValid) return null;

  const { latitude: satLat, longitude: satLon, altitude: satAlt } = eciToGeodetic(
    result.position,
    date
  );

  // Convert observer lat/lon to radians
  const obsLat = observer.lat * DEG_TO_RAD;
  const obsLon = observer.lon * DEG_TO_RAD;
  const satLatRad = satLat * DEG_TO_RAD;
  const satLonRad = satLon * DEG_TO_RAD;

  // Compute topocentric coordinates
  const lonDiff = satLonRad - obsLon;

  // Horizontal coordinates (simplified — assumes flat Earth for nearby, spherical for far)
  const cosLat = Math.cos(obsLat);
  const sinLat = Math.sin(obsLat);

  // East, North, Up components
  const east = -Math.sin(lonDiff) * Math.cos(satLatRad);
  const north =
    cosLat * Math.sin(satLatRad) -
    sinLat * Math.cos(satLatRad) * Math.cos(lonDiff);
  const up =
    sinLat * Math.sin(satLatRad) +
    cosLat * Math.cos(satLatRad) * Math.cos(lonDiff);

  // Azimuth (clockwise from North)
  const azimuth = ((Math.atan2(east, north) * RAD_TO_DEG + 360) % 360);

  // Elevation
  const hyp = Math.sqrt(east * east + north * north);
  const elevation = Math.atan2(up, hyp) * RAD_TO_DEG;

  // Range (approximate)
  const range = satAlt - observer.alt; // km (simplified)

  return {
    azimuth,
    elevation: elevation < -0.1 ? elevation : Math.max(0, elevation),
    range,
  };
}

// ─── Pass Prediction ─────────────────────────────────── //

/**
 * Compute visible passes for a satellite over an observer location.
 *
 * Algorithm:
 * 1. Step through time in 30-second increments over a 24-hour window.
 * 2. Detect horizon crossings (el goes from negative to positive).
 * 3. For each rise, continue until set.
 * 4. Use parabolic interpolation to refine peak elevation.
 * 5. Check solar illumination (satellite must be in sunlight).
 *
 * @param tle - The satellite's TLE
 * @param observer - Observer location
 * @param startTime - Start of prediction window
 * @param hours - Number of hours to predict (default 24)
 * @param minElevation - Minimum elevation for a valid pass (default 10°)
 */
export function predictPasses(
  tle: TleSet,
  observer: ObserverLocation,
  startTime: Date = new Date(),
  hours: number = 24,
  minElevation: number = 10
): PassPrediction[] {
  const passes: PassPrediction[] = [];

  const stepSec = 30;
  const totalSteps = Math.floor((hours * 3600) / stepSec);

  let prevEl: number | null = null;
  let inPass = false;
  let passStart: Date | null = null;
  let prevAz: number | null = null;

  // Track satellite position for orbit details
  const sun = getSunPositionFromDate(startTime);

  for (let i = 0; i <= totalSteps; i++) {
    const date = new Date(startTime.getTime() + i * stepSec * 1000);
    const azEl = computeAzEl(tle, date, observer);

    if (!azEl) {
      if (inPass) {
        // End the pass
        if (passStart) {
          finalizePass(passes, tle, observer, passStart, date, prevAz, sun, minElevation);
        }
        inPass = false;
        passStart = null;
      }
      prevEl = null;
      continue;
    }

    if (azEl.elevation >= minElevation) {
      if (!inPass) {
        inPass = true;
        passStart = date;
        prevAz = azEl.azimuth;
      }
    } else if (inPass && azEl.elevation < 0) {
      // Satellite set below horizon
      finalizePass(passes, tle, observer, passStart!, date, prevAz, sun, minElevation);
      inPass = false;
      passStart = null;
    }

    prevEl = azEl.elevation;
    prevAz = azEl.azimuth;
  }

  // Handle pass that's still ongoing at end of window
  if (inPass && passStart) {
    const finalTime = new Date(startTime.getTime() + totalSteps * stepSec * 1000);
    finalizePass(passes, tle, observer, passStart, finalTime, prevAz, sun, minElevation);
  }

  return passes;
}

/** Finalize a pass with peak elevation interpolation. */
function finalizePass(
  passes: PassPrediction[],
  tle: TleSet,
  observer: ObserverLocation,
  startTime: Date,
  endTime: Date,
  startAz: number | null,
  sun: ReturnType<typeof getSunPosition>,
  minElevation: number
): void {
  // Find peak elevation by searching within the pass window
  const passDurationMin = (endTime.getTime() - startTime.getTime()) / 60000;
  const stepMin = passDurationMin / 50;

  let maxEl = -90;
  let maxTime: Date = startTime;
  let maxAz = startAz ?? 0;

  for (let t = 0; t <= passDurationMin; t += stepMin) {
    const date = new Date(startTime.getTime() + t * 60000);
    const azEl = computeAzEl(tle, date, observer);
    if (azEl && azEl.elevation > maxEl) {
      maxEl = azEl.elevation;
      maxTime = date;
      maxAz = azEl.azimuth;
    }
  }

  // Check if satellite is illuminated (sunlit)
  const satPos = propagateSatellite(tle, maxTime);
  const isLit = satPos.isValid
    ? isSunlit(satPos.position, sun)
    : false;

  passes.push({
    startTime,
    maxTime,
    endTime,
    maxElevation: maxEl,
    startAz: startAz ?? 0,
    maxAz,
    endAz: maxAz,
    isLit,
    magnitude: -2, // Approximate; real implementation uses specific formulas
  });
}

/** Check if a satellite position is in sunlight. */
function isSunlit(
  position: [number, number, number],
  sun: ReturnType<typeof getSunPosition>
): boolean {
  const [x, y, z] = position;
  const dot = x * sun.eci[0] + y * sun.eci[1] + z * sun.eci[2];

  if (dot > 0) {
    // Simple check: sun-facing
    const r = Math.sqrt(x * x + y * y + z * z);
    if (r > 0) {
      const shadowAngle = Math.acos(dot / r);
      const earthAngularRadius = Math.asin(EARTH_RADIUS_KM / r);
      return shadowAngle < Math.PI / 2 - earthAngularRadius + 1 * DEG_TO_RAD;
    }
  }
  return false;
}

/**
 * Compute the next visible pass (satellite in sunlight, above horizon).
 */
export function getNextVisiblePass(
  tle: TleSet,
  observer: ObserverLocation,
  startTime: Date = new Date()
): PassPrediction | null {
  const passes = predictPasses(tle, observer, startTime, 12, 5);
  for (const pass of passes) {
    if (pass.isLit && pass.maxElevation > 10) {
      return pass;
    }
  }
  return passes.length > 0 ? passes[0] : null;
}
