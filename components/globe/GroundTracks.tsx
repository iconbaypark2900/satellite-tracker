/**
 * GroundTracks.tsx — Render ground tracks (satellite paths projected onto
 * Earth's surface) for the selected and hovered satellites only.
 *
 * Like OrbitPaths, this used to compute every satellite's track on every
 * render (~160 SGP4 solves each) — scoped to ≤2 satellites and a coarse
 * time bucket it is effectively free.
 */

"use client";

import { useMemo } from "react";
import { Color } from "three";
import { propagateSatellite, eciToEcef } from "@/lib/orbit-utils";
import { useSatelliteStore } from "@/lib/satellite-store";
import { TleSet } from "@/types";
import { getGroupColor } from "@/lib/color-utils";
import { GROUND_TRACK_WINDOW_MIN } from "@/lib/constants";

// Earth radius for projecting ground tracks onto the surface
const EARTH_RADIUS = 6371;

const SEGMENTS = 160;

/** Recompute when sim time moves by this much (window is ±8h). */
const TRACK_RECOMPUTE_BUCKET_MS = 60 * 60000;

interface Props {
  tles: TleSet[];
  selectedNorad: string | null;
  hoveredNorad?: string | null;
}

function computeTrackPoints(tle: TleSet, centerMs: number): Float32Array {
  const stepMin = (GROUND_TRACK_WINDOW_MIN * 2) / SEGMENTS; // ±8h
  const positions: number[] = [];

  for (let i = 0; i <= SEGMENTS; i++) {
    const tMin = -GROUND_TRACK_WINDOW_MIN + i * stepMin;
    const date = new Date(centerMs + tMin * 60000);
    const result = propagateSatellite(tle, date);

    if (result.isValid) {
      const ecef = eciToEcef(result.position, date);
      const r = Math.sqrt(ecef[0] ** 2 + ecef[1] ** 2 + ecef[2] ** 2);
      if (r > 0) {
        const s = EARTH_RADIUS / r;
        if (positions.length > 0) {
          // Duplicate previous point for continuous line in LINES mode
          positions.push(
            positions[positions.length - 3],
            positions[positions.length - 2],
            positions[positions.length - 1]
          );
        }
        positions.push(ecef[0] * s, ecef[1] * s, ecef[2] * s);
      }
    }
  }

  return new Float32Array(positions);
}

/** Dim a group color to 50% brightness for surface tracks. */
function dimColor(colorStr: string): string {
  const c = new Color(colorStr);
  return `rgb(${Math.round(c.r * 127)}, ${Math.round(c.g * 127)}, ${Math.round(c.b * 127)})`;
}

export default function GroundTracks({ tles, selectedNorad, hoveredNorad }: Props) {
  const timeBucket = useSatelliteStore((s) =>
    Math.floor(s.timeControl.simTime.getTime() / TRACK_RECOMPUTE_BUCKET_MS)
  );

  const targets = useMemo(() => {
    const wanted: Array<{ tle: TleSet; color: string; opacity: number }> = [];
    for (const tle of tles) {
      if (!tle.line1 || !tle.line2) continue;
      if (tle.noradId === selectedNorad) {
        wanted.push({ tle, color: "#ffffff", opacity: 0.7 });
      } else if (tle.noradId === hoveredNorad) {
        wanted.push({
          tle,
          color: dimColor(getGroupColor(tle.group ?? "OTHER")),
          opacity: 0.45,
        });
      }
    }
    return wanted;
  }, [tles, selectedNorad, hoveredNorad]);

  const tracks = useMemo(
    () =>
      targets.map(({ tle, color, opacity }) => ({
        noradId: tle.noradId,
        points: computeTrackPoints(tle, timeBucket * TRACK_RECOMPUTE_BUCKET_MS),
        color,
        opacity,
      })),
    [targets, timeBucket]
  );

  if (tracks.length === 0) return null;

  return (
    <group>
      {tracks.map((track) => (
        <lineSegments key={`${track.noradId}-${track.color}`} userData={{ noradId: track.noradId }}>
          <bufferGeometry attach="geometry">
            <bufferAttribute attach="attributes-position" args={[track.points, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            attach="material"
            color={track.color}
            transparent
            opacity={track.opacity}
            toneMapped={false}
            depthWrite={false}
            depthTest={true}
          />
        </lineSegments>
      ))}
    </group>
  );
}
