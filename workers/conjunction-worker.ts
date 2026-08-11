/// <reference lib="webworker" />

/**
 * conjunction-worker.ts — Runs a conjunction screening off the main
 * thread.
 *
 * Protocol:
 *   main → worker:
 *     { type: "start", tles: TleLike[], startMs, windowMs, thresholdKm, stepSec }
 *   worker → main:
 *     { type: "progress", fraction, phase, chunk, totalChunks }   (throttled ≥100ms)
 *     { type: "done", events, stats, elapsedMs }
 *     { type: "error", message }
 *
 * There is no cancel message: the screening loop is synchronous, so the
 * main thread cancels by terminating the worker.
 */

import { TleLike } from "../lib/propagation-core";
import { screenConjunctions, ScreeningParams } from "../lib/conjunction-core";

const ctx: Worker = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent) => {
  const data = e.data;
  if (data.type !== "start") return;

  const tles = data.tles as TleLike[];
  const params: ScreeningParams = {
    startMs: data.startMs,
    windowMs: data.windowMs,
    thresholdKm: data.thresholdKm,
    stepSec: data.stepSec,
  };

  let lastPost = 0;
  const t0 = performance.now();

  try {
    const result = screenConjunctions(tles, params, (fraction, phase, chunk, totalChunks) => {
      const now = performance.now();
      if (now - lastPost >= 100 || fraction >= 1) {
        lastPost = now;
        ctx.postMessage({ type: "progress", fraction, phase, chunk, totalChunks });
      }
    });
    ctx.postMessage({
      type: "done",
      events: result.events,
      stats: result.stats,
      elapsedMs: Math.round(performance.now() - t0),
    });
  } catch (err) {
    ctx.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
