/**
 * Core type definitions for the Satellite Tracker application.
 */

// ─── TLE Types ─────────────────────────────────────── //

/** A single Two-Line Element (TLE) set. */
export interface TleSet {
  /** NORAD catalog ID (e.g. "25544" for ISS) */
  noradId: string;
  /** Satellite name / common name */
  name: string;
  /** Line 1 of the TLE */
  line1: string;
  /** Line 2 of the TLE */
  line2: string;
  /** Epoch timestamp (from TLE line 1) */
  epoch: string;
  /** Raw TLE source / group (e.g. "STATIONS", "STARLINK") */
  group?: SatelliteGroup;
}

/** Groups of satellites from Celestrak. */
export type SatelliteGroup =
  | "STATIONS"
  | "STARLINK"
  | "ONEWEB"
  | "GPS-OPS"
  | "GOES"
  | "SES"
  | "INTREPID"
  | "OTHER";

/** Result of SGP4 propagation at a given time. */
export interface PropagationResult {
  /** Position in ECI (Earth-Centered Inertial) coordinates, km */
  position: [number, number, number];
  /** Velocity in ECI coordinates, km/s */
  velocity: [number, number, number];
  /** Whether the satellite is in a valid (non-decayed) state */
  isValid: boolean;
}

// ─── Satellite Types ───────────────────────────────── //

/** Orbit category for an object. */
export type OrbitType =
  | "LEO"
  | "MEO"
  | "GEO"
  | "GEO (Eq)"
  | "Polar"
  | "Sun-Sync"
  | "Elliptical"
  | "Deep Space";

/** Operator / owning organization. */
export interface SatelliteOperator {
  name: string;
  country: string;
  abbreviation?: string;
}

/** Full satellite metadata combining TLE + SATCAT info. */
export interface Satellite {
  /** NORAD catalog number (unique ID) */
  noradId: string;
  /** Human-readable name */
  name: string;
  /** TLE set (null if decayed / not available) */
  tle: TleSet | null;
  /** Constellation / group */
  group: SatelliteGroup;
  /** Human-friendly type (Station, Observatory, Comms, Nav, Weather, etc.) */
  type: string;
  /** Operator organization */
  operator: SatelliteOperator;
  /** Orbital period in minutes */
  period: number;
  /** Inclination in degrees */
  inclination: number;
  /** Right Ascension of Ascending Node in degrees */
  raan: number;
  /** Apogee in km */
  apogee: number;
  /** Perigee in km */
  perigee: number;
  /** Mean altitude in km */
  altitude: number;
  /** Launch date string (e.g. "2020-025A") */
  launchDate?: string;
  /** Display color for this satellite */
  color: string;
  /** Current ECI position at simulation time */
  position?: [number, number, number];
  /** Current ECI velocity */
  velocity?: [number, number, number];
  /** Whether the satellite is currently illuminated by the Sun */
  isLit?: boolean;
}

/** Props for the 3D GlobeScene component. */
export interface GlobeSceneProps {
  /** Simulation time as a Date object */
  simTime: Date;
  /** Callback when a satellite is selected */
  onSatelliteSelect?: (sat: Satellite | null) => void;
}

// ─── UI Types ──────────────────────────────────────── //

/** Time control state for the time slider. */
export interface TimeControlState {
  /** Time offset in minutes from real-time (0 = now) */
  offsetMinutes: number;
  /** Whether time is advancing automatically */
  isPlaying: boolean;
  /** Playback speed multiplier (1 = real-time, 60 = 1hr/sec) */
  speed: number;
  /** The simulated Date at the current offset */
  simTime: Date;
}

/** Visibility filter for constellation groups. */
export interface ConstellationFilter {
  [group: string]: boolean;
}

/** Pass prediction for a single satellite over a location. */
export interface PassPrediction {
  /** Start time of the pass */
  startTime: Date;
  /** Maximum elevation time */
  maxTime: Date;
  /** End time of the pass */
  endTime: Date;
  /** Maximum elevation angle in degrees */
  maxElevation: number;
  /** Start azimuth in degrees */
  startAz: number;
  /** Max elevation azimuth in degrees */
  maxAz: number;
  /** End azimuth in degrees */
  endAz: number;
  /** Whether the satellite is sunlit during the pass */
  isLit: boolean;
  /** Maximum brightness (magnitude) */
  magnitude: number;
}

/** Observer location for pass predictions. */
export interface ObserverLocation {
  /** Latitude in degrees */
  lat: number;
  /** Longitude in degrees */
  lon: number;
  /** Altitude in km */
  alt: number;
  /** Human-readable label */
  label: string;
}

/** Satellite data source configuration. */
export interface DataSourceConfig {
  name: string;
  url: string;
  ttlSeconds: number;
  rateLimitPerHour: number;
}

/** Application-wide store interface (Zustand). */
export interface SatelliteStoreState {
  /** All satellites with metadata */
  satellites: Map<string, Satellite>;
  /** Currently selected satellite */
  selectedSatellite: Satellite | null;
  /** Constellation visibility filters */
  constellationFilters: ConstellationFilter;
  /** Time control state */
  timeControl: TimeControlState;
  /** Observer location */
  observer: ObserverLocation;
  /** TLE data age indicator (seconds since last fetch) */
  tleAge: number;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error message if data loading failed */
  error: string | null;
}
