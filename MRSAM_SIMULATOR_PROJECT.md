# MRSAM Simulator — Project Spec & Roadmap

> **Dokumen ini adalah single source of truth.** Spec + roadmap + progress log
> dalam satu file. Setiap sesi vibecoding wajib membaca, mengikuti, dan
> meng-update file ini.

---

## 0. Untuk AI Coding Agent (baca pertama, setiap sesi)

Kamu adalah engineer yang bekerja pada simulator MRSAM ini. Sesi sebelumnya
mungkin sudah menyelesaikan sebagian, sesi berikutnya akan melanjutkan. Ikuti
protokol ini di setiap sesi:

**Saat sesi mulai:**
1. Baca seluruh dokumen ini dari atas ke bawah.
2. Lihat seksi `## 13. Current Focus` — task aktif berikutnya.
3. Lihat seksi `## 12. Roadmap` — verifikasi status checkbox.
4. Lihat seksi `## 14. Progress Log` — pahami apa yang baru saja dikerjakan
   dan apa keputusan teknis yang sudah dibuat.
5. Lihat seksi `## 15. Decision Log` — jangan ubah keputusan tanpa alasan.
6. Konfirmasi ke user: "Saya akan lanjutkan dari [task X]. Mulai?"

**Selama sesi:**
- Kerjakan task secukupnya untuk satu sesi (jangan rakus). Lebih baik 1 task
  selesai dengan test daripada 5 task setengah jalan.
- Setiap task harus disertai test (Vitest). No untested code di simulation
  core.
- Tulis kode TypeScript strict. No `any`, no `@ts-ignore` tanpa komentar
  alasan.
- Comment dalam Bahasa Indonesia untuk explainer, English untuk JSDoc/API.

**Saat sesi mau berakhir (atau token mau habis):**
1. Centang task yang sudah selesai di roadmap (`- [ ]` → `- [x]`).
2. Jika task hanya selesai sebagian, tulis catatan di bawahnya:
   `> Partial: [apa yang sudah, apa yang belum]`.
3. Tambahkan entry baru di `## 14. Progress Log` dengan format yang sudah ada.
4. Update `## 13. Current Focus` ke task berikutnya.
5. Jika ada keputusan teknis baru, tambahkan ke `## 15. Decision Log`.
6. Berikan ringkasan singkat ke user: apa yang dikerjakan, file apa yang
   diubah, apa next step.

**Aturan keras (jangan langgar):**
- Jangan refactor besar tanpa persetujuan user.
- Jangan ganti library/framework yang sudah dipilih.
- Jangan skip Phase berikutnya — kerjakan berurutan kecuali ada blocker.
- Jangan tulis kode > 200 baris dalam satu file tanpa alasan kuat.
- Jika ragu, tanya user lebih dulu.

---

## 1. Identitas Proyek

- **Nama**: MRSAM Operator Simulator (working title; user bisa rename)
- **Tier**: Medium-Range Surface-to-Air Missile (40–100 km engagement range)
- **Hero system**: Barak-8 / MRSAM (Israel-India joint development)
  - Alasan: well-documented public specs, arsitektur modern (AESA + active
    seeker + VLS), kompleksitas pas untuk simulator (tidak setrivial MANPADS,
    tidak seberat S-400).
- **Genre**: Top-down tactical operator simulator. Pemain berperan sebagai
  operator di Battle Management Centre — bukan pilot, bukan god-view RTS.
- **Sasaran realisme**: Functional realism, bukan visual realism. Fisika
  missile, model deteksi radar, dan workflow operator harus akurat. Grafis
  cukup schematic (mirip tactical display sungguhan).
- **Target platform**: Web (desktop dulu, mobile later)
- **Audience**: Defense/aviation enthusiast, pelajar military tech, gamer
  yang suka simulator serius (DCS-like).

---

## 2. Tech Stack

Pilihan stack final (jangan ganti tanpa diskusi user):

