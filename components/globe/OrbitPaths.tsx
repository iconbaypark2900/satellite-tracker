/**
 * OrbitPaths.tsx — Render predicted orbital trajectories for the selected
 * and hovered satellites only.
 *
 * Rendering every satellite's path was both unusable visually (hundreds of
 * overlapping lines) and the app's biggest CPU sink: ~190 SGP4 solves per
 * satellite, re-run on every render. Scoping to ≤2 satellites and
 * recomputing on a coarse time bucket keeps this effectively free.
 */

"use client";

import { useMemo } from "react";
import { propagateSatellite } from "@/lib/orbit-utils";
import { useSatelliteStore } from "@/lib/satellite-store";
import { TleSet } from "@/types";
import { getGroupColor } from "@/lib/color-utils";
import { ORBIT_PATH_WINDOW_MIN, ORBIT_PATH_SEGMENTS } from "@/lib/constants";

/** Recompute the drawn arc when sim time moves by this much (ms). The
 *  window is ±3h, so a 30-min bucket keeps the arc roughly centered. */
const ORBIT_RECOMPUTE_BUCKET_MS = 30 * 60000;

interface Props {
  tles: TleSet[];
  selectedNorad: string | null;
  hoveredNorad?: string | null;
}

/**
 * Compute orbit path points, duplicated (P0, P1, P1, P2, ...) so that
 * lineSegments renders a continuous LINE_STRIP-style path.
 */
function computeOrbitPoints(tle: TleSet, centerMs: number): Float32Array {
  const positions: number[] = [];
  const stepMin = ORBIT_PATH_WINDOW_MIN / ORBIT_PATH_SEGMENTS; // ±3h, 96 segments

  for (let seg = 0; seg <= ORBIT_PATH_SEGMENTS * 2; seg++) {
    const tMin = -ORBIT_PATH_WINDOW_MIN + seg * stepMin;
    const date = new Date(centerMs + tMin * 60000);
    const result = propagateSatellite(tle, date);

    if (result.isValid) {
      const p = result.position;
      if (positions.length > 0) {
        positions.push(
          positions[positions.length - 3],
          positions[positions.length - 2],
          positions[positions.length - 1]
        );
      }
      positions.push(p[0], p[1], p[2]);
    }
  }

  return new Float32Array(positions);
}

export default function OrbitPaths({ tles, selectedNorad, hoveredNorad }: Props) {
  // Coarse time bucket — re-renders only every 30 sim-minutes, not at 10Hz
  const timeBucket = useSatelliteStore((s) =>
    Math.floor(s.timeControl.simTime.getTime() / ORBIT_RECOMPUTE_BUCKET_MS)
  );

  const targets = useMemo(() => {
    const wanted: Array<{ tle: TleSet; color: string; opacity: number }> = [];
    for (const tle of tles) {
      if (!tle.line1 || !tle.line2) continue;
      if (tle.noradId === selectedNorad) {
        wanted.push({ tle, color: "#ffffff", opacity: 0.85 });
      } else if (tle.noradId === hoveredNorad) {
        wanted.push({
          tle,
          color: getGroupColor(tle.group ?? "OTHER"),
          opacity: 0.5,
        });
      }
    }
    return wanted;
  }, [tles, selectedNorad, hoveredNorad]);

  const orbits = useMemo(
    () =>
      targets.map(({ tle, color, opacity }) => ({
        noradId: tle.noradId,
        points: computeOrbitPoints(tle, timeBucket * ORBIT_RECOMPUTE_BUCKET_MS),
        color,
        opacity,
      })),
    [targets, timeBucket]
  );

  if (orbits.length === 0) return null;

  return (
    <group>
      {orbits.map((orbit) => (
        <lineSegments key={`${orbit.noradId}-${orbit.color}`} userData={{ noradId: orbit.noradId }}>
          <bufferGeometry attach="geometry">
            <bufferAttribute attach="attributes-position" args={[orbit.points, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            attach="material"
            color={orbit.color}
            transparent
            opacity={orbit.opacity}
            toneMapped={false}
            depthWrite={false}
            depthTest={true}
          />
        </lineSegments>
      ))}
    </group>
  );
}
