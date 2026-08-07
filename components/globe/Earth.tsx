/**
 * Earth.tsx — Render Earth as a sphere with atmospheric glow,
 * grid lines, day/night terminator, and procedurally-generated
 * surface texture (no external downloads required).
 */

"use client";

import {
  MeshStandardMaterial,
  MeshBasicMaterial,
  CanvasTexture,
  Color,
  BackSide,
  AdditiveBlending,
  NearestFilter,
} from "three";
import { useMemo, useRef, useEffect, useCallback } from "react";
import { useSunPosition } from "@/hooks/useSunPosition";
import { EARTH_MEAN_RADIUS_KM } from "@/lib/constants";

const EARTH_RADIUS = EARTH_MEAN_RADIUS_KM;

export default function Earth() {
  const sunPos = useSunPosition();

  return (
    <>
      {/* Earth sphere with procedural texture */}
      <EarthSphere />

      {/* Atmospheric glow (additive sphere slightly larger) */}
      <EarthAtmosphere />

      {/* Grid lines (latitude/longitude) */}
      <GridLines />

      {/* Optional terminator line (day/night boundary) */}
      {sunPos && <TerminatorLine sunPos={sunPos.eci} />}

      {/* Directional light synced to sun position */}
      <SunDirectionalLight />
    </>
  );
}

/** Generate a procedural Earth texture using a canvas. */
function createEarthTexture(): CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size * 2;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const data = imgData.data;

  // Pseudo-random function seeded by coordinates
  const pseudoRandom = (x: number, y: number): number => {
    const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return seed - Math.floor(seed);
  };

  for (let y = 0; y < canvas.height; y++) {
    const lat = (y / canvas.height - 0.5) * Math.PI;
    const isNearPole = Math.abs(lat) > 1.3; // ~60° latitude

    for (let x = 0; x < canvas.width; x++) {
      const lon = (x / canvas.width) * Math.PI * 2;
      const idx = (y * canvas.width + x) * 4;

      // Multi-octave noise for continent-like patterns
      const n1 = Math.sin(lon * 1.3 + lat * 0.7) * 0.3;
      const n2 = Math.sin(lon * 2.1 - lat * 0.4) * 0.2;
      const n3 = Math.cos(lon * 0.8 + lat * 1.2) * 0.25;
      const n4 = Math.sin(lon * 3.0 + lat * 0.3) * 0.1;
      const n5 = pseudoRandom(lon * 10, lat * 10) * 0.1;
      const noise = (n1 + n2 + n3 + n4 + n5 + 0.5) / 1.3;

      if (isNearPole && noise > 0.45) {
        // Ice caps (white)
        data[idx] = 240;     // R
        data[idx + 1] = 245; // G
        data[idx + 2] = 255; // B
        data[idx + 3] = 255; // A
      } else if (noise > 0.55) {
        // Ocean (varied blues)
        const depth = noise;
        data[idx] = Math.floor(10 + depth * 30);       // R
        data[idx + 1] = Math.floor(40 + depth * 80);   // G
        data[idx + 2] = Math.floor(100 + depth * 155); // B
        data[idx + 3] = 255;
      } else if (noise > 0.35) {
        // Temperate land (green)
        const variation = pseudoRandom(x, y) * 0.3 + 0.7;
        data[idx] = Math.floor(20 * variation);         // R
        data[idx + 1] = Math.floor(120 * variation);    // G
        data[idx + 2] = Math.floor(50 * variation);     // B
        data[idx + 3] = 255;
      } else {
        // Tropical/arid land (brown/tan)
        const variation = pseudoRandom(x, y) * 0.3 + 0.7;
        data[idx] = Math.floor(140 * variation);        // R
        data[idx + 1] = Math.floor(90 * variation);     // G
        data[idx + 2] = Math.floor(40 * variation);     // B
        data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Add clouds (soft white/gray blobs)
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 40; i++) {
    const cx = pseudoRandom(i * 13.7, 0) * canvas.width;
    const cy = pseudoRandom(0, i * 17.3) * canvas.height * 0.7 + canvas.height * 0.15;
    const r = 20 + pseudoRandom(i * 23.1, i * 31.7) * 40;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, "rgba(255,255,255,0.5)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  const texture = new CanvasTexture(canvas);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  return texture;
}

/**
 * Earth sphere with a procedural texture that looks like Earth
 * (blue oceans, green/brown continents, white polar ice, soft clouds).
 */
function EarthSphere() {
  const materialRef = useRef<MeshStandardMaterial>(null!);

  const material = useMemo(() => {
    return new MeshStandardMaterial({
      color: new Color(0xffffff),
      metalness: 0.0,
      roughness: 1.0,
      emissive: new Color(0x05051a),
      emissiveIntensity: 0.3,
    });
  }, []);

  // Generate texture once (client-side only — uses document)
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    return createEarthTexture();
  }, []);

  useEffect(() => {
    if (texture && materialRef.current) {
      materialRef.current.map = texture;
      materialRef.current.needsUpdate = true;
    }
  }, [texture, material]);

  return (
    <mesh castShadow receiveShadow>
      <sphereGeometry args={[EARTH_RADIUS, 256, 256]} />
      <primitive ref={materialRef} object={material} attach="material" />
    </mesh>
  );
}

/** Atmospheric glow using an additive-blended shell. */
function EarthAtmosphere() {
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(0x3278dc),
        side: BackSide,
        transparent: true,
        opacity: 0.25,
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
    <mesh scale={[1.008, 1.008, 1.008]}>
      <sphereGeometry args={[EARTH_RADIUS, 72, 36]} />
      <meshBasicMaterial
        color={new Color(0x4a9eff)}
        transparent
        opacity={0.08}
        depthWrite={false}
        side={BackSide}
        wireframe
      />
    </mesh>
  );
}

/** Day/night terminator line (where the sun is at the horizon). */
function TerminatorLine({ sunPos }: { sunPos: [number, number, number] }) {
  const points: number[] = [];
  const segments = 120;
  for (let i = 0; i <= segments; i++) {
    const lon = (i / segments) * Math.PI * 2;
    // Terminator is where dot(sunDir, point) = 0
    // For a unit sphere: point = (cos(lat)*cos(lon), cos(lat)*sin(lon), sin(lat))
    // sunDir dot point = 0 → cos(lat)*cos(lon)*sx + cos(lat)*sin(lon)*sy + sin(lat)*sz = 0
    // tan(lat) = -(cos(lon)*sx + sin(lon)*sy) / sz
    const tanLat = -(Math.cos(lon) * sunPos[0] + Math.sin(lon) * sunPos[1]) / sunPos[2];
    const lat = Math.atan(tanLat);
    const r = EARTH_RADIUS * 1.001;
    points.push(
      r * Math.cos(lat) * Math.cos(lon),
      r * Math.cos(lat) * Math.sin(lon),
      r * Math.sin(lat)
    );
  }

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array(points), 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color={new Color(0x4a9eff)}
        transparent
        opacity={0.4}
        toneMapped={false}
        depthWrite={false}
      />
    </lineSegments>
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
