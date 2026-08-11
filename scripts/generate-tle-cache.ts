/**
 * generate-tle-cache.ts — Pre-cache TLE data at build time.
 *
 * Fetches the latest TLE sets from Celestrak for all configured groups
 * and writes them to a JSON cache file in public/tle-cache.json.
 *
 * This ensures the app has satellite data even if the Celestrak API
 * is unreachable at runtime, and reduces initial load time.
 *
 * Usage: npm run cache:tle
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { fetchAllTles, parseTleText } from "@/lib/tle-client";
import { TleSet, SatelliteGroup } from "@/types";
import { CELESTRAK_TLE_GROUPS } from "@/lib/constants";

/**
 * Mirror TLE sources used when Celestrak is unreachable (it blocks some
 * IP ranges). Both serve real, daily-updated elements, but only cover
 * stations, weather sats, and amateur satellites — no Starlink/GPS.
 */
const MIRROR_SOURCES = [
  "https://www.amsat.org/tle/current/nasabare.txt",
  "https://r4uab.ru/satonline.txt",
];

/** Best-effort constellation classification by satellite name. */
function classifyByName(name: string): SatelliteGroup {
  const n = name.toUpperCase();
  if (/ISS|ZARYA|TIANHE|TIANGONG|PROGRESS|SOYUZ|DRAGON|CYGNUS/.test(n)) return "STATIONS";
  if (n.includes("STARLINK")) return "STARLINK";
  if (n.includes("ONEWEB")) return "ONEWEB";
  if (/NAVSTAR|GPS/.test(n)) return "GPS-OPS";
  if (/GOES|EWS-G/.test(n)) return "GOES";
  if (/^SES[- ]/.test(n)) return "SES";
  if (n.includes("INTELSAT")) return "INTREPID";
  return "OTHER";
}

/** Fetch real TLEs from the mirror sources, deduped by NORAD ID. */
async function fetchMirrorTles(): Promise<TleSet[]> {
  const byNorad = new Map<string, TleSet>();

  for (const url of MIRROR_SOURCES) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = parseTleText(text, "OTHER");
      parsed.forEach((tle) => {
        if (!byNorad.has(tle.noradId)) {
          byNorad.set(tle.noradId, { ...tle, group: classifyByName(tle.name) });
        }
      });
      console.log(`  ↳ ${url}: ${parsed.length} TLEs`);
    } catch (err) {
      console.warn(`  ↳ ${url} failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  return [...byNorad.values()];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.resolve(__dirname, "../public/tle-cache.json");

interface TleCache {
  generatedAt: string;
  tleCount: number;
  groups: Record<string, { count: number; fetchedAt: string }>;
  tles: TleSet[];
}

async function main() {
  console.log("🛰️  Generating TLE cache...\n");

  let tles: TleSet[];
  try {
    tles = await fetchAllTles();
    console.log("  ↳ Celestrak: OK");
  } catch (err) {
    console.warn(`  ↳ Celestrak unreachable (${err instanceof Error ? err.message : err})`);
    console.log("  ↳ Falling back to mirror sources…");
    tles = await fetchMirrorTles();
  }

  if (tles.length === 0) {
    throw new Error(
      "No TLE source reachable — keeping the existing cache file untouched."
    );
  }

  // Group by constellation
  const groups: Record<string, { count: number; fetchedAt: string }> = {};
  tles.forEach((tle) => {
    const g = tle.group ?? "OTHER";
    if (!groups[g]) groups[g] = { count: 0, fetchedAt: new Date().toISOString() };
    groups[g].count++;
  });

  const cache: TleCache = {
    generatedAt: new Date().toISOString(),
    tleCount: tles.length,
    groups,
    tles,
  };

  // Ensure public/ directory exists
  const publicDir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");

  console.log(`✅ Cached ${tles.length} TLEs in ${CACHE_FILE}`);
  console.log("\nGroups:");
  Object.entries(groups).forEach(([group, info]) => {
    console.log(`  ${group}: ${info.count} satellites`);
  });
}

main().catch((err) => {
  console.error("Failed to generate TLE cache:", err);
  process.exit(1);
});
