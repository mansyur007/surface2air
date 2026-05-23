const { useState, useEffect, useRef, useMemo } = React;

// ============================================================
// SIMULATED TRACK DATA
// ============================================================
const INITIAL_TRACKS = [
  { id: "T-014", type: "AIR", class: "FAST-JET",  bearing: 42, range: 38.2, alt: 9100, speed: 480, hostility: "HOSTILE",  ttg: 28 },
  { id: "T-015", type: "AIR", class: "CRUISE-M",  bearing: 358, range: 22.7, alt:  120, speed: 620, hostility: "HOSTILE",  ttg: 14 },
  { id: "T-018", type: "AIR", class: "UAV",       bearing: 112, range: 51.4, alt: 4200, speed: 180, hostility: "UNKNOWN",  ttg: 73 },
  { id: "T-021", type: "AIR", class: "ROTARY",    bearing: 268, range: 17.9, alt:  340, speed:  95, hostility: "FRIENDLY", ttg: null },
  { id: "T-024", type: "AIR", class: "FAST-JET",  bearing: 88, range: 64.1, alt: 11200,speed: 510, hostility: "UNKNOWN",  ttg: 92 },
  { id: "T-027", type: "AIR", class: "FAST-JET",  bearing: 195, range: 71.6, alt: 8800, speed: 460, hostility: "FRIENDLY", ttg: null },
  { id: "T-029", type: "AIR", class: "BALLOON",   bearing: 332, range: 44.0, alt: 18000,speed:  22, hostility: "UNKNOWN",  ttg: 410 },
];

const BATTERIES = [
  { id: "ALPHA-1", status: "READY",    rdy: 4, total: 4, kind: "MR-SAM" },
  { id: "ALPHA-2", status: "READY",    rdy: 3, total: 4, kind: "MR-SAM" },
  { id: "BRAVO-1", status: "TRACKING", rdy: 4, total: 4, kind: "LR-SAM" },
  { id: "BRAVO-2", status: "RELOAD",   rdy: 1, total: 4, kind: "LR-SAM" },
  { id: "CHARLIE", status: "STANDBY",  rdy: 6, total: 6, kind: "SR-PDS" },
];

// ============================================================
// HELPERS
// ============================================================
const pad = (n, w = 2) => String(n).padStart(w, "0");
const fmt3 = (n) => String(Math.round(n)).padStart(3, "0");

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 250);
    return () => clearInterval(id);
  }, []);
  return now;
}

function zulu(d) {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}
function ddmmm(d) {
  const m = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][d.getUTCMonth()];
  return `${pad(d.getUTCDate())} ${m} ${d.getUTCFullYear()}`;
}