| Layer | Pilihan | Alasan |
|-------|---------|--------|
| Language | TypeScript 5+ strict | Type safety untuk simulation logic |
| Build | Vite | Fast dev loop, modern |
| Framework UI | React 18 | Untuk panel/HUD, ekosistem matang |
| 2D rendering (tactical display) | PixiJS atau Canvas2D | Performant 2D |
| 3D rendering (optional, nanti) | Three.js | Jika butuh 3D view |
| State management | Zustand | Lightweight, cocok untuk game state |
| Math | gl-matrix | Fast vector/matrix ops |
| Testing | Vitest + @testing-library/react | Cepat, kompatibel dengan Vite |
| E2E | Playwright | User punya background Cypress, Playwright lebih cocok untuk web modern |
| Linting | ESLint + Prettier | Standard |
| Schema/validation | Zod | Validasi scenario JSON, save game |
| Package manager | pnpm | Cepat, disk-efficient |

**Browser target**: Evergreen (Chrome/Edge/Firefox/Safari latest 2 versions).

---

## 3. Arsitektur High-Level

Sistem dibagi menjadi 4 layer dengan dependency satu arah (atas → bawah):

```
┌───────────────────────────────────────────────────┐
│  PRESENTATION                                     │
│  React UI + PixiJS tactical display               │
│  (subscribe ke world state, render)               │
└──────────────────▲────────────────────────────────┘
                   │ readonly state
┌──────────────────┴────────────────────────────────┐
│  GAME LAYER                                       │
│  Scenario loader, mission objectives, scoring     │
└──────────────────▲────────────────────────────────┘
                   │
┌──────────────────┴────────────────────────────────┐
│  C2 / DECISION LAYER                              │
│  TEWA, weapon assignment, ROE state machine,      │
│  operator action handler                          │
└──────────────────▲────────────────────────────────┘
                   │
┌──────────────────┴────────────────────────────────┐
│  SIMULATION CORE                                  │
│  Tick loop, entities, physics, sensors, missiles, │
│  threats, datalink, RNG (seeded)                  │
└───────────────────────────────────────────────────┘
```

**Aturan dependency:**
- Simulation core TIDAK boleh import dari UI/React.
- Simulation core harus deterministic (given same seed + inputs, same
  outputs). Ini membuat replay & testing tractable.
- UI hanya MEMBACA state lewat selector, MENULIS lewat dispatched action.

**Folder structure (target):**
```
src/
├── core/              # simulation core, no UI deps
│   ├── time/          # tick, scheduler
│   ├── world/         # world state, entity registry
│   ├── geometry/      # coords, transforms, raycasts
│   ├── physics/       # missile physics, drag, gravity
│   ├── sensors/       # radar, IFF, EO/IR
│   ├── missiles/      # missile FSM, guidance, seeker
│   ├── threats/       # threat AI, flight models
│   ├── c2/            # TEWA, ROE, engagement tracker
│   ├── datalink/      # network model
│   ├── rng/           # seeded RNG
│   └── index.ts
├── data/              # static data: systems, missiles, threats
│   ├── systems/
│   ├── missiles/
│   ├── threats/
│   └── scenarios/
├── ui/                # React components
│   ├── tactical/      # tactical display (PixiJS)
│   ├── panels/        # operator panels
│   └── App.tsx
├── store/             # Zustand stores
├── lib/               # shared utils
└── main.tsx
```

---

## 4. Data Model (singkatan; detail di kode)

