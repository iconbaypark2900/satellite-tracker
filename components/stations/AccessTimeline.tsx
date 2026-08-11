/**
 * AccessTimeline.tsx — SVG Gantt chart of access windows.
 *
 * Rows are station × satellite combinations; bars are passes colored by
 * constellation group; a red cursor marks "now". Clicking a bar selects
 * the satellite and jumps the simulation clock to the pass start.
 */

"use client";

import { useMemo } from "react";
import { AccessEvent } from "@/types";
import { getGroupColor } from "@/lib/color-utils";
import { useSatelliteStore } from "@/lib/satellite-store";

interface Props {
  events: AccessEvent[];
  startMs: number;
  hours: number;
}

const ROW_H = 26;
const LABEL_W = 190;
const AXIS_H = 22;

export default function AccessTimeline({ events, startMs, hours }: Props) {
  const satellites = useSatelliteStore((s) => s.satellites);
  const setSelectedSatellite = useSatelliteStore((s) => s.setSelectedSatellite);
  const setTimeOffset = useSatelliteStore((s) => s.setTimeOffset);

  const windowMs = hours * 3600_000;

  // Row per station×satellite that actually has events, stable order
  const rows = useMemo(() => {
    const keys = new Map<string, { label: string; events: AccessEvent[] }>();
    for (const ev of events) {
      const key = `${ev.stationId}|${ev.noradId}`;
      if (!keys.has(key)) {
        keys.set(key, {
          label: `${ev.stationName} · ${ev.satelliteName}`,
          events: [],
        });
      }
      keys.get(key)!.events.push(ev);
    }
    return [...keys.values()];
  }, [events]);

  const width = 900;
  const chartW = width - LABEL_W;
  const height = AXIS_H + rows.length * ROW_H + 6;

  const xFor = (t: number) =>
    LABEL_W + Math.max(0, Math.min(1, (t - startMs) / windowMs)) * chartW;

  // Hour ticks: every 6h for 24/48h windows
  const ticks = useMemo(() => {
    const out: Array<{ x: number; label: string }> = [];
    for (let h = 0; h <= hours; h += 6) {
      const t = startMs + h * 3600_000;
      out.push({
        x: xFor(t),
        label: new Date(t).toISOString().slice(11, 16) + "Z",
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMs, hours, rows.length]);

  const nowX = xFor(Date.now());

  if (rows.length === 0) {
    return (
      <p className="text-sm text-[#6f6d69] py-4">
        No access windows in this period for the selected satellites and
        stations.
      </p>
    );
  }

  const handleBarClick = (ev: AccessEvent) => {
    const sat = satellites.get(ev.noradId);
    if (sat) setSelectedSatellite(sat);
    setTimeOffset((ev.pass.startTime.getTime() - Date.now()) / 60000);
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        width={width}
        height={height}
        style={{ minWidth: width, display: "block" }}
        role="img"
        aria-label="Access window timeline"
      >
        {/* Axis */}
        {ticks.map((t) => (
          <g key={t.x}>
            <line
              x1={t.x}
              y1={AXIS_H - 4}
              x2={t.x}
              y2={height}
              stroke="rgba(120,130,180,0.15)"
            />
            <text
              x={t.x}
              y={AXIS_H - 8}
              fill="#6f6d69"
              fontSize={9}
              textAnchor="middle"
              fontFamily="monospace"
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* Rows */}
        {rows.map((row, i) => {
          const y = AXIS_H + i * ROW_H;
          return (
            <g key={row.label}>
              <line
                x1={LABEL_W}
                y1={y + ROW_H}
                x2={width}
                y2={y + ROW_H}
                stroke="rgba(120,130,180,0.08)"
              />
              <text
                x={LABEL_W - 8}
                y={y + ROW_H / 2 + 3}
                fill="#c0c0e0"
                fontSize={10}
                textAnchor="end"
                fontFamily="monospace"
              >
                {row.label.length > 30 ? row.label.slice(0, 29) + "…" : row.label}
              </text>

              {row.events.map((ev, j) => {
                const x1 = xFor(ev.pass.startTime.getTime());
                const x2 = xFor(ev.pass.endTime.getTime());
                const color = getGroupColor(ev.group);
                const title = `${ev.satelliteName} over ${ev.stationName}\n${ev.pass.startTime.toISOString().slice(11, 19)}Z → ${ev.pass.endTime.toISOString().slice(11, 19)}Z · max el ${ev.pass.maxElevation.toFixed(0)}°${ev.pass.isVisible ? " · visible" : ""}`;
                return (
                  <rect
                    key={j}
                    x={x1}
                    y={y + 5}
                    width={Math.max(2, x2 - x1)}
                    height={ROW_H - 10}
                    rx={2}
                    fill={color}
                    opacity={ev.pass.isVisible ? 1 : 0.55}
                    stroke={ev.pass.isVisible ? "#ffffff" : "none"}
                    strokeWidth={0.5}
                    style={{ cursor: "pointer" }}
                    onClick={() => handleBarClick(ev)}
                  >
                    <title>{title}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}

        {/* Now cursor */}
        {nowX > LABEL_W && nowX < width && (
          <line
            x1={nowX}
            y1={AXIS_H - 4}
            x2={nowX}
            y2={height}
            stroke="#ff5252"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
      </svg>
      <p className="text-xs text-[#6f6d69] mt-1">
        Solid bars = visually observable pass · dimmed = radio-only /
        daylight · click a bar to view it on the globe
      </p>
    </div>
  );
}
