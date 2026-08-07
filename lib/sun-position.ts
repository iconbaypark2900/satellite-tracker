/**
 * Sun position calculation — astronomical algorithms for solar direction,
 * terminators, and illumination checks.
 */

import { unixToJulian } from "@/lib/orbit-utils";
import { DEG_TO_RAD, RAD_TO_DEG, J2000_JD, EARTH_RADIUS_KM } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────── //

export interface SunPosition {
  /** ECI direction vector (normalized) toward the Sun */
  eci: [number, number, number];
  /** Right Ascension (degrees) */
  ra: number;
  /** Declination (degrees) */
  dec: number;
  /** whether the Sun is above the equator at this JDAPI */
  // (informational)
}

// ─── Core Sun Position ───────────────────────────────── //

/**
 * Compute the Sun's ECI direction vector and celestial coordinates
 * at a given Julian date.
 *
 * Uses the VSOP87 approximation (good to ~1 arcminute).
 */
export function getSunPosition(jd: number): SunPosition {
  const T = (jd - J2000_JD) / 365.25;

  // Mean longitude (degrees, reduced to 0-360)
  const L0 = ((280.46646 + 36000.76983 * T) % 360 + 360) % 360;

  // Mean anomaly (degrees)
  const M = ((357.52911 + 359.05029 * T) % 360 + 360) % 360;
  const Mr = M * DEG_TO_RAD;

  // Equation of center
  const C =
    (1.914602 - 0.004817 * T) * Math.sin(Mr) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) +
    0.000289 * Math.sin(3 * Mr);

  // True longitude (degrees)
  const L_true = L0 + C;

  // Ecliptic longitude (radians)
  const lambda = L_true * DEG_TO_RAD;

  // Obliquity of ecliptic (degrees → radians)
  const eps = ((23.439291 - 0.013011 * T) % 360) * DEG_TO_RAD;

  // ECI direction vector (unit)
  const sinLambda = Math.sin(lambda);
  const eci: [number, number, number] = [
    Math.cos(lambda),
    Math.cos(eps) * sinLambda,
    Math.sin(eps) * sinLambda,
  ];

  return {
    eci,
    ra: L_true, // Approximation; precise RA requires additional terms
    dec: Math.asin(eci[2]) * RAD_TO_DEG,
  };
}

/**
 * Compute sun position from a Date object.
 */
export function getSunPositionFromDate(date: Date): SunPosition {
  return getSunPosition(unixToJulian(date.getTime()));
}

// ─── Terminator Line ─────────────────────────────────── //

/**
 * Compute the terminator (day/night boundary) as a set of lat/lon points
 * at the subsolar latitude.
 *
 * @returns Array of {latitude, longitude} points along the terminator.
 */
export function getTerminatorPoints(
  jd: number,
  segments: number = 120
): Array<{ latitude: number; longitude: number }> {
  const sun = getSunPosition(jd);
  const points: Array<{ latitude: number; longitude: number }> = [];

  for (let i = 0; i <= segments; i++) {
    const lon = ((360 * i) / segments) * DEG_TO_RAD;

    // Terminator is at 90° from the subsolar point
    // Use spherical geometry
    const slat = Math.asin(sun.eci[2]);
    const slon = Math.atan2(sun.eci[1], sun.eci[0]);

    // Terminator latitude at a given longitude
    const dlon = lon - slon;
    const lat = Math.atan2(
      -Math.sin(dlon),
      Math.cos(dlon) * Math.sin(slat) - Math.cos(slat) * Math.tan(slat)
    );

    // Simplify: terminator is approximately at ±90° from subsolar point
    // Use a simpler approximation
    const termLat = Math.asin(
      Math.sin(slat) * Math.cos(dlon) * 0 // terminator boundary
    );

    points.push({
      latitude: Math.max(-89, Math.min(89, lat * RAD_TO_DEG)),
      longitude: ((lon * RAD_TO_DEG) % 360 + 360) % 360,
    });
  }

  return points;
}

// ─── Illumination ────────────────────────────────────── //

/**
 * Check whether a point at (lat, lon) on Earth is currently in daylight
 * (not in the terminator shadow).
 */
export function isPointLit(
  latitude: number,
  longitude: number,
  sun: SunPosition
): boolean {
  const latRad = latitude * DEG_TO_RAD;
  const lonRad = longitude * DEG_TO_RAD;

  // Convert lat/lon to ECI direction (point on Earth's surface)
  const x = Math.cos(latRad) * Math.cos(lonRad);
  const y = Math.cos(latRad) * Math.sin(lonRad);
  const z = Math.sin(latRad);

  // Sun is lit if dot product with sun direction > 0
  const dot = x * sun.eci[0] + y * sun.eci[1] + z * sun.eci[2];

  return dot > 0;
}

/**
 * Compute the subsolar point (latitude, longitude) at a given time.
 */
export function getSubsolarPoint(jd: number): { latitude: number; longitude: number } {
  const sun = getSunPosition(jd);
  return {
    latitude: Math.asin(sun.eci[2]) * RAD_TO_DEG,
    longitude: Math.atan2(sun.eci[1], sun.eci[0]) * RAD_TO_DEG,
  };
}

/**
 * Compute day/night shading factor for a point on Earth (0 = night, 1 = day).
 * Uses a smooth terminator for nicer rendering.
 */
export function getDayNightFactor(
  latitude: number,
  longitude: number,
  sun: SunPosition,
  edgeSoftness: number = 0.1
): number {
  const latRad = latitude * DEG_TO_RAD;
  const lonRad = longitude * DEG_TO_RAD;

  const x = Math.cos(latRad) * Math.cos(lonRad);
  const y = Math.cos(latRad) * Math.sin(lonRad);
  const z = Math.sin(latRad);

  const dot = x * sun.eci[0] + y * sun.eci[1] + z * sun.eci[2];

  // Smoothstep for soft terminator
  const t = (dot + edgeSoftness) / (2 * edgeSoftness);
  return Math.max(0, Math.min(1, t));
}
