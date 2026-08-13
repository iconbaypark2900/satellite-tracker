/**
 * Earth.tsx — Render Earth with real NASA textures: a day/night shader
 * (Blue Marble day map, city-lights night map, soft terminator mix),
 * fresnel atmosphere, and lat/lon grid.
 *
 * The textured sphere lives inside <EcefFrame> so geography rotates with
 * GMST and stays aligned with the ECI satellite positions. Falls back to
 * the original procedural texture when the downloaded textures are absent.
 */

"use client";

import {
  MeshBasicMaterial,
  CanvasTexture,
  Color,
  BackSide,
  AdditiveBlending,
  ShaderMaterial,
  Texture,
  TextureLoader,
  SRGBColorSpace,
  Vector3,
} from "three";
import { useMemo, useRef, useEffect, useState } from "react";
import { useSunPosition } from "@/hooks/useSunPosition";
import { EARTH_MEAN_RADIUS_KM } from "@/lib/constants";
import EcefFrame from "./EcefFrame";

const EARTH_RADIUS = EARTH_MEAN_RADIUS_KM;

export default function Earth() {
  return (
    <>
      {/* Earth-fixed content spins with GMST to match ECI satellites */}
      <EcefFrame>
        <EarthSphere />
      </EcefFrame>

      {/* Atmospheric fresnel glow (view-dependent, not Earth-fixed) */}
      <EarthAtmosphere />

      {/* Grid lines (latitude/longitude) */}
      <GridLines />
    </>
  );
}

// ─── Day/Night Shader ─────────────────────────────────── //

