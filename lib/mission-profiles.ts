/**
 * mission-profiles.ts — What each satellite is actually for.
 *
 * The tracker could say where an object is to four decimal places and not a
 * word about why it is there. SATCAT would supply an operator and a country,
 * but it is unreachable from many networks and never carried a mission
 * description anyway. This module is the offline answer to "what am I
 * looking at", in three tiers:
 *
 *   object  — a curated entry for this exact NORAD id
 *   family  — the satellite belongs to a series whose mission is known
 *   class   — nothing specific is known; describe the category honestly
 *
 * The tier is returned alongside the text so the UI can attribute it. A
 * class-tier line describes what this *kind* of object does and must never
 * be presented as a fact about the specific satellite.
 *
 * Families are only listed here when their mission is actually known. Several
 * series in the current catalogue (CSTP, HORS, GRIFON, MONITOR) are
 * deliberately absent rather than guessed at — they fall through to the class
 * tier, which says less but says nothing false.
 */

import { Satellite, SatelliteGroup } from "@/types";

export type MissionTier = "object" | "family" | "class";

export interface MissionProfile {
  /** One or two sentences on what the satellite is for. */
  purpose: string;
  /** How specific the claim is — see the tier notes above. */
  tier: MissionTier;
  /** Operating organisation, when the family determines one. */
  operator?: string;
  country?: string;
}

interface FamilyProfile extends Omit<MissionProfile, "tier"> {
  match: RegExp;
}

// ─── Family Profiles ─────────────────────────────────── //

/**
 * Ordered: the first match wins, so put specific series before the general
 * patterns they would also match.
 */