```ts
// Identitas & posisi
type EntityId = string;
type Vec3 = [number, number, number]; // ENU local frame, meters
type LatLonAlt = { lat: number; lon: number; alt: number };

// Battery (unit MRSAM lengkap)
interface Battery {
  id: EntityId;
  name: string;
  faction: 'BLUE' | 'RED' | 'NEUTRAL';
  position: LatLonAlt;
  status: 'deploying' | 'ready' | 'engaging' | 'reloading' | 'displacing';
  componentIds: EntityId[];
  inventory: { missilesTotal: number; missilesLoaded: number };
  doctrine: Doctrine;
}

// Komponen (radar, launcher, BMC)
interface Component {
  id: EntityId;
  batteryId: EntityId;
  type: 'mfr' | 'launcher' | 'bmc' | 'eo_ir' | 'iff';
  position: LatLonAlt;
  health: number; // 0..1
  powerState: 'off' | 'warmup' | 'standby' | 'active';
  emitting: boolean; // untuk radar — mempengaruhi RWR detection
}

// Track (apa yang terlihat operator)
interface Track {
  id: EntityId;
  position: LatLonAlt;        // dengan error
  velocity: Vec3;             // dengan error
  uncertainty: number;        // m, growing kalau no update
  classification: 'unknown' | 'aircraft' | 'cruise_missile' | 'helicopter' | 'drone' | 'ballistic';
  allegiance: 'unknown' | 'friendly' | 'hostile' | 'neutral';
  threatLevel: number;        // 0..1
  trackQuality: number;       // 0..1
  sourceSensorIds: EntityId[];
  engagementStatus: 'none' | 'assigned' | 'engaged' | 'killed';
  firstSeenT: number;
  lastUpdateT: number;
}

// Truth (ground truth, hanya untuk simulation core, BUKAN ditampilkan ke pemain)
interface TargetTruth {
  id: EntityId;
  position: LatLonAlt;
  velocity: Vec3;
  rcs: number;                // m^2, varies by aspect
  irSignature: number;
  type: ThreatType;
  alive: boolean;
  flightPlan: Waypoint[];
  evasionState: EvasionState;
}

// Missile in flight
interface Missile {
  id: EntityId;
  typeId: string;             // ref ke data
  position: LatLonAlt;
  velocity: Vec3;
  mass: number;
  fuelRemaining: number;
  phase: 'stowed' | 'preparing' | 'boost' | 'midcourse' | 'terminal' | 'detonated' | 'missed' | 'self_destruct';
  guidanceMode: 'command' | 'midcourse_inertial' | 'midcourse_uplink' | 'active_seeker' | 'lost';
  targetTrackId?: EntityId;
  seekerLocked: boolean;
  launcherCellId: EntityId;
  launchT: number;
}
```

Detail lengkap akan grow seiring implementasi.

---

## 5. State Machines (high level)

**Battery FSM:**
`STOWED → DEPLOYING → READY → ENGAGING ⇄ READY → DISPLACING → STOWED`

**Missile FSM:**
`STOWED → PREPARING → BOOST → MIDCOURSE → TERMINAL → (DETONATED|MISSED|SELF_DESTRUCT)`

**ROE FSM:**
`WEAPONS_HOLD → WEAPONS_TIGHT → WEAPONS_FREE` (operator-controlled)

**Track lifecycle:**
`TENTATIVE → CONFIRMED → COASTING → DROPPED`

Setiap FSM harus implementasi sebagai pure function `transition(state, event) => state`.

---

## 6. Game Loop

- **Fixed simulation tick**: 60 Hz (16.67 ms)
- **Sensor sub-tick**: variable per sensor (search radar 6 RPM = 0.1 Hz scan
  complete; tapi internal beam dwell di-update tiap simulation tick)
- **Render frame**: `requestAnimationFrame` decoupled dari simulation
- **Determinism**: Semua randomness lewat seeded RNG (lokal per skenario)

```ts
// pseudocode
function gameLoop(timestamp) {
  while (accumulator >= TICK_MS) {
    world = simulationTick(world, TICK_MS / 1000);
    accumulator -= TICK_MS;
  }
  render(world, alpha = accumulator / TICK_MS); // interpolate
  requestAnimationFrame(gameLoop);
}
```

---

## 7. Realism Targets

Hal-hal spesifik yang HARUS terasa:

1. **Detection bukan deterministic.** Pd dihitung dari radar equation
   sederhana: `SNR ∝ (Pt × G² × λ² × σ) / R⁴`. Threshold + noise → probabilistic
   detect.
2. **Track quality menurun saat target manuver atau di-jam.** Visualisasikan
   sebagai uncertainty ellipse di tactical display.
3. **Multi-target capacity terbatas.** Battery bisa engage max 8–24 target
   simultan. Saat overload, TEWA harus prioritize.
4. **Notching exploit.** Target yang fly perpendicular ke radar (zero
   Doppler) drop track sementara di pulse-Doppler radar.
5. **Seeker handoff failure.** Active seeker missile bisa fail acquire kalau
   midcourse data buruk → missile lost / self-destruct.
6. **Emission control trade-off.** Search radar emit terus → terdeteksi RWR
   musuh → vulnerable ARM. Operator harus manage emission time.
