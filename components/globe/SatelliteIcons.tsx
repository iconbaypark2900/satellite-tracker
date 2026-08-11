/**
 * SatelliteIcons.tsx — Render all satellites as a single THREE.Points draw
 * call with screen-space point sizing.
 *
 * World-space geometry (the old 3km instanced spheres) is sub-pixel in a
 * scene where Earth is 6371 units — points with a fixed pixel size stay
 * visible at every zoom level and scale to thousands of satellites.
 *
 * Picking is done manually in screen space (project positions → nearest
 * within a pixel radius, skipping Earth-occluded satellites) because
 * raycasting Points needs distance-dependent world thresholds and
 * InstancedMesh bounding spheres go stale when matrices change.
 */

"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";
import { propagateSatellite } from "@/lib/orbit-utils";
import { useSatelliteStore } from "@/lib/satellite-store";
import { TleSet, Satellite } from "@/types";
import { getGroupColor } from "@/lib/color-utils";
import { EARTH_MEAN_RADIUS_KM } from "@/lib/constants";

/** Base point diameter in CSS pixels (scaled by devicePixelRatio). */
const BASE_SIZE_PX = 6;
/** Picking radius in CSS pixels. */
const PICK_RADIUS_PX = 10;
/** Throttle for hover hit-testing (ms). */
const HOVER_THROTTLE_MS = 30;
/** Max pointer travel (px) between down and click to count as a click. */
const CLICK_SLOP_PX = 5;

const VERTEX_SHADER = /* glsl */ `
  attribute vec3 aColor;
  attribute float aIndex;
  attribute float aValid;
  uniform float uSize;
  uniform float uSelectedIndex;
  uniform float uHoveredIndex;
  varying vec3 vColor;
  varying float vState;

  void main() {
    vColor = aColor;
    float state = 0.0;
    if (abs(aIndex - uSelectedIndex) < 0.5) {
      state = 2.0;
    } else if (abs(aIndex - uHoveredIndex) < 0.5) {
      state = 1.0;
    }
    vState = state;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aValid * uSize * (1.0 + 0.5 * state);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vState;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    float core = smoothstep(0.35, 0.0, d);
    float halo = pow(max(0.0, 1.0 - d), 2.0) * 0.6;
    float alpha = core + halo;
    if (alpha < 0.02) discard;
    float whiten = vState >= 2.0 ? 0.7 : (vState >= 1.0 ? 0.3 : 0.0);
    vec3 color = mix(vColor, vec3(1.0), whiten);
    gl_FragColor = vec4(color, alpha);
  }
`;

interface Props {
  tles: TleSet[];
  /** Map of all satellites for name/operator resolution. */
  satellites: Map<string, Satellite>;
  selectedNorad: string | null;
  onSelect: (sat: Satellite | null) => void;
  /** Called with the NORAD ID of the hovered satellite, or null. */
  onHover?: (noradId: string | null) => void;
}

