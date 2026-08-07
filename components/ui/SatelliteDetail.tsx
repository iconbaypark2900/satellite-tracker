/**
 * SatelliteDetail.tsx — Detailed metadata panel for the selected satellite.
 *
 * Shows orbit parameters, operator info, and computed values (velocity,
 * orbit type, apogee/perigee). Hidden when no satellite is selected.
 */

"use client";

import { useSatelliteStore } from "@/lib/satellite-store";
import { Satellite } from "@/types";
import { orbitalVelocity, orbitType } from "@/lib/orbit-utils";

export default function SatelliteDetail() {
  const { selectedSatellite, setSelectedSatellite } = useSatelliteStore();

  if (!selectedSatellite) {
    return (
      <div className="dp">
        <h2 style={{ color: "#4137ff", marginBottom: "0.4rem", fontSize: "0.8rem" }}>
          Selected Satellite
        </h2>
        <p
          id="sh"
          style={{
            color: "#6f6d69",
            fontSize: "0.68px",
            textAlign: "center",
            paddingTop: "0.3rem",
          }}
        >
          🔍 Click a satellite to view details
        </p>
      </div>
    );
  }

  const sat = selectedSatellite;
  const vel = orbitalVelocity(sat.altitude);
  const oType = orbitType(sat.altitude, sat.inclination);

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
      <h2 style={{ color: "#4137ff", marginBottom: "0.4rem", fontSize: "0.8rem" }}>
        Selected Satellite
      </h2>

      <div id="sm" style={{ display: "block" }}>
        {fields.map((f) => (
          <div key={f.label} className="dr">
            <span className="lab">{f.label}</span>
            <span className="val" id={`n${fields.indexOf(f) + 1}`}>{f.value}</span>
          </div>
        ))}
      </div>

      <p
        style={{ color: "#6f6d69", fontSize: "0.65rem", marginTop: "0.3rem" }}
        onClick={() => setSelectedSatellite(null)}
      >
        ✕ Clear selection
      </p>
    </div>
  );
}