7. **Datalink dependency.** Battery bisa receive track dari sister radar via
   datalink. Putus datalink = lebih buta.
8. **Salvo doctrine.** Default 2 missile per high-threat target, time
   separation 3–5 detik. Configurable.
9. **Engagement timeline jelas.** Detect → track → identify → assign → launch
   → midcourse → terminal → assess. Setiap transisi ada waktu nyata.
10. **Magazine matters.** Reload tidak instan; saat magazine habis dan threat
    masih banyak, pemain harus prioritize.

---

## 8. Threats yang harus didukung

| Threat | RCS | Speed | Altitude | Catatan |
|--------|-----|-------|----------|---------|
| 4th-gen fighter | 3–5 m² | M0.9–M2.0 | 100m–15km | Manuver sampai 9G |
| Helicopter | 5–10 m² | 50–80 m/s | 10m–3km | Sering NOE; rotor blade flash bisa di-detect |
| Cruise missile (subsonic) | 0.1–0.5 m² | M0.7 | 30m–500m | Susah di-detect karena low + small |
| Cruise missile (supersonic) | 0.5–1 m² | M2.5 | varies | Lebih cepat tapi lebih hot |
| UAV (small) | 0.01–0.1 m² | 30 m/s | 100m–5km | Hardest detect, slow |
| Stealth aircraft | 0.001–0.01 m² | M0.9 | high | Hampir invisible di X-band; VHF bisa detect tapi tidak fire-control quality |
| TBM (short range) | 0.1 m² | M5+ | up to 100km | Kemampuan terbatas — endgame stretch goal |
| ARM | 0.05 m² | M2 | varies | Threat ke radar Anda sendiri |

Setiap threat punya **flight model** (waypoint follower) dan **evasion AI**
sederhana (notching, jamming, terrain mask).

---

## 9. Reference data — Barak-8 (untuk Phase 4 dan seterusnya)

Sumber publik:
- **Missile**: dual-pulse rocket motor, range up to 70–100 km, ceiling
  ~16 km, top speed ~M2, active radar seeker (X-band), thrust vectoring.
- **MFR (EL/M-2248 MF-STAR)**: AESA, S-band, range ~250 km untuk fighter-size
  RCS, 360° coverage (4 face), simultan track ~1100, engage ~24.
- **Battery typical**:
  - 1× MFR (truck-mounted)
  - 1× BMC (Battle Management Centre)
  - 3–4× Launcher, masing-masing 8 cell VLS = 24–32 missile loaded
  - 1–2× Reloader vehicle
- **Setup time**: ~5 menit (modern, mobile)

Detail engineering lebih dalam akan dimasukkan ke `/data/systems/barak8.json`.

---

## 10. Scenario format

Scenario adalah JSON yang di-validate dengan Zod. Skeleton:

```json
{
  "id": "tutorial-01",
  "name": "Single bandit, clear weather",
  "difficulty": "tutorial",
  "seed": 12345,
  "duration": 600,
  "weather": { "ceiling": 10000, "visibility": 20000, "wind": [5, 90] },
  "blueforces": [
    { "type": "battery", "system": "barak8", "position": {...}, "loadout": "default" }
  ],
  "redforces": [
    { "type": "aircraft", "model": "su24", "spawnAt": 5, "waypoints": [...] }
  ],
  "objectives": [
    { "type": "defend", "target": "airbase-01", "duration": 600 },
    { "type": "min_kills", "count": 1 }
  ],
  "roe_initial": "WEAPONS_TIGHT"
}
```

---

## 11. UI / Operator Workstation (target Phase 6)

Layout target (desktop, 1920×1080):

```
┌─────────────────────────────────────────────────────────────────┐
│ TOP BAR: scenario name, sim time, ROE state, alarm, sound       │
├─────────────────────────┬───────────────────────────────────────┤
│                         │  TRACK LIST                           │
│                         │  - id, range, speed, alt, class       │
│   TACTICAL DISPLAY      │  - hostility, engagement status       │
│   (PPI / map view)      ├───────────────────────────────────────┤
│   - own forces          │  ENGAGEMENT PANEL                     │
│   - tracks              │  - selected track detail              │
│   - WEZ overlay         │  - assign weapon button               │
│   - radar coverage      │  - in-flight missile status           │
│                         ├───────────────────────────────────────┤
│                         │  SYSTEM STATUS                        │
│                         │  - radar state, magazine, datalink    │
├─────────────────────────┴───────────────────────────────────────┤
│ COMMAND BAR: ROE, emission control, displace, speed (1×/4×/16×) │
└─────────────────────────────────────────────────────────────────┘
```

