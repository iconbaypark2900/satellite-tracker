# Validation — Prediction Accuracy vs JPL Horizons

This document quantifies the accuracy of this tracker's orbital
predictions against an independent, authoritative reference: the
[JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) ephemeris service.

**Headline result:** over a 48-hour window, this app's topocentric ISS
predictions agree with JPL Horizons to a **median 0.005° all-sky /
0.039° during overhead passes** (≈ 1/10 the apparent width of the
Moon), with slant-range agreement of **0.4 km median**, and **12 of 12
pass culminations matched within the 1-minute sampling grid**.

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

## Results (generated 2026-08-11, TLE epoch 2026-08-10 12:06 UTC)

| Metric | Median | 95th pct | Max | N |
|---|---|---|---|---|
| Angular error, all sky (deg) | 0.005 | 0.018 | 0.158 | 2881 |
| Angular error, el>10° (deg) | 0.039 | 0.103 | 0.158 | 63 |
| Range error, el>10° (km) | 0.4 | 1.3 | 1.6 | 63 |
| Pass-peak timing error (s) | 0.0 | 0.0 | 0.0 | 12/12 passes |
| Pass-peak elevation error (deg) | 0.01 | 0.06 | 0.06 | 12 |

### Error growth vs prediction horizon (el>10°, angular deg)

| Hours since TLE epoch | Median | 95th pct | Max | N |
|---|---|---|---|---|
| 0-12h | 0.016 | 0.039 | 0.060 | 27 |
| 12-24h | 0.056 | 0.090 | 0.090 | 6 |
| 24-36h | 0.054 | 0.100 | 0.158 | 25 |
| 36-48h | 0.103 | 0.133 | 0.133 | 5 |

Notes on reading the numbers:

- Angular error is larger during passes (el>10°) than all-sky because
  the satellite is *closer*: the same few-hundred-meter position error
  subtends a larger angle at 500 km slant range than at 2000 km.
- The range error (median 0.4 km, max 1.6 km over 48h) sits inside
  SGP4's well-documented 1-3 km accuracy envelope for LEO objects with
  fresh elements.
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
