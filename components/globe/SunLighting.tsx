/**
 * SunLighting.tsx — Directional light that follows the Sun's position
 * in ECI coordinates, plus ambient light and hemisphere lighting
 * for realistic Earth illumination.
 */

"use client";

import { useThree, useFrame } from "@react-three/fiber";
import { DirectionalLight, AmbientLight, Color, Vector3 } from "three";
import { useEffect, useRef, useMemo } from "react";
import { getSunPositionFromDate } from "@/lib/sun-position";
import { useSatelliteStore } from "@/lib/satellite-store";
import { unixToJulian } from "@/lib/orbit-utils";

const SUN_DISTANCE = 1e8; // km (effectively infinite)

export default function SunLighting({ simTime }: { simTime: Date }) {
  const directionalLightRef = useRef<any>(null);
  const ambientLightRef = useRef<any>(null);

  const sunPos = useMemo(() => getSunPositionFromDate(simTime), [simTime]);

  // Update light position as time advances
  useFrame(() => {
    if (directionalLightRef.current) {
      directionalLightRef.current.position.set(
        sunPos.eci[0] * SUN_DISTANCE,
        sunPos.eci[1] * SUN_DISTANCE,
        sunPos.eci[2] * SUN_DISTANCE
      );
      directionalLightRef.current.lookAt(0, 0, 0);
    }
  });

  return (
    <>
      {/* Main directional light (sun) */}
      <directionalLight
        ref={directionalLightRef}
        intensity={2.5}
        color={new Color(0xffffff)}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={SUN_DISTANCE * 2}
        shadow-camera-near={EARTH_RADIUS * 0.5}
      />

      {/* Ambient fill light (blue-ish, simulates atmospheric scattering) */}
      <ambientLight ref={ambientLightRef} intensity={0.4} color={new Color(0x4a9eff)} />

      {/* Hemisphere light for ground color transition */}
      <hemisphereLight
        args={[new Color(0xffffff), new Color(0x05051a), 0.35]}
      />
    </>
  );
}

const EARTH_RADIUS = 6371;