const EARTH_VERTEX = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const EARTH_FRAGMENT = /* glsl */ `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uNormalMap;
  uniform sampler2D uSpecMap;
  uniform vec3 uSunDir;
  uniform float uHasNight;
  uniform float uHasNormal;
  uniform float uHasSpec;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  /**
   * Tangent basis for a UV sphere, derived analytically.
   *
   * sphereGeometry carries no tangent attribute, and adding one would mean a
   * BufferGeometryUtils dependency for geometry whose parameterisation we
   * already know. For a UV sphere the tangent runs along increasing longitude,
   * which is the direction perpendicular to both the surface normal and the
   * polar axis. Exact here; not general to arbitrary meshes.
   */
  mat3 sphereTBN(vec3 n) {
    // POLAR AXIS IS +Z, NOT +Y. vWorldNormal is a world-space vector, and the
    // mesh carries rotation-x = PI/2 to put the geometry's +Y pole on scene +Z
    // (ECI north). Using +Y here builds the basis 90 degrees off and applies
    // the normal map sideways — which still renders, just wrong, so it would
    // not have announced itself.
    vec3 polar = vec3(0.0, 0.0, 1.0);
    // Degenerate exactly at the poles, where every longitude meets. Fall back
    // to any perpendicular direction rather than emitting NaN across the cap.
    vec3 t = cross(polar, n);
    float len = length(t);
    t = len > 1e-4 ? t / len : vec3(1.0, 0.0, 0.0);
    return mat3(t, cross(n, t), n);
  }

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 day = texture2D(uDayMap, vUv).rgb;
    vec3 night = uHasNight > 0.5
      ? texture2D(uNightMap, vUv).rgb
      : day * 0.04;

    // Surface relief. Perturb the normal used for LIGHTING only — the
    // geometric normal still drives the terminator and the fresnel rim, so
    // mountains cannot punch holes in the day/night line.
    vec3 shadingNormal = n;
    if (uHasNormal > 0.5) {
      vec3 tn = texture2D(uNormalMap, vUv).rgb * 2.0 - 1.0;
      // Flatten the bump slightly: these maps are authored for close-up use and
      // read as gravel from orbit at full strength.
      tn.xy *= 0.6;
      shadingNormal = normalize(sphereTBN(n) * normalize(tn));
    }

    // Soft terminator: fully night below -0.08, fully day above 0.15
    float k = smoothstep(-0.08, 0.15, dot(n, uSunDir));

    // Relief shading, driven by the perturbed normal. Centred on 1.0 so flat
    // ground keeps the texture's own brightness and only slopes shift.
    float relief = uHasNormal > 0.5
      ? mix(1.0, 0.6 + 0.8 * max(dot(shadingNormal, uSunDir), 0.0), k)
      : 1.0;

    vec3 color = mix(night * 1.6, day * relief, k);

    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    // Sun glint on water. The spec map is the ocean mask — an unmasked
    // highlight sliding over continents is the classic giveaway. Gated by k so
    // it cannot appear on the night side.
    if (uHasSpec > 0.5) {
      float water = texture2D(uSpecMap, vUv).r;
      vec3 h = normalize(uSunDir + viewDir);
      float spec = pow(max(dot(shadingNormal, h), 0.0), 48.0);
      color += vec3(1.0, 0.97, 0.9) * spec * water * k * 0.55;
    }

    // Subtle blue fresnel rim
    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    color += vec3(0.2, 0.45, 0.9) * rim * 0.35;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Generate the procedural fallback Earth texture using a canvas. */
function createEarthTexture(): CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size * 2;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const data = imgData.data;

  const pseudoRandom = (x: number, y: number): number => {
    const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return seed - Math.floor(seed);
  };

  for (let y = 0; y < canvas.height; y++) {
    const lat = (y / canvas.height - 0.5) * Math.PI;
    const isNearPole = Math.abs(lat) > 1.3;

    for (let x = 0; x < canvas.width; x++) {
      const lon = (x / canvas.width) * Math.PI * 2;
      const idx = (y * canvas.width + x) * 4;

      const n1 = Math.sin(lon * 1.3 + lat * 0.7) * 0.3;
      const n2 = Math.sin(lon * 2.1 - lat * 0.4) * 0.2;
      const n3 = Math.cos(lon * 0.8 + lat * 1.2) * 0.25;
      const n4 = Math.sin(lon * 3.0 + lat * 0.3) * 0.1;
      const n5 = pseudoRandom(lon * 10, lat * 10) * 0.1;
      const noise = (n1 + n2 + n3 + n4 + n5 + 0.5) / 1.3;

      if (isNearPole && noise > 0.45) {
        data[idx] = 240;
        data[idx + 1] = 245;
        data[idx + 2] = 255;
        data[idx + 3] = 255;
      } else if (noise > 0.55) {
        const depth = noise;
        data[idx] = Math.floor(10 + depth * 30);
        data[idx + 1] = Math.floor(40 + depth * 80);
        data[idx + 2] = Math.floor(100 + depth * 155);
        data[idx + 3] = 255;
      } else if (noise > 0.35) {
        const variation = pseudoRandom(x, y) * 0.3 + 0.7;
        data[idx] = Math.floor(20 * variation);
        data[idx + 1] = Math.floor(120 * variation);
        data[idx + 2] = Math.floor(50 * variation);
        data[idx + 3] = 255;
      } else {
        const variation = pseudoRandom(x, y) * 0.3 + 0.7;
        data[idx] = Math.floor(140 * variation);
        data[idx + 1] = Math.floor(90 * variation);
        data[idx + 2] = Math.floor(40 * variation);
        data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Load a texture, resolving null on failure (missing file, decode error). */
function loadTexture(url: string): Promise<Texture | null> {
  return new Promise((resolve) => {
    new TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = 8;
        resolve(tex);
      },
      undefined,
      () => resolve(null)
    );
  });
}

/** Earth sphere with the day/night shader (procedural fallback). */
function EarthSphere() {
  const [maps, setMaps] = useState<{
    day: Texture;
    night: Texture | null;
    normal: Texture | null;
    spec: Texture | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // All four are downloaded by scripts/download-textures.ts. Until now only
      // the first two were ever sampled, so the Earth had no surface relief and
      // no ocean glint despite shipping the maps for both.
      const [day, night, normal, spec] = await Promise.all([
        loadTexture("/textures/earth-day.jpg"),
        loadTexture("/textures/earth-night.jpg"),
        loadTexture("/textures/earth-normal.jpg"),
        loadTexture("/textures/earth-spec.jpg"),
      ]);
      if (cancelled) return;
      // If the day map is missing we are on the procedural fallback, where the
      // real normal/spec maps would not line up with the generated continents.
      const real = day !== null;
      setMaps({
        day: day ?? createEarthTexture(),
        night: real ? night : null,
        normal: real ? normal : null,
        spec: real ? spec : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sunPos = useSunPosition();

  const material = useMemo(() => {
    if (!maps) return null;
    return new ShaderMaterial({
      uniforms: {
        uDayMap: { value: maps.day },
        uNightMap: { value: maps.night ?? maps.day },
        uNormalMap: { value: maps.normal ?? maps.day },
        uSpecMap: { value: maps.spec ?? maps.day },
        uHasNight: { value: maps.night ? 1 : 0 },
        // Each map is independently optional: a failed fetch drops that one
        // effect and leaves the rest rendering exactly as before.
        uHasNormal: { value: maps.normal ? 1 : 0 },
        uHasSpec: { value: maps.spec ? 1 : 0 },
        uSunDir: { value: new Vector3(1, 0, 0) },
      },
      vertexShader: EARTH_VERTEX,
      fragmentShader: EARTH_FRAGMENT,
    });
  }, [maps]);

  useEffect(() => () => material?.dispose(), [material]);

  // Keep the sun direction uniform current (60s-quantized source)
  useEffect(() => {
    if (material && sunPos) {
      (material.uniforms.uSunDir.value as Vector3)
        .set(sunPos.eci[0], sunPos.eci[1], sunPos.eci[2])
        .normalize();
    }
  }, [material, sunPos]);

  if (!material) return null;

  return (
    // Geometry poles are on +Y; rotate so they align with scene +Z (ECI north)
    <mesh rotation-x={Math.PI / 2}>
      <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** Atmospheric glow using an additive-blended back-side shell. */
function EarthAtmosphere() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {},
        vertexShader: /* glsl */ `
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          void main() {
            vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          void main() {
            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            // BackSide: normals face away — glow strongest at the limb
            float intensity = pow(0.62 + dot(normalize(vWorldNormal), viewDir), 3.5);
            gl_FragColor = vec4(vec3(0.2, 0.47, 0.86) * intensity, intensity * 0.5);
          }
        `,
        side: BackSide,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  return (
    <mesh scale={[1.035, 1.035, 1.035]}>
      <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
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
        opacity={0.05}
        depthWrite={false}
        side={BackSide}
        wireframe
      />
    </mesh>
  );
}