Sound cues penting: track new, lock warning (RWR feedback ke Anda), missile
launch, missile impact, missile miss, magazine low, datalink lost.

---

## 12. Roadmap

> **Format**: `- [ ]` belum mulai, `- [~]` partial (lihat catatan di
> bawahnya), `- [x]` selesai dengan test passing.

### Phase 0 — Foundation
- [ ] **0.1** Inisialisasi repo: pnpm + Vite + TS strict + ESLint + Prettier
- [ ] **0.2** Setup Vitest, satu sample test passing
- [ ] **0.3** Setup folder structure sesuai seksi 3
- [ ] **0.4** Setup Zustand store skeleton
- [ ] **0.5** Setup React App skeleton dengan placeholder layout
- [ ] **0.6** Setup Playwright dengan satu smoke test
- [ ] **0.7** Setup CI sederhana (lint + test) — bisa GitHub Actions
- [ ] **0.8** Tambah README dasar dengan cara run dev/test/build

### Phase 1 — Simulation Core
- [ ] **1.1** Seeded RNG (mulberry32 atau xoshiro), test deterministic
- [ ] **1.2** Time/tick system: fixed timestep loop, accumulator pattern
- [ ] **1.3** Geometry utils: ENU↔ECEF↔LatLonAlt conversion, haversine
- [ ] **1.4** Vector math wrappers (di atas gl-matrix)
- [ ] **1.5** Entity registry (Map<EntityId, Entity>) dengan add/remove/get
- [ ] **1.6** World state struct: { entities, time, rng, scenario }
- [ ] **1.7** simulationTick(world, dt) skeleton — pure function
- [ ] **1.8** Test: 1000 tick deterministic dengan seed sama

### Phase 2 — Sensors
- [ ] **2.1** Radar equation simplified: hitung Pd(rcs, range, altitude)
- [ ] **2.2** Atmospheric attenuation model (sederhana, by frequency band)
- [ ] **2.3** Search radar component: rotating beam, scan period, FOV
- [ ] **2.4** Search radar tick: untuk setiap target dalam beam, roll Pd
- [ ] **2.5** Doppler / notching model (target perpendicular drop)
- [ ] **2.6** Track manager: correlation, track init, drop after N misses
- [ ] **2.7** Track quality calculation
- [ ] **2.8** Track-while-scan (TWS) untuk MFR
- [ ] **2.9** Fire control radar: lebih akurat, terbatas channel
- [ ] **2.10** IFF interrogator: mode 4 challenge-response
- [ ] **2.11** EO/IR sensor: passive, line-of-sight, thermal contrast model
- [ ] **2.12** RWR model (untuk threat aware terhadap radar Anda)
- [ ] **2.13** Test suite untuk semua sensor

### Phase 3 — Threats & Targets
- [ ] **3.1** Threat type registry, RCS table per aspect
- [ ] **3.2** Waypoint flight model dengan smooth turn
- [ ] **3.3** Aircraft threat: fighter, bomber profiles
- [ ] **3.4** Cruise missile threat: low-altitude, terrain follow (simplified)
- [ ] **3.5** Helicopter threat: NOE, hover capability
- [ ] **3.6** UAV threat: small RCS, slow
- [ ] **3.7** Evasion AI: notch, terrain mask, chaff/flare
- [ ] **3.8** Threat spawner dari scenario file
- [ ] **3.9** Test: threat profile reproducible

