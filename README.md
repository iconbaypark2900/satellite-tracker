# 🛰️ Satellite Tracker

A real-time, interactive 3D satellite tracking platform for space enthusiasts, amateur astronomers, and educators.

> **Built with:** Next.js 15 (App Router) · Three.js + React Three Fiber · satellite.js (SGP4/SDP4) · Zustand + Immer · Tailwind CSS · SWR
>
> **Live Demo:** `demo/index.html` — a self-contained Canvas 2D prototype with 18 tracked satellites
> **Full Product Spec:** `docs/PRD.md`

---

## 📖 Table of Contents

- [Demo](#demo)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Data Sources](#data-sources)
- [Architecture Overview](#architecture-overview)
- [Roadmap](#roadmap)
- [License](#license)

---

## 🎮 Demo

A working, dependency-free prototype lives in [`demo/index.html`](demo/index.html). Open it in any browser:

```bash
# Simply open in your browser
npx serve demo/     # or any static file server
# or: python3 -m http.server --directory demo
```

The demo renders 18 satellites (ISS, Hubble, Starlink, OneWeb, GPS, GOES, Voyager, etc.) on a 2D canvas projection with:
- SGP4-like orbital propagation with time warping (-24h → +30d)
- Sun-synchronized lighting & terminator line
- Orbit path predictions & ground tracks
- Constellation filtering & satellite search
- Detailed metadata panel

The full PRD with the Next.js + Three.js architecture is in [`docs/PRD.md`](docs/PRD.md).

---

## 🚀 Quick Start

```bash
# Clone & install
git clone https://github.com/Quantum-Global-Group/satellite-tracker.git
cd satellite-tracker
cp .env.local.example .env.local
npm install           # or: pnpm install

# Run locally
npm run dev
# → http://localhost:3000

# Download Earth textures (first run only)
npm run textures

# Pre-cache TLE snapshots
npm run cache:tle
```

---

## 📐 Project Structure

```
satellite-tracker/
├── app/                          # Next.js 15 App Router
│   ├── api/                      # API Routes
│   │   ├── tle/route.ts          # Proxy → Celestrak TLE API
│   │   ├── satcat/route.ts       # Proxy → SATCAT metadata API
│   │   └── passes/route.ts       # Compute pass predictions
│   ├── (dashboard)/
│   │   ├── globe/page.tsx        # 3D globe view (Three.js)
│   │   ├── sky/page.tsx          # Celestial sphere (alt/az)
│   │   └── passes/page.tsx       # Pass prediction list
│   ├── layout.tsx                # Root layout (providers, fonts)
│   ├── page.tsx                  # Landing → redirect to /globe
│   └── globals.css
├── components/
│   ├── globe/                    # Three.js scene components
│   ├── ui/                       # Interactive UI controls
│   └── layout/                   # Header, Footer, Loading
├── lib/                          # Business logic (SGP4, TLE, passes)
├── hooks/                        # Custom React hooks (SWR + Zustand)
├── types/                        # TypeScript interfaces
├── workers/                      # WebWorker for SGP4 offloading
├── public/textures/              # NASA Earth textures
├── styles/                       # Tailwind + custom CSS
├── scripts/                      # Build/dev utilities
├── demo/index.html               # Standalone working demo
└── docs/PRD.md                   # Full product requirements
```

---

## 🔭 Data Sources

| Source | Purpose |
|--------|---------|
| [Celestrak TLE API](https://celestrak.org/) | `gp.php?GROUP=STATIONS&FORMAT=TLE` — 5 groups: STATIONS, STARLINK, ONEWEB, GPS-OPS, GOES |
| [Celestrak SATCAT](https://celestrak.org/) | `records.php?CATNR=XXXX&FORMAT=JSON` — metadata |
| [NASA APIs](https://api.nasa.gov/) | Earth textures, space weather (optional) |

---

## 🏗 Architecture Overview

```
Browser (R3F + Zustand)
   │
   ├── SWR → Next.js API Routes
   │         ├── /api/tle      → Celestrak (5-min cache)
   │         ├── /api/satcat   → SATCAT (24h cache)
   │         └── /api/passes   → SGP4 pass predictions
   │
   ├── WebWorker — SGP4 propagation (60fps, 50+ satellites)
   │
   └── Canvas: GlobeScene → Earth + OrbitPaths + GroundTracks
                             + SatelliteIcons (InstancedMesh)
                             + SunLighting + Starfield
```

---

## 📋 Roadmap

See [`docs/PRD.md`](docs/PRD.md) for the full specification. Summary:

- **Phase 1–2 (MVP):** 3D globe, 50+ satellites, SGP4 in WebWorker, time controls — ✅ Done (see [demo](demo/index.html))
- **Phase 3:** UI/UX, constellation filters, responsive layout
- **Phase 4:** Atmospheric scattering, mobile polish, SEO
- **Phase 5:** Deploy to Vercel

---

## 🤝 Contributing

Pull requests welcome! See [`docs/PRD.md`](docs/PRD.md) for full architecture and technical decisions.

---

## 📄 License

MIT — see [LICENSE](LICENSE).
