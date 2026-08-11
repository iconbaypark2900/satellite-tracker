/**
 * satellite-metadata.ts — Static metadata for well-known satellites.
 *
 * Celestrak SATCAT is unreachable from some networks (it blocks IP
 * ranges), so ship curated facts for the satellites users click most.
 * Merge priority in buildSatellite: SATCAT > this file > TLE-derived
 * designator > group inference.
 */

import { SatelliteOperator } from "@/types";

export interface StaticSatelliteMetadata {
  operator?: SatelliteOperator;
  /** ISO date or launch designator. */
  launchDate?: string;
  type?: string;
}

export const STATIC_SATELLITE_METADATA: Record<string, StaticSatelliteMetadata> = {
  // Stations
  "25544": {
    operator: { name: "NASA/Roscosmos/ESA/JAXA/CSA", country: "International" },
    launchDate: "1998-11-20",
    type: "Space Station",
  },
  "48274": {
    operator: { name: "CMSA", country: "China" },
    launchDate: "2021-04-29",
    type: "Space Station (Tianhe core)",
  },
  // Weather / Earth observation
  "41866": {
    operator: { name: "NOAA/NASA", country: "USA" },
    launchDate: "2016-11-19",
    type: "Weather (GOES-East series)",
  },
  "51850": {
    operator: { name: "NOAA/NASA", country: "USA" },
    launchDate: "2022-03-01",
    type: "Weather (GOES-West series)",
  },
  "25338": {
    operator: { name: "NOAA", country: "USA" },
    launchDate: "1998-05-13",
    type: "Weather (POES)",
  },
  "28654": {
    operator: { name: "NOAA", country: "USA" },
    launchDate: "2005-05-20",
    type: "Weather (POES)",
  },
  "33591": {
    operator: { name: "NOAA", country: "USA" },
    launchDate: "2009-02-06",
    type: "Weather (POES)",
  },
  // Popular amateur-radio satellites
  "07530": {
    operator: { name: "AMSAT", country: "USA" },
    launchDate: "1974-11-15",
    type: "Amateur radio (AO-7)",
  },
  "14781": {
    operator: { name: "University of Surrey", country: "UK" },
    launchDate: "1984-03-01",
    type: "Amateur radio (UO-11)",
  },
  "22825": {
    operator: { name: "AMRAD", country: "USA" },
    launchDate: "1993-09-26",
    type: "Amateur radio (AO-27)",
  },
  "24278": {
    operator: { name: "JAMSAT/JARL", country: "Japan" },
    launchDate: "1996-08-17",
    type: "Amateur radio (FO-29)",
  },
  "27607": {
    operator: { name: "Saudi Space Agency", country: "Saudi Arabia" },
    launchDate: "2002-12-20",
    type: "Amateur radio (SO-50)",
  },
  "43017": {
    operator: { name: "AMSAT", country: "USA" },
    launchDate: "2017-11-18",
    type: "Amateur radio (AO-91)",
  },
};
