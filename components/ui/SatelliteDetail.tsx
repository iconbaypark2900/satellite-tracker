/**
 * SatelliteDetail.tsx — Detailed metadata panel for the selected satellite.
 *
 * Shows orbit parameters, operator info, and computed values (velocity,
 * orbit type, apogee/perigee). Shows a placeholder when no satellite is selected.
 */

"use client";

import { useSatelliteStore } from "@/lib/satellite-store";
import { Satellite } from "@/types";
import { orbitalVelocity, orbitType } from "@/lib/orbit-utils";
import { GROUP_COLORS } from "@/lib/constants";

export default function SatelliteDetail() {
  const { selectedSatellite, setSelectedSatellite } = useSatelliteStore();

  if (!selectedSatellite) {
    return (
      <div className="dp">
        <h2 className="text-primary mb-1 text-xs font-semibold">
          Selected Satellite
        </h2>
        <p className="text-text-muted text-center py-3 text-xs">
          🔍 Click a satellite or its orbit path to view details
        </p>
      </div>
    );
  }

  const sat = selectedSatellite;
  const vel = orbitalVelocity(sat.altitude);
  const oType = orbitType(sat.altitude, sat.inclination);
  const color = GROUP_COLORS[sat.group] ?? GROUP_COLORS.OTHER;

  const fields = [
    { label: "Name", value: sat.name },
    { label: "Operator", value: sat.operator?.name ?? "—" },
    { label: "Type", value: sat.type },
    { label: "NORAD ID", value: sat.noradId },
    { label: "Launch", value: sat.launchDate ?? "—" },
    { label: "Country", value: sat.operator?.country ?? "—" },
    { label: "Orbit", value: oType },
    { label: "Period", value: `${sat.period.toFixed(1)} min` },
    { label: "Inclination", value: `${sat.inclination}°` },
    { label: "Altitude", value: `${sat.altitude} km` },
    { label: "Velocity", value: `${vel.toFixed(2)} km/s` },
    { label: "Apogee", value: `${sat.apogee} km` },
    { label: "Perigee", value: `${sat.perigee} km` },
  ];

  return (
    <div className="dp">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{
            background: color,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
        <h2 className="text-primary text-xs font-semibold">
          Selected Satellite
        </h2>
      </div>

      <div className="space-y-0.5">
        {fields.map((f) => (
          <div key={f.label} className="dr">
            <span className="lab">{f.label}</span>
            <span className="val">{f.value}</span>
          </div>
        ))}
      </div>

      <p
        className="text-text-muted text-xs mt-1 cursor-pointer hover:text-primary transition-colors"
        onClick={() => setSelectedSatellite(null)}
      >
        ✕ Clear selection
      </p>
    </div>
  );
}
