/**
 * TLE (Two-Line Element) specific types.
 */

import { SatelliteGroup } from "./index";

/** Raw TLE data as returned by Celestrak. */
export interface RawTle {
  SATNAME: string;
  NORAD_CAT_ID: string;
  TLE_LINE1: string;
  TLE_LINE2: string;
  EPOCH: string;
  MEAN_ANOMALY?: string;
  ECCENTRICITY?: string;
  INCLINATION?: string;
  RA_OF_ASC_NODE?: string;
  ARG_OF_PERIGEE?: string;
  MEAN_MOTION?: string;
}

/** Parsed TLE with derived parameters. */
export interface ParsedTle extends RawTle {
  /** Satellite name (trimmed) */
  name: string;
  /** NORAD ID as number */
  noradId: number;
  /** Epoch as Julian Date */
  epochJd: number;
  /** Epoch as JavaScript Date */
  epochDate: Date;
  /** Inclination in degrees */
  inclinationDeg: number;
  /** Right ascension of ascending node in degrees */
  raanDeg: number;
  /** Eccentricity (dimensionless) */
  eccentricity: number;
  /** Argument of perigee in degrees */
  argOfPerigeeDeg: number;
  /** Mean anomaly in degrees */
  meanAnomalyDeg: number;
  /** Mean motion in revolutions/day */
  meanMotion: number;
  /** Source group (STATIONS, STARLINK, etc.) */
  group: SatelliteGroup;
}

/** SGP4 propagator result at a specific time. */
export interface Sgp4Result {
  /** Position [x, y, z] in km (ECI) */
  position: [number, number, number];
  /** Velocity [x, y, z] in km/s (ECI) */
  velocity: [number, number, number];
  /** Whether propagation was successful */
  success: boolean;
  /** Error message if propagation failed */
  error?: string;
}

/** TLE set with group attribution. */
export interface TleSet {
  noradId: string;
  name: string;
  line1: string;
  line2: string;
  epoch: string;
  group?: SatelliteGroup;
}