export default function SatelliteIcons({
  tles,
  satellites,
  selectedNorad,
  onSelect,
  onHover,
}: Props) {
  const pointsRef = useRef<Points>(null!);
  const { gl, camera } = useThree();
  const count = tles.length;

  // Geometry with dynamic positions + static per-point attributes
  const { geometry, positions, valid } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const indices = new Float32Array(count);
    const valid = new Float32Array(count); // 0 until first successful propagation

    const color = new Color();
    tles.forEach((tle, i) => {
      color.set(getGroupColor(tle.group ?? "OTHER"));
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      indices[i] = i;
    });

    const geometry = new BufferGeometry();
    const posAttr = new BufferAttribute(positions, 3);
    posAttr.setUsage(DynamicDrawUsage);
    geometry.setAttribute("position", posAttr);
    geometry.setAttribute("aColor", new BufferAttribute(colors, 3));
    geometry.setAttribute("aIndex", new BufferAttribute(indices, 1));
    const validAttr = new BufferAttribute(valid, 1);
    validAttr.setUsage(DynamicDrawUsage);
    geometry.setAttribute("aValid", validAttr);
    return { geometry, positions, valid };
  }, [tles, count]);

  // Dispose replaced geometries
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uSize: { value: BASE_SIZE_PX * gl.getPixelRatio() },
          uSelectedIndex: { value: -1 },
          uHoveredIndex: { value: -1 },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      }),
    [gl]
  );
  useEffect(() => () => material.dispose(), [material]);

  // Keep the selected-index uniform in sync with the store selection
  const selectedIndex = useMemo(
    () => tles.findIndex((t) => t.noradId === selectedNorad),
    [tles, selectedNorad]
  );
  useEffect(() => {
    material.uniforms.uSelectedIndex.value = selectedIndex;
  }, [material, selectedIndex]);

  // Propagate all satellites each frame into the position attribute
  useFrame(() => {
    const points = pointsRef.current;
    if (!points) return;
    const simTime = useSatelliteStore.getState().timeControl.simTime;

    let validChanged = false;
    for (let i = 0; i < count; i++) {
      const result = propagateSatellite(tles[i], simTime);
      if (result.isValid) {
        positions[i * 3] = result.position[0];
        positions[i * 3 + 1] = result.position[1];
        positions[i * 3 + 2] = result.position[2];
        if (valid[i] !== 1) {
          valid[i] = 1;
          validChanged = true;
        }
      } else if (valid[i] !== 0) {
        valid[i] = 0;
        validChanged = true;
      }
    }

    const geo = points.geometry as BufferGeometry;
    (geo.getAttribute("position") as BufferAttribute).needsUpdate = true;
    if (validChanged) {
      (geo.getAttribute("aValid") as BufferAttribute).needsUpdate = true;
    }
    material.uniforms.uSize.value = BASE_SIZE_PX * gl.getPixelRatio();
  });

  // ── Manual screen-space picking ────────────────────────────────── //

  // Refs so the listeners never need re-binding on state change
  const pickState = useRef({
    tles,
    satellites,
    onSelect,
    onHover,
    hoveredIndex: -1,
    downX: 0,
    downY: 0,
    lastHoverAt: 0,
  });
  pickState.current.tles = tles;
  pickState.current.satellites = satellites;
  pickState.current.onSelect = onSelect;
  pickState.current.onHover = onHover;

  useEffect(() => {
    const canvas = gl.domElement;
    const projected = new Vector3();

    /**
     * Find the nearest satellite within PICK_RADIUS_PX of the pointer,
     * skipping invalid and Earth-occluded points. Returns index or -1.
     */
    const hitTest = (clientX: number, clientY: number): number => {
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const halfW = rect.width / 2;
      const halfH = rect.height / 2;

      const camPos = camera.position;
      const camLenSq = camPos.lengthSq();
      const earthRadiusSq = EARTH_MEAN_RADIUS_KM * EARTH_MEAN_RADIUS_KM * 0.998;

      let best = -1;
      let bestDistSq = PICK_RADIUS_PX * PICK_RADIUS_PX;

      const n = pickState.current.tles.length;
      for (let i = 0; i < n; i++) {
        if (valid[i] !== 1) continue;
        const x = positions[i * 3];
        const y = positions[i * 3 + 1];
        const z = positions[i * 3 + 2];

        // Earth occlusion: does the camera→satellite segment cross the globe?
        const dx = x - camPos.x;
        const dy = y - camPos.y;
        const dz = z - camPos.z;
        const segLenSq = dx * dx + dy * dy + dz * dz;
        const tca = -(camPos.x * dx + camPos.y * dy + camPos.z * dz) / segLenSq;
        if (tca > 0 && tca < 1) {
          const closestSq =
            camLenSq - tca * tca * segLenSq;
          if (closestSq < earthRadiusSq) continue;
        }

        projected.set(x, y, z).project(camera);
        if (projected.z > 1) continue; // behind the camera
        const sx = projected.x * halfW + halfW;
        const sy = -projected.y * halfH + halfH;
        const ddx = sx - px;
        const ddy = sy - py;
        const distSq = ddx * ddx + ddy * ddy;
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          best = i;
        }
      }
      return best;
    };

    const setHover = (index: number) => {
      const state = pickState.current;
      if (index === state.hoveredIndex) return;
      state.hoveredIndex = index;
      material.uniforms.uHoveredIndex.value = index;
      canvas.style.cursor = index >= 0 ? "pointer" : "";
      const noradId = index >= 0 ? state.tles[index]?.noradId ?? null : null;
      state.onHover?.(noradId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - pickState.current.lastHoverAt < HOVER_THROTTLE_MS) return;
      pickState.current.lastHoverAt = now;
      setHover(hitTest(e.clientX, e.clientY));
    };

    const onPointerDown = (e: PointerEvent) => {
      pickState.current.downX = e.clientX;
      pickState.current.downY = e.clientY;
    };

    const onClick = (e: MouseEvent) => {
      const state = pickState.current;
      // Ignore clicks that were actually drags (orbit rotation)
      const moved =
        Math.abs(e.clientX - state.downX) > CLICK_SLOP_PX ||
        Math.abs(e.clientY - state.downY) > CLICK_SLOP_PX;
      if (moved) return;

      const index = hitTest(e.clientX, e.clientY);
      if (index >= 0) {
        const noradId = state.tles[index]?.noradId;
        const sat = noradId ? state.satellites.get(noradId) : undefined;
        state.onSelect(sat ?? null);
      } else {
        state.onSelect(null);
      }
    };

    const onPointerLeave = () => setHover(-1);

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("pointerleave", onPointerLeave);
    return () => {
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.style.cursor = "";
    };
  }, [gl, camera, material, positions, valid]);

  if (count === 0) return null;

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
    />
  );
}
