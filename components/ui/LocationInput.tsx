/**
 * LocationInput.tsx — Location picker for pass predictions.
 *
 * Supports:
 * - City search (via geocoding)
 * - Coordinate input (lat/lon/alt)
 * - Browser geolocation
 * - Quick-select from default locations
 */

"use client";

import { useState, useCallback } from "react";
import { useLocation } from "@/hooks/useLocation";
import { DEFAULT_LOCATIONS } from "@/lib/pass-calculator";
import { ObserverLocation } from "@/types";

export default function LocationInput() {
  const { observer, setLocation, requestGeolocation, setManualLocation } = useLocation();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ObserverLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Geocode a city name to coordinates using Nominatim
  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        {
          headers: { "User-Agent": "SatelliteTracker/1.0" },
        }
      );

      if (!resp.ok) throw new Error("Geocoding service unavailable");

      const data = await resp.json();
      setSearchResults(
        data.map((r: any) => ({
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon),
          alt: 0,
          label: r.display_name,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleGeolocate = async () => {
    try {
      await requestGeolocation();
      setError(null);
    } catch (err) {
      setError("Geolocation permission denied or unavailable");
    }
  };

  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");

  const handleManualSubmit = () => {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (!Number.isFinite(lat) || Math.abs(lat) > 90) {
      setError("Latitude must be between -90 and 90");
      return;
    }
    if (!Number.isFinite(lon) || Math.abs(lon) > 180) {
      setError("Longitude must be between -180 and 180");
      return;
    }
    setError(null);
    setManualLocation(lat, lon, 0, `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`);
    setManualLat("");
    setManualLon("");
  };

  return (
    <div className="dp">
      <h2 style={{ color: "#4137ff", marginBottom: "0.4rem", fontSize: "0.8rem" }}>
        Observer Location
      </h2>

      <p style={{ fontSize: "0.65rem", color: "#6f6d69", marginBottom: "0.5rem" }}>
        {observer.label} — {observer.lat.toFixed(2)}°, {observer.lon.toFixed(2)}°
      </p>

      {/* Search */}
      <input
        type="text"
        className="sb"
        placeholder="Search city…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          searchLocation(e.target.value);
        }}
      />

      {isSearching && <p style={{ fontSize: "0.65rem", color: "#6f6d69" }}>Searching…</p>}
      {error && <p style={{ fontSize: "0.65rem", color: "#ff80ab" }}>{error}</p>}

      {/* Search results */}
      {searchResults.length > 0 && (
        <div style={{ marginBottom: "0.5rem" }}>
          {searchResults.slice(0, 5).map((r) => (
            <div
              key={r.label}
              className="si"
              onClick={() => {
                setLocation(r);
                setSearch("");
                setSearchResults([]);
              }}
            >
              {r.label}
            </div>
          ))}
        </div>
      )}

      {/* Quick-select defaults */}
      <div style={{ fontSize: "0.65rem", color: "#6f6d69", marginBottom: "0.3rem" }}>
        Quick select:
      </div>
      {DEFAULT_LOCATIONS.map((loc) => (
        <div
          key={loc.label}
          className="si"
          style={{
            opacity: loc.label === observer.label ? 1 : 0.6,
          }}
          onClick={() => setLocation(loc)}
        >
          {loc.label}
        </div>
      ))}

      {/* Manual coordinates */}
      <div style={{ fontSize: "0.65rem", color: "#6f6d69", margin: "0.5rem 0 0.3rem" }}>
        Coordinates:
      </div>
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <input
          type="text"
          inputMode="decimal"
          className="sb"
          style={{ marginBottom: 0 }}
          placeholder="Lat (-90…90)"
          value={manualLat}
          onChange={(e) => setManualLat(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
        />
        <input
          type="text"
          inputMode="decimal"
          className="sb"
          style={{ marginBottom: 0 }}
          placeholder="Lon (-180…180)"
          value={manualLon}
          onChange={(e) => setManualLon(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
        />
        <button
          className="sb"
          style={{ width: "auto", marginBottom: 0, padding: "0.25rem 0.7rem" }}
          onClick={handleManualSubmit}
        >
          Set
        </button>
      </div>

      {/* Geolocation button */}
      <button
        className="sb"
        style={{ fontSize: "0.65rem", padding: "0.25rem 0.5rem", marginTop: "0.3rem" }}
        onClick={handleGeolocate}
      >
        📍 Use My Location
      </button>
    </div>
  );
}
