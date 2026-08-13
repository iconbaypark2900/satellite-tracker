/**
 * propagation-engine.ts — Singleton propagation state living OUTSIDE React.
 *
 * Owns the satellite position/velocity buffers. A WebWorker computes full
 * SGP4 states on demand (coalesced ticks, transferable buffers); between
 * worker states the main thread extrapolates with p + v·dt + ½·a·dt².
 *
 * That header used to claim linear p + v·dt was "centimeter-accurate at 1x
 * speed and still sub-pixel at high warp". The first half was true, the second
 * was not: at the MAX_SIM_DRIFT_MS edge it put the ISS 3.9 km off — roughly
 * 0.45° at 500 km range, ~19x the error of the Horizons-validated pass path,
 * with a sawtooth that snapped back on every re-solve. The claim was never
 * measured. See getPositionInto for the numbers that replaced it.
 *
 * Falls back to synchronous main-thread batches when Workers are
 * unavailable (SSR, ancient browsers, worker construction failure).
 */

import { buildSatrecs, propagateBatch, TleLike } from "./propagation-core";
import { EARTH_MU } from "./constants";
import type { SatRec } from "satellite.js";

/** Re-tick when the sim time drifts this far from the last state (ms). */
const MAX_SIM_DRIFT_MS = 30_000;
/** Re-tick at least this often in real time (ms). */
const MAX_REAL_AGE_MS = 250;

interface WorkerBuffers {
  positions: ArrayBuffer;
  velocities: ArrayBuffer;
  valid: ArrayBuffer;
}

class PropagationEngine {
  positions = new Float32Array(0);
  velocities = new Float32Array(0);
  valid = new Uint8Array(0);
  /** Sim time (ms) the buffers were computed for. */
  epochMs = 0;
  noradIds: string[] = [];
  failed: { noradId: string; name: string }[] = [];
  /** True once the current fleet has at least one computed state. */
  ready = false;
  /** The exact TLE array reference this engine was initialized with. */
  source: readonly TleLike[] | null = null;

  private worker: Worker | null = null;
  private workerAlive = false;
  private fallbackSatrecs: (SatRec | null)[] = [];
  private count = 0;
  private tickInFlight = false;
  private pendingSimMs: number | null = null;
  private lastTickRealMs = 0;
  private spareBuffers: WorkerBuffers | null = null;
  private initToken = 0;

  /** (Re)initialize for a satellite fleet. Safe to call repeatedly. */
  init(tles: readonly TleLike[]): void {
    if (this.source === tles) return;
    const token = ++this.initToken;

    this.source = tles;
    this.count = tles.length;
    this.ready = false;
    this.tickInFlight = false;
    this.pendingSimMs = null;
    this.spareBuffers = null;
    this.positions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    this.valid = new Uint8Array(this.count);
    this.noradIds = tles.map((t) => t.noradId);
    this.failed = [];
    this.fallbackSatrecs = [];

    if (this.count === 0) return;

    if (!this.worker && typeof Worker !== "undefined") {
      try {
        this.worker = new Worker(
          new URL("../workers/propagation-worker.ts", import.meta.url)
        );
        this.workerAlive = true;
        this.worker.onerror = () => {
          // Worker died (bundling issue, CSP…) — fall back to main thread
          this.workerAlive = false;
          this.worker?.terminate();
          this.worker = null;
          if (this.source) {
            const src = this.source;
            this.source = null;
            this.init(src);
          }
        };
      } catch {
        this.worker = null;
        this.workerAlive = false;
      }
    }

    if (this.worker && this.workerAlive) {
      this.worker.onmessage = (e: MessageEvent) => {
        if (token !== this.initToken) return; // stale fleet
        const data = e.data;
        if (data.type === "ready") {
          this.failed = data.failed;
          if (this.failed.length > 0) {
            console.warn(
              `SGP4 worker: ${this.failed.length} TLE(s) failed to initialize:`,
              this.failed.map((f) => `${f.name} (#${f.noradId})`).join(", ")
            );
          }
          return;
        }
        if (data.type === "state") {
          // Recycle the previous buffers back to the worker next tick
          this.spareBuffers = {
            positions: this.positions.buffer as ArrayBuffer,
            velocities: this.velocities.buffer as ArrayBuffer,
            valid: this.valid.buffer as ArrayBuffer,
          };
          this.positions = new Float32Array(data.positions);
          this.velocities = new Float32Array(data.velocities);
          this.valid = new Uint8Array(data.valid);
          this.epochMs = data.timeMs;
          this.ready = true;
          this.tickInFlight = false;

          // A newer time was requested while this tick ran — chase it
          if (
            this.pendingSimMs !== null &&
            Math.abs(this.pendingSimMs - this.epochMs) > MAX_SIM_DRIFT_MS
          ) {
            const chase = this.pendingSimMs;
            this.pendingSimMs = null;
            this.sendTick(chase);
          }
        }
      };
      this.worker.postMessage({ type: "init", tles });
    } else {
      // Main-thread fallback
      const built = buildSatrecs(tles as TleLike[]);
      this.fallbackSatrecs = built.satrecs;
      this.failed = built.failed;
    }
  }