// ============================================================
// RADAR SCOPE
// ============================================================
function Scope({ tracks, selected, onSelect, sweepOn, scopeStyle, t, palette }) {
  const SIZE = 520;
  const C = SIZE / 2;
  const MAX_RANGE = 80; // nm

  // sweep angle (degrees, clockwise from north)
  const sweep = sweepOn ? (t * 60) % 360 : null;

  const rangeRings = [20, 40, 60, 80];
  const compass = scopeStyle === "ppi"
    ? [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
    : [0, 90, 180, 270];

  // project track to xy on scope
  function project(track) {
    const r = (track.range / MAX_RANGE) * (SIZE / 2 - 16);
    const rad = (track.bearing - 90) * Math.PI / 180;
    return { x: C + Math.cos(rad) * r, y: C + Math.sin(rad) * r };
  }

  // sweep echo intensity per track (decays after sweep passes)
  function intensity(track) {
    if (!sweepOn) return 1;
    const delta = ((sweep - track.bearing) % 360 + 360) % 360;
    // brightest just behind the sweep line
    return Math.max(0.18, 1 - delta / 90);
  }

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" height="100%" style={{ display: "block" }}>
      <defs>
        <radialGradient id="scope-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor={palette.scopeInner} />
          <stop offset="100%" stopColor={palette.scopeOuter} />
        </radialGradient>
        <linearGradient id="sweep-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={palette.primary} stopOpacity="0" />
          <stop offset="80%"  stopColor={palette.primary} stopOpacity="0.05" />
          <stop offset="100%" stopColor={palette.primary} stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {/* background */}
      <circle cx={C} cy={C} r={SIZE / 2 - 4} fill="url(#scope-bg)" stroke={palette.gridStrong} strokeWidth="1" />

      {/* range rings */}
      {rangeRings.map((r, i) => {
        const radius = (r / MAX_RANGE) * (SIZE / 2 - 16);
        return (
          <g key={r}>
            <circle cx={C} cy={C} r={radius} fill="none" stroke={palette.grid} strokeWidth="0.8" strokeDasharray={i === rangeRings.length - 1 ? "0" : "3 4"} />
            <text x={C + radius + 2} y={C - 4} fill={palette.gridText} fontSize="9" fontFamily="JetBrains Mono, monospace">{r}nm</text>
          </g>
        );
      })}

      {/* compass spokes */}
      {compass.map(deg => {
        const rad = (deg - 90) * Math.PI / 180;
        const x2 = C + Math.cos(rad) * (SIZE / 2 - 16);
        const y2 = C + Math.sin(rad) * (SIZE / 2 - 16);
        return <line key={deg} x1={C} y1={C} x2={x2} y2={y2} stroke={palette.grid} strokeWidth="0.6" />;
      })}

      {/* cardinal labels */}
      {[["N", 0], ["E", 90], ["S", 180], ["W", 270]].map(([l, d]) => {
        const rad = (d - 90) * Math.PI / 180;
        const x = C + Math.cos(rad) * (SIZE / 2 - 4);
        const y = C + Math.sin(rad) * (SIZE / 2 - 4) + 4;
        return <text key={l} x={x} y={y} fill={palette.primary} fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="700" textAnchor="middle">{l}</text>;
      })}

      {/* engagement envelope */}
      <circle cx={C} cy={C} r={(50 / MAX_RANGE) * (SIZE / 2 - 16)} fill="none" stroke={palette.amber} strokeWidth="0.6" strokeDasharray="2 6" opacity="0.5" />

      {/* SAM site at center */}
      <g transform={`translate(${C} ${C})`}>
        <polygon points="0,-8 7,5 -7,5" fill={palette.primary} />
        <circle r="3" fill={palette.bgDeep} />
      </g>

      {/* sweep wedge */}
      {sweepOn && (
        <g transform={`translate(${C} ${C}) rotate(${sweep - 90})`}>
          <path d={`M 0 0 L ${SIZE/2 - 16} 0 A ${SIZE/2 - 16} ${SIZE/2 - 16} 0 0 0 ${(SIZE/2-16)*Math.cos(-Math.PI/3)} ${(SIZE/2-16)*Math.sin(-Math.PI/3)} Z`} fill="url(#sweep-grad)" />
          <line x1="0" y1="0" x2={SIZE/2 - 16} y2="0" stroke={palette.primary} strokeWidth="1.5" />
        </g>
      )}

      {/* tracks */}
      {tracks.map(tr => {
        const { x, y } = project(tr);
        const I = intensity(tr);
        const isSel = selected === tr.id;
        const color = tr.hostility === "HOSTILE" ? palette.red
                    : tr.hostility === "FRIENDLY" ? palette.blue
                    : palette.amber;
        const shape = tr.hostility === "HOSTILE"
          ? <polygon points="-7,-7 7,-7 0,7" fill="none" stroke={color} strokeWidth="1.6" />
          : tr.hostility === "FRIENDLY"
          ? <circle r="6.5" fill="none" stroke={color} strokeWidth="1.6" />
          : <rect x="-6" y="-6" width="12" height="12" fill="none" stroke={color} strokeWidth="1.6" />;

        // velocity vector
        const vRad = (tr.bearing + (tr.hostility === "HOSTILE" ? 180 : 0) - 90) * Math.PI / 180;
        const vLen = Math.min(28, tr.speed / 20);
        const vx = Math.cos(vRad) * vLen;
        const vy = Math.sin(vRad) * vLen;

        return (
          <g key={tr.id} transform={`translate(${x} ${y})`} opacity={I} style={{ cursor: "pointer" }} onClick={() => onSelect(tr.id)}>
            {isSel && <circle r="14" fill="none" stroke={palette.primary} strokeWidth="1" strokeDasharray="2 2" />}
            {shape}
            <line x1="0" y1="0" x2={vx} y2={vy} stroke={color} strokeWidth="1" opacity="0.7" />
            <text x="10" y="-8" fill={color} fontSize="9" fontFamily="JetBrains Mono, monospace">{tr.id}</text>
            <text x="10" y="3" fill={palette.muted} fontSize="8" fontFamily="JetBrains Mono, monospace">{Math.round(tr.alt/100)*100/1000}k</text>
          </g>
        );
      })}

      {/* crosshair */}
      <line x1={C} y1="8" x2={C} y2={SIZE - 8} stroke={palette.grid} strokeWidth="0.4" />
      <line x1="8" y1={C} x2={SIZE - 8} y2={C} stroke={palette.grid} strokeWidth="0.4" />
    </svg>
  );
}

