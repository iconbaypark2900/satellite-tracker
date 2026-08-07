/**
 * Earth.tsx — Render Earth as a textured sphere with atmospheric glow,
 * grid lines, and a day/night terminator controlled by sun direction.
 */

"use client";

import { useLoader, useFrame } from "@react-three/fiber";
import { TextureLoader, MeshStandardMaterial, Color, BackSide, AdditiveBlending } from "three";
import { useMemo, useRef } from "react";
import { useSunPosition } from "@/hooks/useSunPosition";
import { useSatelliteStore } from "@/lib/satellite-store";

const EARTH_RADIUS = 6371;

export default function Earth() {
  const meshRef = useRef<any>();
  const { timeControl } = useSatelliteStore();

  // Load Earth textures
  const [colorMap, nightMap, bumpMap, specMap] = useLoader(TextureLoader, [
    "/textures/earth-day-8k.jpg",
    "/textures/earth-night-4k.jpg",
    "/textures/earth-bump-8k.jpg",
    "/textures/earth-spec-4k.jpg",
  ]);

  // Get sun direction for lighting
  const sunPos = useSunPosition();

  // Create material
  const material = useMemo(() => {
    const mat = new MeshStandardMaterial({
      map: colorMap,
      lightMap: nightMap,
      bumpMap: bumpMap,
      bumpScale: 0.8,
      metalness: 0.2,
      roughness: 0.8,
      emissive: new Color(0x05051a),
      emissiveMap: nightMap,
      emissiveIntensity: 0.4,
    });
    return mat;
  }, [colorMap, nightMap, bumpMap]);

  // Update directional light based on sun position
  useFrame(() => {
    if (meshRef.current && sunPos) {
      // Rotate Earth slightly to account for sun position
      // (the terminator line is computed in the shader / lighting)
    }
  });

  return (
    <>
      {/* Earth sphere */}
      <mesh ref={meshRef} castShadow receiveShadow>
        <sphereGeometry args={[EARTH_RADIUS, 256, 256]} />
        <primitive object={material} attach="material" />
      </mesh>

      {/* Atmospheric glow (additive sphere slightly larger) */}
      <EarthAtmosphere />

      {/* Grid lines (latitude/longitude) */}
      <GridLines />

      {/* Directional light synced to sun position */}
      <SunDirectionalLight />
    </>
  );
}

/** Atmospheric glow using a custom shader-like approach. */
function EarthAtmosphere() {
  const { timeControl } = useSatelliteStore();
  const sunPos = useSunPosition();

  const material = useMemo(() => {
    return new MeshBasicMaterial({
      color: new Color(0x3278dc),
      side: BackSide,
      transparent: true,
      opacity: 0.15,
      blending: AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
  }, []);

  return (
    <mesh scale={[1.02, 1.02, 1.02]}>
      <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** Lat/lon grid lines on Earth's surface (wireframe overlay). */
function GridLines() {
  return (
    <mesh scale={[1.005, 1.005, 1.005]}>
      <sphereGeometry args={[EARTH_RADIUS, 72, 36]} />
      <meshBasicMaterial
        color={new Color(0x3278dc)}
        transparent
        opacity={0.1}
        depthWrite={false}
        side={BackSide}
        wireframe
      />
    </mesh>
  );
}

/**
 * Directional light that follows the sun's position in ECI space.
 */
function SunDirectionalLight() {
  const sunPos = useSunPosition();

  if (!sunPos) return null;

  return (
    <directionalLight
      position={[
        sunPos.eci[0] * 1e8,
        sunPos.eci[1] * 1e8,
        sunPos.eci[2] * 1e8,
      ]}
      castShadow
      intensity={2}
      color={new Color(0xffffff)}
    />
  );
}
