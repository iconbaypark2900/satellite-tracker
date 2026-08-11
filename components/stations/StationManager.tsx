/**
 * StationManager.tsx — List, add, edit, and remove ground stations.
 */

"use client";

import { useState } from "react";
import { useGroundStations } from "@/hooks/useGroundStations";
import { useSatelliteStore } from "@/lib/satellite-store";

export default function StationManager() {
  const { stations, addGroundStation, updateGroundStation, removeGroundStation } =
    useGroundStations();
  const observer = useSatelliteStore((s) => s.observer);

  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [minEl, setMinEl] = useState("10");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const latN = parseFloat(lat);
    const lonN = parseFloat(lon);
    const minElN = parseFloat(minEl);
    if (!name.trim()) return setError("Station name required");
    if (!Number.isFinite(latN) || Math.abs(latN) > 90)
      return setError("Latitude must be -90…90");
    if (!Number.isFinite(lonN) || Math.abs(lonN) > 180)
      return setError("Longitude must be -180…180");
    if (!Number.isFinite(minElN) || minElN < 0 || minElN > 90)
      return setError("Min elevation must be 0…90");

    setError(null);
    addGroundStation({
      id: `st-${Date.now().toString(36)}`,
      name: name.trim(),
      lat: latN,
      lon: lonN,
      alt: 0,
      minElevation: minElN,
    });
    setName("");
    setLat("");
    setLon("");
  };

  const handleUseObserver = () => {
    setName(observer.label);
    setLat(observer.lat.toFixed(4));
    setLon(observer.lon.toFixed(4));
  };

  return (
    <div className="dp">
      <h2 style={{ color: "#4137ff", marginBottom: "0.4rem", fontSize: "0.8rem" }}>
        Ground Stations
      </h2>

      {stations.map((st) => (
        <div key={st.id} className="dr" style={{ alignItems: "center" }}>
          <span className="val" style={{ fontWeight: 600 }}>
            {st.name}
          </span>
          <span className="lab" style={{ fontSize: "0.62rem" }}>
            {st.lat.toFixed(2)}°, {st.lon.toFixed(2)}° · min&nbsp;
            <input
              type="number"
              min={0}
              max={90}
              value={st.minElevation}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v) && v >= 0 && v <= 90) {
                  updateGroundStation(st.id, { minElevation: v });
                }
              }}
              style={{
                width: "2.6rem",
                background: "#050510",
                border: "1px solid #222",
                borderRadius: "3px",
                color: "#e0e0ff",
                fontSize: "0.62rem",
                padding: "0 0.15rem",
              }}
            />
            °
            <button
              onClick={() => removeGroundStation(st.id)}
              title="Remove station"
              style={{
                marginLeft: "0.5rem",
                color: "#ff80ab",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "0.7rem",
              }}
            >
              ✕
            </button>
          </span>
        </div>
      ))}

      {/* Add station */}
      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
        <input
          className="sb"
          style={{ marginBottom: 0, flex: "1 1 8rem" }}
          placeholder="Station name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="sb"
          style={{ marginBottom: 0, width: "6rem", flex: "0 0 auto" }}
          placeholder="Lat"
          inputMode="decimal"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
        />
        <input
          className="sb"
          style={{ marginBottom: 0, width: "6rem", flex: "0 0 auto" }}
          placeholder="Lon"
          inputMode="decimal"
          value={lon}
          onChange={(e) => setLon(e.target.value)}
        />
        <input
          className="sb"
          style={{ marginBottom: 0, width: "5rem", flex: "0 0 auto" }}
          placeholder="Min el°"
          inputMode="decimal"
          value={minEl}
          onChange={(e) => setMinEl(e.target.value)}
        />
        <button
          className="sb"
          style={{ marginBottom: 0, width: "auto", padding: "0.25rem 0.8rem" }}
          onClick={handleAdd}
        >
          Add
        </button>
        <button
          className="sb"
          style={{ marginBottom: 0, width: "auto", padding: "0.25rem 0.6rem" }}
          onClick={handleUseObserver}
          title="Prefill from the current observer location"
        >
          📍 Use observer
        </button>
      </div>
      {error && (
        <p style={{ fontSize: "0.65rem", color: "#ff80ab", marginTop: "0.3rem" }}>{error}</p>
      )}
    </div>
  );
}