  private sendTick(simMs: number): void {
    if (!this.worker || !this.workerAlive) return;
    this.tickInFlight = true;
    this.lastTickRealMs = performance.now();
    const msg: { type: string; timeMs: number; buffers?: WorkerBuffers } = {
      type: "tick",
      timeMs: simMs,
    };
    const transfer: ArrayBuffer[] = [];
    if (this.spareBuffers) {
      msg.buffers = this.spareBuffers;
      transfer.push(
        this.spareBuffers.positions,
        this.spareBuffers.velocities,
        this.spareBuffers.valid
      );
      this.spareBuffers = null;
    }
    this.worker.postMessage(msg, transfer);
  }

  /**
   * Ensure the buffered state tracks `simMs`. Called once per frame;
   * coalesces so at most one worker tick is in flight.
   */
  requestTick(simMs: number): void {
    if (this.count === 0) return;

    // Main-thread fallback: compute synchronously at the tick cadence
    if (!this.worker || !this.workerAlive) {
      if (this.fallbackSatrecs.length === 0) return;
      const stale =
        !this.ready ||
        Math.abs(simMs - this.epochMs) > MAX_SIM_DRIFT_MS ||
        performance.now() - this.lastTickRealMs > MAX_REAL_AGE_MS;
      if (stale) {
        propagateBatch(this.fallbackSatrecs, simMs, this.positions, this.velocities, this.valid);
        this.epochMs = simMs;
        this.ready = true;
        this.lastTickRealMs = performance.now();
      }
      return;
    }

    if (this.tickInFlight) {
      this.pendingSimMs = simMs;
      return;
    }

    const stale =
      !this.ready ||
      Math.abs(simMs - this.epochMs) > MAX_SIM_DRIFT_MS ||
      performance.now() - this.lastTickRealMs > MAX_REAL_AGE_MS;
    if (stale) {
      this.sendTick(simMs);
    }
  }

  /**
   * Extrapolated position (km, ECI) for index `i` at `simMs`.
   *
   * Second-order: position + velocity·dt + ½·a·dt², where `a` is two-body
   * gravitational acceleration −μr/|r|³. The dt² term is what makes this
   * follow the orbit's curve instead of flying off along the tangent.
   *
   * WHY, measured against `satellite.propagate()` for the ISS over the full
   * MAX_SIM_DRIFT_MS window:
   *
   *   dt (s)     linear      second-order
   *        1    0.004 km       ~0.000 km
   *       10    0.432 km        0.005 km
   *       30    3.889 km        0.042 km
   *
   * Linear extrapolation drew the ISS 3.9 km from its true position at the
   * window's edge — about 0.45° of apparent error at 500 km range, against
   * the JPL-Horizons-validated pass-prediction path (see docs/VALIDATION.md). Worse, the
   * error grew quadratically and then snapped back on each re-solve, so
   * satellites visibly drifted off their orbit line and jumped.
   *
   * Fixing it this way rather than by shortening the staleness window keeps
   * the SGP4 solve rate unchanged — the whole point of the buffered engine at
   * ~400 objects and 60 fps — while cutting the worst-case error by ~93x.
   *
   * Two-body is sufficient here because dt is bounded by MAX_SIM_DRIFT_MS;
   * J2 and drag act over much longer timescales and are already in the SGP4
   * solve that seeds this buffer.
   */
  getPositionInto(
    i: number,
    simMs: number,
    out: { x: number; y: number; z: number }
  ): boolean {
    if (!this.ready || this.valid[i] !== 1) return false;
    const dt = (simMs - this.epochMs) / 1000;

    const b = i * 3;
    const px = this.positions[b];
    const py = this.positions[b + 1];
    const pz = this.positions[b + 2];

    const r2 = px * px + py * py + pz * pz;
    const r = Math.sqrt(r2);
    // Guard a degenerate buffer rather than emitting NaN into the geometry,
    // which would silently corrupt every subsequent frame.
    if (!(r > 0)) return false;

    // −μ/r³, applied to each component below. μ in km³/s².
    const k = -EARTH_MU / (r2 * r);
    const half_dt2 = 0.5 * dt * dt;

    out.x = px + this.velocities[b] * dt + k * px * half_dt2;
    out.y = py + this.velocities[b + 1] * dt + k * py * half_dt2;
    out.z = pz + this.velocities[b + 2] * dt + k * pz * half_dt2;
    return true;
  }
}

/** App-wide singleton. */
export const propagationEngine = new PropagationEngine();
