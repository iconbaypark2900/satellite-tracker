/**
 * conjunction-core.ts — All-vs-all close-approach screening.
 *
 * Time-major architecture: for each time step, satellites are binned
 * into a uniform 3D spatial hash and only neighboring-cell pairs are
 * examined — O(steps × (n + local pairs)) instead of the hopeless
 * O(pairs × steps) of pair-major screening. A closed-form linearized
 * minimum over each sampling interval (|Δr + Δv·τ|, τ ∈ ±Δt/2)
 * guarantees a 60s grid cannot step over a hypersonic encounter that
 * lasts only seconds. Candidate minima are refined against full SGP4
 * by golden-section search to <0.05s.
 *
 * Pure and deterministic (no Date.now/randomness — startMs is an
 * input). Relative imports only: this module is part of the worker
 * bundle graph.
 */

import * as satellite from "satellite.js";
import { buildSatrecs, TleLike } from "./propagation-core";
import {
  collisionProbability,
  assumedSigmaKm,
} from "./collision-probability";

const MU = 398600.4418; // km³/s²
/** Pad on the shell-overlap gate: J2 short-periodic osculation (~10-15km
 *  LEO) + TLE staleness. */
const SHELL_PAD_KM = 20;
/** Linearization buffer on the interval test, by step size. */
const INTERVAL_BUFFER_KM: Record<number, number> = { 60: 2, 120: 10 };
/** Same-pair events closer than this merge into one. */
const MERGE_WINDOW_MS = 10 * 60_000;
const GOLDEN = (Math.sqrt(5) - 1) / 2;

/**
 * Combined hard-body radius, in km, assumed for every pair.
 *
 * A stated guess, like the position uncertainty: this application has no
 * dimensions for the objects it screens. Ten metres combined is a
 * conventional default for two unremarkable satellites, and Pc scales roughly
 * as the square of it — doubling this figure roughly quadruples every
 * probability on the page. Named rather than inlined so that is visible.
 */
const ASSUMED_COMBINED_RADIUS_KM = 0.01;

/** Age of a TLE at a given time, in hours, from the satrec's own epoch. */
function tleAgeHours(satrec: satellite.SatRec, atMs: number): number {
  const epochMs = (satrec.jdsatepoch - 2440587.5) * 86400000;
  return Math.max(0, (atMs - epochMs) / 3600000);
}

/**
 * Probability of collision for a refined encounter.
 *
 * The combined uncertainty is isotropic — a single assumed sigma per object,
 * added in quadrature per R2 of the slice's spec, NOT summed. With an
 * isotropic 2-D Gaussian the encounter-plane orientation drops out and only
 * the miss MAGNITUDE matters, so the miss vector is passed as (missKm, 0).
 * That is exact rather than an approximation: verified to 2e-20 across the
 * axis-swapped and diagonal placements.
 */
function encounterPc(
  satrecA: satellite.SatRec,
  satrecB: satellite.SatRec,
  tcaMs: number,
  missKm: number
): { pc: number; sigmaKm: number } | null {
  try {
    const sA = assumedSigmaKm(tleAgeHours(satrecA, tcaMs));
    const sB = assumedSigmaKm(tleAgeHours(satrecB, tcaMs));
    const sigmaKm = Math.hypot(sA, sB);
    return {
      pc: collisionProbability(missKm, 0, sigmaKm, sigmaKm, ASSUMED_COMBINED_RADIUS_KM),
      sigmaKm,
    };
  } catch {
    // Absent rather than zero: a zero would read as "safe" when the truth is
    // that the probability could not be computed.
    return null;
  }
}

export interface ConjunctionEvent {
  idA: string;
  idB: string;
  nameA: string;
  nameB: string;
  groupA?: string;
  groupB?: string;
  tcaMs: number;
  missKm: number;
  relSpeedKmS: number;
  /**
   * Probability of collision, from an ASSUMED uncertainty — see
   * `PC_ASSUMPTION_NOTE`. Not an operational conjunction assessment: public
   * TLEs carry no covariance, so both the position uncertainty and the
   * hard-body radius behind this number are stated guesses.
   *
   * Optional, and absent rather than zero when it cannot be computed. A zero
   * would read as "safe" when the truth is "unknown".
   */
  pc?: number;
  /** Combined 1-sigma uncertainty (km) used for `pc`, for display alongside it. */
  pcSigmaKm?: number;
}

