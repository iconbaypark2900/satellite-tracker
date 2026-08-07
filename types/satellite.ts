/**
 * Satellite metadata types.
 */

import { OrbitType, SatelliteGroup } from "./index";

/** SATCAT record from Celestrak. */
export interface SatCatRecord {
  /** NORAD catalog number */
  NORAD_CAT_ID: string;
  /** International designator */
  INTL_DESIG: string;
  /** Object name */
  OBJECT_NAME: string;
  /** Country / operator code */
  COUNTRY?: string;
  /** Launch date */
  LAUNCH: string;
  /** Deploy date */
  DECAY?: string;
  /** Object type (ROCKET, DEBRIS, UNKNOWN, etc.) */
  OBJECT_TYPE?: string;
  /** Orbital period in minutes */
  PERIOD?: string;
  /** Inclination in degrees */
  INCLINATION?: string;
  /** Semi-major axis in km */
  SEMIMAJOR_AXIS?: string;
  /** Apogee in km */
  APOGEE?: string;
  /** Perigee in km */
  PERIGEE?: string;
  /** Right ascension */
  RA_OF_ASC_NODE?: string;
  /** Argument of perigee */
  ARG_OF_PERIGEE?: string;
}

/** Combined satellite metadata with TLE + SATCAT. */
export interface SatelliteMetadata {
  /** NORAD catalog number */
  noradId: string;
  /** Satellite / object name */
  name: string;
  /** TLE group (STATIONS, STARLINK, etc.) */
  group: SatelliteGroup;
  /** Object type */
  type: string;
  /** Country of origin */
  country: string;
  /** Launch date string */
  launchDate: string;
  /** International designator */
  intDesignator: string;
  /** Orbital period (minutes) */
  period: number;
  /** Inclination (degrees) */
  inclination: number;
  /** Apogee altitude (km) */
  apogee: number;
  /** Perigee altitude (km) */
  perigee: number;
  /** Orbit category */
  orbitType: OrbitType;
  /** Display color */
  color: string;
}
