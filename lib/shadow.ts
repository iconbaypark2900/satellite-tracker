/**
 * shadow.ts — Conical Earth shadow: umbra and penumbra.
 *
 * Built by dcode (gemma4-26b, tier 1) from dcode-stack/slices/shadow/SPEC.md and
 * promoted by its deterministic gate. Do not edit by hand: change the SPEC and
 * re-run `govern slices/shadow`, so the module and the thing that checks it stay
 * in step.
 *
 * Gated against ray-traced solar-limb occlusion — an algorithm sharing no step
 * with the cone geometry. Cone radii match boundaries found by bisection to
 * within 20 m from 400 km to 100,000 km behind the Earth.
 */

export type ShadowState = "sunlit" | "penumbra" | "umbra";

const EARTH_RADIUS = 6378.137;
const SUN_RADIUS = 695700;

/**
 * Calculates the radii of the umbra and penumbra shadow cones.
 * 
 * @param sunDistanceKm Distance from Earth center to Sun center.
 * @param alongAxisKm Distance behind Earth center along the anti-sun axis.
 * @returns { umbraKm, penumbraKm }
 */
export function shadowRadiiKm(sunDistanceKm: number, alongAxisKm: number): { umbraKm: number; penumbraKm: number } {
  if (!Number.isFinite(sunDistanceKm) || sunDistanceKm <= SUN_RADIUS + EARTH_RADIUS) {
    throw new RangeError("sunDistanceKm must be finite and greater than SUN_RADIUS + EARTH_RADIUS");
  }
  if (!Number.isFinite(alongAxisKm)) {
    throw new RangeError("alongAxisKm must be finite");
  }

  const sinAlphaUmbra = (SUN_RADIUS - EARTH_RADIUS) / sunDistanceKm;
  const sinAlphaPenumbra = (SUN_RADIUS + EARTH_RADIUS) / sunDistanceKm;

  const alphaUmbra = Math.asin(sinAlphaUmbra);
  const alphaPenumbra = Math.asin(sinAlphaPenumbra);

  const umbraKm = EARTH_RADIUS / Math.cos(alphaUmbra) - alongAxisKm * Math.tan(alphaUmbra);
  const penumbraKm = EARTH_RADIUS / Math.cos(alphaPenumbra) + alongAxisKm * Math.tan(alphaPenumbra);

  return { umbraKm, penumbraKm };
}

/**
 * Determines the shadow state of a satellite.
 * 
 * @param satEciKm Satellite position in ECI (km).
 * @param sunEciKm Sun position in ECI (km).
 * @returns "sunlit" | "penumbra" | "umbra"
 */
export function shadowState(satEciKm: number[], sunEciKm: number[]): ShadowState {
  // R6 - Validate inputs
  if (!Array.isArray(satEciKm) || satEciKm.length !== 3 || !Array.isArray(sunEciKm) || sunEciKm.length !== 3) {
    throw new RangeError("Arguments must be arrays of exactly 3 elements");
  }

  for (const val of [...satEciKm, ...sunEciKm]) {
    if (typeof val !== "number" || !Number.isFinite(val)) {
      throw new RangeError("All elements must be finite numbers");
    }
  }

  const sunDistSq = sunEciKm[0] ** 2 + sunEciKm[1] ** 2 + sunEciKm[2] ** 2;
  const sunDist = Math.sqrt(sunDistSq);

  if (sunDist === 0) {
    throw new RangeError("|sunEciKm| cannot be zero");
  }

  const satDistSq = satEciKm[0] ** 2 + satEciKm[1] ** 2 + satEciKm[2] ** 2;
  const satDist = Math.sqrt(satDistSq);

  if (satDist < EARTH_RADIUS) {
    throw new RangeError("|satEciKm| must be at least Earth's radius");
  }

  // R2 - Procedure
  // 1. sHat is the unit vector along sunEciKm
  const sHat = [sunEciKm[0] / sunDist, sunEciKm[1] / sunDist, sunEciKm[2] / sunDist];

  // 2. zeta = -(satEciKm · sHat)
  const dotProduct = satEciKm[0] * sHat[0] + satEciKm[1] * sHat[1] + satEciKm[2] * sHat[2];
  const zeta = -dotProduct;

  // 3. If zeta <= 0, return "sunlit"
  if (zeta <= 0) {
    return "sunlit";
  }

  // 4. rho = sqrt(|satEciKm|² - (satEciKm · sHat)²)
  const rho = Math.sqrt(Math.max(0, satDistSq - dotProduct ** 2));

  // 5. Take { umbraKm, penumbraKm } from R1
  const { umbraKm, penumbraKm } = shadowRadiiKm(sunDist, zeta);

  // 6. If umbraKm > 0 and rho <= umbraKm, return "umbra"
  if (umbraKm > 0 && rho <= umbraKm) {
    return "umbra";
  }

  // 7. Otherwise if rho <= penumbraKm, return "penumbra"
  if (rho <= penumbraKm) {
    return "penumbra";
  }

  // 8. Otherwise return "sunlit"
  return "sunlit";
}
