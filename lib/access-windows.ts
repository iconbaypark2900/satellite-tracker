/**
 * access-windows.ts — Compute satellite access windows over ground
 * stations. Thin, pure composition over predictPasses.
 */

import { predictPasses } from "@/lib/pass-calculator";
import { Satellite, GroundStation, AccessEvent } from "@/types";

/**
 * Compute all access windows for every station × satellite combination.
 * Each station's own minimum elevation is applied.
 */
export function computeAccessWindows(
  satellites: Satellite[],
  stations: GroundStation[],
  startTime: Date,
  hours: number
): AccessEvent[] {
  const events: AccessEvent[] = [];

  for (const station of stations) {
    const observer = {
      lat: station.lat,
      lon: station.lon,
      alt: station.alt,
      label: station.name,
    };
    for (const sat of satellites) {
      if (!sat.tle) continue;
      const passes = predictPasses(
        sat.tle,
        observer,
        startTime,
        hours,
        station.minElevation
      );
      for (const pass of passes) {
        events.push({
          stationId: station.id,
          stationName: station.name,
          noradId: sat.noradId,
          satelliteName: sat.name,
          group: sat.group,
          pass,
        });
      }
    }
  }

  events.sort((a, b) => a.pass.startTime.getTime() - b.pass.startTime.getTime());
  return events;
}
