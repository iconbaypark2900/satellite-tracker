/**
 * FpsProbe.tsx — Samples the render frame rate and publishes it to the store.
 *
 * Replaces drei's <Stats /> panel, which pins itself to the viewport's
 * top-left corner and sat directly on top of the wordmark. The number is
 * more useful in the header's status cluster anyway: with a few hundred
 * objects propagating and a time slider that can be scrubbed, whether the
 * renderer is keeping up is operational information, not a debug aid.
 *
 * Renders nothing. Counts frames and writes once a second, so the store
 * update cannot itself become the thing that costs frames.
 */

"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useSatelliteStore } from "@/lib/satellite-store";

const SAMPLE_MS = 1000;

export default function FpsProbe() {
  const frames = useRef(0);
  const windowStart = useRef(
    typeof performance !== "undefined" ? performance.now() : 0
  );

  useFrame(() => {
    frames.current += 1;
    const now = performance.now();
    const elapsed = now - windowStart.current;
    if (elapsed < SAMPLE_MS) return;

    const fps = Math.round((frames.current * 1000) / elapsed);
    frames.current = 0;
    windowStart.current = now;

    // Read through getState so this component never subscribes to the
    // store and never re-renders itself.
    const { renderFps, setRenderFps } = useSatelliteStore.getState();
    if (fps !== renderFps) setRenderFps(fps);
  });

  return null;
}
