/**
 * SatelliteLabels.tsx — Render name labels for the selected and hovered
 * satellites.
 *
 * Positions update per frame via refs (no React re-render on time ticks);
 * drei's <Html> re-projects its parent transform every frame.
 */

"use client";

import { useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { propagateSatellite } from "@/lib/orbit-utils";
import { useSatelliteStore } from "@/lib/satellite-store";
import { TleSet, Satellite } from "@/types";
import { getGroupColor } from "@/lib/color-utils";

interface Props {
  tles: TleSet[];
  /** NORAD ID of the selected satellite. */
  selectedNorad: string | null;
  /** Satellites map for name + group resolution. */
  satellites: Map<string, Satellite>;
  /** Currently hovered satellite (NORAD ID or null). */
  hoveredNorad: string | null;
}

export default function SatelliteLabels({
  tles,
  selectedNorad,
  satellites,
  hoveredNorad,
}: Props) {
  const labels = useMemo(() => {
    const ids = new Set<string>();
    if (selectedNorad) ids.add(selectedNorad);
    if (hoveredNorad && hoveredNorad !== selectedNorad) ids.add(hoveredNorad);

    return tles
      .filter((tle) => ids.has(tle.noradId) && tle.line1 && tle.line2)
      .map((tle) => {
        const sat = satellites.get(tle.noradId);
        const group = sat?.group ?? tle.group ?? "OTHER";
        return {
          tle,
          noradId: tle.noradId,
          name: sat?.name ?? tle.name,
          color: getGroupColor(group),
        };
      });
  }, [tles, selectedNorad, hoveredNorad, satellites]);

  if (labels.length === 0) return null;

  return (
    <group>
      {labels.map((label) => (
        <SingleLabel key={label.noradId} {...label} />
      ))}
    </group>
  );
}

/** A single floating label that tracks its satellite every frame. */
function SingleLabel({
  tle,
  noradId,
  name,
  color,
}: {
  tle: TleSet;
  noradId: string;
  name: string;
  color: string;
}) {
  const groupRef = useRef<Group>(null!);

  useFrame(() => {
    if (!groupRef.current) return;
    const simTime = useSatelliteStore.getState().timeControl.simTime;
    const result = propagateSatellite(tle, simTime);
    if (result.isValid) {
      groupRef.current.position.set(
        result.position[0],
        result.position[1],
        result.position[2]
      );
    }
  });

  return (
    <group ref={groupRef}>
      <Html
        style={{
          pointerEvents: "none",
          userSelect: "none",
          transform: "translate(10px, -24px)",
        }}
      >
        <div
          className="satellite-label"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "2px 6px",
            background: "rgba(10, 10, 20, 0.85)",
            border: `1px solid ${color}`,
            borderRadius: "4px",
            fontSize: "0.65rem",
            fontFamily: "monospace",
            color: "#e0e0ff",
            whiteSpace: "nowrap",
            boxShadow: `0 0 8px ${color}`,
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              flexShrink: 0,
              background: color,
              boxShadow: `0 0 4px ${color}`,
            }}
          />
          <span style={{ fontWeight: 600, color }}>{name}</span>
          <span style={{ color: "#6f6d69", opacity: 0.7 }}>#{noradId}</span>
        </div>
      </Html>
    </group>
  );
}