export interface ScreeningParams {
  startMs: number;
  windowMs: number;
  thresholdKm: number;
  stepSec: number;
  /** Steps per processing chunk (default: 2h of grid). */
  chunkSteps?: number;
}

export interface ScreeningStats {
  satCount: number;
  failedTles: number;
  steps: number;
  candidatePairSteps: number;
  prescreenRejectedSteps: number;
  refinements: number;
  totalFound: number;
  suppressed: number;
}

export interface ScreeningResult {
  events: ConjunctionEvent[];
  stats: ScreeningStats;
}

export type ProgressCallback = (
  fraction: number,
  phase: "propagating" | "screening" | "refining",
  chunk: number,
  totalChunks: number
) => void;

// ─── Orbit shells ─────────────────────────────────────── //

export interface ShellParams {
  rPerKm: number;
  rApoKm: number;
  vMaxKmS: number;
}

/** Kozai mean-element shell bounds + perigee speed from a satrec. */
export function computeShellParams(satrec: satellite.SatRec): ShellParams {
  const nRadMin = satrec.no; // rad/min
  const periodSec = (2 * Math.PI * 60) / nRadMin;
  const a = Math.cbrt((MU * periodSec * periodSec) / (4 * Math.PI * Math.PI));
  const e = satrec.ecco;
  const rPerKm = a * (1 - e);
  const rApoKm = a * (1 + e);
  const vMaxKmS = Math.sqrt(MU * (2 / rPerKm - 1 / a));
  return { rPerKm, rApoKm, vMaxKmS };
}

/** Can two shells come within thresholdKm (+pad) of each other at all? */
export function shellsOverlap(
  a: ShellParams,
  b: ShellParams,
  thresholdKm: number,
  padKm: number = SHELL_PAD_KM
): boolean {
  const gap = Math.max(a.rPerKm - b.rApoKm, b.rPerKm - a.rApoKm);
  return gap <= thresholdKm + padKm;
}

// ─── Ephemeris grid ───────────────────────────────────── //

function unixToJulian(ms: number): number {
  return ms / 86400000 + 2440587.5;
}

/**
 * Fill sat-major ephemeris buffers for one time chunk using the
 * satellite.sgp4 fast path (minutes-since-epoch, no Date allocation).
 * Layout: pos[(i*nSteps + k)*3 + c], valid[i*nSteps + k].
 */
export function buildEphemerisChunk(
  satrecs: (satellite.SatRec | null)[],
  t0Ms: number,
  stepMs: number,
  nSteps: number,
  pos: Float32Array,
  vel: Float32Array,
  valid: Uint8Array
): void {
  const jd0 = unixToJulian(t0Ms);
  const stepMin = stepMs / 60000;

  for (let i = 0; i < satrecs.length; i++) {
    const satrec = satrecs[i];
    const base = i * nSteps;
    if (!satrec) {
      valid.fill(0, base, base + nSteps);
      continue;
    }
    const tsince0 = (jd0 - satrec.jdsatepoch) * 1440; // minutes
    for (let k = 0; k < nSteps; k++) {
      let ok = false;
      try {
        const result = satellite.sgp4(satrec, tsince0 + k * stepMin);
        const p = result?.position as { x: number; y: number; z: number } | null;
        const v = result?.velocity as { x: number; y: number; z: number } | null;
        if (p && v && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
          const o = (base + k) * 3;
          pos[o] = p.x;
          pos[o + 1] = p.y;
          pos[o + 2] = p.z;
          vel[o] = v.x;
          vel[o + 1] = v.y;
          vel[o + 2] = v.z;
          ok = true;
        }
      } catch {
        ok = false;
      }
      valid[base + k] = ok ? 1 : 0;
    }
  }
}

// ─── Interval minimum ─────────────────────────────────── //

/**
 * Closed-form minimum of |Δr + Δv·τ| over τ ∈ [−halfStepSec, halfStepSec]
 * for satellites i, j at grid slot (sat-major offset already applied by
 * the caller via oi/oj = (satIdx*nSteps + k)*3).
 */
