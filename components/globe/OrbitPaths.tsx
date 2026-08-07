/**
 * OrbitPaths.tsx — Render predicted orbital trajectories as curved lines
 * around Earth for each satellite with a valid TLE.
 *
 * Computes positions over a ±3-hour window and projects them onto the
 * Earth-centered coordinate system.
 */

"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, Color } from "three";
import { propagateSatellite } from "@/lib/orbit-utils";
import { TleSet } from "@/types";
import { getGroupColor } from "@/lib/color-utils";

interface Props {
  tles: TleSet[];
  simTime: Date;
}

export default function OrbitPaths({ tles, simTime }: Props) {
  const segments = 96; // points per orbit segment

  const lines = useMemo(() => {
    const points: number[] = [];
    const colors: number[] = [];

    tles.forEach((tle) => {
      if (!tle.line1 || !tle.line2) return;

      const group = tle.group ?? "OTHER";
      const color = new Color(getGroupColor(group));
      const colorArr = [color.r, color.g, color.b];

      const stepMin = 180 / segments; // ±3 hours, 96 segments

      for (let seg = 0; seg <= segments * 2; seg++) {
        const tMin = -180 + seg * stepMin;
        const date = new Date(simTime.getTime() + tMin * 60000);

        const result = propagateSatellite(tle, date);

        if (result.isValid) {
          points.push(
            result.position[0],
            result.position[1],
            result.position[2]
          );
          colors.push(colorArr[0], colorArr[1], colorArr[2]);
        }
      }
    });

    return { points, colors };
  }, [tles, simTime]);

  if (lines.points.length === 0) return null;

  return (
    <group>
      <lineSegments>
        <bufferGeometry attach="geometry">
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(lines.points), 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[new Float32Array(lines.colors), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          attach="material"
          vertexColors
          transparent
          opacity={0.35}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  );
}
