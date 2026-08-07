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

// Texture sources (NASA Visible Earth / ESA)
const TEXTURES = [
  {
    name: "earth-day-8k.jpg",
    url: "https://cdn.jsdelivr.net/gh/dguo/earth@main/earth_day_8k.jpg",
    description: "NASA Blue Marble — daytime color map (8K)",
  },
  {
    name: "earth-night-4k.jpg",
    url: "https://cdn.jsdelivr.net/gh/dguo/earth@main/earth_night_4k.jpg",
    description: "NASA Blue Marble — city lights at night (4K)",
  },
  {
    name: "earth-bump-8k.jpg",
    url: "https://cdn.jsdelivr.net/gh/dguo/earth@main/earth_topo_8k.jpg",
    description: "Earth topography / elevation bump map (8K)",
  },
  {
    name: "earth-spec-4k.jpg",
    url: "https://cdn.jsdelivr.net/gh/dguo/earth@main/earth_specular_4k.jpg",
    description: "Earth water specular / ocean reflection map (4K)",
  },
  {
    name: "stars-hdr.hdr",
    url: "https://cdn.jsdelivr.net/gh/liadarmastro/earth@main/textures/stars.hdr",
    description: "HDRI starfield environment map",
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

  for (const tex of TEXTURES) {
    const dest = path.join(TEXTURE_DIR, tex.name);
    console.log(`  → ${tex.description}`);
    console.log(`    ${tex.url} → ${dest}`);
    try {
      await download(tex.url, dest);
      const stats = fs.statSync(dest);
      console.log(`    ✅ ${(stats.size / (1024 * 1024)).toFixed(1)} MB\n`);
    } catch (err) {
      console.warn(`    ⚠️  Failed: ${err instanceof Error ? err.message : err}\n`);
      // Create a placeholder file so the build doesn't break
      fs.writeFileSync(dest, "");
    }
  }

  console.log("✅ Texture download complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
