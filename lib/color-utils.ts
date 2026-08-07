/**
 * Color utilities — constellation color mapping, visibility magnitude
 * calculations, and satellite color assignment.
 */

import { SatelliteGroup } from "@/types";
import { GROUP_COLORS } from "@/lib/constants";

// ─── Color Mapping ───────────────────────────────────── //

/**
 * Get the display color for a satellite constellation group.
 */
export function getGroupColor(group: SatelliteGroup): string {
  return GROUP_COLORS[group] ?? GROUP_COLORS.OTHER;
}

/**
 * Get the display color for a satellite by NORAD ID,
 * using a hash for consistent assignment.
 */
export function getSatelliteColor(noradId: string, group?: SatelliteGroup): string {
  if (group) {
    return getGroupColor(group);
  }

  // Hash-based color fallback for unknown groups
  let hash = 0;
  for (let i = 0; i < noradId.length; i++) {
    hash = noradId.charCodeAt(i) + (hash << 5) - hash;
  }
  hash = Math.abs(hash);

  const hue = (hash % 360);
  const saturation = 70 + (hash % 20);
  const lightness = 50 + (hash % 10);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// ─── Brightness / Magnitude ──────────────────────────── //

/**
 * Compute the apparent visual magnitude of a satellite.
 *
 * Uses a simplified model based on:
 * - Satellite type and size
 * - Observer distance
 * - Phase angle (angle Sun-Satellite-Observer)
 *
 * @returns Visual magnitude (lower = brighter). Returns null if not calculable.
 */
export function computeMagnitude(
  type: string,
  distanceKm: number,
  phaseAngleDeg: number = 0
): number | null {
  // Base magnitude by type (approximate)
  const baseMagnitude: Record<string, number> = {
    Station: -1.5,       // ISS is brightest
    Observatory: -0.5,    // Hubble
    Comms: 3.0,           // Typical comms satellite
    Nav: 4.5,             // GPS
    Weather: 2.0,         // GOES
    "Earth Obs": 2.5,     // Sentinel
    "Deep Space": 7.0,    // Voyager — very dim
  };

  const base = baseMagnitude[type] ?? 4.0;

  // Distance correction (magnitude gets dimmer with distance)
  const distanceMod = 5 * Math.log10(distanceKm / 1000);

  // Phase angle correction (rough approximation of the Lambertian phase function)
  const phase = Math.max(0, phaseAngleDeg);
  const phaseMod = phase < 5 ? 0 : 0.02 * (phase - 5);

  return base + distanceMod + phaseMod;
}

/**
 * Check if a satellite is likely visible to the naked eye
 * (magnitude ≤ 6 is the typical naked-eye limit).
 */
export function isVisibleToNakedEye(magnitude: number): boolean {
  return magnitude <= 6.0;
}

/**
 * Convert a hex color to RGB components.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB components to a CSS hsl string.
 */
export function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h *= 60;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (2 - max - min);

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Generate a glowing color string with opacity for satellite rendering.
 */
export function glowColor(baseColor: string, opacity: number = 0.65): string {
  const rgb = hexToRgb(baseColor);
  if (!rgb) return baseColor;

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}
