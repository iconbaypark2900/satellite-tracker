/**
 * UI-specific type definitions.
 */

/** Time display format. */
export type TimeFormat = "utc" | "local";

/** Theme mode. */
export type ThemeMode = "dark" | "light" | "auto";

/** UI view mode. */
export type ViewMode = "globe" | "sky" | "passes";

/** Satellite detail panel fields. */
export interface SatelliteDetailFields {
  name: string;
  operator: string;
  type: string;
  noradId: string;
  launch: string;
  country: string;
  orbit: string;
  period: string;
  inclination: string;
  altitude: string;
  velocity: string;
  apogee: string;
  perigee: string;
}

/** Search filter options. */
export interface SearchFilters {
  query: string;
  group?: string;
  orbitType?: string;
  isLitOnly?: boolean;
}

/** Toast / notification message. */
export interface ToastMessage {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  duration?: number;
}
