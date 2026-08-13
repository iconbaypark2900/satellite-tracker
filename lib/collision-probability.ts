/**
 * collision-probability.ts — Foster 2-D probability of collision.
 *
 * Built by dcode (nemotron-lightning, tier 2) from
 * dcode-stack/slices/collision-probability/SPEC.md and promoted by its
 * deterministic gate. Do not edit by hand: change the SPEC and re-run
 * `govern slices/collision-probability`.
 *
 * The integral is gated against Monte Carlo — 4e6 samples per case, agreement
 * required within 4 standard errors — which converges by the law of large
 * numbers rather than by mesh refinement and so shares no step with the
 * quadrature.
 *
 * READ PC_ASSUMPTION_NOTE BEFORE SHOWING ANY NUMBER FROM THIS MODULE.
 * The arithmetic is exact. Its input is not measured. This project has no
 * covariance data and public TLEs carry none, so every probability here rests
 * on an assumed uncertainty and an assumed hard-body radius. That is why the
 * caveat is an export rather than a comment: a caller cannot drop it without
 * deleting code.
 */

/**
 * Probability of collision from an assumed covariance.
 *
 * Computes Pc using Foster's two-dimensional method with numerical integration
 * over a disk in polar coordinates. All quantities are in kilometres.
 *
 * The probability is computed from an explicitly assumed uncertainty, not from
 * measured covariance. The assumption travels with the result via PC_ASSUMPTION_NOTE.
 */

// R7: the assumption caveat that must travel with every Pc result
export const PC_ASSUMPTION_NOTE =
  "Probability of collision computed from an assumed uncertainty, not measured covariance. " +
  "Derived from TLE-derived position error growth model: sigma = 1.0 + 0.5 * tleAgeHours km. " +
  "Indicative only, not operational conjunction assessment.";

/**
 * Assumed 1-sigma position uncertainty for a single object whose TLE is tleAgeHours old.
 * sigma = 1.0 + 0.5 * tleAgeHours kilometres.
 * Strictly increasing, strictly positive at zero, defined for tleAgeHours >= 0.
 */
export function assumedSigmaKm(tleAgeHours: number): number {
  if (!Number.isFinite(tleAgeHours)) {
    throw new RangeError(
      `tleAgeHours must be a finite number, got ${typeof tleAgeHours === "number" ? tleAgeHours : tleAgeHours}`
    );
  }
  if (tleAgeHours < 0) {
    throw new RangeError(
      `tleAgeHours must be non-negative, got ${tleAgeHours}`
    );
  }
  return 1.0 + 0.5 * tleAgeHours;
}

/**
 * Probability of collision via Foster's two-dimensional method.
 *
 * Evaluates the integral numerically over a disk in polar coordinates:
 *   Pc = ∫∫_{x²+z²≤R²} 1/(2πσxσz) * exp(-[(x-missX)²/(2σx²) + (z-missZ)²/(2σz²)]) r dr dθ
 *
 * Uses polar quadrature with at least 200 radial and 200 angular steps.
 * The r factor (Jacobian) is included — omitting it systematically understates Pc.
 *
 * Work is in principal axes; no correlation term appears. Caller must rotate
 * into the eigenbasis if the covariance has off-diagonal terms.
 *
 * @param missXKm - x-component of the miss vector in the encounter plane (km)
 * @param missZKm - z-component of the miss vector in the encounter plane (km)
 * @param sigmaXKm - 1-sigma of the combined covariance per axis x (km), must be > 0
 * @param sigmaZKm - 1-sigma of the combined covariance per axis z (km), must be > 0
 * @param radiusKm - the sum of both hard-body radii (km). radius === 0 is valid and returns 0.
 * @returns dimensionless probability in [0, 1]
 */
export function collisionProbability(
  missXKm: number,
  missZKm: number,
  sigmaXKm: number,
  sigmaZKm: number,
  radiusKm: number
): number {
  // R8: validate all inputs are finite numbers
  const args = [missXKm, missZKm, sigmaXKm, sigmaZKm, radiusKm] as [number, number, number, number, number];
  for (let i = 0; i < 5; i++) {
    if (!Number.isFinite(args[i])) {
      throw new RangeError(
        `All arguments must be finite numbers. Argument ${i + 1} is ${typeof args[i] === "number" ? args[i] : args[i]}}`
      );
    }
  }

  // R8: sigmaXKm and sigmaZKm must be strictly greater than zero
  if (sigmaXKm <= 0) {
    throw new RangeError(
      `sigmaXKm must be strictly greater than zero, got ${sigmaXKm}`
    );
  }
  if (sigmaZKm <= 0) {
    throw new RangeError(
      `sigmaZKm must be strictly greater than zero, got ${sigmaZKm}`
    );
  }

  // R8: radiusKm must not be negative; radiusKm === 0 is valid and returns 0
  if (radiusKm < 0) {
    throw new RangeError(
      `radiusKm must not be negative, got ${radiusKm}`
    );
  }

  // R4: radiusKm === 0 is valid and must return 0
  if (radiusKm === 0) {
    return 0;
  }

  // Numerical integration over the disk using polar quadrature
  // x = r * cos(theta), z = r * sin(theta), area element = r dr dtheta
  //
  // Pc = ∫_{θ=0}^{2π} ∫_{r=0}^{R} 1/(2πσxσz) * exp(-[(r*cosθ - missX)²/(2σx²) + (r*sinθ - missZ)²/(2σz²)]) * r dr dθ
  //
  // We integrate over r first, then theta, using composite Simpson's rule or simple Riemann sums.
  // With 200 radial steps and 200 angular steps, we get sufficient accuracy.

  const N_R = 200; // radial steps (must be >= 200 per spec)
  const N_Theta = 200; // angular steps (must be >= 200 per spec)

  const dr = radiusKm / N_R;
  const dtheta = (2 * Math.PI) / N_Theta;

  let pc = 0;

  for (let i = 0; i < N_R; i++) {
    // r at the center of each radial strip
    const r = (i + 0.5) * dr;

    // Skip if r is beyond the disk (shouldn't happen with our dr calculation)
    if (r > radiusKm) break;

    for (let j = 0; j < N_Theta; j++) {
      // theta at the center of each angular sector
      const theta = (j + 0.5) * dtheta;

      // Convert back to Cartesian for the Gaussian exponent
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);

      // Quadratic form: (x - missX)²/(2σx²) + (z - missZ)²/(2σz²)
      const xTerm = Math.pow(x - missXKm, 2) / (2 * Math.pow(sigmaXKm, 2));
      const zTerm = Math.pow(z - missZKm, 2) / (2 * Math.pow(sigmaZKm, 2));
      const expArg = -(xTerm + zTerm);

      // Gaussian prefactor: 1/(2πσxσz)
      const prefactor = 1 / (2 * Math.PI * sigmaXKm * sigmaZKm);

      // Integrand: prefactor * exp(exponent) * r (the Jacobian r factor)
      const integrand = prefactor * Math.exp(expArg) * r;

      pc += integrand * dtheta; // accumulate over theta, still need to multiply by dr later
    }
  }

  // Multiply by dr to complete the radial integration
  pc *= dr;

  // The full integral should be over the disk; we've integrated r from 0 to R and theta from 0 to 2π
  // pc is already the result of ∫∫ integrand dr dtheta

  // Clamp to [0, 1] per R3 (numerical errors should keep this within bounds, but be safe)
  if (pc < 0) pc = 0;
  if (pc > 1) pc = 1;

  return pc;
}