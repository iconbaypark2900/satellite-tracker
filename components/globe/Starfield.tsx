/**
 * Starfield.tsx — Render a star-filled background using procedural star
 * points distributed on a large sphere, plus optional HDRI environment map.
 *
 * Uses a large inverted sphere with star textures or sprite-based stars
 * for the background, providing a realistic space environment.
 */

"use client";

import { useMemo, useRef } from "react";
import { BufferGeometry, BufferAttribute, Color, Points, PointsMaterial, Mesh, SphereGeometry, MeshBasicMaterial, BackSide, AdditiveBlending } from "three";

/** Number of stars to generate procedurally. */
const STAR_COUNT = 2000;
const STAR_SPHERE_RADIUS = 50000; // Very far away (km)

export default function Starfield() {
  // Generate procedural star positions on a sphere
  const starGeometry = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = 2 * Math.PI * Math.random();
      const r = STAR_SPHERE_RADIUS;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    return geometry;
  }, []);

  // Generate star colors (white to slightly blue-ish)
  const starColors = useMemo(() => {
    const colors = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const b = Math.random();
      const t = b * 0.8 + 0.2;
      colors[i * 3] = 1 * t;
      colors[i * 3 + 1] = 1 * t;
      colors[i * 3 + 2] = 1 * 0.8 * t;
    }
    return colors;
  }, []);

  // Star material (additive blending for glow effect)
  const starMaterial = useMemo(
    () =>
      new PointsMaterial({
        size: 70,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        toneMapped: false,
        color: new Color(0xffffff),
        blending: AdditiveBlending,
      }),
    []
  );

  // Attach colors
  starGeometry.setAttribute(
    "color",
    new BufferAttribute(starColors, 3)
  );

  return <points geometry={starGeometry} material={starMaterial} />;
}
