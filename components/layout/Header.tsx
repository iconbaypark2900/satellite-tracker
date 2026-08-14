/**
 * Header.tsx — Top navigation bar and instrument status strip.
 *
 * The status cluster used to read "396 tracked · Sun: -18° · 0m · TLE age:
 * 89.8m" — four bare numbers with nothing to say what they meant or when to
 * care. Each reading now carries the interpretation alongside the figure:
 *
 *   Elements  — how stale the orbital data is AND where it came from. SGP4
 *               error grows with epoch age, and the app silently falls back
 *               to amateur mirrors when Celestrak is blocked, so provenance
 *               belongs on screen rather than in a console log.
 *   Sun       — the elevation named as its twilight band, because that band
 *               is what decides whether anything is visible from the ground.
 *   Frame rate— the globe propagates a few hundred objects; whether the
 *               renderer is keeping up is operational, not a debug detail.
 *
 * Readings degrade by priority as the viewport narrows rather than wrapping
 * into the nav.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSatelliteStore, useSatellites } from "@/lib/satellite-store";
import { formatMinutes } from "@/lib/time-utils";
import { useSunPosition } from "@/hooks/useSunPosition";
import { useObserver } from "@/lib/satellite-store";
import { DEG_TO_RAD, RAD_TO_DEG } from "@/lib/constants";
import { twilightPhase } from "@/lib/sun-position";
import Icon, { IconName } from "@/components/ui/Icon";

const NAV_LINKS: { href: string; label: string; icon: IconName; hint: string }[] = [
  { href: "/globe", label: "Globe", icon: "globe", hint: "3D view of every tracked object in real time" },
  { href: "/sky", label: "Sky", icon: "stars", hint: "What is overhead right now, in altitude and azimuth" },
  { href: "/passes", label: "Passes", icon: "calendar", hint: "Rise and set times for the selected satellite" },
  { href: "/stations", label: "Stations", icon: "signal", hint: "Access windows across multiple ground stations" },
  { href: "/conjunctions", label: "Conjunctions", icon: "alert", hint: "Screen the catalogue for close approaches" },
];

/** How the element set reached us, and whether that is worth flagging. */
function describeSource(source: string | null): { label: string; detail: string; degraded: boolean } {
  switch (source) {
    case "live":
      return { label: "live", detail: "Fetched directly from Celestrak just now.", degraded: false };
    case "cache":
      return {
        label: "cached",
        detail: "Served from the bundled element snapshot, which is still within its freshness window.",
        degraded: false,
      };
    case "cache-stale":
      return {
        label: "stale cache",
        detail: "Celestrak could not be reached, so these elements are the last snapshot taken. Positions drift roughly 1–3 km per day past epoch.",
        degraded: true,
      };
    default:
      return { label: "unknown", detail: "Source of the current element set is not recorded.", degraded: true };
  }
}

