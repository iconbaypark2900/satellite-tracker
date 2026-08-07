/**
 * SGP4 orbital propagation helpers — wrapping satellite.js for position
 * calculation, ground track computation, and pass prediction utilities.
 */

import * as satellite from "satellite.js";
import {
  EARTH_RADIUS_KM,
  EARTH_MU,
  EARTH_OMEGA,
  DEG_TO_RAD,
  RAD_TO_DEG,
  J2000_JD,
  UNIX_TO_J2000_DAYS,
  SIDEREAL_DAY_MIN,
  ORBIT_PATH_SEGMENTS,
  EARTH_MEAN_RADIUS_KM,
} from "@/lib/constants";
import { PropagationResult, TleSet } from "@/types";

// ─── ECI / ECEF Conversion ───────────────────────────── //

/** Convert a Unix timestamp (ms) to Julian Date. */
export function unixToJulian(unixTs: number): number {
  return unixTs / 86400000 + 2440587.5;
}

/** Convert a Date to Julian Date. */
export function dateToJulian(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Convert Julian Date to a JavaScript Date. */
export function julianToDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}

// ─── Sun Position ────────────────────────────────────── //

/**
 * Compute the Sun's ECI direction vector at a given Julian Date.
 * Uses the approximate astronomical algorithm from the demo.
 */
export function getSunDirection(jd: number): [number, number, number] {
  const T = (jd - J2000_JD) / 365.25;

  // Mean longitude (degrees)
  const L0 = (280.46646 + 36000.76983 * T) % 360;
  // Mean anomaly (degrees)
  const M = (357.52911 + 359.05029 * T) % 360;
  const Mr = M * DEG_TO_RAD;

  // Equation of center
  const C =
    (1.914602 - 0.004817 * T) * Math.sin(Mr) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) +
    0.000289 * Math.sin(3 * Mr);

  // Ecliptic longitude (radians)
  const lambda = (L0 + C) * DEG_TO_RAD;
  // Obliquity of ecliptic (radians)
  const eps = (23.439291 - 0.013011 * T) * DEG_TO_RAD;

  return [
    Math.cos(lambda),
    Math.cos(eps) * Math.sin(lambda),
    Math.sin(eps) * Math.sin(lambda),
  ];
}

// ─── SGP4 Propagation ────────────────────────────────── //

/**
 * Propagate a single satellite at a given time using its TLE.
 *
 * @param tle - The TLE set (must have line1 and line2)
 * @param date - The time to propagate to
 * @returns PropagationResult with ECI position/velocity
 */
export function propagateSatellite(
  tle: TleSet,
  date: Date
): PropagationResult {
  // If we don't have valid TLE lines, return invalid
  if (!tle.line1 || !tle.line2) {
    return {
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      isValid: false,
    };
  }

  try {
    // satellite.js v4+: twoline2sat(line1, line2, name?)
    const satRec = satellite.twoline2sat(tle.line1, tle.line2, tle.name);

    const result = satellite.propagate(satRec, date) as {
      position: number[] | undefined;
      velocity: number[] | undefined;
    };

    if (!result.position || !result.velocity) {
      return {
        position: [0, 0, 0],
        velocity: [0, 0, 0],
        isValid: false,
      };
    }

    return {
      position: result.position as [number, number, number],
      velocity: result.velocity as [number, number, number],
      isValid: true,
    };
  } catch {
    return {
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      isValid: false,
    };
  }
}

/**
 * Propagate all satellites and return valid positions.
 * Used by the WebWorker for high-frequency updates.
 */
export function propagateAll(
  tleSets: TleSet[],
  date: Date
): Map<string, PropagationResult> {
  const results = new Map<string, PropagationResult>();

  for (const tle of tleSets) {
    const result = propagateSatellite(tle, date);
    if (result.isValid) {
      results.set(tle.noradId, result);
    }
  }

  return results;
}

// ─── ECEF Conversion ─────────────────────────────────── //

/**
 * Convert ECI (Earth-Centered Inertial) position to ECEF (Earth-Centered
 * Earth-Fixed) by accounting for Earth's rotation.
 */
export function eciToEcef(
  position: [number, number, number],
  date: Date
): [number, number, number] {
  const jd = dateToJulian(date);
  // GMST angle in radians (approximate, accurate enough for visualization)
  const gmstAngle = ((360.98564736621 * (jd - 2451545.0)) % 360) * DEG_TO_RAD;

  const cos = Math.cos(gmstAngle);
  const sin = Math.sin(gmstAngle);

  const [x, y, z] = position;
  return [
    x * cos + y * sin,
    -x * sin + y * cos,
    z,
  ];
}

// ─── Geographic Coordinates ──────────────────────────── //

