# MRSAM Operator Simulator

> **Functional realism for medium-range surface-to-air missile operations.**
> Top-down tactical operator simulator built around the **Barak-8 / MRSAM** weapon system — engagement range 40–100 km, operator-perspective (Battle Management Centre), web-based.

[![status](https://img.shields.io/badge/status-pre--alpha-orange)]()
[![phase](https://img.shields.io/badge/phase-0%20foundation-blue)]()
[![typescript](https://img.shields.io/badge/typescript-strict-3178c6)]()
[![license](https://img.shields.io/badge/license-TBD-lightgrey)]()

---

## What is this?

You are not the pilot. You are not playing god-view RTS. You are the **operator** in front of the tactical display — interpreting tracks, classifying contacts, applying ROE, assigning weapons, and watching missiles fly.

The simulator targets **functional realism, not visual realism**. The radar equation, track quality decay under maneuver, notching exploits, seeker handoff failures, magazine pressure, datalink dependence, and TEWA prioritization all behave the way they do in real systems. Graphics stay schematic — the focus is on *decisions*, not screenshots.

Reference platform: **Barak-8** (Israel/India joint development) — AESA MFR + active-radar seeker + VLS, well-documented public specs, complexity that fits a serious simulator without crossing into S-400 territory.

> **Audience**: defense/aviation enthusiasts, military-tech students, and gamers who want a DCS-grade simulator on the air-defense side of the engagement.

---

## Status

- **Phase**: 0 — Foundation (not started)
- **Single source of truth**: [`MRSAM_SIMULATOR_PROJECT.md`](./MRSAM_SIMULATOR_PROJECT.md) — read this first. Spec, architecture, roadmap, decision log, and progress log all live in one document.
- **Current build**: a self-contained prototype (`dashboard-integrated.html`) is checked in — a Three.js engagement view wired to a live operator dashboard (tracks table, PPI radar scope, batteries, engagement stats). It is an early creative exploration, **not** the production codebase, and will be superseded by the TypeScript core described in the spec. Earlier explorations (`index.html`, `js/`, `styles.css`, `dashboard/`) are kept under [`archive/`](./archive/).

The roadmap is intentionally phased and gated. Each phase requires tests passing before moving on. See [§12 Roadmap](./MRSAM_SIMULATOR_PROJECT.md#12-roadmap) for the full task list.

---

## Quick start

> Phase 0 is not yet implemented. Once `package.json` lands, the workflow will be:

```bash
# install
pnpm install

# run dev (Vite + HMR)
pnpm dev

# unit tests (Vitest, watch mode)
pnpm test

# end-to-end (Playwright)
pnpm e2e

# typecheck + lint
pnpm check

# production build
pnpm build
```

To run the current prototype (`dashboard-integrated.html`):

```bash
python3 -m http.server 8765
# open http://localhost:8765/dashboard-integrated.html
```

Click the canvas once to enable audio. Controls: **Space** launch · **T** spawn target · **drag** orbit · **LAUNCH / RESET** buttons in the status bar.

The archived explorations are still viewable, e.g. `http://localhost:8765/archive/index.html`.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript 5+ strict** | Type safety for simulation logic |
| Build | **Vite** | Fast dev loop |
| UI framework | **React 18** | Mature ecosystem for panels/HUD |
| Tactical display | **PixiJS** (Canvas2D fallback) | Fast 2D rendering — top-down PPI is inherently 2D |
| 3D (optional, later) | **Three.js** | Only if a 3D engagement preview is added |
| State | **Zustand** | Lightweight, fits game state |
| Math | **gl-matrix** | Fast vector/matrix ops |
| Schema | **Zod** | Validate scenarios + save games |
| Tests | **Vitest** + Testing Library | Fast, Vite-native |
| E2E | **Playwright** | Modern web E2E |
| Lint/format | **ESLint + Prettier** | Standard |
| Package manager | **pnpm** | Disk-efficient, fast |

Browser target: evergreen (Chrome / Edge / Firefox / Safari, last 2 versions).

Stack choices are locked unless renegotiated with the project owner — see the Decision Log in the spec.

---

## Architecture

Four layers, dependency flows top-down only:

```
┌─────────────────────────────────────────────────────┐
│  PRESENTATION                                       │
│  React UI · PixiJS tactical display                 │
│  reads world state via selectors, dispatches actions│
└──────────────────▲──────────────────────────────────┘
                   │ readonly
┌──────────────────┴──────────────────────────────────┐
│  GAME LAYER                                         │
│  Scenario loader · objectives · scoring             │
└──────────────────▲──────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────┐
│  C2 / DECISION                                      │
│  TEWA · weapon assignment · ROE · operator commands │
└──────────────────▲──────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────┐
│  SIMULATION CORE                                    │
│  tick · entities · physics · sensors · missiles ·   │
│  threats · datalink · seeded RNG                    │
└─────────────────────────────────────────────────────┘
```

**Hard rules:**
- Simulation core never imports from UI or React.
- Simulation core is **deterministic**: same seed + same inputs → same outputs (this enables replay and tractable testing).
- Fixed simulation tick at **60 Hz** (16.67 ms), decoupled from `requestAnimationFrame`.
- All randomness goes through a **seeded RNG** (per-scenario).

```
src/
├── core/         simulation core (no UI deps)
│   ├── time/      tick & scheduler
│   ├── world/     world state, entity registry
│   ├── geometry/  ENU/ECEF/LatLonAlt, raycast
│   ├── physics/   missile drag, gravity
│   ├── sensors/   radar, IFF, EO/IR, RWR
│   ├── missiles/  FSM, guidance (PN), seeker
│   ├── threats/   flight model, evasion AI
│   ├── c2/        TEWA, ROE, engagement tracker
│   ├── datalink/  network model
│   └── rng/       seeded mulberry32 / xoshiro
├── data/         systems · missiles · threats · scenarios (JSON)
├── ui/           React components, tactical display
├── store/        Zustand stores
└── lib/          shared utils
```

---

## Realism principles

Things that must *feel* right at runtime:

1. **Detection is probabilistic.** Pd is computed from a simplified radar equation `SNR ∝ (Pt · G² · λ² · σ) / R⁴` with noise threshold — not a hard "in range = seen".
2. **Track quality decays** under target maneuver and jamming. Visualized as a growing uncertainty ellipse.
3. **Multi-target capacity is finite.** A battery engages 8–24 simultaneous targets; saturation forces TEWA to drop the lowest-priority threat.
4. **Notching matters.** Targets flying perpendicular to the radar (zero Doppler) drop track on pulse-Doppler systems.
5. **Seeker handoff can fail.** Bad midcourse data → terminal acquisition miss → missile lost or self-destructs.
6. **Emission control trades stealth for awareness.** Radar emitting → RWR detect → ARM threat. Operator manages emission time.
7. **Datalink dependency.** Track sharing across batteries is a force multiplier; losing it makes you blinder.
8. **Salvo doctrine.** Default 2-missile salvo against high-threat targets, time-separated 3–5 s. Configurable.
9. **Engagement timeline is real.** Detect → track → identify → assign → launch → midcourse → terminal → assess. Each transition takes time.
10. **Magazine is a resource.** Reload is not instant; saturation forces priority calls.

---

## Threats supported

| Class | RCS | Speed | Altitude | Note |
|---|---|---|---|---|
| 4th-gen fighter | 3–5 m² | M0.9–M2.0 | 100 m – 15 km | up to 9G maneuver |
| Helicopter | 5–10 m² | 50–80 m/s | 10 m – 3 km | NOE; rotor blade flash |
| Cruise missile (subsonic) | 0.1–0.5 m² | M0.7 | 30 m – 500 m | low + small → hard detect |
| Cruise missile (supersonic) | 0.5–1 m² | M2.5 | varies | faster but hotter |
| UAV (small) | 0.01–0.1 m² | 30 m/s | 100 m – 5 km | hardest detect |
| Stealth aircraft | 0.001–0.01 m² | M0.9 | high | X-band near-invisible; VHF acquires non-fire-control |
| TBM (short range) | 0.1 m² | M5+ | up to 100 km | endgame stretch goal |
| ARM | 0.05 m² | M2 | varies | threat to your radar |

Each gets a flight model (waypoint follower) and basic evasion AI (notching, jamming, terrain mask).

---

## Roadmap (overview)

| Phase | Focus |
|---|---|
| **0** | Foundation — repo, Vite, TS strict, lint, tests, CI |
| **1** | Simulation core — RNG, tick, geometry, world state |
| **2** | Sensors — radar equation, search/FCR, TWS, IFF, EO/IR, RWR |
| **3** | Threats — flight models, evasion AI, scenario spawner |
| **4** | Missile — FSM, boost/drag/PN guidance, seeker, prox fuse, Pk |
| **5** | C2 — ROE, TEWA, weapon assignment, salvo, datalink, saturation |
| **6** | UI — tactical display, panels, time control, sound cues, tutorial |
| **7** | Scenarios — JSON+Zod, tutorial/combat/saturation/SEAD/stealth |
| **8** | Polish — replay, save, stats, perf, a11y, i18n, multiplayer (stretch) |

Full task-level checklist: [`MRSAM_SIMULATOR_PROJECT.md` §12](./MRSAM_SIMULATOR_PROJECT.md#12-roadmap).

---

## Contributing

This project follows a **session-based workflow**. Every coding session — human or AI agent — must:

1. Read [`MRSAM_SIMULATOR_PROJECT.md`](./MRSAM_SIMULATOR_PROJECT.md) end-to-end.
2. Identify the active task in `## 13. Current Focus`.
3. Confirm the task, then work it (one or two tasks per session — depth over breadth).
4. At session end: tick the roadmap, append to the Progress Log, advance Current Focus, log any new technical decisions.

**Code rules:**
- TypeScript strict. No `any`, no unannotated `@ts-ignore`.
- Tests required for everything in `core/` (simulation must be regression-proof).
- Comments: Indonesian for explainer prose, English for JSDoc and public API.
- One file > 200 lines needs justification.
- No library swaps without owner approval.
- No phase-skipping unless a blocker forces it.

**FSMs** (Battery, Missile, ROE, Track lifecycle) must be implemented as pure functions: `transition(state, event) => state`. No hidden state, no side effects in transitions.

---

## Glossary

Air-defense terminology can get dense fast. The full glossary lives in [`MRSAM_SIMULATOR_PROJECT.md` §16](./MRSAM_SIMULATOR_PROJECT.md#16-glossary) — covers AESA, ARM, BMC, C2, ECCM, ECM, IADS, IFF, MFR, NEZ, NOE, Pd, Pk, PN, PPI, RCS, ROE, RWR, SEAD, STT, TBM, TEL, TEWA, TTI, TVM, TWS, VLS, WEZ.

---

## References

Public, open material the project draws on:

- US Army FM 3-01.85 — Patriot Battalion Operations
- Wikipedia: Barak 8, MF-STAR (EL/M-2248), MRSAM
- DCS World manuals (Patriot / Hawk modules) — best operator-workflow reference
- Carlo Kopp, *Surface-to-Air Missile Systems* (ausairpower.net)
- Janes (paid; public summaries OK)
- *An Overview of Track-While-Scan Radar Systems* (paper)

---

## License

TBD. Treat as **all rights reserved** until a license is committed.

---

_This README is a project front-door; the spec is the source of truth._