const FAMILIES: FamilyProfile[] = [
  // ── Weather and Earth science ──
  {
    match: /^NOAA[- ]?\d|NOAA \d+ \(/,
    purpose:
      "NOAA polar-orbiting weather satellite. Carries the AVHRR imager and sounding instruments, and broadcasts imagery continuously in the clear — the APT and HRPT downlinks are receivable with a hand-built antenna, which is why these are the classic first catch for weather-satellite hobbyists.",
    operator: "NOAA",
    country: "USA",
  },
  {
    match: /METOP/,
    purpose:
      "EUMETSAT polar-orbiting weather satellite flying the mid-morning orbit, complementing NOAA's afternoon coverage. Carries IASI, an infrared sounder that recovers temperature and humidity profiles through the depth of the atmosphere.",
    operator: "EUMETSAT",
    country: "Europe",
  },
  {
    match: /METEOR M/,
    purpose:
      "Roscosmos polar weather satellite. Broadcasts LRPT imagery on VHF, the Russian counterpart to NOAA's APT and a common target for amateur ground stations.",
    operator: "Roscosmos",
    country: "Russia",
  },
  {
    match: /FENGYUN|^FY-/,
    purpose:
      "Chinese meteorological satellite operated by the China Meteorological Administration. The FY-2 and FY-4 series sit in geostationary orbit for continuous disc imaging; FY-3 flies polar for global coverage.",
    operator: "CMA",
    country: "China",
  },
  {
    match: /^GOES|EWS-G/,
    purpose:
      "Geostationary weather satellite watching one face of the Earth continuously — the source of the looping cloud imagery in weather forecasts. Retired GOES craft transferred to the US Space Force fly on as EWS-G over the Indian Ocean.",
    operator: "NOAA / NASA",
    country: "USA",
  },
  {
    match: /ELEKTRO/,
    purpose:
      "Russian geostationary weather satellite, providing continuous imaging over Europe, Russia and the Indian Ocean.",
    operator: "Roscosmos",
    country: "Russia",
  },
  {
    match: /ARKTIKA/,
    purpose:
      "Russian weather satellite in a highly elliptical Molniya orbit, giving the continuous view of the Arctic that geostationary satellites cannot — from over the equator, the poles sit too low on the horizon to image usefully.",
    operator: "Roscosmos",
    country: "Russia",
  },
  {
    match: /IONOSFERA/,
    purpose:
      "Russian ionospheric monitoring satellite. Measures plasma density and electric fields in the upper atmosphere — the layer that bends and delays every HF and satellite signal passing through it.",
    operator: "Roscosmos",
    country: "Russia",
  },
  {
    match: /\bSMAP\b/,
    purpose:
      "NASA Soil Moisture Active Passive. Maps global soil moisture with an L-band radiometer, feeding drought monitoring and flood and crop forecasting.",
    operator: "NASA",
    country: "USA",
  },
  {
    match: /SARAL/,
    purpose:
      "Indo-French radar altimetry mission measuring sea-surface height to centimetre precision, for ocean circulation and sea-level rise records.",
    operator: "ISRO / CNES",
    country: "India / France",
  },

  // ── Communications ──
  {
    match: /SITRO-AIS/,
    purpose:
      "Part of a Russian commercial constellation that listens for AIS — the VHF position beacons ships broadcast continuously. Coastal receivers only hear AIS to the horizon, so satellites are the only way to track shipping in open ocean.",
    operator: "Sputnix",
    country: "Russia",
  },
  {
    match: /INMARSAT/,
    purpose:
      "Geostationary L-band satellite carrying mobile voice and data for ships, aircraft and remote operations. Inmarsat carries the space segment of GMDSS, the maritime distress and safety system.",
    operator: "Inmarsat",
    country: "UK",
  },
  {
    match: /INTELSAT|EUTELSAT/,
    purpose:
      "Geostationary commercial communications satellite carrying television distribution, broadband trunking and enterprise data links.",
  },
  {
    match: /MERIDIAN/,
    purpose:
      "Russian communications satellite in a highly elliptical Molniya orbit. It loiters near apogee over the northern hemisphere, serving Siberia and the Arctic where a geostationary satellite would sit on the horizon.",
    operator: "Roscosmos",
    country: "Russia",
  },
  {
    match: /^UFO \d/,
    purpose:
      "US Navy UHF Follow-On satellite: narrowband geostationary satcom for mobile military users whose antennas are too small for higher bands.",
    operator: "US Navy",
    country: "USA",
  },
  {
    match: /FLTSATCOM/,
    purpose:
      "US Navy Fleet Satellite Communications craft, launched around 1980 and long retired. Its unused UHF transponders became notorious as open repeaters for unauthorised users.",
    operator: "US Navy",
    country: "USA",
  },
  {
    match: /^S-NET/,
    purpose:
      "One of four TU Berlin nanosatellites demonstrating S-band inter-satellite links — satellites relaying through each other rather than every one needing its own ground pass.",
    operator: "TU Berlin",
    country: "Germany",
  },
  {
    match: /APRIZESAT/,
    purpose:
      "Small commercial satellite carrying store-and-forward messaging and AIS ship tracking: it collects data on one pass and downlinks it on the next.",
    operator: "SpaceQuest",
    country: "USA",
  },
  {
    match: /RASSVET/,
    purpose:
      "Russian low-orbit broadband technology demonstrator, flown to prove the satellite bus and inter-satellite links for a planned communications constellation.",
    country: "Russia",
  },
  {
    match: /ASTROCAST/,
    purpose:
      "Nanosatellite for global IoT messaging — low-rate, low-power telemetry from remote sensors and equipment with no terrestrial coverage.",
    operator: "Astrocast",
    country: "Switzerland",
  },

  // ── Earth observation ──
  {
    match: /ZORKIY/,
    purpose:
      "Russian commercial high-resolution optical imaging cubesat, built to show that a satellite of this size can return sub-metre-class imagery.",
    operator: "Sputnix",
    country: "Russia",
  },
  {
    match: /GAOFEN|JILIN/,
    purpose:
      "Chinese high-resolution Earth-imaging satellite, used for mapping, agriculture, and resource and disaster monitoring.",
    country: "China",
  },
  {
    match: /PROBA/,
    purpose:
      "ESA Project for On-Board Autonomy: a small satellite flown to prove new technology in orbit. PROBA-V carried a wide-swath vegetation imager that continued the SPOT-VEGETATION climate record.",
    operator: "ESA",
    country: "Europe",
  },
  {
    match: /CORVUS/,
    purpose:
      "Astro Digital imaging cubesat carrying a multispectral camera for agricultural and land-cover monitoring.",
    operator: "Astro Digital",
    country: "USA",
  },
  {
    match: /\bDOVE|^FLOCK/,
    purpose:
      "Planet Labs imaging cubesat. Flown in large flocks so the constellation as a whole images the entire land surface every day.",
    operator: "Planet Labs",
    country: "USA",
  },
  {
    match: /^AIST/,
    purpose:
      "Russian small research satellite from Samara University and the Progress Rocket Space Centre, flying Earth-imaging and space-science payloads.",
    country: "Russia",
  },
  {
    match: /SENTINEL/,
    purpose:
      "ESA Copernicus satellite supplying free, open Earth-observation data — the operational backbone of European environmental and climate monitoring.",
    operator: "ESA",
    country: "Europe",
  },
  {
    match: /CASSIOPE/,
    purpose:
      "Canadian satellite carrying the e-POP instrument suite, studying how solar storms disturb the ionosphere and disrupt radio propagation.",
    operator: "CSA",
    country: "Canada",
  },

  // ── Navigation ──
  {
    match: /NAVSTAR|\bGPS\b/,
    purpose:
      "GPS satellite broadcasting the ranging signals a receiver uses to trilaterate position and, just as importantly, to recover precise time — which is what synchronises power grids, financial timestamps and mobile networks.",
    operator: "US Space Force",
    country: "USA",
  },
  {
    match: /GLONASS/,
    purpose:
      "GLONASS navigation satellite, the Russian counterpart to GPS.",
    operator: "Roscosmos",
    country: "Russia",
  },
  {
    match: /GALILEO/,
    purpose:
      "Galileo navigation satellite — Europe's civil-controlled global positioning system.",
    operator: "EUSPA",
    country: "Europe",
  },
  {
    match: /BEIDOU/,
    purpose: "BeiDou navigation satellite, China's global positioning system.",
    country: "China",
  },
  {
    match: /TRANSIT \d/,
    purpose:
      "Transit satellite from the first operational satellite navigation system, built to fix the position of US Navy submarines. Receivers derived position from the Doppler shift of its beacon over a single pass — the ancestor of GPS.",
    operator: "US Navy",
    country: "USA",
  },

  // ── Amateur radio ──
  {
    match: /TEVEL/,
    purpose:
      "One of a set of Israeli educational cubesats built by high-school students, each carrying an FM amateur radio repeater that anyone with a handheld and a modest antenna can work.",
    country: "Israel",
  },
  {
    match: /QO-100|ES.?HAIL/,
    purpose:
      "The first geostationary amateur radio transponder. Because it never moves in the sky, operators can work it with a fixed dish and stay in contact across a third of the planet continuously — unlike LEO satellites, which give ten-minute windows.",
    country: "Qatar",
  },
  {
    match: /FUNCUBE/,
    purpose:
      "AMSAT-UK educational cubesat carrying a linear amateur transponder and a telemetry beacon designed for schools to decode with a simple dongle receiver.",
    operator: "AMSAT-UK",
    country: "UK",
  },
  {
    match: /GREENCUBE|\(IO-117\)/,
    purpose:
      "Carries a digipeater in medium Earth orbit — far higher than most amateur satellites, so a single pass is visible across continents for hours rather than minutes.",
    country: "Italy",
  },
  {
    match: /GEOSCAN/,
    purpose:
      "Russian educational cubesat flown under the Space-π schools programme, carrying a camera and an amateur radio beacon for students to receive.",
    operator: "Geoscan",
    country: "Russia",
  },
  {
    match: /POLYTECH|MTUSI|RTU MIREA|SAMSAT|\bSWSU\b/,
    purpose:
      "Russian university cubesat flown under the Space-π schools and student programme, typically carrying a small science or imaging payload and an amateur beacon.",
    country: "Russia",
  },
  {
    match: /NORBY/,
    purpose:
      "Novosibirsk State University cubesat carrying X-ray and magnetometer instruments alongside an amateur radio downlink.",
    country: "Russia",
  },

  // ── Technology demonstration ──
  {
    match: /NETSAT/,
    purpose:
      "One of four University of Würzburg nanosatellites demonstrating autonomous formation flying — the satellites hold a geometry relative to each other without ground commanding.",
    operator: "Uni Würzburg",
    country: "Germany",
  },
  {
    match: /DEORBITSAIL|\bD-SAT\b/,
    purpose:
      "Technology demonstrator for end-of-life disposal, testing hardware that pulls a spent satellite out of orbit instead of leaving it as debris.",
  },
  {
    match: /MOMENTUS/,
    purpose:
      "Orbital transfer vehicle demonstrator — a tug that carries smallsats from their drop-off orbit to their working one.",
    operator: "Momentus",
    country: "USA",
  },
];

// ─── Class Fallbacks ─────────────────────────────────── //

/**
 * What this kind of object does, for satellites with no curated or family
 * entry. Phrased about the class, never about the individual.
 */
const CLASS_PROFILES: Record<SatelliteGroup, string> = {
  STATIONS:
    "A crewed orbital station or a vehicle visiting one — continuously inhabited laboratories, and the brightest things in the sky after the Moon and Venus.",
  STARLINK:
    "A satellite in a low-orbit broadband constellation, relaying internet service to ground terminals.",
  ONEWEB:
    "A satellite in a low-orbit broadband constellation serving fixed and mobile terminals at high latitudes.",
  NAVIGATION:
    "A navigation satellite broadcasting ranging and timing signals for positioning receivers.",
  WEATHER:
    "A meteorological satellite carrying imagers and sounders that feed operational weather forecasting.",
  COMMS:
    "A communications satellite relaying voice, data or broadcast traffic between ground stations.",
  "EARTH-OBS":
    "An Earth-observation satellite carrying imaging or remote-sensing instruments for mapping, agriculture, or environmental monitoring.",
  AMATEUR:
    "An amateur radio satellite. Most carry a transponder or digipeater that licensed operators worldwide may use, plus a telemetry beacon anyone can receive.",
  // Overridden below for the two designator schemes, which say more.
  RESEARCH:
    "A research or technology-demonstration smallsat — typically a university or agency cubesat flying an experiment, a new component, or a student payload.",
  DEBRIS:
    "A spent rocket stage or catalogued fragment. It carries no payload and is tracked because it is a collision hazard.",
  OTHER:
    "Catalogued and tracked, but its name carries no public indication of mission.",
};

// ─── Public API ──────────────────────────────────────── //

/**
 * Curated entries for individual objects, where the specific satellite is
 * notable enough that the family text would undersell it.
 */
const OBJECT_PROFILES: Record<string, Omit<MissionProfile, "tier">> = {
  "25544": {
    purpose:
      "The International Space Station: a permanently crewed laboratory, continuously occupied since November 2000. It is the brightest satellite in the sky, easily visible to the naked eye, and carries an amateur radio station that schools can contact directly during a pass.",
    operator: "NASA / Roscosmos / ESA / JAXA / CSA",
    country: "International",
  },
  "48274": {
    purpose:
      "Tianhe, the core module of the Chinese space station Tiangong — living quarters, power and propulsion for a permanently crewed outpost.",
    operator: "CMSA",
    country: "China",
  },
  "20580": {
    purpose:
      "The Hubble Space Telescope. Observing above the atmosphere removes the blurring that limits ground telescopes, which is what makes its deep-field images possible.",
    operator: "NASA / ESA",
    country: "USA",
  },
};

/**
 * Resolve what a satellite is for, most specific source first.
 */
export function missionProfile(sat: {
  noradId: string;
  name: string;
  group: SatelliteGroup;
}): MissionProfile {
  const object = OBJECT_PROFILES[sat.noradId];
  if (object) return { ...object, tier: "object" };

  const upper = sat.name.toUpperCase();
  const family = FAMILIES.find((f) => f.match.test(upper));
  if (family) {
    const { match: _match, ...profile } = family;
    return { ...profile, tier: "family" };
  }

  // The two amateur designator schemes each say something the generic
  // amateur text does not, and between them they cover most of that
  // category. Still class-tier: this describes the designation, not the
  // individual spacecraft's payload.
  if (sat.group === "AMATEUR") {
    if (/^[A-Z]{1,2}O-\d+|\([A-Z]{1,2}O-\d+\)/.test(upper)) {
      return {
        tier: "class",
        purpose:
          "Carries an OSCAR designation — Orbiting Satellite Carrying Amateur Radio — assigned in sequence once a satellite is in orbit and its amateur payload is confirmed working and open to the community. The letters before the number identify the sponsoring group.",
      };
    }
    if (/^RS-?\d|\(RS-?\d+[A-Z]?\)|RS\d+S/.test(upper)) {
      return {
        tier: "class",
        purpose:
          "Carries an RS designation, the Russian equivalent of the OSCAR series. Many are otherwise ordinary research or university satellites that also fly an amateur beacon or transponder, which is how they end up tracked on amateur listings.",
        country: "Russia",
      };
    }
  }

  return { purpose: CLASS_PROFILES[sat.group] ?? CLASS_PROFILES.OTHER, tier: "class" };
}

/**
 * What the orbit itself tells you, derived from the elements rather than
 * from any table — so this is true for every object, including the ones no
 * catalogue describes.
 */
export function orbitInsight(sat: Satellite): { label: string; text: string } | null {
  const { inclination, period, apogee, perigee } = sat;
  const eccentric = apogee - perigee > 5000;

  if (period > 1400 && period < 1470 && inclination < 3 && !eccentric) {
    return {
      label: "Geostationary",
      text: "Orbits once per sidereal day over the equator, so it hangs at a fixed point in the sky. A ground dish can be bolted down and never moved — and it is always in view from roughly a third of the planet.",
    };
  }

  if (eccentric && inclination > 55 && inclination < 70) {
    return {
      label: "Molniya orbit",
      text: "A deliberately lopsided orbit that crawls through apogee over high latitudes and whips through perigee on the other side. It spends most of each revolution usefully placed over the north, which is why Russia uses it where geostationary satellites sit too low.",
    };
  }

  if (eccentric) {
    return {
      label: "Highly elliptical",
      text: `Ranges from ${Math.round(perigee)} km at perigee to ${Math.round(apogee)} km at apogee, so its speed and its distance from a ground station change dramatically through a single revolution.`,
    };
  }

  if (inclination > 96 && inclination < 102 && apogee < 1600) {
    return {
      label: "Sun-synchronous",
      text: "Its orbit plane precesses about one degree a day, matching Earth's motion around the Sun, so it crosses the equator at the same local solar time on every pass. Shadows fall the same way in every image, which is what makes scenes comparable over months.",
    };
  }

  if (inclination > 80) {
    return {
      label: "Polar",
      text: "Passes near both poles while Earth turns underneath, so over a day it overflies effectively the whole surface — the standard choice for global imaging and weather.",
    };
  }

  if (apogee < 2000) {
    // One decimal: rounding to whole revolutions turns the ISS's familiar
    // 15.5 into 16, and the half matters — it is why the ground track
    // shifts west by half a revolution each day.
    const revsPerDay = (1440 / period).toFixed(1);
    return {
      label: "Low Earth orbit",
      text: `Completes about ${revsPerDay} revolutions a day at ${Math.round(sat.altitude)} km. From any one ground station it is in view for only a few minutes at a time, so contacts are short and have to be planned.`,
    };
  }

  return null;
}
