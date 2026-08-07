/**
 * Earth.tsx — Render Earth as a sphere with atmospheric glow,
 * grid lines, and a day/night terminator controlled by sun direction.
 *
 * Uses a color-gradient material (no external texture dependencies)
 * so the app renders correctly even before textures are downloaded.
 * When real textures are present in public/textures/, they are loaded
 * via useLoader with a Suspense fallback.
 */

"use client";

import { useLoader } from "@react-three/fiber";
import {
  TextureLoader,
  MeshStandardMaterial,
  MeshBasicMaterial,
  Color,
  BackSide,
  AdditiveBlending,
} from "three";
import { useMemo, useRef, Suspense } from "react";
import { useSunPosition } from "@/hooks/useSunPosition";
import { useSatelliteStore } from "@/lib/satellite-store";
import { EARTH_MEAN_RADIUS_KM } from "@/lib/constants";

const EARTH_RADIUS = EARTH_MEAN_RADIUS_KM;

export default function Earth() {
  const meshRef = useRef<any>();
  const sunPos = useSunPosition();

  return (
    <>
      {/* Earth sphere with texture (or fallback material) */}
      <Suspense fallback={<EarthFallback />}>
        <EarthTextured meshRef={meshRef} />
      </Suspense>

      {/* Atmospheric glow (additive sphere slightly larger) */}
      <EarthAtmosphere />

      {/* Grid lines (latitude/longitude) */}
      <GridLines />

      {/* Directional light synced to sun position */}
      <SunDirectionalLight />
    </>
  );
}

/**
 * Earth with real textures loaded from public/textures/.
 * Falls back to EarthFallback if textures are unavailable.
 */
function EarthTextured({ meshRef }: { meshRef: any }) {
  const [colorMap, nightMap, bumpMap] = useLoader(TextureLoader, [
    "/textures/earth-day-8k.jpg",
    "/textures/earth-night-4k.jpg",
    "/textures/earth-bump-8k.jpg",
  ]);

  const material = useMemo(() => {
    return new MeshStandardMaterial({
      map: colorMap,
      bumpMap: bumpMap,
      bumpScale: 0.8,
      metalness: 0.2,
      roughness: 0.8,
      emissive: new Color(0x05051a),
      emissiveMap: nightMap,
      emissiveIntensity: 0.4,
    });
  }, [colorMap, nightMap, bumpMap]);

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <sphereGeometry args={[EARTH_RADIUS, 256, 256]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/**
 * Fallback Earth sphere using a solid gradient material.
 * Used when texture files are not available.
 */
function EarthFallback({ meshRef }: { meshRef?: any }) {
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color(0x0a3d66),
        metalness: 0.2,
        roughness: 0.8,
        emissive: new Color(0x05051a),
        emissiveIntensity: 0.3,
      }),
    []
  );

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** Atmospheric glow using a custom shader-like approach. */
function EarthAtmosphere() {
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(0x3278dc),
        side: BackSide,
        transparent: true,
        opacity: 0.15,
        blending: AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    []
  );

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