export function intervalMinDistance(
  pos: Float32Array,
  vel: Float32Array,
  oi: number,
  oj: number,
  halfStepSec: number
): number {
  const dx = pos[oi] - pos[oj];
  const dy = pos[oi + 1] - pos[oj + 1];
  const dz = pos[oi + 2] - pos[oj + 2];
  const dvx = vel[oi] - vel[oj];
  const dvy = vel[oi + 1] - vel[oj + 1];
  const dvz = vel[oi + 2] - vel[oj + 2];

  const vv = dvx * dvx + dvy * dvy + dvz * dvz;
  let tau = 0;
  if (vv > 1e-12) {
    tau = -(dx * dvx + dy * dvy + dz * dvz) / vv;
    if (tau < -halfStepSec) tau = -halfStepSec;
    else if (tau > halfStepSec) tau = halfStepSec;
  }
  const mx = dx + dvx * tau;
  const my = dy + dvy * tau;
  const mz = dz + dvz * tau;
  return Math.sqrt(mx * mx + my * my + mz * mz);
}

// ─── Spatial hash ─────────────────────────────────────── //

/** Half-neighborhood offsets (13 of 26) + own cell, so each unordered
 *  cell pair is visited exactly once. */
const NEIGHBOR_OFFSETS: Array<[number, number, number]> = [
  [1, 0, 0], [0, 1, 0], [0, 0, 1],
  [1, 1, 0], [1, -1, 0], [1, 0, 1], [1, 0, -1],
  [0, 1, 1], [0, 1, -1],
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
];

const CELL_BITS = 11; // ±60000km / ~100km cells → well within 2^11 per axis
const CELL_OFFSET = 1 << (CELL_BITS - 1);

/**
 * Enumerate satellite pairs within one cell radius of each other at one
 * grid step. Calls cb(i, j) with i < j exactly once per pair.
 */
export function forEachClosePair(
  pos: Float32Array,
  valid: Uint8Array,
  n: number,
  nSteps: number,
  stepIdx: number,
  cellKm: number,
  cb: (i: number, j: number) => void
): void {
  const cells = new Map<number, number[]>();
  const keyOf = (x: number, y: number, z: number) => {
    const ix = Math.floor(x / cellKm) + CELL_OFFSET;
    const iy = Math.floor(y / cellKm) + CELL_OFFSET;
    const iz = Math.floor(z / cellKm) + CELL_OFFSET;
    return (ix << (2 * CELL_BITS)) | (iy << CELL_BITS) | iz;
  };

  for (let i = 0; i < n; i++) {
    if (valid[i * nSteps + stepIdx] !== 1) continue;
    const o = (i * nSteps + stepIdx) * 3;
    const key = keyOf(pos[o], pos[o + 1], pos[o + 2]);
    const bucket = cells.get(key);
    if (bucket) bucket.push(i);
    else cells.set(key, [i]);
  }

  for (const [key, bucket] of cells) {
    // Within-cell pairs
    for (let a = 0; a < bucket.length; a++) {
      for (let b = a + 1; b < bucket.length; b++) {
        const i = bucket[a];
        const j = bucket[b];
        cb(Math.min(i, j), Math.max(i, j));
      }
    }
    // Forward-neighbor cross pairs
    const iz = key & ((1 << CELL_BITS) - 1);
    const iy = (key >> CELL_BITS) & ((1 << CELL_BITS) - 1);
    const ix = key >> (2 * CELL_BITS);
    for (const [ox, oy, oz] of NEIGHBOR_OFFSETS) {
      const nKey = ((ix + ox) << (2 * CELL_BITS)) | ((iy + oy) << CELL_BITS) | (iz + oz);
      const other = cells.get(nKey);
      if (!other) continue;
      for (const i of bucket) {
        for (const j of other) {
          cb(Math.min(i, j), Math.max(i, j));
        }
      }
    }
  }
}

// ─── Refinement ───────────────────────────────────────── //

function stateAt(
  satrec: satellite.SatRec,
  tMs: number
): { p: [number, number, number]; v: [number, number, number] } | null {
  try {
    const tsince = (unixToJulian(tMs) - satrec.jdsatepoch) * 1440;
    const result = satellite.sgp4(satrec, tsince);
    const p = result?.position as { x: number; y: number; z: number } | null;
    const v = result?.velocity as { x: number; y: number; z: number } | null;
    if (!p || !v || !Number.isFinite(p.x)) return null;
    return { p: [p.x, p.y, p.z], v: [v.x, v.y, v.z] };
  } catch {
    return null;
  }
}