/** Convert ECEF position (km) to latitude, longitude, altitude (km). */
export function ecefToGeodetic(
  position: [number, number, number]
): { latitude: number; longitude: number; altitude: number } {
  // Use satellite.js' built-in geodetic conversion
  const [x, y, z] = position;
  const lonRad = Math.atan2(y, x);
  const lon = lonRad * RAD_TO_DEG;

  const earthLat = Math.atan2(z, Math.sqrt(x * x + y * y));

  // Simplified — for precise conversion use satellite.js'
  // eciToGeodetic which handles Earth's oblateness
  const r = Math.sqrt(x * x + y * y + z * z);
  const lat = (r > 0 ? Math.asin(z / r) : 0) * RAD_TO_DEG;
  const alt = r - EARTH_MEAN_RADIUS_KM;

  return {
    latitude: lat,
    longitude: lon,
    altitude: alt,
  };
}

/** Convert ECI position directly to geographic lat/lon/alt. */
export function eciToGeodetic(
  position: [number, number, number],
  date: Date
): { latitude: number; longitude: number; altitude: number } {
  try {
    const jd = dateToJulian(date);
    // satellite.js: gstime(jd) → GMST in radians
    const gmst = satellite.gstime(jd);
    // satellite.js: eciToGeodetic(eciPosition, gmst) → {latitude, longitude, height}
    const result = satellite.eciToGeodetic(position, gmst);

    return {
      latitude: result.latitude * RAD_TO_DEG,
      longitude: result.longitude * RAD_TO_DEG,
      altitude: result.height / 1000, // meters → km
    };
  } catch {
    // Fallback to simple ECEF → geodetic conversion
    const ecef = eciToEcef(position, date);
    return ecefToGeodetic(ecef);
  }
}

// ─── Orbit Path Calculation ──────────────────────────── //

/**
 * Compute orbit path points in ECI coordinates over a time window.
 *
 * @param tle - TLE set for the satellite
 * @param centerTime - Center of the time window
 * @param windowMinutes - Half-window in minutes (± window)
 * @param segments - Number of points to compute
 * @returns Array of ECI position tuples
 */
export function computeOrbitPath(
  tle: TleSet,
  centerTime: Date,
  windowMinutes: number = 180,
  segments: number = ORBIT_PATH_SEGMENTS
): Array<[number, number, number]> {
  const points: Array<[number, number, number]> = [];
  const stepMinutes = (windowMinutes * 2) / segments;

  for (let i = 0; i <= segments; i++) {
    const tMin = -windowMinutes + i * stepMinutes;
    const date = new Date(centerTime.getTime() + tMin * 60000);

    const result = propagateSatellite(tle, date);
    if (result.isValid) {
      points.push(result.position);
    }
  }

  return points;
}

// ─── Ground Track Calculation ────────────────────────── //

/**
 * Compute ground track points (lat/lon) over a time window.
 */
export function computeGroundTrack(
  tle: TleSet,
  centerTime: Date,
  windowMinutes: number = 480,
  segments: number = 160
): Array<{ latitude: number; longitude: number }> {
  const points: Array<{ latitude: number; longitude: number }> = [];
  const stepMinutes = (windowMinutes * 2) / segments;

  for (let i = 0; i <= segments; i++) {
    const tMin = -windowMinutes + i * stepMinutes;
    const date = new Date(centerTime.getTime() + tMin * 60000);

    const result = propagateSatellite(tle, date);
    if (result.isValid) {
      const geo = eciToGeodetic(result.position, date);
      points.push({ latitude: geo.latitude, longitude: geo.longitude });
    }
  }

  return points;
}

// ─── Illumination Check ───────────────────────────────── //

/**
 * Check whether a satellite is illuminated by the Sun (not in Earth's shadow).
 */
export function isSatelliteLit(
  position: [number, number, number],
  sunDir: [number, number, number],
  date: Date
): boolean {
  const [sx, sy, sz] = sunDir;
  const [x, y, z] = position;

  // Satellite is lit if the angle between sun direction and satellite position
  // is less than ~90 degrees (dot product > 0 means lit)
  const dot = x * sx + y * sy + z * sz;

  // Also check that satellite isn't behind Earth
  const r = Math.sqrt(x * x + y * y + z * z);
  const earthRadius = EARTH_RADIUS_KM;

  if (dot > 0) {
    // Sun is in roughly the same direction as satellite — likely lit
    return true;
  }

  // Check if satellite is in Earth's shadow by computing the shadow angle
  // Shadow occurs when the satellite is behind Earth relative to the Sun
  const shadowAngle = Math.acos(dot / (r * 1)); // sunDir is normalized
  const earthAngularRadius = Math.asin(earthRadius / r);

  return shadowAngle < (Math.PI / 2 - earthAngularRadius);
}

// ─── Orbital Velocity ────────────────────────────────── //

/** Compute orbital velocity at a given altitude (km/s). */
export function orbitalVelocity(altitudeKm: number): number {
  return Math.sqrt(EARTH_MU / (EARTH_RADIUS_KM + altitudeKm));
}

/** Compute orbital period at a given altitude (minutes). */
export function orbitalPeriod(altitudeKm: number): number {
  const r = EARTH_RADIUS_KM + altitudeKm;
  const v = Math.sqrt(EARTH_MU / r);
  return (2 * Math.PI * r) / v / 60; // seconds → minutes
}

// ─── Constants ───────────────────────────────────────── //

const DAY = 86400; // seconds
