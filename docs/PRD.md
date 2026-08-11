# 🛰️ Satellite Tracker — Product Requirements & Project Plan

> A real-time, interactive 3D satellite tracking platform for space enthusiasts, amateur astronomers, and educators. Built as a portfolio-grade Next.js + Three.js application with live SGP4 orbital mechanics.

---

## 1. Problem Statement

Amateur astronomers and space enthusiasts want to know **what's flying overhead right now**, but existing tools are either:
- Too academic (raw TLE data dumps)
- Too simplistic (single-satellite trackers)
- Not visual enough (spreadsheet-style interfaces)
- Desktop-only applications

We're building a **web-first, visually stunning, data-rich satellite tracker** that lets anyone point at the sky and know exactly what they're looking at.

---

## 2. Target Users & Personas

| Persona | Needs | Technical Level |
|---------|-------|-----------------|
| **Alex** — Amateur Astronomer | Wants to photograph the ISS tonight. Needs pass predictions, brightness info, and sky direction. | Medium |
| **Sam** — Space Enthusiast | Wants to see how Starlink fills the sky. Loves visual data and constellation overviews. | Low |
| **Dr. Reyes** — High School Physics Teacher | Needs a classroom tool to teach orbital mechanics. Wants to visualize LEO vs GEO, inclinations, periods. | Medium |
| **Jordan** — Software Engineer (Portfolio Viewer) | Wants to see clean code, modern stack, good architecture. Judges technical decisions. | High |

---

## 3. Feature Requirements

### MVP — Must Ship (Week 1–2)

| # | Feature | Description | User Value |
|---|---------|-------------|------------|
| 1 | Real-time 3D Globe | Three.js sphere with Earth textures, atmospheric glow, grid lines | Visual foundation |
| 2 | Live Satellite Positions | SGP4 propagation via satellite.js, positions update every second | Core functionality |
| 3 | Satellite Database | ~50 tracked objects (ISS, Hubble, Starlink, OneWeb, GPS, GOES) | Richness |
| 4 | Constellation Filter | Toggle visibility by constellation (Starlink, GPS, ISS, etc.) | Usability |
| 5 | Time Controls | Real-time clock with time-warp slider (-24h to +30d) | Flexibility |
| 6 | Sun-Synced Lighting | Terminator line moves with real date; lit/unlit satellites | Realism |
| 7 | Satellite Selection | Click to view name, NORAD ID, orbit params, operator | Information |
| 8 | Responsive Layout | Works on desktop, tablet, mobile | Accessibility |

### V1.5 — Should Ship (Week 3)

| # | Feature | Description |
|---|---------|-------------|
| 9 | Pass Predictions | Enter location → get "Next visible passes" list with time, max elevation, azimuth |
| 10 | Location Input | City search or coordinates or geolocation |
| 11 | Sky View Mode | Switch to celestial sphere view (alt/az), with constellations |
| 12 | Brightness Magnitude | Show which satellites are actually visible to the naked eye |
| 13 | Share Feature | Share link with specific time and selected satellite |

### V2.0 — Nice to Have (Week 4+)

| # | Feature | Description |
|---|---------|-------------|
| 14 | Space Weather Impact | Solar flux affects drag predictions (TLE decay) |
| 15 | Historical Tracking | See past positions, replay satellite maneuvers |
| 16 | Space Debris | Visual 3D space junk (10,000+ objects) |
| 17 | Data Export | Download pass predictions as CSV |
| 18 | Educational Mode | Pop-up tooltips explaining orbital mechanics concepts |
| 19 | Offline Mode | Cache TLEs and work without internet |
| 20 | Mobile App | Progressive Web App (PWA) installable on phones |

---

## 4. Technical Architecture

