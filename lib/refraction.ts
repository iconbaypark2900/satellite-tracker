/**
 * refraction.ts — Atmospheric refraction (Saemundsson, true -> apparent altitude).
 *
 * Built by dcode (gemma4-26b, tier 1) from dcode-stack/slices/refraction/SPEC.md and
 * promoted by its deterministic gate. Do not edit by hand: change the SPEC and
 * re-run `govern slices/refraction`, so the module and the thing that checks it stay
 * in step.
 *
 * Gated against JPL Horizons: 135 above-horizon ISS samples from 0.09 to 78.40
 * degrees elevation, agreeing to 0.05 arcmin. Also round-trip checked against
 * Bennett's independently derived inverse.
 */

export function refractionArcmin(
  trueAltitudeDeg: number,
  pressureMbar: number = 1010,
  temperatureC: number = 10
): number {
  if (!Number.isFinite(trueAltitudeDeg)) {
    throw new RangeError("trueAltitudeDeg must be a finite number");
  }
  if (!Number.isFinite(pressureMbar) || pressureMbar <= 0) {
    throw new RangeError("pressureMbar must be a finite number greater than zero");
  }
  if (!Number.isFinite(temperatureC) || temperatureC <= -273.15) {
    throw new RangeError("temperatureC must be a finite number greater than absolute zero (-273.15 °C)");
  }

  if (trueAltitudeDeg < -1) {
    return 0;
  }

  const h = trueAltitudeDeg;
  const degArg = h + 10.3 / (h + 5.11);
  const radArg = degArg * (Math.PI / 180);
  
  let R = 1.02 / Math.tan(radArg);

  // Apply scaling for non-standard conditions
  const pressureScale = pressureMbar / 1010;
  const temperatureScale = 283 / (273 + temperatureC);
  R = R * pressureScale * temperatureScale;

  // Clamp to minimum 0
  return Math.max(0, R);
}

export function apparentAltitudeDeg(
  trueAltitudeDeg: number,
  pressureMbar: number = 1010,
  temperatureC: number = 10
): number {
  return trueAltitudeDeg + refractionArcmin(trueAltitudeDeg, pressureMbar, temperatureC) / 60;
}