// ============================================================
// PANELS
// ============================================================
function StatusPill({ label, value, tone = "ok" }) {
  const toneColor = { ok: "var(--primary)", warn: "var(--amber)", crit: "var(--red)", muted: "var(--muted)" }[tone];
  return (
    <div className="pill">
      <span className="pill-label">{label}</span>
      <span className="pill-value" style={{ color: toneColor }}>{value}</span>
    </div>
  );
}

function TrackRow({ track, selected, onSelect }) {
  const hostColor = track.hostility === "HOSTILE" ? "var(--red)"
                  : track.hostility === "FRIENDLY" ? "var(--blue)"
                  : "var(--amber)";
  return (
    <div className={`track-row ${selected ? "selected" : ""}`} onClick={() => onSelect(track.id)}>
      <span className="t-id">{track.id}</span>
      <span className="t-class">{track.class}</span>
      <span className="t-brg">{fmt3(track.bearing)}°</span>
      <span className="t-rng">{track.range.toFixed(1)}</span>
      <span className="t-alt">{pad(Math.round(track.alt / 100), 3)}</span>
      <span className="t-spd">{track.speed}</span>
      <span className="t-host" style={{ color: hostColor }}>● {track.hostility.slice(0,3)}</span>
      <span className="t-ttg">{track.ttg ? `${track.ttg}s` : "—"}</span>
    </div>
  );
}

function BatteryCard({ b, onAssign, canAssign }) {
  const tone = b.status === "READY" ? "ok" : b.status === "TRACKING" ? "warn" : b.status === "RELOAD" ? "crit" : "muted";
  return (
    <div className="battery">
      <div className="battery-head">
        <div>
          <div className="battery-id">{b.id}</div>
          <div className="battery-kind">{b.kind}</div>
        </div>
        <StatusPill label="ST" value={b.status} tone={tone} />
      </div>
      <div className="battery-cells">
        {Array.from({ length: b.total }).map((_, i) => (
          <div key={i} className={`cell ${i < b.rdy ? "loaded" : "empty"}`} />
        ))}
      </div>
      <div className="battery-foot">
        <span className="muted">RDY {b.rdy}/{b.total}</span>
        <button className="btn-mini" disabled={!canAssign || b.status === "RELOAD"} onClick={() => onAssign(b.id)}>ASSIGN</button>
      </div>
    </div>
  );
}

