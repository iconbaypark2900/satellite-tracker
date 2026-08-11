/**
 * download-textures.ts — Download NASA Earth observation textures.
 *
 * Fetches high-resolution Earth textures (day, night, bump, specular)
 * and an HDRI starfield from publicly available sources.
 *
 * References:
 * - NASA Blue Marble: https://visibleearth.nasa.gov/
 * - ESA Starfield: https://earth.esa.int/
 */

import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEXTURE_DIR = path.resolve(__dirname, "../public/textures");

// Use https-compatible protocol
const protocol = "https";

// Texture sources — verified reachable, public domain (NASA) / MIT (three.js)
const TEXTURES = [
  {
    name: "earth-day.jpg",
    url: "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg",
    description: "NASA Blue Marble NG — daytime color map (5400×2700)",
    required: true,
  },
  {
    name: "earth-night.jpg",
    url: "https://eoimages.gsfc.nasa.gov/images/imagerecords/55000/55167/earth_lights_lrg.jpg",
    description: "NASA Earth at Night — city lights",
    required: false,
  },
  {
    name: "earth-normal.jpg",
    url: "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r165/examples/textures/planets/earth_normal_2048.jpg",
    description: "Earth normal map (2K, three.js examples)",
    required: false,
  },
  {
    name: "earth-spec.jpg",
    url: "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r165/examples/textures/planets/earth_specular_2048.jpg",
    description: "Earth water specular map (2K, three.js examples)",
    required: false,
  },
];

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          // Follow redirect
          const redirectUrl = res.headers.location!;
          file.close();
          download(redirectUrl, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          reject(new Error(`Request Failed. Status Code: ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
        file.on("error", (err) => {
          file.close();
          fs.unlink(dest, () => reject(err));
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}

async function main() {
  if (!fs.existsSync(TEXTURE_DIR)) {
    fs.mkdirSync(TEXTURE_DIR, { recursive: true });
  }

  console.log("📥 Downloading Earth textures...\n");

  let missingRequired = false;

  for (const tex of TEXTURES) {
    const dest = path.join(TEXTURE_DIR, tex.name);

    // Skip files that already exist with real content
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      console.log(`  ✓ ${tex.name} already present, skipping`);
      continue;
    }

    console.log(`  → ${tex.description}`);
    console.log(`    ${tex.url} → ${dest}`);
    try {
      await download(tex.url, dest);
      const stats = fs.statSync(dest);
      if (stats.size === 0) throw new Error("Empty response");
      console.log(`    ✅ ${(stats.size / (1024 * 1024)).toFixed(1)} MB\n`);
    } catch (err) {
      console.warn(`    ⚠️  Failed: ${err instanceof Error ? err.message : err}\n`);
      // Never leave a partial/empty file — the app falls back to its
      // procedural texture when the file is absent
      fs.rmSync(dest, { force: true });
      if (tex.required) missingRequired = true;
    }
  }

  if (missingRequired) {
    console.error("❌ Required day texture missing — app will use the procedural fallback.");
    process.exit(1);
  }
  console.log("✅ Texture download complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
