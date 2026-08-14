/**
 * SatellitePicker.tsx — Choose up to N satellites for access planning.
 */

"use client";

import { useMemo, useState } from "react";
import { useSatelliteStore } from "@/lib/satellite-store";
import { getGroupColor } from "@/lib/color-utils";
import Icon from "@/components/ui/Icon";

const MAX_PICKED = 8;

interface Props {
  picked: string[];
  onChange: (noradIds: string[]) => void;
}

export default function SatellitePicker({ picked, onChange }: Props) {
  const satellites = useSatelliteStore((s) => s.satellites);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return [...satellites.values()]
      .filter(
        (s) =>
          !picked.includes(s.noradId) &&
          (s.name.toLowerCase().includes(q) || s.noradId.includes(q))
      )
      .slice(0, 6);
  }, [satellites, query, picked]);

  const toggle = (noradId: string) => {
    if (picked.includes(noradId)) {
      onChange(picked.filter((id) => id !== noradId));
    } else if (picked.length < MAX_PICKED) {
      onChange([...picked, noradId]);
      setQuery("");
    }
  };

  return (
    <div className="dp">
      <h2 style={{ color: "#4137ff", marginBottom: "0.4rem", fontSize: "0.8rem" }}>
        Satellites ({picked.length}/{MAX_PICKED})
      </h2>

      {/* Picked chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.4rem" }}>
        {picked.map((id) => {
          const sat = satellites.get(id);
          if (!sat) return null;
          const color = getGroupColor(sat.group);
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              title="Remove from plan"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                background: "rgba(20,20,35,0.6)",
                border: `1px solid ${color}`,
                borderRadius: "10px",
                padding: "0.1rem 0.5rem",
                fontSize: "0.65rem",
                color: "#e0e0ff",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: color,
                }}
              />
              {sat.name} <Icon name="close" />
            </button>
          );
        })}
        {picked.length === 0 && (
          <span style={{ fontSize: "0.65rem", color: "#6f6d69" }}>
            No satellites picked — search below.
          </span>
        )}
      </div>

      <input
        className="sb"
        style={{ marginBottom: 0 }}
        placeholder="Add satellite by name or NORAD ID…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={picked.length >= MAX_PICKED}
      />
      {matches.length > 0 && (
        <div style={{ marginTop: "0.2rem" }}>
          {matches.map((sat) => (
            <div key={sat.noradId} className="si" onClick={() => toggle(sat.noradId)}>
              <span
                className="dot"
                style={{ background: getGroupColor(sat.group) }}
              />
              {sat.name}
              <span style={{ color: "#6f6d69" }}>#{sat.noradId}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