### Phase 4 — Missile
- [ ] **4.1** Missile data file: barak8.json dengan kinematics
- [ ] **4.2** Missile FSM (boost → midcourse → terminal → impact/miss)
- [ ] **4.3** Boost phase: thrust vector, burn time, mass loss
- [ ] **4.4** Drag model: simplified Cd vs Mach curve
- [ ] **4.5** Gravity, earth rotation (optional)
- [ ] **4.6** Proportional Navigation guidance law
- [ ] **4.7** Midcourse: inertial + uplink correction
- [ ] **4.8** Active seeker: handoff, FOV, lock probability
- [ ] **4.9** Terminal phase: PN dengan latax limit
- [ ] **4.10** Proximity fuse + warhead damage model
- [ ] **4.11** Pk calculation berdasar miss distance + warhead lethal radius
- [ ] **4.12** Self-destruct kalau lost
- [ ] **4.13** Test: missile vs non-manuvering target hit rate ≈ expected
- [ ] **4.14** Test: missile vs notching target rate menurun

### Phase 5 — C2 / TEWA / ROE
- [ ] **5.1** ROE state machine + operator commands
- [ ] **5.2** Threat evaluation: prioritize by TTI, classification, asset value
- [ ] **5.3** Weapon assignment: pilih launcher dengan geometri terbaik
- [ ] **5.4** Engagement tracker: missile-track linkage, salvo logic
- [ ] **5.5** Doctrine: missile per target (1, 2 STT, dst), config-driven
- [ ] **5.6** Kill assessment: post-impact radar verification
- [ ] **5.7** Shoot-look-shoot vs shoot-shoot-look
- [ ] **5.8** Datalink: receive track dari unit lain
- [ ] **5.9** Saturation handling: queue + abandon low priority
- [ ] **5.10** Test: skenario saturation 12 cruise missile

### Phase 6 — UI / Operator Workstation
- [ ] **6.1** App shell + layout grid
- [ ] **6.2** Tactical display canvas (PixiJS): own forces, north-up
- [ ] **6.3** Tactical display: track render dengan hostility color
- [ ] **6.4** Tactical display: WEZ overlay (engagement envelope)
- [ ] **6.5** Tactical display: radar coverage cone overlay
- [ ] **6.6** Track list panel (sortable, selectable)
- [ ] **6.7** Engagement panel: detail track terpilih + assign button
- [ ] **6.8** In-flight missile panel: track linkage, ETA impact
- [ ] **6.9** System status panel: radar/launcher/magazine/datalink
- [ ] **6.10** ROE control + emission control
- [ ] **6.11** Time control: pause / 1× / 4× / 16×
- [ ] **6.12** Sound cue system (track new, launch, impact, RWR)
- [ ] **6.13** Settings: theme, audio volume, hotkeys
- [ ] **6.14** Tutorial overlay system

### Phase 7 — Scenarios & Content
- [ ] **7.1** Scenario JSON schema + Zod validator
- [ ] **7.2** Scenario loader + selector menu
- [ ] **7.3** Skenario tutorial-01: single bandit, high alt, clear
- [ ] **7.4** Skenario tutorial-02: low-alt cruise missile, single
- [ ] **7.5** Skenario combat-01: 4-ship fighter package
- [ ] **7.6** Skenario combat-02: saturation raid 12 cruise missile
- [ ] **7.7** Skenario combat-03: SEAD escort + strikers
- [ ] **7.8** Skenario combat-04: stealth + jamming
- [ ] **7.9** Mission objective evaluator + scoring
- [ ] **7.10** After-action report screen

### Phase 8 — Polish & Stretch
- [ ] **8.1** Save/resume mid-scenario
- [ ] **8.2** Replay system (record state + tick events, playback)
- [ ] **8.3** Statistics tracking lintas misi
- [ ] **8.4** Performance pass: profile, optimize hot loops
- [ ] **8.5** Accessibility: keyboard nav, screen reader untuk panel UI
- [ ] **8.6** Localization: ID + EN
- [ ] **8.7** Documentation: in-app glossary, mekanika doc
- [ ] **8.8** Mobile layout (stretch)
- [ ] **8.9** Multiple system support: NASAMS, Buk-M3 sebagai data variant
- [ ] **8.10** Multiplayer co-op (operator + commander) — hard stretch

---

## 13. Current Focus

> **Selalu pointer ke task aktif berikutnya. Update di akhir setiap sesi.**

**Status**: Belum mulai. Sesi pertama harus:
1. Konfirmasi tech stack dengan user (atau langsung pakai default seksi 2).
2. Mulai dari **Phase 0.1 — Inisialisasi repo**.

