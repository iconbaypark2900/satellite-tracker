/// <reference lib="webworker" />

/**
 * propagation-worker.ts — WebWorker for batch SGP4 propagation.
 *
 * Protocol (all buffers transferred, never cloned):
 *   main → worker:
 *     { type: "init", tles: TleLike[] }
 *     { type: "tick", timeMs: number,
 *       buffers?: { positions: ArrayBuffer; velocities: ArrayBuffer; valid: ArrayBuffer } }
 *       — `buffers` returns the previously received set for reuse (ping-pong)
 *   worker → main:
 *     { type: "ready", noradIds: string[], failed: {noradId,name}[] }
 *     { type: "state", timeMs: number,
 *       positions: ArrayBuffer, velocities: ArrayBuffer, valid: ArrayBuffer }
 *
 * The worker never self-schedules — the main thread drives ticks.
 */

import {
  buildSatrecs,
  propagateBatch,
  TleLike,
} from "../lib/propagation-core";
import type { SatRec } from "satellite.js";

const ctx: Worker = self as unknown as Worker;

let satrecs: (SatRec | null)[] = [];
let count = 0;

ctx.onmessage = (e: MessageEvent) => {
  const data = e.data;

  if (data.type === "init") {
    const tles = data.tles as TleLike[];
    const built = buildSatrecs(tles);
    satrecs = built.satrecs;
    count = satrecs.length;
    ctx.postMessage({ type: "ready", noradIds: built.noradIds, failed: built.failed });
    return;
  }

  if (data.type === "tick") {
    if (count === 0) return;

    // Reuse returned buffers when they match the current fleet size
    let positions: Float32Array;
    let velocities: Float32Array;
    let valid: Uint8Array;
    const b = data.buffers as
      | { positions: ArrayBuffer; velocities: ArrayBuffer; valid: ArrayBuffer }
      | undefined;
    if (b && b.positions.byteLength === count * 3 * 4) {
      positions = new Float32Array(b.positions);
      velocities = new Float32Array(b.velocities);
      valid = new Uint8Array(b.valid);
    } else {
      positions = new Float32Array(count * 3);
      velocities = new Float32Array(count * 3);
      valid = new Uint8Array(count);
    }

    propagateBatch(satrecs, data.timeMs as number, positions, velocities, valid);

    ctx.postMessage(
      {
        type: "state",
        timeMs: data.timeMs,
        positions: positions.buffer,
        velocities: velocities.buffer,
        valid: valid.buffer,
      },
      [positions.buffer, velocities.buffer, valid.buffer]
    );
  }
};