### 4.1 Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Next.js 15 (App Router) | Server components, SWR integration, SEO |
| **3D Engine** | Three.js r165 + React Three Fiber | React-idiomatic, tree-shakable, battle-tested |
| **Orbital Mechanics** | satellite.js v6 (SGP4/SDP4) | Industry standard, WASM available for performance |
| **State Management** | Zustand + Immer | Lightweight, structured, serializable |
| **Data Fetching** | SWR + Next.js API Routes | Server-side caching, client-side revalidation |
| **Styling** | Tailwind CSS v4 + Framer Motion | Design system, smooth animations |
| **Deployment** | Vercel + PlanetScale (optional) | Edge functions, zero-config deployments |
| **Type Safety** | TypeScript throughout | Portfolio showcase, error prevention |

### 4.2 Data Flow

```
User opens app
  → Server fetches TLEs from Celestrak (cached 5 min)
  → Server fetches SATCAT metadata (cached 24h)
  → Client hydrates with data
  → SGP4 worker propagates all satellites every 100ms
  → Positions streamed to Three.js scene graph
  → R3F re-renders Globe scene
  → User interacts (select, time-warp, search)
  → Zustand store updates
  → UI components reactively update
```

### 4.3 Project Structure

```
satellite-tracker/
├── app/                              # Next.js 15 App Router
│   ├── api/                          # API routes
│   │   ├── tle/
│   │   │   └── route.ts              # Proxy → Celestrak TLE API
│   │   ├── satcat/
│   │   │   └── route.ts              # Proxy → Celestrak SATCAT API
│   │   └── passes/
│   │       └── route.ts              # Compute pass predictions
│   ├── (dashboard)/
│   │   ├── globe/
│   │   │   └── page.tsx             # 3D globe view
│   │   ├── sky/
│   │   │   └── page.tsx             # Celestial sphere view
│   │   └── passes/
│   │       └── page.tsx             # Pass prediction list
│   ├── layout.tsx                    # Root layout (providers, fonts)
│   ├── page.tsx                      # Landing → redirect to globe
│   └── globals.css                   # Tailwind imports
│
├── components/                       # React components
│   ├── globe/
│   │   ├── GlobeScene.tsx            # Three.js scene container
│   │   ├── Earth.tsx                 # Sphere + atmosphere shader
│   │   ├── SatelliteIcons.tsx        # Instanced meshes for performance
│   │   ├── OrbitPaths.tsx            # Trajectory prediction curves
│   │   ├── GroundTracks.tsx          # Terminator + track lines
│   │   ├── SunLighting.tsx           # Dynamic directional light
│   │   └── Starfield.tsx             # HDRI + star sprites
│   ├── ui/
│   │   ├── TimeSlider.tsx            # Time warp control
│   │   ├── ConstellationFilter.tsx   # Toggle constellations
│   │   ├── SatelliteList.tsx         # Searchable satellite table
│   │   ├── SatelliteDetail.tsx       # Metadata panel
│   │   ├── LocationInput.tsx         # City/coordinates/geolocation
│   │   └── PassPredictionCard.tsx    # Single pass prediction row
│   └── layout/
│       ├── Header.tsx                # Top nav bar
│       ├── Footer.tsx                # Copyright / credits
│       └── LoadingScreen.tsx         # Splash while loading
│
├── lib/                              # Business logic
│   ├── satellite-store.ts            # Zustand store (TS types + actions)
│   ├── tle-client.ts                 # Celestrak API client (fetch + cache)
│   ├── satcat-client.ts              # SATCAT metadata client
│   ├── orbit-utils.ts                # SGP4 propagation helpers
│   ├── sun-position.ts               # Astronomical sun position calc
│   ├── pass-calculator.ts            # Az/el pass predictions
│   ├── color-utils.ts                # Constellation color mapping
│   └── constants.ts                  # Orbital constants, group configs
│
├── hooks/                            # Custom React hooks
│   ├── useTleData.ts                 # SWR hook: fetch + cache TLEs
│   ├── useSatCatData.ts              # SWR hook: fetch metadata
│   ├── useTimeControl.ts             # Time state + animation
│   ├── useSunPosition.ts             # Memoized sun direction
│   ├── usePassPredictions.ts         # Pass calc hook
│   └── useLocation.ts                # Geolocation + saved locations
│
├── types/                            # TypeScript interfaces
│   ├── index.ts                      # Core types
│   ├── tle.ts                        # TLE + SatRec types
│   ├── satellite.ts                  # Satellite metadata
│   └── ui.ts                         # UI state types
│
├── workers/                          # WebWorker scripts
│   └── propagation-worker.ts         # Offload SGP4 to worker
│
├── public/                           # Static assets
│   ├── textures/
│   │   ├── earth-day-8k.jpg          # Color map
│   │   ├── earth-night-4k.jpg        # City lights
│   │   ├── earth-bump-8k.jpg         # Topography
│   │   ├── earth-spec-4k.jpg         # Water specular
│   │   └── stars-hdr.hdr             # Starfield environment
│   ├── fonts/
│   │   └── (custom monospace font)
│   └── favicon.ico
│
├── styles/
│   ├── globals.css                   # Tailwind directives
│   ├── satellite-colors.css          # Constellation color classes
│   └── animations.css                # CSS-only micro-animations
│
├── scripts/                          # Build/dev utilities
│   ├── download-textures.ts          # Fetch Earth textures
│   └── generate-tle-cache.ts         # Pre-cache TLE snapshots
│
├── .env.local                        # API keys, env vars
├── next.config.js                    # Image domains, headers
├── tailwind.config.js                # Custom color palette
├── tsconfig.json                     # Strict TypeScript
├── package.json
└── README.md
```