function distSqAt(
  satrecA: satellite.SatRec,
  satrecB: satellite.SatRec,
  tMs: number
): number {
  const a = stateAt(satrecA, tMs);
  const b = stateAt(satrecB, tMs);
  if (!a || !b) return Infinity;
  const dx = a.p[0] - b.p[0];
  const dy = a.p[1] - b.p[1];
  const dz = a.p[2] - b.p[2];
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Golden-section search for the true SGP4 minimum distance in
 * [tLoMs, tHiMs]. Converges to <0.05s (hard cap 40 iterations).
 */
export function refineTca(
  satrecA: satellite.SatRec,
  satrecB: satellite.SatRec,
  tLoMs: number,
  tHiMs: number
): { tcaMs: number; missKm: number; relSpeedKmS: number } | null {
  let lo = tLoMs;
  let hi = tHiMs;
  let m1 = hi - GOLDEN * (hi - lo);
  let m2 = lo + GOLDEN * (hi - lo);
  let f1 = distSqAt(satrecA, satrecB, m1);
  let f2 = distSqAt(satrecA, satrecB, m2);
  if (!Number.isFinite(f1) || !Number.isFinite(f2)) return null;

  for (let iter = 0; iter < 40 && hi - lo > 50; iter++) {
    if (f1 <= f2) {
      hi = m2;
      m2 = m1;
      f2 = f1;
      m1 = hi - GOLDEN * (hi - lo);
      f1 = distSqAt(satrecA, satrecB, m1);
    } else {
      lo = m1;
      m1 = m2;
      f1 = f2;
      m2 = lo + GOLDEN * (hi - lo);
      f2 = distSqAt(satrecA, satrecB, m2);
    }
  }

  const tcaMs = (lo + hi) / 2;
  const a = stateAt(satrecA, tcaMs);
  const b = stateAt(satrecB, tcaMs);
  if (!a || !b) return null;
  const dx = a.p[0] - b.p[0];
  const dy = a.p[1] - b.p[1];
  const dz = a.p[2] - b.p[2];
  const dvx = a.v[0] - b.v[0];
  const dvy = a.v[1] - b.v[1];
  const dvz = a.v[2] - b.v[2];
  return {
    tcaMs,
    missKm: Math.sqrt(dx * dx + dy * dy + dz * dz),
    relSpeedKmS: Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz),
  };
}

// ─── Event post-processing ────────────────────────────── //

