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
import { fetchAllTles } from "@/lib/tle-client";
import { TleSet, SatelliteGroup } from "@/types";
import { CELESTRAK_TLE_GROUPS } from "@/lib/constants";

const CACHE_FILE = path.resolve(__dirname, "../public/tle-cache.json");

interface TleCache {
  generatedAt: string;
  tleCount: number;
  groups: Record<string, { count: number; fetchedAt: string }>;
  tles: TleSet[];
}

async function main() {
  console.log("🛰️  Generating TLE cache...\n");

  const tles = await fetchAllTles();

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
