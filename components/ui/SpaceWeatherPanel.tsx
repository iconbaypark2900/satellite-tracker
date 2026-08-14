/**
 * SpaceWeatherPanel.tsx — Compact live NOAA SWPC space-weather readout.
 *
 * Kp index (with NOAA G-storm scale), solar wind speed, IMF Bz, and
 * GOES X-ray flare class. Refreshes every 5 minutes via /api/spaceweather.
 * Renders a muted "unavailable" row if SWPC can't be reached.
 */

"use client";

import useSWR from "swr";
import {
  SpaceWeatherSummary,
  kpToGScale,
  kpColor,
  isBzSouthwardWarning,
} from "@/lib/space-weather";
import Icon from "@/components/ui/Icon";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

export default function SpaceWeatherPanel() {
  const { data, error } = useSWR<SpaceWeatherSummary>(
    "/api/spaceweather",
    fetcher,
    {
      refreshInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.68rem",
    padding: "0.1rem 0",
  };

  if (error || (data && !data.kp && !data.solarWind && !data.imf && !data.xray)) {
    return (
      <div style={{ padding: "0.5rem 0.7rem" }}>
        <SectionTitle />
        <p style={{ fontSize: "0.62rem", color: "#6f6d69" }}>
          NOAA SWPC unavailable
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: "0.5rem 0.7rem" }}>
        <SectionTitle />
        <p style={{ fontSize: "0.62rem", color: "#6f6d69" }}>Loading…</p>
      </div>
    );
  }

  const gScale = kpToGScale(data.kp?.max3h ?? data.kp?.value);
  const storm = (data.kp?.value ?? 0) >= 5;
  const bzWarn = isBzSouthwardWarning(data.imf?.bzGsmNt);
  const updated = data.kp?.timeTag
    ? new Date(data.kp.timeTag + (data.kp.timeTag.endsWith("Z") ? "" : "Z"))
    : null;

  return (
    <div style={{ padding: "0.5rem 0.7rem" }}>
      <SectionTitle />

      {data.kp && (
        <div style={rowStyle}>
          <span className="lab">Kp index</span>
          <span style={{ color: kpColor(data.kp.value), fontWeight: 600 }}>
            {data.kp.value.toFixed(1)}
            {gScale && (
              <span
                style={{
                  marginLeft: "0.4rem",
                  padding: "0 0.3rem",
                  borderRadius: "3px",
                  background: kpColor(data.kp.max3h),
                  color: "#05051a",
                  fontSize: "0.6rem",
                }}
              >
                {gScale}
              </span>
            )}
          </span>
        </div>
      )}

      {data.solarWind && (
        <div style={rowStyle}>
          <span className="lab">Solar wind</span>
          <span className="val">{Math.round(data.solarWind.speedKmS)} km/s</span>
        </div>
      )}

      {data.imf && (
        <div style={rowStyle}>
          <span className="lab">IMF Bz</span>
          <span
            className="val"
            style={bzWarn ? { color: "#ffa726" } : undefined}
            title={bzWarn ? "Southward Bz — geoeffective coupling" : undefined}
          >
            {data.imf.bzGsmNt > 0 ? "+" : ""}
            {data.imf.bzGsmNt.toFixed(1)} nT
            {bzWarn ? <Icon name="alert" style={{ marginLeft: "0.25rem" }} /> : null}
          </span>
        </div>
      )}

      {data.xray?.class && (
        <div style={rowStyle}>
          <span className="lab">X-ray flux</span>
          <span className="val">{data.xray.class}</span>
        </div>
      )}

      {storm && (
        <p style={{ fontSize: "0.6rem", color: "#ffa726", marginTop: "0.2rem" }}>
          <Icon name="alert" /> Geomagnetic storm — increased LEO drag; TLE accuracy degrades
          faster than usual.
        </p>
      )}

      <p style={{ fontSize: "0.55rem", color: "#6f6d69", marginTop: "0.25rem" }}>
        NOAA SWPC
        {updated && !Number.isNaN(updated.getTime())
          ? ` · updated ${updated.toISOString().slice(11, 16)} UTC`
          : ""}
      </p>
    </div>
  );
}

function SectionTitle() {
  return (
    <h3
      style={{
        fontSize: "0.65rem",
        color: "#4a9eff",
        fontWeight: 600,
        marginBottom: "0.15rem",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
        <Icon name="sun" />
        Space Weather
      </span>
    </h3>
  );
}
