/// <reference lib="webworker" />

/**
 * propagation-worker.ts — WebWorker for high-frequency SGP4 propagation.
 *
 * Offloads orbital propagation from the main thread to maintain 60fps
 * when tracking 50+ satellites. Communicates via postMessage.
 *
 * Expected messages:
 *   { type: "propagate", tles: TleSet[], simTime: number (unix ms) }
 *   { type: "stop" }
 *
 * Responds with:
 *   { type: "results", positions: Map<string, PropagationResult> }
 */

import { propagateSatellite, getSunPosition, dateToJulian } from "@/lib/orbit-utils";
import { TleSet, PropagationResult } from "@/types";

// Worker context type (TypeScript needs this for WebWorker scripts)
const ctx: Worker = self as unknown as Worker;

let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

ctx.onmessage = (e: MessageEvent) => {
  const data = e.data as {
    type: string;
    tles: TleSet[];
    simTime?: number;
  };

  switch (data.type) {
    case "propagate":
      handlePropagate(data.tles, data.simTime);
      break;
    case "start":
      startLoop(data.tles);
      break;
    case "stop":
      stopLoop();
      break;
    default:
      // Ignore unknown messages
      break;
  }
};

/**
 * Propagate all satellites at a specific time and post results.
 */
function handlePropagate(tles: TleSet[], simTime?: number) {
  if (!tles || tles.length === 0) return;

  const date = simTime ? new Date(simTime) : new Date();
  const results = new Map<string, PropagationResult>();

  for (const tle of tles) {
    const result = propagateSatellite(tle, date);
    results.set(tle.noradId, result);
  }

  ctx.postMessage({ type: "results", results });
}

/**
 * Start a continuous propagation loop.
 * Updates at 100ms intervals (10fps propagation for smooth animation).
 */
function startLoop(tles: TleSet[]) {
  if (intervalId) clearInterval(intervalId);
  isRunning = true;

  intervalId = setInterval(() => {
    if (!isRunning) return;
    handlePropagate(tles);
  }, 100);
}

/**
 * Stop the propagation loop.
 */
function stopLoop() {
  isRunning = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// Clean up on worker termination
self.addEventListener("beforeunload", stopLoop);
