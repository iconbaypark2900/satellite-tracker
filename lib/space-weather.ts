/**
 * space-weather.ts — Pure helpers for NOAA SWPC data products.
 */

/** GOES X-ray flux (W/m², 0.1-0.8nm) → flare class string, e.g. "B3.1". */
export function xrayFluxToClass(flux: number | null | undefined): string | null {
  if (flux === null || flux === undefined || !Number.isFinite(flux) || flux <= 0) {
    return null;
  }
  const bands: Array<[string, number]> = [
    ["X", 1e-4],
    ["M", 1e-5],
    ["C", 1e-6],
    ["B", 1e-7],
    ["A", 1e-8],
  ];
  for (const [letter, floor] of bands) {
    if (flux >= floor) {
      // X class is open-ended (X10 = 1e-3); others cap at 9.9
      const level = flux / floor;
      const capped = letter === "X" ? level : Math.min(level, 9.9);
      return `${letter}${capped.toFixed(1)}`;
    }
  }
  return `A${(flux / 1e-8).toFixed(1)}`;
}

/** Kp index → NOAA geomagnetic storm scale (G1..G5), or null below storm level. */
export function kpToGScale(kp: number | null | undefined): string | null {
  if (kp === null || kp === undefined || !Number.isFinite(kp)) return null;
  if (kp >= 9) return "G5";
  if (kp >= 8) return "G4";
  if (kp >= 7) return "G3";
  if (kp >= 6) return "G2";
  if (kp >= 5) return "G1";
  return null;
}

/** Color for a Kp value (quiet → storm). */
export function kpColor(kp: number | null | undefined): string {
  if (kp === null || kp === undefined || !Number.isFinite(kp)) return "#6f6d69";
  if (kp >= 7) return "#ff5252";
  if (kp >= 5) return "#ffa726";
  if (kp >= 4) return "#ffd700";
  return "#8aff8a";
}

/** Southward IMF (Bz < -5 nT) lets solar wind couple into the magnetosphere. */
export function isBzSouthwardWarning(bzGsm: number | null | undefined): boolean {
  return typeof bzGsm === "number" && Number.isFinite(bzGsm) && bzGsm < -5;
}

export interface SpaceWeatherSummary {
  fetchedAt: string;
  kp: { value: number; max3h: number; timeTag: string } | null;
  solarWind: { speedKmS: number; timeTag: string } | null;
  imf: { btNt: number; bzGsmNt: number; timeTag: string } | null;
  xray: { flux: number; class: string | null; timeTag: string } | null;
}
