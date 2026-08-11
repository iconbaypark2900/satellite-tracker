/**
 * Header.tsx — Top navigation bar.
 *
 * Displays the app title, connection status, time info, and
 * navigation links to the dashboard views (Globe, Sky, Passes).
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSatelliteStore, useSatellites } from "@/lib/satellite-store";
import { formatMinutes } from "@/lib/time-utils";
import { useSunPosition } from "@/hooks/useSunPosition";
import { useObserver } from "@/lib/satellite-store";
import { DEG_TO_RAD, RAD_TO_DEG, EARTH_RADIUS_KM } from "@/lib/constants";

const NAV_LINKS = [
  { href: "/globe", label: "🌍 Globe" },
  { href: "/sky", label: "🔭 Sky" },
  { href: "/passes", label: "📅 Passes" },
];

export default function Header() {
  const pathname = usePathname();
  const satellites = useSatellites();
  const { timeControl, isLoading, error, tleAge } = useSatelliteStore();
  const observer = useObserver();
  const sunPos = useSunPosition();

  // Compute sun elevation at observer location
  let sunElevation = 0;
  if (sunPos && observer) {
    // Sun direction in ECI → convert to topocentric (observer-centric)
    const obsLat = observer.lat * DEG_TO_RAD;
    const obsLon = observer.lon * DEG_TO_RAD;
    const lat = obsLat;
    const lon = obsLon;
    // Transform sun ECI direction to local horizon frame
    const sx = sunPos.eci[0];
    const sy = sunPos.eci[1];
    const sz = sunPos.eci[2];
    // Rotate by observer longitude (around Z) then latitude (around Y)
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const cosLon = Math.cos(lon);
    const sinLon = Math.sin(lon);
    // Convert ECI to local: first undo Earth rotation (not needed for direction only)
    // Approximate: project sun vector onto local horizon frame
    const east = -sx * sinLon + sy * cosLon;
    const north = -sx * cosLon * sinLat - sy * sinLon * sinLat + sz * cosLat;
    const up = sx * cosLon * cosLat + sy * sinLon * cosLat + sz * sinLat;
    const horizonDist = Math.sqrt(east * east + north * north + up * up);
    if (horizonDist > 0) {
      sunElevation = (Math.asin(up / horizonDist) * RAD_TO_DEG);
    }
  }

  const tleAgeMin = isFinite(tleAge) ? tleAge / 60 : 0;

  return (
    <header
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "3.5rem",
        padding: "0 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(10,10,20,0.85)",
        borderBottom: "1px solid #222",
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <h1 style={{ fontSize: "1.1rem", margin: 0 }}>
          <Link href="/globe" style={{ color: "#4137ff", textDecoration: "none" }}>
            🛰️ Satellite Tracker
          </Link>
        </h1>
        {error && (
          <span style={{ color: "#ff80ab", fontSize: "0.7rem" }}>
            ⚠️ {error}
          </span>
        )}
      </div>

      {/* View navigation */}
      <nav style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              style={{
                padding: "0.35rem 0.9rem",
                fontSize: "0.75rem",
                textDecoration: "none",
                color: active ? "#4a9eff" : "#6f6d69",
                borderBottom: active
                  ? "2px solid #4a9eff"
                  : "2px solid transparent",
                fontWeight: active ? 600 : 400,
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div
        id="sb-stats"
        suppressHydrationWarning={true}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          background: "rgba(15,15,25,0.7)",
          padding: "0.3rem 0.8rem",
          borderRadius: "5px",
          border: "1px solid #222",
          fontSize: "0.68rem",
          color: "#6f6d69",
        }}
      >
        <span>🛰️ <span style={{ color: "#4a9eff" }}>{satellites.size}</span> tracked</span>
        <span>🌞 Sun: <span style={{ color: "#4a9eff" }}>{Math.round(sunElevation)}°</span></span>
        <span>⏱️ <span style={{ color: "#4a9eff" }}>{formatMinutes(timeControl.offsetMinutes)}</span></span>
        <span>📡 TLE age: <span style={{ color: "#4a9eff" }}>{tleAgeMin.toFixed(1)}m</span></span>
        {isLoading && <span style={{ color: "#4a9eff" }}>⏳ Loading…</span>}
      </div>
    </header>
  );
}
