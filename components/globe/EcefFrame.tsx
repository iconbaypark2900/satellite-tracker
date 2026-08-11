/**
 * EcefFrame.tsx — A group that rotates with the Earth.
 *
 * The scene is ECI (satellite positions come straight from SGP4), so
 * anything Earth-fixed — the textured globe, ground tracks — must spin
 * by GMST around the scene Z (polar) axis to stay geographically true.
 */

"use client";

import { ReactNode, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import * as satellite from "satellite.js";
import { useSatelliteStore } from "@/lib/satellite-store";

export default function EcefFrame({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null!);

  useFrame(() => {
    if (!ref.current) return;
    const simTime = useSatelliteStore.getState().timeControl.simTime;
    ref.current.rotation.z = satellite.gstime(simTime);
  });

  return <group ref={ref}>{children}</group>;
}
