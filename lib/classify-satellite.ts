/**
 * classify-satellite.ts — Assign a mission category to a satellite by name.
 *
 * The tracker reads TLEs from Celestrak when it is reachable and from the
 * amateur-radio mirrors (AMSAT, r4uab) when it is not. Those feeds carry
 * completely different objects, so categorising by *source* left every
 * Celestrak-only group empty and dumped the entire mirror catalogue into
 * "Other". Classifying by name instead gives the same taxonomy whichever
 * feed answered, and it is the only classification the build script and the
 * runtime share.
 *
 * Names come from the feeds verbatim, so the matching is deliberately
 * pattern-based rather than a lookup table: new launches classify correctly
 * without a code change as long as they follow their family's convention.
 */

import { SatelliteGroup } from "@/types";

/**
 * Objects that are catalogued but whose mission the name does not reveal —
 * Cosmos serials, bare USA designators, and unnamed launch IDs. These fall
 * to "OTHER" rather than being filed as research satellites, which is what
 * an unrecognised name otherwise implies.
 */
const OPAQUE = /^COSMOS[- ]\d|^USA[- ]?\d|^\d{4}-\d+[A-Z]|^OBJECT |^TBA[ -]/;

/** Crewed stations and the vehicles that visit them. */
const STATIONS =
  /\bISS\b|ZARYA|TIANHE|TIANGONG|\bCSS\b|PROGRESS|SOYUZ|DRAGON|CYGNUS|SHENZHOU/;

/** Global navigation constellations. */
const NAVIGATION = /NAVSTAR|\bGPS\b|GLONASS|GALILEO|BEIDOU|\bIRNSS\b|\bQZS|TRANSIT \d/;

/** Meteorological and space-weather satellites. */
const WEATHER =
  /\bNOAA\b|METOP|METEOR M|FENGYUN|GOES|EWS-G|ELEKTRO|ARKTIKA|KOMPSAT|DMSP|HIMAWARI|MTSAT|\bINSAT\b|IONOSFERA/;

/**
 * Amateur radio payloads. Two conventions dominate: the OSCAR designators
 * (AO-7, FO-29, QO-100 …) and the Russian RS series, either hyphenated
 * (RS-44) or as a bracketed suffix on the operational name (RS92S6). Both
 * appear as the whole name or in parentheses after it.
 */
const AMATEUR_DESIGNATOR = /^[A-Z]{1,2}O-\d+|\([A-Z]{1,2}O-\d+\)|^RS-?\d|\(RS-?\d+[A-Z]?\)|RS\d+S/;
const AMATEUR_NAMED =
  /OSCAR|TEVEL|FUNCUBE|GREENCUBE|CAS-\d|LILACSAT|SNUGLITE|UWE-\d|BEESAT|DUCHIFAT|SWISSCUBE|ITAMSAT|RADIO ROSTO|XIWANG|HADES|SONATE|GRBBETA|CUBEBEL/;

/** Communications satellites, commercial through military. */
const COMMS =
  /INMARSAT|EUTELSAT|INTELSAT|^SES[- ]|FLTSATCOM|\bUFO \d|MERIDIAN|BLUEWALKER|ASTROCAST|S-NET|SITRO-AIS|AISAT|\bAIS\b|IRIDIUM|GLOBALSTAR|ORBCOMM|MARAFON|GONETS|STRELA/;

/** Imaging, remote-sensing, and Earth-science missions. */
const EARTH_OBS =
  /ZORKIY|GAOFEN|JILIN|PROBA|\bDOVE|PERSEUS-M|CORVUS|APRIZESAT|LUOJIA|CASSIOPE|GRIFON|RASSVET|\bAIST|GEOSCAN|BRO-\d|SMAP|SARAL|RESURS|KANOPUS|SENTINEL|LANDSAT|\bOBZ/;

/** Spent upper stages and catalogued fragments. */
const DEBRIS = /R\/B|\bDEB\b|\bPLATFORM\b|\bCOOLANT\b/;

/**
 * Categorise a satellite by its catalogue name.
 *
 * Order matters: the specific families are tested before the broad mission
 * classes, so an object carrying an amateur beacon on a research bus (a
 * common Russian arrangement) files under its amateur designation — which is
 * how it is tracked and worked in practice. An amateur designator outranks
 * even an opaque serial for the same reason: "COSMOS-2499 (RS-47)" tells you
 * exactly what can be heard from it.
 *
 * Unmatched names fall to "RESEARCH": the long tail of both feeds is
 * university and technology-demonstration smallsats, so that is the accurate
 * default rather than a dumping ground.
 */
export function classifySatellite(name: string): SatelliteGroup {
  const n = name.toUpperCase();

  if (AMATEUR_DESIGNATOR.test(n)) return "AMATEUR";
  if (OPAQUE.test(n)) return "OTHER";
  if (DEBRIS.test(n)) return "DEBRIS";
  if (STATIONS.test(n)) return "STATIONS";
  if (n.includes("STARLINK")) return "STARLINK";
  if (n.includes("ONEWEB")) return "ONEWEB";
  if (NAVIGATION.test(n)) return "NAVIGATION";
  if (WEATHER.test(n)) return "WEATHER";
  if (AMATEUR_NAMED.test(n)) return "AMATEUR";
  if (COMMS.test(n)) return "COMMS";
  if (EARTH_OBS.test(n)) return "EARTH-OBS";

  return "RESEARCH";
}
