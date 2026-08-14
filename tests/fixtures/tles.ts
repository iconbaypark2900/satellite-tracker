/**
 * Epoch-pinned real TLEs for deterministic orbital-math tests.
 * All epochs are day 222 of 2026 (2026-08-10). Tests must use start
 * times near these epochs, never `new Date()`.
 */

import { TleSet, ObserverLocation } from "@/types";

/** Prediction start pinned just after the fixture epochs. */
export const FIXTURE_START = new Date("2026-08-10T12:00:00Z");

export const NYC: ObserverLocation = {
  lat: 40.7128,
  lon: -74.006,
  alt: 0.01,
  label: "New York, NY, USA",
};

export const TOKYO: ObserverLocation = {
  lat: 35.6895,
  lon: 139.6917,
  alt: 0.04,
  label: "Tokyo, Japan",
};

/** ISS — LEO, 51.6° inclination, ~420 km. */
export const ISS: TleSet = {
  name: "ISS",
  noradId: "25544",
  line1: "1 25544U 98067A   26222.18186727  .00004351  00000-0  85915-4 0  9999",
  line2: "2 25544  51.6326  32.8714 0007377  31.2060 328.9366 15.49401464580127",
  epoch: "26222.18186727",
  group: "STATIONS",
};

/** GOES-16 — geostationary over the western hemisphere. */
export const GOES_16: TleSet = {
  name: "GOES-16",
  noradId: "41866",
  line1: "1 41866U 16071A   26222.46850214 -.00000104  00000-0  00000+0 0  9999",
  line2: "2 41866   0.4667  85.1494 0001213 118.9985 178.7281  1.00270567 35649",
  epoch: "26222.46850214",
  group: "WEATHER",
};

/** NOAA-19 — polar sun-synchronous LEO, ~870 km. */
export const NOAA_19: TleSet = {
  name: "NOAA-19",
  noradId: "33591",
  line1: "1 33591U 09005A   26222.48517046  .00000003  00000-0  25659-4 0  9998",
  line2: "2 33591  98.9488 293.3903 0012911 233.9641 126.0335 14.13481599902152",
  epoch: "26222.48517046",
  group: "WEATHER",
};