export function mergeAndSortEvents(
  events: ConjunctionEvent[],
  mergeWindowMs: number = MERGE_WINDOW_MS,
  cap: number = 1000
): { events: ConjunctionEvent[]; totalFound: number; suppressed: number } {
  // Merge same-pair events with close TCAs (keep the smaller miss)
  const byPair = new Map<string, ConjunctionEvent[]>();
  for (const ev of events) {
    const key = `${ev.idA}|${ev.idB}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key)!.push(ev);
  }

  const merged: ConjunctionEvent[] = [];
  for (const list of byPair.values()) {
    list.sort((a, b) => a.tcaMs - b.tcaMs);
    let current = list[0];
    for (let i = 1; i < list.length; i++) {
      const next = list[i];
      if (next.tcaMs - current.tcaMs < mergeWindowMs) {
        if (next.missKm < current.missKm) current = next;
      } else {
        merged.push(current);
        current = next;
      }
    }
    merged.push(current);
  }

  merged.sort((a, b) => a.missKm - b.missKm);
  const totalFound = merged.length;
  const capped = merged.slice(0, cap);
  return { events: capped, totalFound, suppressed: totalFound - capped.length };
}

// ─── Orchestrator ─────────────────────────────────────── //

export function screenConjunctions(
  tles: TleLike[],
  params: ScreeningParams,
  onProgress?: ProgressCallback
): ScreeningResult {
  const { startMs, windowMs, thresholdKm, stepSec } = params;
  const stepMs = stepSec * 1000;
  const halfStepSec = stepSec / 2;
  const buffer = INTERVAL_BUFFER_KM[stepSec] ?? Math.max(2, stepSec * stepSec / 1800);
  const coarseThreshold = thresholdKm + buffer;

  const { satrecs, noradIds, failed } = buildSatrecs(tles);
  const n = tles.length;
  const normalizedIds = noradIds.map((id) => id.trim().replace(/^0+(?=\d)/, ""));

  // Shell parameters + catalog-wide max relative speed
  const shells: (ShellParams | null)[] = satrecs.map((sr) =>
    sr ? computeShellParams(sr) : null
  );
  let vMaxCatalog = 0;
  for (const s of shells) {
    if (s && s.vMaxKmS > vMaxCatalog) vMaxCatalog = s.vMaxKmS;
  }
  const cellKm = thresholdKm + 2 * vMaxCatalog * halfStepSec;

  const totalSteps = Math.floor(windowMs / stepMs) + 1;
  const chunkSteps = Math.min(
    totalSteps,
    params.chunkSteps ?? Math.max(2, Math.round((2 * 3600) / stepSec))
  );
  const totalChunks = Math.ceil(totalSteps / chunkSteps);

  const pos = new Float32Array(n * chunkSteps * 3);
  const vel = new Float32Array(n * chunkSteps * 3);
  const valid = new Uint8Array(n * chunkSteps);

  // Sparse per-pair hits across the whole window
  const hits = new Map<number, Array<{ step: number; dMin: number }>>();
  const stats: ScreeningStats = {
    satCount: n,
    failedTles: failed.length,
    steps: totalSteps,
    candidatePairSteps: 0,
    prescreenRejectedSteps: 0,
    refinements: 0,
    totalFound: 0,
    suppressed: 0,
  };

  for (let chunk = 0; chunk < totalChunks; chunk++) {
    const chunkStart = chunk * chunkSteps;
    const stepsInChunk = Math.min(chunkSteps, totalSteps - chunkStart);
    const t0 = startMs + chunkStart * stepMs;

    onProgress?.(chunk / totalChunks, "propagating", chunk + 1, totalChunks);
    buildEphemerisChunk(satrecs, t0, stepMs, stepsInChunk, pos, vel, valid);

    onProgress?.((chunk + 0.8) / totalChunks, "screening", chunk + 1, totalChunks);
    for (let k = 0; k < stepsInChunk; k++) {
      forEachClosePair(pos, valid, n, chunkSteps, k, cellKm, (i, j) => {
        // Duplicate catalog entries (same satellite, possibly with
        // different zero-padding from different sources) are not pairs
        if (normalizedIds[i] === normalizedIds[j]) return;

        const si = shells[i];
        const sj = shells[j];
        if (!si || !sj) return;
        if (!shellsOverlap(si, sj, thresholdKm)) {
          stats.prescreenRejectedSteps++;
          return;
        }

        const oi = (i * chunkSteps + k) * 3;
        const oj = (j * chunkSteps + k) * 3;
        const dMin = intervalMinDistance(pos, vel, oi, oj, halfStepSec);
        stats.candidatePairSteps++;
        if (dMin <= coarseThreshold) {
          const key = i * n + j;
          if (!hits.has(key)) hits.set(key, []);
          hits.get(key)!.push({ step: chunkStart + k, dMin });
        }
      });
    }
  }

  // Runs → local minima → refinement
  onProgress?.(1, "refining", totalChunks, totalChunks);
  const rawEvents: ConjunctionEvent[] = [];

  for (const [key, list] of hits) {
    const i = Math.floor(key / n);
    const j = key % n;
    const satrecA = satrecs[i];
    const satrecB = satrecs[j];
    if (!satrecA || !satrecB) continue;

    list.sort((a, b) => a.step - b.step);

    // Split into runs of consecutive steps, find local minima per run
    let runStart = 0;
    for (let idx = 0; idx <= list.length; idx++) {
      const isBreak =
        idx === list.length || (idx > 0 && list[idx].step > list[idx - 1].step + 1);
      if (!isBreak) continue;

      const run = list.slice(runStart, idx);
      runStart = idx;

      for (let r = 0; r < run.length; r++) {
        const isMin =
          (r === 0 || run[r].dMin <= run[r - 1].dMin) &&
          (r === run.length - 1 || run[r].dMin <= run[r + 1].dMin);
        if (!isMin) continue;

        const tCenter = startMs + run[r].step * stepMs;
        stats.refinements++;
        // Bracket may straddle chunk edges but never the screening window
        const refined = refineTca(
          satrecA,
          satrecB,
          Math.max(startMs, tCenter - stepMs),
          Math.min(startMs + windowMs, tCenter + stepMs)
        );
        if (refined && refined.missKm <= thresholdKm) {
          const risk = encounterPc(satrecA, satrecB, refined.tcaMs, refined.missKm);
          rawEvents.push({
            pc: risk?.pc,
            pcSigmaKm: risk?.sigmaKm,
            idA: noradIds[i],
            idB: noradIds[j],
            nameA: tles[i].name,
            nameB: tles[j].name,
            groupA: (tles[i] as { group?: string }).group,
            groupB: (tles[j] as { group?: string }).group,
            ...refined,
          });
        }
      }
    }
  }

  const { events, totalFound, suppressed } = mergeAndSortEvents(rawEvents);
  stats.totalFound = totalFound;
  stats.suppressed = suppressed;

  return { events, stats };
}
