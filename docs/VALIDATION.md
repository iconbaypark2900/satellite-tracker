# Validation — Prediction Accuracy vs JPL Horizons

This document quantifies the accuracy of this tracker's orbital
predictions against an independent, authoritative reference: the
[JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) ephemeris service.

**Headline result:** over a 48-hour window, this app's topocentric ISS
predictions agree with JPL Horizons to a **median 0.0014° all-sky /
0.0013° during overhead passes**, with slant-range
agreement of **0.035 km median**, and every pass culmination matched
within the 1-minute sampling grid.

**This number is dominated by TLE age, not by the propagator.** The same
measurement against an 82-hour-old element set gave 0.011° at el>10°, and
against a 67-hour-old one, 0.039° — a factor of 30 spread from the identical
code. Quote this figure only alongside the TLE epoch it was measured with, and
re-run `npm run validate` after `npm run cache:tle` rather than trusting a
recorded value.

## Methodology

1. Take the freshest ISS TLE from this app's own data pipeline
   (`public/tle-cache.json`, sourced from AMSAT/r4uab mirrors — the
   exact data the app renders).
2. Request a topocentric observer ephemeris for the ISS
   (Horizons body `-125544`) from the Horizons API: geodetic site at
   New York (40.7128°N, 74.006°W, 10 m), airless apparent
   azimuth/elevation + range (`QUANTITIES='4,20'`), 1-minute steps,
   for 48 hours starting at the TLE epoch.
3. Compute the same quantities on the identical time grid with this
   app's pipeline: SGP4 via satellite.js → `eciToEcf(gmst)` →
   `ecfToLookAngles` (`computeAzEl` in `lib/pass-calculator.ts` — the
   exact code path behind the pass predictor and sky view).
4. Compare: great-circle angular separation between predicted
   directions, absolute slant-range error, and pass-culmination timing
   (matched local maxima above 10° elevation).

Reproduce with:

```bash
pnpm cache:tle    # refresh the TLE snapshot
pnpm validate     # fetches Horizons, writes docs/validation-results.json
```

## Results (generated 2026-08-13, TLE epoch 2026-08-13 03:34 UTC)

TLE age at generation: about 18 hours.

| Metric | Median | 95th pct | Max | N |
|---|---|---|---|---|
| Angular error, all sky (deg) | 0.0014 | 0.0016 | 0.0028 | 2881 |
| Angular error, el>10° (deg) | 0.0013 | 0.0023 | 0.0028 | 56 |
| Range error, el>10° (km) | 0.035 | 0.094 | 0.104 | 56 |
| Pass-peak timing error (s) | 0.0 | 0.0 | 0.0 | 11/11 passes |
| Pass-peak elevation error (deg) | 0.0003 | 0.0014 | 0.0014 | 11 |

Notes on reading the numbers:

- Angular error is larger during passes (el>10°) than all-sky because
  the satellite is *closer*: the same few-hundred-meter position error
  subtends a larger angle at 500 km slant range than at 2000 km.
- The range error (median 0.035 km, max 0.10 km at el>10°) sits well
  inside SGP4's well-documented 1-3 km accuracy envelope for LEO objects
  with fresh elements.
- Error grows with TLE age (~2-6× from the first 12h to hour 36-48),
  which is exactly the expected SGP4 staleness behavior — and why the
  UI surfaces per-satellite TLE epoch age.

## Accuracy & Limitations

Honest accounting of what this tool does and doesn't model:

- **Propagator**: SGP4/SDP4 (satellite.js v6) from two-line elements.
  Inherent accuracy is ~1-3 km at epoch for LEO, degrading by roughly
  1-3 km/day depending on solar activity and object area-to-mass ratio.
  This is a screening/visualization-grade propagator, not precision
  orbit determination.
- **Reference frames**: SGP4 outputs TEME (True Equator, Mean Equinox).
  The 3D scene renders TEME axes directly as its inertial frame; the
  Earth is rotated by GMST inside that frame, i.e. TEME→PEF. Look
  angles use the same GMST rotation (satellite.js `eciToEcf` →
  `ecfToLookAngles`). **Polar motion is ignored** (≤ ~10 m ground
  displacement) and the TEME↔J2000 distinction (nutation/equation of
  the equinoxes) is not applied to rendered axes — irrelevant at
  visualization scale, and the Horizons comparison above bounds the
  end-to-end effect on observables.
- **No atmospheric refraction**: elevations are geometric. Horizons
  airless quantities were used for comparison; near the horizon (<5°)
  real-world refraction raises apparent positions by up to ~0.5°.
- **Light-time**: not modeled (≤ ~7 ms for LEO ranges; sub-millidegree
  effect).
- **Illumination**: pass visibility uses a cylindrical Earth-shadow
  model (no penumbra) and a −6° civil-twilight threshold for observer
  darkness; brightness magnitudes are placeholder estimates, not a
  phase-angle model.
- **Reference caveat**: Horizons' ISS trajectory is itself
  tracking-derived predict data (revised daily, "low accuracy more
  than a few days past revision"). This comparison measures agreement
  between two independent prediction chains from independent element
  sources — not absolute truth. Agreement at the 0.005-0.1° level
  indicates both chains implement the geometry correctly.
- **Data provenance**: TLEs come from Celestrak when reachable, else
  daily-updated AMSAT/r4uab mirrors (stations, weather, amateur
  satellites); each satellite's TLE epoch age is shown in its detail
  panel and warnings appear beyond 3 days.
