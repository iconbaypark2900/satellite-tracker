/**
 * SatelliteIcons.tsx — Render satellite positions as instanced meshes
 * for performance (single draw call for all satellites).
 *
 * Each satellite is rendered as a small glowing sphere with its group color.
 */

"use client";

import { useMemo, useRef, useCallback, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D, Color, InstancedBufferAttribute } from "three";
import { propagateSatellite } from "@/lib/orbit-utils";
import { TleSet, Satellite } from "@/types";
import { getGroupColor } from "@/lib/color-utils";

const DUMMY = new Object3D();

interface Props {
  tles: TleSet[];
  simTime: Date;
  selectedNorad: string | null;
  onSelect: (sat: Satellite | null) => void;
}

export default function SatelliteIcons({ tles, simTime, selectedNorad, onSelect }: Props) {
  const meshRef = useRef<InstancedMesh>(null!);
  const count = tles.length;

  // Colors per satellite
  const colors = useMemo(() => {
    return tles.map((tle) => {
      const group = tle.group ?? "OTHER";
      return new Color(getGroupColor(group));
    });
  }, [tles]);

  // Instance colors attribute (Float32Array for GPU)
  const instanceColors = useMemo(() => {
    const arr = new Float32Array(count * 3);
    colors.forEach((c, i) => {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    });
    return arr;
  }, [colors, count]);

  // Set instance colors on the instanced mesh (avoids TS issues with JSX element)
  useLayoutEffect(() => {
    if (!meshRef.current) return;
    meshRef.current.instanceColor = new InstancedBufferAttribute(instanceColors, 3);
  }, [instanceColors]);

  // Update positions every frame
  useFrame(() => {
    if (!meshRef.current) return;

    tles.forEach((tle, i) => {
      const result = propagateSatellite(tle, simTime);

      if (result.isValid) {
        DUMMY.position.set(
          result.position[0],
          result.position[1],
          result.position[2]
        );

        // Scale based on selection
        const scale = selectedNorad === tle.noradId ? 1.5 : 1;
        DUMMY.scale.setScalar(scale);

        DUMMY.updateMatrix();
        meshRef.current.setMatrixAt(i, DUMMY.matrix);
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      count={count}
      args={[undefined, undefined, count]}
    >
      <sphereGeometry args={[3, 16, 16]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
