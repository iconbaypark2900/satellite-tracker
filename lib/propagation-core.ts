/**
 * propagation-core.ts — Pure SGP4 batch propagation shared by the
 * WebWorker and the main-thread fallback.
 *
 * IMPORTANT: relative imports only (no "@/" alias) — this module is part
 * of the worker bundle graph.
 */

import * as satellite from "satellite.js";

export interface TleLike {
  noradId: string;
  name: string;
  line1: string;
  line2: string;
}

export interface BuildResult {
  satrecs: (satellite.SatRec | null)[];
  noradIds: string[];
  failed: { noradId: string; name: string }[];
}

/** Parse satrecs once for a TLE list, recording failures. */
export function buildSatrecs(tles: TleLike[]): BuildResult {
  const satrecs: (satellite.SatRec | null)[] = new Array(tles.length);
  const noradIds: string[] = new Array(tles.length);
  const failed: { noradId: string; name: string }[] = [];

  for (let i = 0; i < tles.length; i++) {
    const tle = tles[i];
    noradIds[i] = tle.noradId;
    let satrec: satellite.SatRec | null = null;
    if (tle.line1 && tle.line2) {
      try {
        const parsed = satellite.twoline2satrec(tle.line1, tle.line2);
        satrec = parsed.error === 0 ? parsed : null;
      } catch {
        satrec = null;
      }
    }
    satrecs[i] = satrec;
    if (!satrec) failed.push({ noradId: tle.noradId, name: tle.name });
  }

  return { satrecs, noradIds, failed };
}

/**
 * Propagate every satrec to `timeMs`, writing ECI km / km-per-s into the
 * provided flat arrays. Invalid results set valid[i]=0 and leave the
 * position untouched.
 */
export function propagateBatch(
  satrecs: (satellite.SatRec | null)[],
  timeMs: number,
  positions: Float32Array,
  velocities: Float32Array,
  valid: Uint8Array
): void {
  const date = new Date(timeMs);

  for (let i = 0; i < satrecs.length; i++) {
    const satrec = satrecs[i];
    if (!satrec) {
      valid[i] = 0;
      continue;
    }

    try {
      const result = satellite.propagate(satrec, date);
      const pos = result?.position as
        | { x: number; y: number; z: number }
        | null
        | undefined;
      const vel = result?.velocity as
        | { x: number; y: number; z: number }
        | null
        | undefined;

      if (
        !pos ||
        !vel ||
        pos.x === null ||
        Number.isNaN(pos.x) ||
        Number.isNaN(pos.y) ||
        Number.isNaN(pos.z)
      ) {
        valid[i] = 0;
        continue;
      }

      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      velocities[i * 3] = vel.x;
      velocities[i * 3 + 1] = vel.y;
      velocities[i * 3 + 2] = vel.z;
      valid[i] = 1;
    } catch {
      valid[i] = 0;
    }
  }
}