// ============================================================
// ROOT
// ============================================================
function Dashboard() {
  const [t, setT] = useTweaks(/*EDITMODE-BEGIN*/{
    "scheme": "phosphor",
    "scopeStyle": "ppi",
    "sweep": true,
    "threatDensity": 1,
    "alertLevel": "RED"
  }/*EDITMODE-END*/);

  const palettes = {
    phosphor: { primary: "oklch(0.85 0.17 145)", amber: "oklch(0.82 0.17 75)", red: "oklch(0.68 0.22 25)", blue: "oklch(0.78 0.12 230)",
                bg: "oklch(0.13 0.015 150)", bgDeep: "oklch(0.09 0.012 150)", panel: "oklch(0.16 0.018 150)",
                border: "oklch(0.28 0.025 150)", muted: "oklch(0.55 0.02 150)", text: "oklch(0.92 0.02 150)",
                grid: "oklch(0.35 0.04 150)", gridStrong: "oklch(0.45 0.06 150)", gridText: "oklch(0.55 0.05 150)",
                scopeInner: "oklch(0.18 0.025 150)", scopeOuter: "oklch(0.09 0.012 150)" },
    amber:    { primary: "oklch(0.82 0.17 75)",  amber: "oklch(0.78 0.16 60)", red: "oklch(0.68 0.22 25)", blue: "oklch(0.78 0.12 230)",
                bg: "oklch(0.13 0.012 60)",  bgDeep: "oklch(0.08 0.01 60)",   panel: "oklch(0.16 0.014 60)",
                border: "oklch(0.28 0.025 60)", muted: "oklch(0.55 0.025 60)", text: "oklch(0.92 0.025 60)",
                grid: "oklch(0.36 0.05 60)", gridStrong: "oklch(0.46 0.07 60)", gridText: "oklch(0.55 0.06 60)",
                scopeInner: "oklch(0.18 0.025 60)", scopeOuter: "oklch(0.08 0.01 60)" },
    arctic:   { primary: "oklch(0.85 0.13 220)", amber: "oklch(0.82 0.17 75)", red: "oklch(0.68 0.22 25)", blue: "oklch(0.78 0.12 230)",
                bg: "oklch(0.14 0.015 230)", bgDeep: "oklch(0.09 0.012 230)", panel: "oklch(0.17 0.018 230)",
                border: "oklch(0.30 0.030 230)", muted: "oklch(0.58 0.03 230)", text: "oklch(0.94 0.02 230)",
                grid: "oklch(0.36 0.04 230)", gridStrong: "oklch(0.46 0.06 230)", gridText: "oklch(0.58 0.05 230)",
                scopeInner: "oklch(0.18 0.025 230)", scopeOuter: "oklch(0.09 0.012 230)" },
  };
  const palette = palettes[t.scheme] || palettes.phosphor;

  // sim clock
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let raf, last = performance.now();
    const loop = (now) => {
      const dt = (now - last) / 1000; last = now;
      setTick(v => v + dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const now = useNow();

  // tracks update positions slowly to feel alive
  const tracks = useMemo(() => {
    const base = INITIAL_TRACKS.slice(0, Math.round(INITIAL_TRACKS.length * t.threatDensity));
    return base.map(tr => ({
      ...tr,
      bearing: (tr.bearing + (tr.hostility === "HOSTILE" ? -0.4 : 0.2) * tick) % 360,
      range: Math.max(2, tr.range + (tr.hostility === "HOSTILE" ? -0.06 : 0.03) * tick),
      ttg: tr.ttg ? Math.max(0, tr.ttg - tick * 0.5) : null,
    }));
  }, [tick, t.threatDensity]);

  const [selected, setSelected] = useState("T-015");
  const [engagements, setEngagements] = useState([]);
  const [log, setLog] = useState([
    { t: "23:14:02Z", lvl: "INFO", msg: "BRAVO-1 search radar ACQ T-015" },
    { t: "23:14:08Z", lvl: "WARN", msg: "T-015 classified CRUISE-M, hostile" },
    { t: "23:13:51Z", lvl: "INFO", msg: "ALPHA-2 reload cell-04 complete" },
    { t: "23:13:33Z", lvl: "INFO", msg: "Datalink to NORTH-COMD nominal" },
    { t: "23:13:11Z", lvl: "WARN", msg: "T-014 entering MEZ in 28s" },
    { t: "23:12:48Z", lvl: "INFO", msg: "IFF interrogation T-021 → FRIENDLY" },
  ]);

  const selectedTrack = tracks.find(tr => tr.id === selected);

  function assignBattery(bid) {
    if (!selectedTrack) return;
    const entry = { t: zulu(new Date()), lvl: "ENGAGE", msg: `${bid} assigned to ${selectedTrack.id} (${selectedTrack.class})` };
    setLog(l => [entry, ...l].slice(0, 24));
    setEngagements(e => [...e, { battery: bid, track: selectedTrack.id, phase: "LAUNCH", t0: tick }]);
  }

  // engagement phase progression
  useEffect(() => {
    setEngagements(es => es.map(e => {
      const dt = tick - e.t0;
      const phase = dt < 2 ? "LAUNCH" : dt < 6 ? "BOOST" : dt < 14 ? "MIDCOURSE" : dt < 18 ? "TERMINAL" : "DONE";
      return { ...e, phase };
    }).filter(e => e.phase !== "DONE" || tick - e.t0 < 22));
  }, [tick]);

  const hostiles = tracks.filter(tr => tr.hostility === "HOSTILE").length;
  const unknowns = tracks.filter(tr => tr.hostility === "UNKNOWN").length;

  const alertColor = t.alertLevel === "RED" ? "var(--red)" : t.alertLevel === "AMBER" ? "var(--amber)" : "var(--primary)";

  return (
    <div className="root" style={{
      "--primary": palette.primary, "--amber": palette.amber, "--red": palette.red, "--blue": palette.blue,
      "--bg": palette.bg, "--bg-deep": palette.bgDeep, "--panel": palette.panel,
      "--border": palette.border, "--muted": palette.muted, "--text": palette.text,
    }}>
      {/* TOP BAR */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <polygon points="12,2 22,20 2,20" fill="none" stroke={palette.primary} strokeWidth="1.6" />
              <circle cx="12" cy="14" r="2.5" fill={palette.primary} />
              <line x1="12" y1="2" x2="12" y2="14" stroke={palette.primary} strokeWidth="1" strokeDasharray="2 2" />
            </svg>
          </div>
          <div>
            <div className="brand-title">AEGIDA C2</div>
            <div className="brand-sub">SECTOR-7 · NODE 04</div>
          </div>
        </div>

        <div className="top-stats">
          <StatusPill label="TIME" value={zulu(now)} />
          <StatusPill label="DATE" value={ddmmm(now)} tone="muted" />
          <StatusPill label="LINK" value="NOMINAL" tone="ok" />
          <StatusPill label="RADAR" value="ACTIVE" tone="ok" />
          <StatusPill label="HOSTILE" value={String(hostiles).padStart(2,"0")} tone="crit" />
          <StatusPill label="UNKNOWN" value={String(unknowns).padStart(2,"0")} tone="warn" />
        </div>

        <div className="alert-block" style={{ "--alert": alertColor }}>
          <div className="alert-pulse" />
          <div>
            <div className="alert-label">DEFCON</div>
            <div className="alert-value">{t.alertLevel}</div>
          </div>
        </div>
      </header>

      {/* GRID */}
      <main className="grid">
        {/* LEFT — TRACK TABLE */}
        <section className="panel tracks-panel">
          <div className="panel-head">
            <span className="panel-title">TRACK TABLE</span>
            <span className="panel-meta">{tracks.length} CONTACTS</span>
          </div>
          <div className="track-table">
            <div className="track-row track-head">
              <span>ID</span><span>CLASS</span><span>BRG</span><span>RNG</span><span>ALT</span><span>SPD</span><span>IFF</span><span>TTG</span>
            </div>
            {tracks.sort((a,b) => a.range - b.range).map(tr =>
              <TrackRow key={tr.id} track={tr} selected={selected === tr.id} onSelect={setSelected} />
            )}
          </div>

          <div className="panel-head" style={{ marginTop: 16 }}>
            <span className="panel-title">SELECTED CONTACT</span>
            <span className="panel-meta">{selectedTrack?.id ?? "—"}</span>
          </div>
          {selectedTrack ? (
            <div className="detail-grid">
              <div><div className="dl">CLASS</div><div className="dv">{selectedTrack.class}</div></div>
              <div><div className="dl">IFF</div><div className="dv" style={{ color: selectedTrack.hostility === "HOSTILE" ? "var(--red)" : selectedTrack.hostility === "FRIENDLY" ? "var(--blue)" : "var(--amber)" }}>{selectedTrack.hostility}</div></div>
              <div><div className="dl">BEARING</div><div className="dv">{fmt3(selectedTrack.bearing)}°</div></div>
              <div><div className="dl">RANGE</div><div className="dv">{selectedTrack.range.toFixed(1)} nm</div></div>
              <div><div className="dl">ALTITUDE</div><div className="dv">{(selectedTrack.alt).toLocaleString()} ft</div></div>
              <div><div className="dl">SPEED</div><div className="dv">{selectedTrack.speed} kt</div></div>
              <div><div className="dl">TTG MEZ</div><div className="dv">{selectedTrack.ttg ? `${Math.round(selectedTrack.ttg)}s` : "—"}</div></div>
              <div><div className="dl">P-KILL</div><div className="dv">{selectedTrack.hostility === "HOSTILE" ? "0.92" : "—"}</div></div>
            </div>
          ) : <div className="muted small" style={{ padding: 12 }}>No contact selected.</div>}
        </section>

        {/* CENTER — SCOPE */}
        <section className="panel scope-panel">
          <div className="panel-head">
            <span className="panel-title">SURVEILLANCE · PPI</span>
            <span className="panel-meta">RANGE 80nm · AZ 0–360° · EL 0–45°</span>
          </div>
          <div className="scope-wrap">
            <Scope tracks={tracks} selected={selected} onSelect={setSelected} sweepOn={t.sweep} scopeStyle={t.scopeStyle} t={tick} palette={palette} />
            <div className="scope-corners">
              <div className="corner tl"><span className="muted">MODE</span> <span>AUTO-TRK</span></div>
              <div className="corner tr"><span className="muted">PRF</span> <span>HIGH</span></div>
              <div className="corner bl"><span className="muted">SCAN</span> <span>{t.sweep ? "60°/s" : "PAUSED"}</span></div>
              <div className="corner br"><span className="muted">SEC</span> <span>SECRET//NOFORN</span></div>
            </div>
          </div>

          {/* ENGAGEMENTS STRIP */}
          <div className="engagements">
            <div className="panel-head">
              <span className="panel-title">ACTIVE ENGAGEMENTS</span>
              <span className="panel-meta">{engagements.length} IN-FLIGHT</span>
            </div>
            {engagements.length === 0 ? (
              <div className="muted small" style={{ padding: "10px 12px" }}>No engagements. Select a hostile and assign a battery.</div>
            ) : (
              <div className="eng-list">
                {engagements.map((e, i) => {
                  const dt = tick - e.t0;
                  const pct = Math.min(100, (dt / 18) * 100);
                  return (
                    <div key={i} className="eng-row">
                      <span className="eng-bat">{e.battery}</span>
                      <span className="eng-arr">→</span>
                      <span className="eng-trk">{e.track}</span>
                      <span className={`eng-phase ph-${e.phase}`}>{e.phase}</span>
                      <div className="eng-bar"><div className="eng-fill" style={{ width: `${pct}%` }} /></div>
                      <span className="eng-time">T+{dt.toFixed(1)}s</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT — BATTERIES + LOG */}
        <section className="panel right-panel">
          <div className="panel-head">
            <span className="panel-title">FIRE UNITS</span>
            <span className="panel-meta">5 BATTERIES</span>
          </div>
          <div className="batteries">
            {BATTERIES.map(b =>
              <BatteryCard key={b.id} b={b} onAssign={assignBattery} canAssign={selectedTrack?.hostility === "HOSTILE"} />
            )}
          </div>

          <div className="panel-head" style={{ marginTop: 16 }}>
            <span className="panel-title">EVENT LOG</span>
            <span className="panel-meta">LIVE</span>
          </div>
          <div className="log">
            {log.map((e, i) => (
              <div key={i} className={`log-row lvl-${e.lvl.toLowerCase()}`}>
                <span className="log-t">{e.t}</span>
                <span className="log-lvl">{e.lvl}</span>
                <span className="log-msg">{e.msg}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* FOOTER STATUS */}
      <footer className="footer">
        <div className="foot-cluster">
          <span className="muted">OPR</span><span>MAJ. K. VOSSEN</span>
          <span className="sep">|</span>
          <span className="muted">SHIFT</span><span>2/3</span>
          <span className="sep">|</span>
          <span className="muted">CELL</span><span>NORTH-04</span>
        </div>
        <div className="foot-cluster">
          <span className="muted">PWR</span><span>440V / 98%</span>
          <span className="sep">|</span>
          <span className="muted">CPU</span><span>23%</span>
          <span className="sep">|</span>
          <span className="muted">MEM</span><span>11.4/64GB</span>
          <span className="sep">|</span>
          <span className="muted">SAT</span><span>LOCK 7/7</span>
        </div>
        <div className="foot-cluster">
          <span className="muted">BUILD</span><span>4.21.7-stable</span>
        </div>
      </footer>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Visuals" />
        <TweakRadio label="Color scheme" value={t.scheme}
          options={["phosphor", "amber", "arctic"]}
          onChange={(v) => setT("scheme", v)} />
        <TweakRadio label="Scope grid" value={t.scopeStyle}
          options={["ppi", "min"]}
          onChange={(v) => setT("scopeStyle", v)} />
        <TweakToggle label="Radar sweep" value={t.sweep}
          onChange={(v) => setT("sweep", v)} />
        <TweakSection label="Threat picture" />
        <TweakSlider label="Track density" value={t.threatDensity}
          min={0.3} max={1} step={0.1}
          onChange={(v) => setT("threatDensity", v)} />
        <TweakRadio label="DEFCON" value={t.alertLevel}
          options={["GREEN", "AMBER", "RED"]}
          onChange={(v) => setT("alertLevel", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Dashboard />);
