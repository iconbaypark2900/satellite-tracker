/**
 * GroundTracks.tsx — Render satellite ground tracks (projected onto
 * Earth's surface) as dashed lines.
 *
 * Computes ECEF positions over a ±8-hour window and projects to lat/lon.
 */

"use client";

import { useMemo } from "react";
import { Group, Color } from "three";
import { useThree } from "@react-three/fiber";
import { propagateSatellite, eciToEcef } from "@/lib/orbit-utils";
import { TleSet } from "@/types";
import { getGroupColor } from "@/lib/color-utils";

// Earth radius for projecting ground tracks onto the surface
const EARTH_RADIUS = 6371;

interface Props {
  tles: TleSet[];
  simTime: Date;
}

export default function GroundTracks({ tles, simTime }: Props) {
  const { scene } = useThree();

  const tracks = useMemo(() => {
    const allPoints: number[] = [];
    const allColors: number[] = [];
    const segmentIndices: Array<{ start: number; count: number }> = [];

    const stepMin = 8 * 60 / 160; // ±8h window, 160 points

    tles.forEach((tle) => {
      if (!tle.line1 || !tle.line2) return;

      const group = tle.group ?? "OTHER";
      const color = new Color(getGroupColor(group));
      const colorArr = [color.r, color.g, color.b];

      const startIdx = allPoints.length / 3;

      for (let i = 0; i <= 160; i++) {
        const tMin = -480 + i * stepMin;
        const date = new Date(simTime.getTime() + tMin * 60000);

        const result = propagateSatellite(tle, date);

        if (result.isValid) {
          // Convert ECI → ECEF
          const ecef = eciToEcef(result.position, date);

          // Normalize to Earth's surface
          const r = Math.sqrt(ecef[0] ** 2 + ecef[1] ** 2 + ecef[2] ** 2);
          if (r > 0) {
            const s = EARTH_RADIUS / r;
            allPoints.push(ecef[0] * s, ecef[1] * s, ecef[2] * s);
            allColors.push(colorArr[0] * 0.5, colorArr[1] * 0.5, colorArr[2] * 0.5);
          }
        }
      }

      segmentIndices.push({ start: startIdx, count: (allPoints.length / 3) - startIdx });
    });

    return { points: allPoints, colors: allColors, segments: segmentIndices };
  }, [tles, simTime]);

  if (tracks.points.length === 0) return null;

  return (
    <group>
      {tracks.segments.map((seg, idx) => {
        if (seg.count < 2) return null;
        return (
          <lineSegments key={idx}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[
                  new Float32Array(
                    tracks.points.slice(seg.start * 3, (seg.start + seg.count) * 3)
                  ),
                  3,
                ]}
              />
              <bufferAttribute
                attach="attributes-color"
                args={[
                  new Float32Array(
                    tracks.colors.slice(seg.start * 3, (seg.start + seg.count) * 3)
                  ),
                  3,
                ]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              vertexColors
              transparent
              opacity={0.3}
              toneMapped={false}
            />
          </lineSegments>
        );
      })}
    </group>
  );
}
