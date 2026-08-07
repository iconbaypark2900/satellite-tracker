/**
 * Application constants — orbital mechanics values, group configs, and TLE sources.
 */

import { DataSourceConfig, SatelliteGroup } from "@/types";

// ─── Physical Constants ───────────────────────────────── //

/** Earth's equatorial radius in km. */
export const EARTH_RADIUS_KM = 6378.137;

/** Earth's mean radius in km (for rendering). */
export const EARTH_MEAN_RADIUS_KM = 6371.0;

/** Earth's gravitational parameter (GM) in km³/s². */
export const EARTH_MU = 398600.4418;

/** Sidereal day in minutes (3h 56m 4s). */
export const SIDEREAL_DAY_MIN = 1436.06825;

/** Speed of light in km/s. */
export const SPEED_OF_LIGHT_KM_S = 299792.458;

/** Astronomical unit in km. */
export const AU_KM = 149597870.7;

/** Julian date of J2000 epoch. */
export const J2000_JD = 2451545.0;

/** Days from Unix epoch (1970-01-01) to J2000 (2000-01-01 12:00 UT). */
export const UNIX_TO_J2000_DAYS = 10957.5;

/** Earth angular rotation rate (rad/s). */
export const EARTH_OMEGA = (2 * Math.PI) / 86164.0905;

// ─── Degree / Radian Helpers ───────────────────────────── //

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

// ─── Satellite Group Configuration ────────────────────── //

/** Color mapping for each satellite constellation / group. */
export const GROUP_COLORS: Record<SatelliteGroup, string> = {
  STATIONS: "#FFD700",   // Gold (ISS, Tiangong, Hubble, etc.)
  STARLINK: "#4A9EFF",   // Blue (SpaceX)
  ONEWEB: "#BA68C8",     // Purple (OneWeb)
  "GPS-OPS": "#81D4FA",  // Light blue (USAF GPS)
  GOES: "#8AFF8A",       // Green (NOAA/NASA GOES)
  SES: "#FFCC80",        // Apricot (SES)
  INTREPID: "#FF80AB",   // Pink (Intelsat)
  OTHER: "#ECEFF1",      // Gray (everything else)
};

/** Human-readable label for each group. */
export const GROUP_LABELS: Record<SatelliteGroup, string> = {
  STATIONS: "ISS & Stations",
  STARLINK: "Starlink",
  ONEWEB: "OneWeb",
  "GPS-OPS": "GPS",
  GOES: "GOES",
  SES: "SES",
  INTREPID: "Intelsat",
  OTHER: "Other",
};

// ─── Celestrak TLE Group URLs ──────────────────────────── //

/** Map of Celestrak group names to their TLE fetch URLs. */
export const CELESTRAK_TLE_GROUPS: Record<SatelliteGroup, string> = {
  STATIONS: "https://celestrak.org/cgi-bin/gp/makegp.cgi?GROUP=STATIONS&FORMAT=TLE",
  STARLINK: "https://celestrak.org/cgi-bin/gp/makegp.cgi?GROUP=STARLINK&FORMAT=TLE",
  ONEWEB: "https://celestrak.org/cgi-bin/gp/makegp.cgi?GROUP=ONEWEB&FORMAT=TLE",
  "GPS-OPS": "https://celestrak.org/cgi-bin/gp/makegp.cgi?GROUP=GPS-OPS&FORMAT=TLE",
  GOES: "https://celestrak.org/cgi-bin/gp/makegp.cgi?GROUP=GOES&FORMAT=TLE",
  SES: "https://celestrak.org/cgi-bin/gp/makegp.cgi?GROUP=SES&FORMAT=TLE",
  INTREPID: "https://celestrak.org/cgi-bin/gp/makegp.cgi?GROUP=INTREPID&FORMAT=TLE",
  OTHER: "https://celestrak.org/cgi-bin/gp/makegp.cgi?GROUP=STATIONS&FORMAT=TLE",
};

/** Celestrak SATCAT records API endpoint. */
export const SATCAT_API_URL = "https://celestrak.org/satcat/records.php";

/** SATCAT query endpoint for individual records. */
export const SATCAT_RECORDS_URL = "https://celestrak.org/satcat/records.php?FORMAT=JSON";

// ─── Default Satellite List (for demo / fallback) ─────── //

/**
 * Fallback satellite list used when Celestrak is unreachable.
 * Mirrors the dataset in demo/index.html.
 */
export const DEFAULT_SATELLITES = [
  { name: "ISS (ZARYA)", norad: "25544", group: "STATIONS" },
  { name: "Hubble Space Telescope", norad: "20580", group: "STATIONS" },
  { name: "Tiangong", norad: "48793", group: "STATIONS" },
  { name: "Starlink-30001", norad: "70001", group: "STARLINK" },
  { name: "Starlink-70001", norad: "71001", group: "STARLINK" },
  { name: "OneWeb-2001", norad: "44926", group: "ONEWEB" },
  { name: "GPS IIR-10 (USA-183)", norad: "29494", group: "GPS-OPS" },
  { name: "GOES-East (G16)", norad: "39246", group: "GOES" },
  { name: "INTELSAT 902", norad: "27627", group: "INTREPID" },
  { name: "NOAA 20 (JPSS-1)", norad: "40697", group: "GOES" },
  { name: "Sentinel-3A", norad: "40699", group: "STATIONS" },
  { name: "Voyager 1", norad: "1132", group: "OTHER" },
  { name: "Voyager 2", norad: "1133", group: "OTHER" },
] as const;

// ─── Timing Constants ─────────────────────────────────── //

/** TLE cache TTL in seconds (5 minutes). */
export const TLE_CACHE_TTL = 300;

/** SATCAT metadata cache TTL in seconds (24 hours). */
export const SATCAT_CACHE_TTL = 86400;

/** Propagation update interval in ms. */
export const PROPAGATION_INTERVAL_MS = 100;

/** Minimum time delta (ms) to trigger re-propagation. */
export const MIN_REPROPAGATE_MS = 100;

/** Time slider range (minutes): -24h to +30d */
export const TIME_SLIDER_MIN = -1440;
export const TIME_SLIDER_MAX = 43200;
export const TIME_SLIDER_STEP = 5;

/** Default propagation window for orbit path (minutes). */
export const ORBIT_PATH_WINDOW_MIN = 180; // ±3h

/** Default ground track window (minutes). */
export const GROUND_TRACK_WINDOW_MIN = 480; // ±8h

// ─── API Data Sources ─────────────────────────────────── //

/** Data source definitions for caching and rate-limiting. */
export const DATA_SOURCES: DataSourceConfig[] = [
  {
    name: "Celestrak TLE",
    url: "https://celestrak.org",
    ttlSeconds: TLE_CACHE_TTL,
    rateLimitPerHour: 120,
  },
  {
    name: "Celestrak SATCAT",
    url: SATCAT_RECORDS_URL,
    ttlSeconds: SATCAT_CACHE_TTL,
    rateLimitPerHour: 120,
  },
  {
    name: "NASA API",
    url: "https://api.nasa.gov",
    ttlSeconds: 86400,
    rateLimitPerHour: 1000,
  },
];

// ─── Rendering Constants ───────────────────────────────── //

/** Number of segments in an orbit path curve. */
export const ORBIT_PATH_SEGMENTS = 96;

/** Maximum satellites before performance warnings. */
export const MAX_SATELLITES_DEFAULT = 50;

/** Maximum satellites before WebWorker is mandatory. */
export const MAX_SATELLITES_MAIN_THREAD = 20;
