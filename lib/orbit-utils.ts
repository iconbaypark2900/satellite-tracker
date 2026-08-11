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
import { PropagationResult, TleSet, Satellite } from "@/types";

// ─── TLE Parsing & Orbital Parameter Extraction ────────────────────────── //

/**
 * Parse a TLE line 2 to extract orbital elements.
 * TLE line 2 format (0-indexed columns):
 *   0-1:  Line number ("2 ")
 *   2-6:  NORAD catalog number
 *   7-14: Inclination (degrees)
 *   15-22: RAAN (degrees)
 *   23-32: Eccentricity (no leading "0.")
 *   33-42: Argument of perigee (degrees)
 *   43-52: Mean anomaly (degrees)
 *   53-62: Mean motion (rev/day)
 */
export function parseTleElements(line2: string): {
  inclination: number;
  raan: number;
  eccentricity: number;
  argOfPerigee: number;
  meanAnomaly: number;
  meanMotion: number;
} | null {
  if (!line2 || !line2.startsWith("2 ")) return null;
  try {
    const inclination = parseFloat(line2.substring(8, 16).trim());
    const raan = parseFloat(line2.substring(17, 25).trim());
    const eccentricity = parseFloat("0." + line2.substring(26, 34).trim());
    const argOfPerigee = parseFloat(line2.substring(34, 42).trim());
    const meanAnomaly = parseFloat(line2.substring(43, 52).trim());
    const meanMotion = parseFloat(line2.substring(52, 63).trim());
    return { inclination, raan, eccentricity, argOfPerigee, meanAnomaly, meanMotion };
  } catch {
    return null;
  }
}

/**
 * Parse the international designator from TLE line 1 (columns 10-17),
 * e.g. "98067A  " → { intlDesignator: "1998-067A", launchYear: 1998 }.
 * Years ≥ 57 are 19xx (Sputnik era), otherwise 20xx.
 */
export function parseIntlDesignator(
  line1: string
): { intlDesignator: string; launchYear: number } | null {
  if (!line1 || line1.length < 17) return null;
  const raw = line1.substring(9, 17).trim();
  const match = raw.match(/^(\d{2})(\d{3})([A-Z]{1,3})$/);
  if (!match) return null;
  const yy = parseInt(match[1], 10);
  const launchYear = yy >= 57 ? 1900 + yy : 2000 + yy;
  return {
    intlDesignator: `${launchYear}-${match[2]}${match[3]}`,
    launchYear,
  };
}

/**
 * Compute orbital parameters (period, apogee, perigee, altitude)
 * from a TLE and update a satellite's metadata.
 */
export function computeOrbitalParams(tle: TleSet): Partial<Satellite> {
  const elements = parseTleElements(tle.line2);
  if (!elements) return {};

  const { inclination, raan, eccentricity, meanMotion } = elements;
  const period = meanMotion > 0 ? 1440 / meanMotion : 0; // minutes

  // Semi-major axis from period: a = (mu * (T/2pi)^2)^(1/3)
  const periodSec = period * 60;
  const a = Math.cbrt((EARTH_MU * periodSec * periodSec) / (4 * Math.PI * Math.PI));

  // Apogee and perigee (altitude above Earth surface)
  const apogee = a * (1 + eccentricity) - EARTH_MEAN_RADIUS_KM;
  const perigee = a * (1 - eccentricity) - EARTH_MEAN_RADIUS_KM;
  const altitude = (apogee + perigee) / 2;

  return {
    period,
    inclination,
    raan,
    apogee: Math.round(apogee),
    perigee: Math.round(perigee),
    altitude: Math.round(altitude),
  };
}

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
 * Module-level satrec cache. Parsing a TLE with twoline2satrec is by far
 * the most expensive step of a propagation call, and TLEs are immutable —
 * key by both lines so a refreshed TLE (new epoch) gets a fresh satrec.
 * `null` marks a TLE that failed to parse, so we don't retry every frame.
 */
const satrecCache = new Map<string, satellite.SatRec | null>();
const SATREC_CACHE_MAX = 16384;
const warnedNoradIds = new Set<string>();

function getSatrec(tle: TleSet): satellite.SatRec | null {
  const key = tle.line1 + tle.line2;
  const cached = satrecCache.get(key);
  if (cached !== undefined) return cached;

  let satrec: satellite.SatRec | null = null;
  try {
    const parsed = satellite.twoline2satrec(tle.line1, tle.line2);
    satrec = parsed.error === 0 ? parsed : null;
  } catch {
    satrec = null;
  }

  if (satrec === null && !warnedNoradIds.has(tle.noradId)) {
    warnedNoradIds.add(tle.noradId);
    console.warn(`SGP4: failed to initialize satrec for ${tle.name} (#${tle.noradId})`);
  }

  if (satrecCache.size >= SATREC_CACHE_MAX) {
    // Drop the oldest entry (Map preserves insertion order)
    const oldest = satrecCache.keys().next().value;
    if (oldest !== undefined) satrecCache.delete(oldest);
  }
  satrecCache.set(key, satrec);
  return satrec;
}

const INVALID_RESULT: PropagationResult = {
  position: [0, 0, 0],
  velocity: [0, 0, 0],
  isValid: false,
};

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
    return INVALID_RESULT;
  }

  const satRec = getSatrec(tle);
  if (!satRec) {
    return INVALID_RESULT;
  }

  try {
    const result = satellite.propagate(satRec, date);
    if (!result || !result.position || !result.velocity) {
      return INVALID_RESULT;
    }

    const pos = result.position as { x: number | null; y: number | null; z: number | null };
    const vel = result.velocity as { x: number | null; y: number | null; z: number | null };

    if (!pos || !vel || pos.x === null || pos.y === null || pos.z === null ||
        vel.x === null || vel.y === null || vel.z === null ||
        Number.isNaN(pos.x) || Number.isNaN(pos.y) || Number.isNaN(pos.z)) {
      return INVALID_RESULT;
    }

    return {
      position: [pos.x, pos.y, pos.z],
      velocity: [vel.x, vel.y, vel.z],
      isValid: true,
    };
  } catch {
    if (!warnedNoradIds.has(tle.noradId)) {
      warnedNoradIds.add(tle.noradId);
      console.warn(`SGP4: propagation threw for ${tle.name} (#${tle.noradId})`);
    }
    return INVALID_RESULT;
  }
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
    // satellite.js requires EciVec3 (object) not a tuple
    const result = satellite.eciToGeodetic(
      { x: position[0], y: position[1], z: position[2] },
      gmst
    );

    return {
      latitude: result.latitude * RAD_TO_DEG,
      longitude: result.longitude * RAD_TO_DEG,
      altitude: result.height, // satellite.js returns km
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

/**
 * Classify orbit type based on altitude and inclination.
 *
 * @param altitudeKm - Satellite altitude in km
 * @param inclinationDeg - Orbital inclination in degrees
 * @returns Orbit type classification string
 */
export function orbitType(altitudeKm: number, inclinationDeg: number): string {
  if (altitudeKm > 35000) return "GEO";
  if (inclinationDeg < 1) return "GEO (Eq)";
  if (inclinationDeg > 80) return "Polar";
  if (inclinationDeg > 50) return "Sun-Sync";
  if (altitudeKm < 2000) return "LEO";
  if (altitudeKm < 35000) return "MEO";
  return "Elliptical";
}

// ─── Constants ───────────────────────────────────────── //

const DAY = 86400; // seconds
