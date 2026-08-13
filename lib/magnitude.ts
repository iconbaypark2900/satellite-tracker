/**
 * magnitude.ts — Visual magnitude with a phase-angle model.
 *
 * Built by dcode (gemma4-26b, tier 1) from dcode-stack/slices/magnitude/SPEC.md
 * and promoted by its deterministic gate. Do not edit by hand: change the SPEC
 * and re-run `govern slices/magnitude`, so the module and the thing that checks
 * it stay in step.
 *
 * The phase function is gated against a Lambertian sphere integrated over its
 * surface — an algorithm sharing no step with the closed form — agreeing to
 * 2e-5 across the domain.
 *
 * The standard magnitudes in MAGNITUDE_TABLE are a different kind of claim.
 * They are published observational estimates, asserted rather than computed,
 * carrying roughly +/-0.5 mag of real spread, and satellites tumble. Nothing
 * verifies them because nothing can. `standardMagnitude` returns null for an
 * unknown id precisely so a caller cannot mistake a guess for one of these.
 */

export function phaseFunction(betaRad: number): number {
  if (!Number.isFinite(betaRad) || betaRad < 0 || betaRad > Math.PI) {
    throw new RangeError("betaRad must be a finite number in [0, PI]");
  }
  // R3: Handle floating-point imprecision at betaRad === Math.PI.
  // Math.sin(Math.PI) is not 0 (~1.22e-16) since Math.PI is a double approximation.
  if (betaRad === Math.PI) {
    return 0;
  }
  return Math.sin(betaRad) + (Math.PI - betaRad) * Math.cos(betaRad);
}

export function visualMagnitude(stdMag: number, rangeKm: number, betaRad: number): number {
  if (arguments.length === 0) {
    throw new RangeError("visualMagnitude requires at least 3 arguments: stdMag, rangeKm, betaRad");
  }
  if (!Number.isFinite(stdMag)) {
    throw new RangeError("stdMag must be a finite number");
  }
  if (!Number.isFinite(rangeKm) || rangeKm <= 0) {
    throw new RangeError("rangeKm must be a finite number greater than zero");
  }

  if (betaRad === Math.PI) {
    return Number.POSITIVE_INFINITY;
  }

  const F = phaseFunction(betaRad);
  // Requirement R3: Handle the unilluminated endpoint. 
  // Since we already checked betaRad === Math.PI, and F(beta) > 0 for beta < PI,
  // we don't need an extra F <= 0 check, but we'll be safe.
  if (F <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return stdMag - 15 + 5 * Math.log10(rangeKm) - 2.5 * Math.log10(F);
}

export function phaseAngleRad(
  satEciKm: number[],
  sunEciKm: number[],
  observerEciKm: number[]
): number {
  const validateVec = (v: number[]) => {
    if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite)) {
      throw new RangeError("Vector must be an array of exactly 3 finite numbers");
    }
  };

  validateVec(satEciKm);
  validateVec(sunEciKm);
  validateVec(observerEciKm);

  const vSatSun = [
    sunEciKm[0] - satEciKm[0],
    sunEciKm[1] - satEciKm[1],
    sunEciKm[2] - satEciKm[2],
  ];
  const vSatObs = [
    observerEciKm[0] - satEciKm[0],
    observerEciKm[1] - satEciKm[1],
    observerEciKm[2] - satEciKm[2],
  ];

  const dot = vSatSun[0] * vSatObs[0] + vSatSun[1] * vSatObs[1] + vSatSun[2] * vSatObs[2];
  const magSun = Math.sqrt(vSatSun[0] ** 2 + vSatSun[1] ** 2 + vSatSun[2] ** 2);
  const magObs = Math.sqrt(vSatObs[0] ** 2 + vSatObs[1] ** 2 + vSatObs[2] ** 2);

  if (magSun === 0 || magObs === 0) {
    throw new RangeError("Satellite cannot coincide with the Sun or the observer");
  }

  const cosBeta = dot / (magSun * magObs);
  // Clamp to [-1, 1] to avoid NaN from floating point errors
  const clampedCos = Math.max(-1, Math.min(1, cosBeta));

  return Math.acos(clampedCos);
}

const MAGNITUDE_TABLE: Record<string, number> = {
  "25544": -1.8,
  "48274": -0.8,
  "20580": 2.0,
  "27386": 2.5,
  "22076": 2.2,
  "25994": 2.5,
};

export function standardMagnitude(noradId: string): number | null {
  const val = MAGNITUDE_TABLE[noradId];
  return val !== undefined ? val : null;
}