**Next task**: `0.1 Inisialisasi repo`

---

## 14. Progress Log

> Format: `### YYYY-MM-DD — Session N`, lalu bullet ringkas. Tambah entry
> baru di paling atas seksi ini (terbaru di atas).

### Belum ada sesi
_Sesi pertama akan tambah entry pertama di sini._

---

## 15. Decision Log

> Format: `### [tanggal] - [topik]`, lalu konteks + keputusan + alasan.
> Sekali keputusan dibuat, jangan diubah tanpa diskusi user.

### Initial — Tech stack default
- **Konteks**: User punya background QA + web tech, pengen vibecoding-ready.
- **Keputusan**: TS strict + Vite + React + Zustand + PixiJS + Vitest.
- **Alasan**: Familiar untuk web devs Indonesia, ekosistem matang, fast
  iteration. PixiJS dipilih daripada Three.js karena tactical display itu
  inherently 2D.

### Initial — Hero system Barak-8
- **Konteks**: Pilih satu sistem MRSAM sebagai basis.
- **Keputusan**: Barak-8.
- **Alasan**: Public spec lengkap, modern (AESA + active seeker), kompleksitas
  pas, ada hubungan India-Israel-banyak negara user (termasuk Indonesia
  pernah pertimbangkan Barak-8 untuk navy).

### Initial — Functional realism, bukan visual
- **Konteks**: Scope-management.
- **Keputusan**: Schematic 2D top-down. Tidak ada 3D pesawat model.
- **Alasan**: Realism utama ada di sensor + missile + decision logic. 3D
  pesawat boros dan tidak menambah edukasi.

---

## 16. Glossary

- **AESA**: Active Electronically Scanned Array. Radar modern dengan beam
  steering elektronik.
- **ARM**: Anti-Radiation Missile. Missile yang home pada emisi radar.
- **BMC**: Battle Management Centre. Pusat C2 untuk satu battery.
- **C2**: Command & Control.
- **DEAD**: Destruction of Enemy Air Defenses.
- **ECCM**: Electronic Counter-CounterMeasures. Defense terhadap jamming.
- **ECM**: Electronic CounterMeasures. Jamming.
- **ENU**: East-North-Up coordinate frame.
- **EO/IR**: Electro-Optical / Infra-Red sensor.
- **FOV**: Field of View.
- **IADS**: Integrated Air Defense System.
- **IFF**: Identification Friend or Foe.
- **MFR**: Multi-Function Radar.
- **MRSAM**: Medium-Range Surface-to-Air Missile.
- **NEZ**: No-Escape Zone.
- **NOE**: Nap-of-the-Earth flying (very low alt, terrain hugging).
- **Pd**: Probability of Detection.
- **PGM**: Precision-Guided Munition.
- **Pk**: Probability of Kill.
- **PN**: Proportional Navigation (missile guidance law).
- **PPI**: Plan Position Indicator (radar display).
- **RCS**: Radar Cross-Section.
- **ROE**: Rules of Engagement.
- **RWR**: Radar Warning Receiver.
- **SEAD**: Suppression of Enemy Air Defenses.
- **STT**: Single Target Track.
- **TBM**: Tactical Ballistic Missile.
- **TEL**: Transporter-Erector-Launcher.
- **TEWA**: Threat Evaluation & Weapon Assignment.
- **TTI**: Time To Intercept.
- **TVM**: Track-Via-Missile.
- **TWS**: Track-While-Scan.
- **VLS**: Vertical Launch System.
- **WEZ**: Weapon Engagement Zone.

---

## 17. References (untuk dipelajari saat butuh)

Public, openly available:
- US Army FM 3-01.85 (Patriot Battalion Operations) — banyak prinsip umum
- Janes (paid, tapi ringkasan public-nya OK)
- Wikipedia: Barak 8, MF-STAR, MRSAM
- DCS World manual untuk Patriot/Hawk module — best operator workflow ref
- "Surface-to-Air Missile Systems" oleh Carlo Kopp (ausairpower.net)
- Paper: "An Overview of Track-While-Scan Radar Systems"
- Anywhere else you can get the information



---

_End of document. Update bagian relevan setelah setiap sesi._
