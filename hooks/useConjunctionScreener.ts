/**
 * useConjunctionScreener — Page-local driver for the conjunction worker.
 *
 * A hook rather than a singleton: screening results belong to the
 * /conjunctions page lifecycle, unlike the globe's shared propagation
 * engine. Cancel terminates the worker (the synchronous screening loop
 * cannot be preempted by a message).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { TleSet } from "@/types";
import {
  ConjunctionEvent,
  ScreeningStats,
} from "@/lib/conjunction-core";

export interface ScreenerState {
  status: "idle" | "running" | "done" | "error";
  progress: number;
  phase: string;
  events: ConjunctionEvent[];
  stats: ScreeningStats | null;
  elapsedMs: number;
  error: string | null;
  /** Params of the completed run, for stale-vs-current labeling. */
  ranWith: { satCount: number; hours: number; thresholdKm: number; at: number } | null;
}

const IDLE: ScreenerState = {
  status: "idle",
  progress: 0,
  phase: "",
  events: [],
  stats: null,
  elapsedMs: 0,
  error: null,
  ranWith: null,
};

export function useConjunctionScreener() {
  const [state, setState] = useState<ScreenerState>(IDLE);
  const workerRef = useRef<Worker | null>(null);

  const cleanup = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const run = useCallback(
    (tles: TleSet[], hours: number, thresholdKm: number) => {
      cleanup();

      const startMs = Date.now();
      const stepSec = tles.length > 1500 ? 120 : 60;

      const runSyncFallback = async () => {
        const { screenConjunctions } = await import("@/lib/conjunction-core");
        const t0 = performance.now();
        try {
          const result = screenConjunctions(tles, {
            startMs,
            windowMs: hours * 3600_000,
            thresholdKm,
            stepSec,
          });
          setState({
            status: "done",
            progress: 1,
            phase: "",
            events: result.events,
            stats: result.stats,
            elapsedMs: Math.round(performance.now() - t0),
            error: null,
            ranWith: { satCount: tles.length, hours, thresholdKm, at: startMs },
          });
        } catch (err) {
          setState({
            ...IDLE,
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      };

      setState({
        ...IDLE,
        status: "running",
        phase: "starting",
      });

      if (typeof Worker === "undefined") {
        void runSyncFallback();
        return;
      }

      let worker: Worker;
      try {
        worker = new Worker(
          new URL("../workers/conjunction-worker.ts", import.meta.url)
        );
      } catch {
        void runSyncFallback();
        return;
      }
      workerRef.current = worker;

      worker.onerror = () => {
        cleanup();
        void runSyncFallback();
      };

      worker.onmessage = (e: MessageEvent) => {
        const data = e.data;
        if (data.type === "progress") {
          setState((s) => ({
            ...s,
            progress: data.fraction,
            phase: `${data.phase} (chunk ${data.chunk}/${data.totalChunks})`,
          }));
        } else if (data.type === "done") {
          setState({
            status: "done",
            progress: 1,
            phase: "",
            events: data.events,
            stats: data.stats,
            elapsedMs: data.elapsedMs,
            error: null,
            ranWith: { satCount: tles.length, hours, thresholdKm, at: startMs },
          });
          cleanup();
        } else if (data.type === "error") {
          setState({ ...IDLE, status: "error", error: data.message });
          cleanup();
        }
      };

      worker.postMessage({
        type: "start",
        tles,
        startMs,
        windowMs: hours * 3600_000,
        thresholdKm,
        stepSec,
      });
    },
    [cleanup]
  );

  const cancel = useCallback(() => {
    cleanup();
    setState(IDLE);
  }, [cleanup]);

  return { ...state, run, cancel };
}
