/**
 * Earth shader — every texture that is downloaded must actually be sampled.
 *
 * This test exists because of a bug that was invisible by inspection:
 * `scripts/download-textures.ts` fetched four maps, the build shipped all four,
 * and the shader sampled two. `earth-normal.jpg` and `earth-spec.jpg` were
 * downloaded on every install and never read, so the Earth had no surface
 * relief and no ocean glint while appearing, in code review, to have both.
 *
 * The related silent failure is a uniform name mismatch: three.js simply does
 * not find a uniform whose GLSL name differs from its JS key, and the effect
 * quietly does nothing. Both are checked here by parsing the shader source.
 */
import fs from "node:fs";
import path from "node:path";

const SRC = fs.readFileSync(
  path.join(process.cwd(), "components/globe/Earth.tsx"),
  "utf8"
);

const fragment = /const EARTH_FRAGMENT = \/\* glsl \*\/ `([\s\S]*?)`;/.exec(SRC)?.[1] ?? "";
const declared = new Set([...fragment.matchAll(/uniform \w+ (\w+);/g)].map((m) => m[1]));
const sampled = new Set([...fragment.matchAll(/texture2D\((\w+),/g)].map((m) => m[1]));
const provided = new Set([...SRC.matchAll(/^\s*(u[A-Z]\w*):\s*\{/gm)].map((m) => m[1]));
const loaded = [...SRC.matchAll(/loadTexture\("\/textures\/([\w.-]+)"\)/g)].map((m) => m[1]);

describe("Earth shader wiring", () => {
  it("parses a fragment shader out of the component", () => {
    expect(fragment.length).toBeGreaterThan(0);
    expect(declared.size).toBeGreaterThan(0);
  });

  it("samples every texture the component downloads", () => {
    // The four maps download-textures.ts fetches.
    expect(loaded).toEqual(
      expect.arrayContaining([
        "earth-day.jpg",
        "earth-night.jpg",
        "earth-normal.jpg",
        "earth-spec.jpg",
      ])
    );
    // One sampler actually read per map.
    expect(sampled.size).toBe(loaded.length);
  });

  it("declares no sampler it never reads", () => {
    const samplers = [...declared].filter((u) => u.endsWith("Map"));
    const unread = samplers.filter((u) => !sampled.has(u));
    expect(unread).toEqual([]);
  });

  it("keeps GLSL uniform names and JS uniform keys in step", () => {
    // A name present on one side only is a silent no-op, not an error.
    expect([...declared].filter((u) => !provided.has(u))).toEqual([]);
    expect([...provided].filter((u) => !declared.has(u))).toEqual([]);
  });

  it("guards every optional map behind its own flag", () => {
    // A failed fetch must drop only that effect, not break the render.
    for (const flag of ["uHasNight", "uHasNormal", "uHasSpec"]) {
      expect(declared.has(flag)).toBe(true);
      expect(fragment).toContain(`${flag} > 0.5`);
    }
  });

  it("masks the specular highlight so only water glints", () => {
    // An unmasked highlight sliding across continents is the classic tell.
    const specBlock = /uHasSpec > 0\.5\)[\s\S]*?\n  \}/.exec(fragment)?.[0] ?? "";
    expect(specBlock).toContain("uSpecMap");
    expect(specBlock).toMatch(/water/);
  });
});

describe("Earth shader frame conventions", () => {
  it("builds the tangent basis around the world-space polar axis", () => {
    // vWorldNormal is world-space and the mesh carries rotation-x = PI/2, so
    // the geometry's +Y pole lands on world +Z. A basis built around +Y is 90
    // degrees off and applies the normal map sideways — it still renders, so
    // nothing complains. This caught exactly that, in the first draft.
    const tbn = /mat3 sphereTBN[\s\S]*?\n  \}/.exec(fragment)?.[0] ?? "";
    expect(tbn).toContain("vec3 polar = vec3(0.0, 0.0, 1.0)");
    expect(tbn).not.toContain("vec3 polar = vec3(0.0, 1.0, 0.0)");
  });

  it("keeps the mesh rotation that convention depends on", () => {
    // If this rotation ever changes, the polar axis above changes with it.
    expect(SRC).toContain("rotation-x={Math.PI / 2}");
  });

  it("perturbs only the lighting normal, not the terminator", () => {
    // The day/night line and the fresnel rim must use the geometric normal, or
    // mountains punch holes in the terminator.
    expect(fragment).toMatch(/float k = smoothstep\([^)]*dot\(n, uSunDir\)\)/);
    expect(fragment).toMatch(/rim = pow\(1\.0 - max\(dot\(n, viewDir\)/);
  });
});