export default function Header() {
  const pathname = usePathname();
  const satellites = useSatellites();
  const { timeControl, isLoading, error, tleAge, tleSource, renderFps } = useSatelliteStore();
  const observer = useObserver();
  const sunPos = useSunPosition();

  // Sun elevation at the observer's location
  let sunElevation = 0;
  if (sunPos && observer) {
    const lat = observer.lat * DEG_TO_RAD;
    const lon = observer.lon * DEG_TO_RAD;
    const [sx, sy, sz] = sunPos.eci;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const cosLon = Math.cos(lon);
    const sinLon = Math.sin(lon);
    const east = -sx * sinLon + sy * cosLon;
    const north = -sx * cosLon * sinLat - sy * sinLon * sinLat + sz * cosLat;
    const up = sx * cosLon * cosLat + sy * sinLon * cosLat + sz * sinLat;
    const mag = Math.sqrt(east * east + north * north + up * up);
    if (mag > 0) sunElevation = Math.asin(up / mag) * RAD_TO_DEG;
  }

  const twilight = twilightPhase(sunElevation);
  const source = describeSource(tleSource);
  const ageMinutes = isFinite(tleAge) ? tleAge / 60 : null;
  const offset = timeControl.offsetMinutes;

  return (
    <header className="absolute inset-x-0 top-0 z-[100] flex h-14 items-center justify-between gap-5 border-b border-space-border bg-[rgba(10,10,20,0.85)] px-4 backdrop-blur-sm xl:gap-8 xl:px-6">
      {/* Identity */}
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="m-0 text-base">
          <Link
            href="/globe"
            className="flex items-center gap-2 text-primary no-underline transition-colors hover:text-satellite-blue"
          >
            <Icon name="satellite" size={18} />
            <span className="whitespace-nowrap font-semibold">Satellite Tracker</span>
          </Link>
        </h1>
        {error && (
          <span className="flex items-center gap-1 truncate text-xs text-satellite-pink" title={error}>
            <Icon name="alert" />
            {error}
          </span>
        )}
      </div>

      {/* Views */}
      <nav className="flex shrink-0 items-center gap-1 xl:gap-2">
        {NAV_LINKS.map(({ href, label, icon, hint }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={hint}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-t border-b-2 px-2.5 py-1.5 text-xs no-underline transition-colors hover:bg-white/5 xl:px-3.5 ${
                active
                  ? "border-satellite-blue font-semibold text-satellite-blue"
                  : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              <Icon name={icon} />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Instrument readings */}
      <div
        id="sb-stats"
        suppressHydrationWarning
        className="flex min-w-0 items-center gap-2.5 rounded border border-space-border bg-[rgba(15,15,25,0.7)] px-2.5 py-1 xl:gap-3.5 xl:px-3"
      >
        <Reading
          icon="satellite"
          value={String(satellites.size)}
          unit="objects"
          title="Objects currently propagated from the loaded element set."
        />

        <Reading
          icon="signal"
          value={ageMinutes === null ? "—" : formatAge(ageMinutes)}
          unit={source.label}
          tone={source.degraded ? "warn" : ageMinutes !== null && ageMinutes > 60 * 24 ? "warn" : "normal"}
          className="hidden md:flex"
          title={`Element set age. ${source.detail} SGP4 accuracy degrades roughly 1–3 km per day past the TLE epoch.`}
        />

        <Reading
          icon={twilight.satellitesVisible ? "eye" : "sun"}
          value={`${Math.round(sunElevation)}°`}
          unit={twilight.name}
          tone={twilight.satellitesVisible ? "good" : "normal"}
          className="hidden lg:flex"
          title={`Sun elevation at ${observer?.label ?? "the observer"}: ${sunElevation.toFixed(1)}°. ${twilight.note}`}
        />

        {offset !== 0 && (
          <Reading
            icon="clock"
            value={formatMinutes(offset)}
            unit="offset"
            tone="warn"
            title="Simulation time is offset from now. Positions shown are propagated, not observed."
          />
        )}

        {renderFps > 0 && (
          <Reading
            icon="bolt"
            value={String(renderFps)}
            unit="fps"
            tone={renderFps < 20 ? "warn" : "normal"}
            className="hidden xl:flex"
            title="Render frame rate. Below about 20 the globe will feel unresponsive while scrubbing time."
          />
        )}

        {isLoading && (
          <span className="flex items-center gap-1.5 text-xs text-satellite-blue">
            <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-satellite-blue border-t-transparent" />
            <span className="hidden sm:inline">Loading…</span>
          </span>
        )}
      </div>
    </header>
  );
}

/** Minutes as the largest sensible unit — "89.8m" is harder to read than "1.5h". */
function formatAge(minutes: number): string {
  if (minutes < 90) return `${Math.round(minutes)}m`;
  if (minutes < 60 * 48) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 1440).toFixed(1)}d`;
}

/**
 * One reading: icon, figure, and the unit or interpretation beneath it.
 * The unit is what turns a number into a statement — "1.5h cached" says
 * something "89.8m" does not.
 */
function Reading({
  icon,
  value,
  unit,
  title,
  tone = "normal",
  className = "",
}: {
  icon: IconName;
  value: string;
  unit: string;
  title: string;
  tone?: "normal" | "good" | "warn";
  className?: string;
}) {
  const valueTone =
    tone === "warn"
      ? "text-satellite-orange"
      : tone === "good"
        ? "text-satellite-green"
        : "text-satellite-blue";

  return (
    <span
      className={`flex items-center gap-1.5 text-text-muted ${className}`}
      title={title}
    >
      <Icon name={icon} />
      <span className="flex items-baseline gap-1 whitespace-nowrap">
        <span className={`font-mono text-xs font-semibold ${valueTone}`}>{value}</span>
        <span className="text-[0.65rem] text-text-muted">{unit}</span>
      </span>
    </span>
  );
}
