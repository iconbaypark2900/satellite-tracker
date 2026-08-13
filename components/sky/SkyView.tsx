/**
 * SkyView.tsx — Alt/az celestial view: the observer's sky as a
 * zenith-centered azimuthal equidistant polar plot.
 *
 * "Looking up" convention (matches Heavens-Above): North at top,
 * East on the LEFT — hold the screen overhead facing north and the
 * chart matches the sky. r = (90 − elevation)/90 · R.
 *
 * Plain 2D canvas: ~400 dots + a trail redrawn at 1Hz is a single cheap
 * repaint; no DOM churn, no 3D machinery.
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSatelliteStore } from "@/lib/satellite-store";
import { computeAzEl, sunAzEl } from "@/lib/pass-calculator";
import { getGroupColor } from "@/lib/color-utils";
import { Satellite } from "@/types";

/** Redraw cadence in sim-time (ms). */
const REDRAW_BUCKET_MS = 1000;
/** Click hit radius in CSS px. */
const HIT_RADIUS_PX = 12;
/** Trail length for the selected satellite. */
const TRAIL_MINUTES = 10;
const TRAIL_STEP_S = 30;

interface Hit {
  x: number;
  y: number;
  noradId: string;
}

export default function SkyView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitsRef = useRef<Hit[]>([]);

  const satellites = useSatelliteStore((s) => s.satellites);
  const filters = useSatelliteStore((s) => s.constellationFilters);
  const observer = useSatelliteStore((s) => s.observer);
  const selectedNorad = useSatelliteStore(
    (s) => s.selectedSatellite?.noradId ?? null
  );
  const setSelectedSatellite = useSatelliteStore((s) => s.setSelectedSatellite);
  // 1Hz redraw trigger tied to sim time (also fires on time-warp jumps)
  const tick = useSatelliteStore((s) =>
    Math.floor(s.timeControl.simTime.getTime() / REDRAW_BUCKET_MS)
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w === 0 || h === 0) return;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) / 2 - 28;
    if (R <= 0) return;

    const simTime = useSatelliteStore.getState().timeControl.simTime;

    const project = (azDeg: number, elDeg: number): [number, number] => {
      const r = ((90 - elDeg) / 90) * R;
      const az = (azDeg * Math.PI) / 180;
      return [cx - r * Math.sin(az), cy - r * Math.cos(az)];
    };

    // ── Sky background tinted by sun altitude ── //
    const sun = sunAzEl(simTime, observer);
    const skyColor =
      sun.elevation > 0
        ? "#0d2f5c"
        : sun.elevation > -6
          ? "#0a1f40"
          : sun.elevation > -18
            ? "#071228"
            : "#04070f";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = skyColor;
    ctx.fill();

    // ── Elevation circles + crosshair ── //
    ctx.strokeStyle = "rgba(120, 130, 180, 0.25)";
    ctx.setLineDash([4, 6]);
    for (const el of [30, 60]) {
      ctx.beginPath();
      ctx.arc(cx, cy, ((90 - el) / 90) * R, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R);
    ctx.lineTo(cx, cy + R);
    ctx.strokeStyle = "rgba(120, 130, 180, 0.12)";
    ctx.stroke();

    // Horizon ring
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(160, 170, 220, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineWidth = 1;

    // Compass labels (E left — looking-up convention)
    ctx.font = "600 12px monospace";
    ctx.fillStyle = "#8890c0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", cx, cy - R - 14);
    ctx.fillText("S", cx, cy + R + 14);
    ctx.fillText("E", cx - R - 14, cy);
    ctx.fillText("W", cx + R + 14, cy);

    // ── Sun disc ── //
    if (sun.elevation > -1) {
      const [sx, sy] = project(sun.azimuth, Math.max(sun.elevation, 0));
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 14);
      glow.addColorStop(0, "rgba(255, 220, 130, 0.95)");
      glow.addColorStop(1, "rgba(255, 220, 130, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd970";
      ctx.fill();
    }

    // ── Satellites ── //
    const hits: Hit[] = [];
    const above: Array<{ sat: Satellite; az: number; el: number }> = [];

    satellites.forEach((sat) => {
      if (!sat.tle) return;
      if (filters[sat.group as string] === false) return;
      const look = computeAzEl(sat.tle, simTime, observer);
      // Apparent, not geometric: this view is a picture of where to point, and
      // refraction lifts an object ~0.09 degrees at 10 and ~0.48 at the
      // horizon. The visibility test uses the apparent value too, so an object
      // refraction has lifted into view is drawn rather than culled.
      if (!look || look.apparentElevation <= 0) return;
      above.push({ sat, az: look.azimuth, el: look.apparentElevation });
    });

    // Trail for the selected satellite (next TRAIL_MINUTES)
    const selected = above.find((a) => a.sat.noradId === selectedNorad);
    const selectedSat =
      selected?.sat ??
      (selectedNorad ? satellites.get(selectedNorad) ?? null : null);
    if (selectedSat?.tle) {
      ctx.beginPath();
      let started = false;
      for (let s = 0; s <= TRAIL_MINUTES * 60; s += TRAIL_STEP_S) {
        const t = new Date(simTime.getTime() + s * 1000);
        const look = computeAzEl(selectedSat.tle, t, observer);
        if (!look || look.apparentElevation <= 0) {
          started = false;
          continue;
        }
        const [x, y] = project(look.azimuth, look.apparentElevation);
        if (started) {
          ctx.lineTo(x, y);
        } else {
          ctx.moveTo(x, y);
          started = true;
        }
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Dots
    for (const { sat, az, el } of above) {
      const [x, y] = project(az, el);
      const isSelected = sat.noradId === selectedNorad;
      const color = getGroupColor(sat.group);

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      hits.push({ x, y, noradId: sat.noradId });
    }

    // Labels: selected + 5 highest-elevation satellites
    const labeled = new Set<string>();
    if (selectedNorad) labeled.add(selectedNorad);
    [...above]
      .sort((a, b) => b.el - a.el)
      .slice(0, 5)
      .forEach((a) => labeled.add(a.sat.noradId));

    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    for (const { sat, az, el } of above) {
      if (!labeled.has(sat.noradId)) continue;
      const [x, y] = project(az, el);
      ctx.fillStyle =
        sat.noradId === selectedNorad ? "#ffffff" : "rgba(200, 205, 240, 0.75)";
      ctx.fillText(sat.name, x + 8, y - 6);
    }

    // Overhead count
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#6f6d69";
    ctx.fillText(`${above.length} above horizon`, 10, h - 12);

    hitsRef.current = hits;
  }, [satellites, filters, observer, selectedNorad]);

  // Redraw on sim-time tick and whenever inputs change
  useEffect(() => {
    draw();
  }, [draw, tick]);

  // Redraw on container resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    let best: Hit | null = null;
    let bestDistSq = HIT_RADIUS_PX * HIT_RADIUS_PX;
    for (const hit of hitsRef.current) {
      const dx = hit.x - px;
      const dy = hit.y - py;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = hit;
      }
    }

    setSelectedSatellite(best ? satellites.get(best.noradId) ?? null : null);
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{ display: "block", cursor: "crosshair" }}
      aria-label="Sky view: satellites by altitude and azimuth"
    />
  );
}