---

## 5. Key Technical Decisions

### 5.1 WebWorker for SGP4
- **Why:** Propagating 50+ satellites × 60fps is CPU-intensive
- **Implementation:** PostMessage to worker with current time → returns `{id, lat, lon, alt}`
- **Fallback:** If worker fails, run on main thread

### 5.2 SGP4 Propagation Accuracy
- **TLE refresh:** 5 minutes from Celestrak (cached in localStorage + Next.js API route)
- **Stale TLE handling:** Show "data age" indicator; gray out satellites with old TLEs
- **Error handling:** Filter out failed propagations (decayed satellites)

### 5.3 Earth Rendering
- **Textures:** NASA Blue Marble (day) + city lights (night) + bump map (topography)
- **Atmosphere Shader:** Custom Three.js shader with Rayleigh scattering approximation
- **Starfield:** HDRI environment map or sprite-based stars

### 5.4 Performance Optimizations
- **InstancedMesh** for satellite icons (one draw call for all satellites)
- **LODs:** Simplified orbits for distant GEO satellites
- **Frustum culling:** Only render satellites in camera view
- **Time debouncing:** Only re-propagate when time changes significantly (>100ms)

### 5.5 Pass Predictions
- **Algorithm:** Iterate over time steps, check when satellite crosses horizon (alt > 0)
- **Illumination check:** Ensure satellite is lit by sun (not in Earth's shadow)
- **Precision:** 1-minute steps with parabolic interpolation for peak elevation

---

## 6. API & Data Sources

| Source | Purpose | Rate Limits | Notes |
|--------|---------|-------------|-------|
| **Celestrak TLE API** | `gp.php?GROUP=STATIONS&FORMAT=TLE` | ~120 requests/hr | 5 groups: STATIONS, STARLINK, ONEWEB, GPS-OPS, GOES |
| **Celestrak SATCAT** | `records.php?CATNR=XXXX&FORMAT=JSON` | ~120 requests/hr | Satellite metadata (name, country, orbit type) |
| **N2YO API** | Real-time satellite tracking (optional) | 30 req/min (free tier) | Alternative if Celestrak rate-limited |
| **NASA APIs** | Earth textures, space weather | Generous | For educational overlays |

---

## 7. Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Initial load time | < 3s | Lighthouse, WebPageTest |
| TLE data freshness | < 5 min lag | Compare with Celestrak timestamp |
| Satellite update rate | 60fps | Chrome DevTools performance |
| Mobile LCP | < 2.5s | Lighthouse mobile |
| Lighthouse score | > 90 | Automated CI check |
| GitHub stars | > 100 | GitHub insights |
| Portfolio engagement | 15% click-through from portfolio to project | UTM tracking |

---

## 8. Development Roadmap

### Phase 1: Foundation (Days 1–3)
- [x] Create Next.js project with TypeScript + Tailwind
- [x] Set up Three.js canvas with Earth sphere
- [x] Implement atmospheric glow shader
- [x] Add starfield background
- [x] Basic orbit controls (rotate, zoom, pan)

### Phase 2: Data Integration (Days 4–7)
- [x] Celestrak TLE API client + caching (with mirror fallback: AMSAT, r4uab)
- [x] SGP4 propagation (satellite.js) in WebWorker (transferable buffers + dead-reckoning)
- [x] Render 50+ satellites with correct positions (single Points draw call, scales to ~8000)
- [x] Orbit path prediction lines (selected/hovered satellite)
- [x] Ground track rendering (selected/hovered, ECEF frame)

### Phase 3: UI & Interaction (Days 8–10)
- [x] Satellite sidebar with search + constellation grouping
- [x] Satellite detail panel (metadata: TLE-derived designator, static records, SATCAT when reachable)
- [x] Time slider with live update
- [x] Sun-synchronized lighting system (day/night texture shader + GMST Earth rotation)
- [x] Constellation filters (toggle visibility)
- [x] Navigation between Globe / Sky / Passes views
- [x] Pass predictions page (topocentric look angles, rise/set refinement, visibility)
- [x] Sky view (alt/az polar plot, click-to-select, selected-satellite trail)

### Phase 4: Polish (Days 11–12)
- [x] NASA Blue Marble day/night Earth textures (procedural fallback)
- [x] Fresnel atmosphere shell
- [x] Satellite glow + selection highlight
- [x] Loading states + error boundaries
- [ ] Responsive layout audit (mobile)
- [ ] SEO (OpenGraph image, sitemap)

### Phase 5: Deploy & Iterate (Day 13–14)
- [ ] Deploy to Vercel (build pipeline ready: prebuild TLE refresh, file tracing)
- [ ] Test on mobile + desktop
- [x] Write README + setup docs
- [ ] Google Analytics (not started)
- [ ] Portfolio showcase page (not started)

---

## 9. Deployment

```bash
# Clone & install
git clone <repo>
cd satellite-tracker
npm install

# Run locally
npm run dev

# Build for production
npm run build

# Deploy to Vercel
npx vercel --prod
```

**Vercel Environment Variables:**
```
CELESTRAK_BASE_URL=https://celestrak.org
SATCHAT_BASE_URL=https://celestrak.org
CACHE_TTL_SECONDS=300
```

---

## 10. Future Roadmap (Post-Portfolio)

| Version | Feature | Impact |
|---------|---------|--------|
| 1.1 | Space debris visualization (10K+ objects) | High visual impact |
| 1.2 | Historical replay mode (past launches) | Educational |
| 1.3 | Progressive Web App (installable) | Mobile users |
| 1.4 | Augmented Reality mode (WebXR) | "Hold phone at sky" |
| 1.5 | Community features (log observations) | User engagement |

---

## How This Portfolio Piece Demonstrates Value

| Skill | Where It Shines |
|-------|-----------------|
| **Full-stack architecture** | API routes, caching, data flow |
| **3D graphics** | Three.js shaders, lighting, instancing |
| **Domain expertise** | SGP4, orbital mechanics, astronomy |
| **Performance optimization** | WebWorkers, instanced meshes, LOD |
| **Type safety** | Full TypeScript with custom types |
| **UI/UX design** | Responsive, accessible, polished |
| **Data engineering** | API integration, caching strategies |
| **DevOps** | CI/CD, edge deployment, monitoring |
