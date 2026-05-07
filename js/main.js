import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildEnvironmentStatic, rebuildEnvironmentInside } from './environment.js';

// ============== Renderer & scene ==============
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x12203a);
scene.fog = new THREE.Fog(0x12203a, 200, 1400);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);
const initialCamPos = new THREE.Vector3(180, 110, 200);
camera.position.copy(initialCamPos);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 12, 0);
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.minDistance = 10;
controls.maxDistance = 1600;

// ============== Lighting (cheap, area-focused shadow) ==============
scene.add(new THREE.HemisphereLight(0x9ec5ff, 0x3a3520, 0.55));
scene.add(new THREE.AmbientLight(0xffffff, 0.22));
const sun = new THREE.DirectionalLight(0xffe2b8, 1.0);
sun.position.set(200, 280, 140);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
const sc = sun.shadow.camera;
sc.left = -120; sc.right = 120; sc.top = 120; sc.bottom = -120;
sc.near = 1; sc.far = 700;
sun.shadow.bias = -0.0006;
scene.add(sun);

// ============== Audio ==============
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
const soundEnabled = () => document.getElementById('soundOn').checked;

function playLaunch() {
  if (!soundEnabled()) return;
  ensureAudio();
  const ctx = audioCtx, t0 = ctx.currentTime;
  const boom = ctx.createOscillator();
  boom.type = 'sawtooth';
  boom.frequency.setValueAtTime(110, t0);
  boom.frequency.exponentialRampToValueAtTime(35, t0 + 0.4);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.5, t0);
  bg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
  boom.connect(bg).connect(ctx.destination);
  boom.start(t0); boom.stop(t0 + 0.6);

  const dur = 1.6, sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource(); noise.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(1200, t0);
  bp.frequency.exponentialRampToValueAtTime(280, t0 + dur);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0, t0);
  ng.gain.linearRampToValueAtTime(0.5, t0 + 0.05);
  ng.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  noise.connect(bp).connect(ng).connect(ctx.destination);
  noise.start(t0); noise.stop(t0 + dur);
}
function playExplosion() {
  if (!soundEnabled()) return;
  ensureAudio();
  const ctx = audioCtx, t0 = ctx.currentTime;
  const dur = 0.9, sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const n = ctx.createBufferSource(); n.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1500, t0);
  lp.frequency.exponentialRampToValueAtTime(150, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.85, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  n.connect(lp).connect(g).connect(ctx.destination);
  n.start(t0); n.stop(t0 + dur);
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(60, t0);
  sub.frequency.exponentialRampToValueAtTime(20, t0 + 0.5);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.55, t0);
  sg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
  sub.connect(sg).connect(ctx.destination);
  sub.start(t0); sub.stop(t0 + 0.6);
}

// ============== Floor grid texture (tiled — scales to any box size) ==============
let cachedFloorTex = null;
function getFloorTexture() {
  if (cachedFloorTex) return cachedFloorTex;
  const px = 128;
  const c = document.createElement('canvas');
  c.width = px; c.height = px;
  const g = c.getContext('2d');
  // 2x2 checker tile
  g.fillStyle = '#37483a';
  g.fillRect(0, 0, px, px);
  g.fillStyle = '#2c3a2f';
  g.fillRect(0, 0, px / 2, px / 2);
  g.fillRect(px / 2, px / 2, px / 2, px / 2);
  // Faint grid lines along tile edges
  g.strokeStyle = 'rgba(120,255,160,0.18)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(px, 0);
  g.moveTo(0, 0); g.lineTo(0, px);
  g.moveTo(px / 2, 0); g.lineTo(px / 2, px);
  g.moveTo(0, px / 2); g.lineTo(px, px / 2);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  cachedFloorTex = tex;
  return tex;
}

// ============== Defended Area (alas + 4 tiang) ==============
const roomGroup = new THREE.Group();
scene.add(roomGroup);
const roomDim = { w: 200, h: 50, d: 200 };

function disposeRoom() {
  while (roomGroup.children.length) {
    const c = roomGroup.children[0];
    roomGroup.remove(c);
    c.geometry?.dispose();
    if (c.material) {
      if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
      else c.material.dispose();
    }
  }
}

function buildRoom(W, H, D) {
  disposeRoom();

  const padThickness = 0.6;
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(W + 3, padThickness, D + 3),
    new THREE.MeshLambertMaterial({ color: 0x2a2d2a })
  );
  pad.position.y = -padThickness / 2;
  pad.receiveShadow = true;
  roomGroup.add(pad);

  const floorTex = getFloorTexture();
  floorTex.repeat.set(W / 4, D / 4); // tile = 4m
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshLambertMaterial({ map: floorTex })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  floor.receiveShadow = true;
  roomGroup.add(floor);

  // 4 corner pillars (scale with height & box size)
  const pillarR = Math.max(0.4, H * 0.012);
  const baseSz = Math.max(2.0, pillarR * 5);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x3a4148, roughness: 0.55, metalness: 0.55 });
  const pillarGeom = new THREE.CylinderGeometry(pillarR, pillarR * 1.25, H, 10);
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x1a1d20 });
  const baseGeom = new THREE.BoxGeometry(baseSz, 0.6, baseSz);
  const capGeom = new THREE.CylinderGeometry(pillarR * 1.4, pillarR * 1.4, 0.4, 10);
  const beaconGeom = new THREE.SphereGeometry(Math.max(0.4, pillarR * 1.5), 10, 6);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });
  const corners = [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]];
  for (const [cx, cz] of corners) {
    const baseBlock = new THREE.Mesh(baseGeom, baseMat);
    baseBlock.position.set(cx, 0.3, cz);
    baseBlock.castShadow = true;
    baseBlock.receiveShadow = true;
    roomGroup.add(baseBlock);

    const pillar = new THREE.Mesh(pillarGeom, pillarMat);
    pillar.position.set(cx, H / 2 + 0.6, cz);
    pillar.castShadow = true;
    roomGroup.add(pillar);

    const cap = new THREE.Mesh(capGeom, pillarMat);
    cap.position.set(cx, H + 0.8, cz);
    roomGroup.add(cap);

    const beacon = new THREE.Mesh(beaconGeom, beaconMat);
    beacon.position.set(cx, H + 1.2, cz);
    roomGroup.add(beacon);
  }

  // Wireframe perimeter (top + bottom)
  const ePts = [
    -W / 2, 0.02, -D / 2, W / 2, 0.02, -D / 2,
    W / 2, 0.02, -D / 2, W / 2, 0.02, D / 2,
    W / 2, 0.02, D / 2, -W / 2, 0.02, D / 2,
    -W / 2, 0.02, D / 2, -W / 2, 0.02, -D / 2,
    -W / 2, H + 0.5, -D / 2, W / 2, H + 0.5, -D / 2,
    W / 2, H + 0.5, -D / 2, W / 2, H + 0.5, D / 2,
    W / 2, H + 0.5, D / 2, -W / 2, H + 0.5, D / 2,
    -W / 2, H + 0.5, D / 2, -W / 2, H + 0.5, -D / 2,
  ];
  const eg = new THREE.BufferGeometry();
  eg.setAttribute('position', new THREE.Float32BufferAttribute(ePts, 3));
  roomGroup.add(new THREE.LineSegments(
    eg,
    new THREE.LineBasicMaterial({ color: 0x4ee2bb, transparent: true, opacity: 0.55 })
  ));

  // Corner brackets on floor
  const bracketMat = new THREE.LineBasicMaterial({ color: 0xff5e7a, transparent: true, opacity: 0.7 });
  const bSize = Math.min(W, D) * 0.08;
  for (const [cx, cz] of corners) {
    const dx = cx > 0 ? -1 : 1;
    const dz = cz > 0 ? -1 : 1;
    const pts = [
      cx, 0.04, cz,
      cx + bSize * dx, 0.04, cz,
      cx, 0.04, cz,
      cx, 0.04, cz + bSize * dz,
    ];
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    roomGroup.add(new THREE.LineSegments(bg, bracketMat));
  }
}

// ============== Build static environment (sky + outer ground) ==============
buildEnvironmentStatic(scene);

// ============== Launcher (Patriot) ==============
const launcherGroup = new THREE.Group();
scene.add(launcherGroup);
const TUBE_ELEV = Math.PI / 3.5;
const TUBE_LEN = 2.6;
const TUBE_LOCAL = [];
let nextTubeIdx = 0;

function buildLauncher() {
  while (launcherGroup.children.length) launcherGroup.remove(launcherGroup.children[0]);
  TUBE_LOCAL.length = 0;
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x3d4a35, roughness: 0.7 });
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.4 });
  const muzzleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.7, 4.0), baseMat);
  base.position.y = 0.35;
  base.castShadow = true; base.receiveShadow = true;
  launcherGroup.add(base);

  const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.25, 14), baseMat);
  platform.position.y = 0.85;
  platform.castShadow = true;
  launcherGroup.add(platform);

  const tubeGeom = new THREE.CylinderGeometry(0.22, 0.22, TUBE_LEN, 12);
  const positions = [[-0.55, 1.6, -0.7], [0.55, 1.6, -0.7], [-0.55, 1.6, 0.7], [0.55, 1.6, 0.7]];
  for (const [tx, ty, tz] of positions) {
    const wrap = new THREE.Group();
    wrap.position.set(tx, ty, tz);
    wrap.rotation.x = TUBE_ELEV;
    const tube = new THREE.Mesh(tubeGeom, tubeMat);
    tube.castShadow = true;
    wrap.add(tube);
    const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 6, 14), muzzleMat);
    muzzle.position.y = TUBE_LEN / 2;
    muzzle.rotation.x = Math.PI / 2;
    wrap.add(muzzle);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    hole.position.y = TUBE_LEN / 2 + 0.001;
    hole.rotation.x = -Math.PI / 2;
    wrap.add(hole);
    launcherGroup.add(wrap);
    const tip = new THREE.Vector3(0, TUBE_LEN / 2 + 0.05, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), TUBE_ELEV);
    TUBE_LOCAL.push(new THREE.Vector3(tx + tip.x, ty + tip.y, tz + tip.z));
  }

  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelGeom = new THREE.CylinderGeometry(0.45, 0.45, 0.34, 12);
  for (const [wx, wz] of [[-1.2, -1.6], [1.2, -1.6], [-1.2, 1.6], [1.2, 1.6]]) {
    const w = new THREE.Mesh(wheelGeom, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.45, wz);
    w.castShadow = true;
    launcherGroup.add(w);
  }
}
buildLauncher();

function getMuzzleWorld(localIdx) {
  const local = TUBE_LOCAL[localIdx].clone();
  local.applyEuler(launcherGroup.rotation);
  local.add(launcherGroup.position);
  return local;
}
function getMuzzleDir() {
  const d = new THREE.Vector3(0, Math.cos(TUBE_ELEV), Math.sin(TUBE_ELEV));
  d.applyEuler(launcherGroup.rotation);
  return d.normalize();
}

// ============== Radar dummy 3D ==============
const radarGroup = new THREE.Group();
scene.add(radarGroup);
let radarSweepMesh = null;
let radarLed = null;
function buildRadar() {
  while (radarGroup.children.length) radarGroup.remove(radarGroup.children[0]);
  const matDark = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const matMetal = new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.3, metalness: 0.6, side: THREE.DoubleSide });
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.2, 10), matDark);
  ped.position.y = 0.6;
  ped.castShadow = true;
  radarGroup.add(ped);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  led.position.set(0, 1.05, 0.32);
  radarGroup.add(led);
  radarLed = led;
  const sweep = new THREE.Group();
  sweep.position.y = 1.3;
  sweep.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.65), matDark));
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.2),
    matMetal
  );
  dish.position.y = 0.1;
  dish.rotation.x = -Math.PI / 3;
  dish.castShadow = true;
  sweep.add(dish);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), matDark);
  feed.position.set(0, 0.3, 0.42);
  feed.rotation.x = -Math.PI / 3;
  sweep.add(feed);
  radarGroup.add(sweep);
  radarSweepMesh = sweep;
}
buildRadar();

// ============== Particle pool ==============
const PMAX = 240;
const partGeom = new THREE.BufferGeometry();
const partPos = new Float32Array(PMAX * 3);
const partVel = new Float32Array(PMAX * 3);
const partCol = new Float32Array(PMAX * 3);
const partLife = new Float32Array(PMAX);
let partHead = 0;
partGeom.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
partGeom.setAttribute('color', new THREE.BufferAttribute(partCol, 3));
partGeom.setDrawRange(0, PMAX);
const partMat = new THREE.PointsMaterial({ size: 0.7, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true });
const partPts = new THREE.Points(partGeom, partMat);
partPts.frustumCulled = false;
scene.add(partPts);

function spawnParticles(p, count = 60) {
  for (let i = 0; i < count; i++) {
    const idx = partHead * 3;
    partPos[idx] = p.x; partPos[idx + 1] = p.y; partPos[idx + 2] = p.z;
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(7 + Math.random() * 9);
    partVel[idx] = dir.x; partVel[idx + 1] = dir.y; partVel[idx + 2] = dir.z;
    partCol[idx] = 1; partCol[idx + 1] = 0.6 + Math.random() * 0.4; partCol[idx + 2] = 0.1;
    partLife[partHead] = 1.2;
    partHead = (partHead + 1) % PMAX;
  }
  partGeom.attributes.position.needsUpdate = true;
  partGeom.attributes.color.needsUpdate = true;
}

const explLight = new THREE.PointLight(0xffaa33, 0, 35);
scene.add(explLight);
let explLightLife = 0;
function triggerExplosion(p) {
  spawnParticles(p, 60);
  explLight.position.copy(p);
  explLight.intensity = 8;
  explLightLife = 1.0;
  playExplosion();
}
function updateParticles(dt) {
  let dirty = false;
  for (let i = 0; i < PMAX; i++) {
    if (partLife[i] <= 0) continue;
    partLife[i] -= dt;
    const idx = i * 3;
    partPos[idx] += partVel[idx] * dt;
    partPos[idx + 1] += partVel[idx + 1] * dt - 4 * dt;
    partPos[idx + 2] += partVel[idx + 2] * dt;
    partVel[idx] *= 0.96; partVel[idx + 1] *= 0.96; partVel[idx + 2] *= 0.96;
    partCol[idx + 1] = Math.max(0, partCol[idx + 1] - dt * 0.7);
    partCol[idx + 2] = Math.max(0, partCol[idx + 2] - dt * 0.5);
    if (partLife[i] <= 0) partPos[idx] = 9999;
    dirty = true;
  }
  if (dirty) {
    partGeom.attributes.position.needsUpdate = true;
    partGeom.attributes.color.needsUpdate = true;
  }
  if (explLightLife > 0) {
    explLightLife -= dt;
    explLight.intensity = Math.max(0, explLightLife * 7);
  } else if (explLight.intensity !== 0) {
    explLight.intensity = 0;
  }
}

// ============== Target (Shahed-136) ==============
const MAX_TARGETS = 6;
const targets = [];

function buildShahedMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xc8c4b0 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const accentMat = new THREE.MeshLambertMaterial({ color: 0x882222 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 1.7, 12), bodyMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 12), bodyMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 1.07;
  group.add(nose);
  const warhead = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), darkMat);
  warhead.position.x = 1.32;
  group.add(warhead);

  const wingMat = new THREE.MeshLambertMaterial({ color: 0xc8c4b0, side: THREE.DoubleSide });
  function makeDelta(side) {
    const pts = [
      0.45, 0, 0.12 * side,
      -0.55, 0, 0.12 * side,
      -0.7, 0, 1.3 * side,
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setIndex([0, 1, 2]);
    g.computeVertexNormals();
    return new THREE.Mesh(g, wingMat);
  }
  group.add(makeDelta(1));
  group.add(makeDelta(-1));

  const tailGeom = new THREE.BoxGeometry(0.45, 0.32, 0.04);
  const tailR = new THREE.Mesh(tailGeom, bodyMat);
  tailR.position.set(-0.75, 0.18, 0.18);
  tailR.rotation.x = -Math.PI / 5;
  group.add(tailR);
  const tailL = new THREE.Mesh(tailGeom, bodyMat);
  tailL.position.set(-0.75, 0.18, -0.18);
  tailL.rotation.x = Math.PI / 5;
  group.add(tailL);

  const propMat = new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const prop = new THREE.Mesh(new THREE.CircleGeometry(0.28, 14), propMat);
  prop.position.x = -0.92;
  prop.rotation.y = Math.PI / 2;
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const bladeG = new THREE.BoxGeometry(0.02, 0.5, 0.04);
  const blade1 = new THREE.Mesh(bladeG, bladeMat);
  blade1.position.x = -0.9;
  const blade2 = new THREE.Mesh(bladeG, bladeMat);
  blade2.position.x = -0.9;
  blade2.rotation.x = Math.PI / 2;
  const propGroup = new THREE.Group();
  propGroup.add(blade1); propGroup.add(blade2); propGroup.add(prop);
  group.add(propGroup);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.46), accentMat);
  stripe.position.set(0.15, 0.18, 0);
  group.add(stripe);

  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.04), darkMat);
  belly.position.set(0.0, -0.18, 0);
  group.add(belly);

  // Emissive blink dot — no point light
  const blinkMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
  const blink = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), blinkMat);
  blink.position.set(0.6, 0.05, 0);
  group.add(blink);

  group.userData.prop = propGroup;
  group.userData.blink = blinkMat;
  return group;
}

function createTarget() {
  const group = buildShahedMesh();
  group.visible = false;
  scene.add(group);
  return {
    group, alive: false, t: 0, phase: 0,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    cruiseDir: new THREE.Vector3(),
    cruiseAlt: 0,
  };
}

function spawnTarget(t) {
  const W = roomDim.w, H = roomDim.h, D = roomDim.d;
  const fromLeft = Math.random() < 0.5;
  const sx = fromLeft ? -(W / 2 + 5) : (W / 2 + 5);
  t.pos.set(sx, H * 0.35 + Math.random() * (H * 0.25), (Math.random() - 0.5) * D * 0.7);
  t.cruiseDir.set(
    fromLeft ? 1 : -1,
    -0.05 + Math.random() * 0.1,
    (Math.random() - 0.5) * 0.4
  ).normalize();
  t.cruiseAlt = t.pos.y;
  t.alive = true;
  t.t = 0;
  t.phase = Math.random() * 6.28;
  // Pre-apply transform before showing — avoids flicker from previous flight pose
  t.vel.copy(t.cruiseDir).multiplyScalar(parseFloat(tsRange.value));
  t.group.position.copy(t.pos);
  const look = t.pos.clone().add(t.vel);
  t.group.lookAt(look);
  t.group.visible = true;
}

function spawnNewTarget() {
  let t = targets.find(x => !x.alive);
  if (!t) {
    if (targets.length >= MAX_TARGETS) return;
    t = createTarget();
    targets.push(t);
  }
  spawnTarget(t);
}

function updateTarget(t, dt) {
  if (!t.alive) return;
  t.t += dt;
  const speed = parseFloat(tsRange.value);
  const wob = new THREE.Vector3(
    Math.cos(t.t * 0.8 + t.phase) * 0.04,
    Math.sin(t.t * 1.4 + t.phase) * 0.07,
    Math.sin(t.t * 0.9 + t.phase) * 0.06
  );
  const dir = t.cruiseDir.clone().add(wob).normalize();
  t.vel.copy(dir).multiplyScalar(speed);
  t.pos.addScaledVector(t.vel, dt);

  if (t.group.userData.prop) t.group.userData.prop.rotation.x += dt * 40;
  if (t.group.userData.blink) {
    const on = Math.sin(t.t * 9) > 0;
    t.group.userData.blink.color.setHex(on ? 0xff5555 : 0x661111);
  }

  t.group.position.copy(t.pos);
  const look = t.pos.clone().add(t.vel);
  t.group.lookAt(look);

  const W = roomDim.w, deepZ = roomDim.d;
  if (Math.abs(t.pos.x) > W / 2 + 12 || Math.abs(t.pos.z) > deepZ / 2 + 5 || t.pos.y < 1 || t.pos.y > roomDim.h + 8) {
    t.alive = false;
    t.group.visible = false;
    if (document.getElementById('autoSpawn').checked) {
      setTimeout(spawnNewTarget, 1000 + Math.random() * 1500);
    }
  }
}

// ============== Misil ==============
const MAX_MISSILES = 8;
const missiles = [];

function buildMissileMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  const tipMat = new THREE.MeshLambertMaterial({ color: 0xcc2222 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.5, 10), bodyMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  group.add(body);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 10), tipMat);
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = 0.96;
  group.add(tip);
  const finMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.02), finMat);
    fin.position.x = -0.6;
    fin.position.y = Math.cos((i * Math.PI) / 2) * 0.18;
    fin.position.z = Math.sin((i * Math.PI) / 2) * 0.18;
    fin.rotation.x = (i * Math.PI) / 2;
    group.add(fin);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 1.1, 10),
    new THREE.MeshBasicMaterial({ color: 0xffaa22, transparent: true, opacity: 0.9 })
  );
  flame.rotation.z = Math.PI / 2;
  flame.position.x = -1.3;
  group.add(flame);
  group.userData.flame = flame;
  return group;
}

function createTrail() {
  const max = 60;
  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.45, vertexColors: true, transparent: true, opacity: 0.85, sizeAttenuation: true });
  const points = new THREE.Points(geom, mat);
  points.frustumCulled = false;
  scene.add(points);
  return { max, geom, pos, col, head: 0, count: 0, points };
}

function createMissile() {
  const group = buildMissileMesh();
  group.visible = false;
  scene.add(group);
  return {
    group, alive: false, age: 0,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    targetRef: null,
    trail: createTrail(),
  };
}

function findNearestTarget(pos) {
  let best = null, bestD = Infinity;
  for (const t of targets) {
    if (!t.alive) continue;
    const d = pos.distanceTo(t.pos);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

// Swarm targeting: prefer a target not yet locked by another live missile.
// If every target is already claimed, fall back to nearest. Result: missiles
// distribute when there are multiple targets, then converge on the survivor.
function assignTarget(m) {
  const claimed = new Set();
  for (const other of missiles) {
    if (other === m || !other.alive || !other.targetRef || !other.targetRef.alive) continue;
    claimed.add(other.targetRef);
  }
  let bestUnclaimed = null, bestUnclaimedD = Infinity;
  let bestAny = null, bestAnyD = Infinity;
  for (const t of targets) {
    if (!t.alive) continue;
    const d = m.pos.distanceTo(t.pos);
    if (d < bestAnyD) { bestAnyD = d; bestAny = t; }
    if (!claimed.has(t) && d < bestUnclaimedD) { bestUnclaimedD = d; bestUnclaimed = t; }
  }
  return bestUnclaimed || bestAny;
}

function launchMissile() {
  if (!targets.some(t => t.alive)) {
    setStatus('NO TARGET');
    setTimeout(() => setStatus('SIAP'), 800);
    return;
  }
  let m = missiles.find(x => !x.alive);
  if (!m) {
    if (missiles.length >= MAX_MISSILES) return;
    m = createMissile();
    missiles.push(m);
  }
  const tubeIdx = nextTubeIdx % TUBE_LOCAL.length;
  nextTubeIdx++;
  const muzzle = getMuzzleWorld(tubeIdx);
  const dir = getMuzzleDir();
  m.pos.copy(muzzle);
  const ms = parseFloat(msRange.value);
  m.vel.copy(dir).multiplyScalar(ms);
  m.targetRef = assignTarget(m);
  m.alive = true;
  m.age = 0;
  // Apply transform BEFORE making visible — prevents one-frame flicker
  // at the missile's previous position when reusing pooled mesh.
  m.group.position.copy(m.pos);
  const lookInit = m.pos.clone().add(m.vel);
  m.group.lookAt(lookInit);
  m.group.rotateY(Math.PI / 2);
  m.group.visible = true;
  m.trail.head = 0; m.trail.count = 0;
  m.trail.geom.setDrawRange(0, 0);
  setStatus('TERBANG');
  playLaunch();
}

function addTrailPoint(tr, p) {
  const i = tr.head * 3;
  tr.pos[i] = p.x; tr.pos[i + 1] = p.y; tr.pos[i + 2] = p.z;
  tr.col[i] = 1; tr.col[i + 1] = 1; tr.col[i + 2] = 1;
  tr.head = (tr.head + 1) % tr.max;
  if (tr.count < tr.max) tr.count++;
  tr.geom.attributes.position.needsUpdate = true;
  tr.geom.attributes.color.needsUpdate = true;
  tr.geom.setDrawRange(0, tr.count);
}
function fadeTrailObj(tr, dt) {
  if (tr.count === 0) return;
  for (let i = 0; i < tr.count; i++) {
    const idx = i * 3;
    tr.col[idx] = Math.max(0, tr.col[idx] - dt * 0.3);
    tr.col[idx + 1] = Math.max(0, tr.col[idx + 1] - dt * 0.4);
    tr.col[idx + 2] = Math.max(0, tr.col[idx + 2] - dt * 0.5);
  }
  tr.geom.attributes.color.needsUpdate = true;
}

let hits = 0, misses = 0;
function setStatus(s) { document.getElementById('stState').textContent = s; }

function updateMissile(m, dt) {
  if (!m.alive) return;
  m.age += dt;
  const ms = parseFloat(msRange.value);
  if (!m.targetRef || !m.targetRef.alive) {
    m.targetRef = assignTarget(m);
  }
  if (m.targetRef && m.targetRef.alive) {
    const toT = m.targetRef.pos.clone().sub(m.pos);
    const dist = toT.length();
    const dirNorm = dist > 1e-4 ? toT.clone().multiplyScalar(1 / dist) : new THREE.Vector3(0, 0, 1);
    const desired = dirNorm.clone().multiplyScalar(ms);
    const turnRate = parseFloat(manRange.value);
    m.vel.lerp(desired, Math.min(1, turnRate * dt));
    m.vel.setLength(ms);

    // Proximity fuse: detonate at PROX, OR if missile flew past target within PASS range
    const PROX = parseFloat(proxRange.value);
    const PASS = Math.max(2.0, PROX * 4);
    const closing = m.vel.dot(dirNorm); // >0 closing in, <0 already passed
    if (dist <= PROX || (dist <= PASS && closing < 0)) {
      const detPos = m.targetRef.pos.clone().add(m.pos).multiplyScalar(0.5);
      triggerExplosion(detPos);
      m.targetRef.alive = false;
      m.targetRef.group.visible = false;
      m.alive = false;
      m.group.visible = false;
      hits++;
      if (document.getElementById('autoSpawn').checked) {
        setTimeout(spawnNewTarget, 1500 + Math.random() * 1500);
      }
      return;
    }
  }
  m.pos.addScaledVector(m.vel, dt);
  m.group.position.copy(m.pos);
  const look = m.pos.clone().add(m.vel);
  m.group.lookAt(look);
  m.group.rotateY(Math.PI / 2);
  addTrailPoint(m.trail, m.pos);
  m.group.userData.flame.scale.setScalar(0.8 + Math.random() * 0.5);

  const W = roomDim.w, H = roomDim.h, D = roomDim.d;
  const oob = Math.abs(m.pos.x) > W / 2 + 20 || m.pos.y > H + 12 || m.pos.y < -1 || Math.abs(m.pos.z) > D / 2 + 10;
  if (m.age > 14 || oob) {
    triggerExplosion(m.pos);
    m.alive = false;
    m.group.visible = false;
    misses++;
  }
}

// ============== UI bindings ==============
const xRange = document.getElementById('xRange');
const yRange = document.getElementById('yRange');
const zRange = document.getElementById('zRange');
const tsRange = document.getElementById('tsRange');
const msRange = document.getElementById('msRange');
const manRange = document.getElementById('manRange');
const proxRange = document.getElementById('proxRange');

function fmtNum(n) { return n.toLocaleString('en-US'); }

let envRebuildTimer = null;
function scheduleEnvRebuild() {
  if (envRebuildTimer) clearTimeout(envRebuildTimer);
  envRebuildTimer = setTimeout(() => {
    rebuildEnvironmentInside(scene, roomDim.w, roomDim.h, roomDim.d);
    envRebuildTimer = null;
  }, 220);
}

function updateRoom() {
  roomDim.w = parseFloat(xRange.value);
  roomDim.h = parseFloat(yRange.value);
  roomDim.d = parseFloat(zRange.value);
  document.getElementById('xVal').textContent = roomDim.w;
  document.getElementById('yVal').textContent = roomDim.h;
  document.getElementById('zVal').textContent = roomDim.d;
  document.getElementById('areaVal').textContent = fmtNum(Math.round(roomDim.w * roomDim.d));
  buildRoom(roomDim.w, roomDim.h, roomDim.d);
  launcherGroup.position.set(0, 0, 0);
  launcherGroup.rotation.y = 0;
  radarGroup.position.set(5, 0, 2);

  // Scale sun shadow frustum to cover the (potentially large) box
  const half = Math.max(roomDim.w, roomDim.d) * 0.55;
  sun.shadow.camera.left = -half;
  sun.shadow.camera.right = half;
  sun.shadow.camera.top = half;
  sun.shadow.camera.bottom = -half;
  sun.shadow.camera.updateProjectionMatrix();

  // Camera distance scales too
  controls.maxDistance = Math.max(roomDim.w, roomDim.d) * 3 + 200;

  scheduleEnvRebuild();
}
xRange.addEventListener('input', updateRoom);
yRange.addEventListener('input', updateRoom);
zRange.addEventListener('input', updateRoom);
tsRange.addEventListener('input', () => document.getElementById('tsVal').textContent = tsRange.value);
msRange.addEventListener('input', () => document.getElementById('msVal').textContent = msRange.value);
manRange.addEventListener('input', () => document.getElementById('manVal').textContent = manRange.value);
proxRange.addEventListener('input', () => document.getElementById('proxVal').textContent = proxRange.value);

document.getElementById('reset').addEventListener('click', () => {
  camera.position.copy(initialCamPos);
  controls.target.set(0, 8, 0);
  controls.update();
});
document.getElementById('launch').addEventListener('click', () => { ensureAudio(); launchMissile(); });
document.getElementById('spawnT').addEventListener('click', () => { ensureAudio(); spawnNewTarget(); });
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); ensureAudio(); launchMissile(); }
  else if (e.code === 'KeyT') { e.preventDefault(); ensureAudio(); spawnNewTarget(); }
});
window.addEventListener('click', ensureAudio, { once: true });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============== HUD (throttled) ==============
function fmt(n) { return (n >= 0 ? '+' : '') + n.toFixed(1); }

const GAUGE_CIRC = 188.5; // 2π × 30
function setGauge(arcId, valueId, value, max, label) {
  const arc = document.getElementById(arcId);
  const valEl = document.getElementById(valueId);
  if (!arc || !valEl) return;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  arc.style.strokeDashoffset = GAUGE_CIRC * (1 - pct);
  valEl.textContent = (label !== undefined) ? label : value;
}

function updateCoordsHUD() {
  let html = '';
  const aliveT = targets.filter(x => x.alive);
  const aliveM = missiles.filter(x => x.alive);

  // Gauges
  setGauge('gTargetArc', 'gTarget', aliveT.length, MAX_TARGETS);
  setGauge('gMissileArc', 'gMissile', aliveM.length, MAX_MISSILES);
  const totalShots = hits + misses;
  setGauge('gHitArc', 'gHit', hits, Math.max(10, totalShots));
  const acc = totalShots > 0 ? Math.round((hits / totalShots) * 100) : 0;
  setGauge('gAccArc', 'gAcc', totalShots > 0 ? acc : 0, 100, totalShots > 0 ? `${acc}%` : '—');

  // Status dot tint
  const stDot = document.getElementById('stDot');
  if (stDot) {
    if (aliveM.length > 0) stDot.style.background = '#00d8ff', stDot.style.boxShadow = '0 0 10px rgba(0,216,255,0.7)';
    else if (aliveT.length > 0) stDot.style.background = '#ffb454', stDot.style.boxShadow = '0 0 10px rgba(255,180,84,0.7)';
    else stDot.style.background = '#4eff9a', stDot.style.boxShadow = '0 0 10px rgba(78,255,154,0.7)';
  }

  // Telemetry meta count
  const meta = document.getElementById('telemetryMeta');
  if (meta) meta.textContent = `${aliveT.length + aliveM.length} obj`;

  if (aliveT.length === 0 && aliveM.length === 0) {
    html = '<div class="empty">— NO CONTACTS —</div>';
  } else {
    if (aliveT.length === 0) {
      html += `<div class="telemetry-row"><span class="label-t">TGT</span><span style="color:#3d5060">offline</span></div>`;
    }
    for (let i = 0; i < Math.min(aliveT.length, 3); i++) {
      const t = aliveT[i];
      html += `<div class="telemetry-row"><span class="label-t">T${i + 1}</span><span><span class="x">X${fmt(t.pos.x)}</span> <span class="y">Y${fmt(t.pos.y)}</span> <span class="z">Z${fmt(t.pos.z)}</span><span class="v-spd">${t.vel.length().toFixed(1)}m/s</span></span></div>`;
    }
    if (aliveT.length > 3) html += `<div class="sep">+${aliveT.length - 3} more targets</div>`;

    if (aliveM.length === 0) {
      html += `<div class="telemetry-row"><span class="label-m">MSL</span><span style="color:#3d5060">standby</span></div>`;
    }
    for (let i = 0; i < Math.min(aliveM.length, 3); i++) {
      const m = aliveM[i];
      html += `<div class="telemetry-row"><span class="label-m">M${i + 1}</span><span><span class="x">X${fmt(m.pos.x)}</span> <span class="y">Y${fmt(m.pos.y)}</span> <span class="z">Z${fmt(m.pos.z)}</span><span class="v-spd">${m.vel.length().toFixed(1)}m/s</span></span></div>`;
    }
    if (aliveM.length > 3) html += `<div class="sep">+${aliveM.length - 3} more missiles</div>`;
  }
  document.getElementById('coordsBody').innerHTML = html;
}

// ============== Datetime ==============
const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
function pad2(n) { return String(n).padStart(2, '0'); }
function updateDateTime() {
  const d = new Date();
  document.getElementById('dtDay').textContent = DAYS[d.getDay()];
  document.getElementById('dtDate').textContent = `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
  document.getElementById('dtTime').textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
updateDateTime();
setInterval(updateDateTime, 1000);

// ============== Tabs (visual only) ==============
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });
});

// ============== Radar HUD 2D (throttled) ==============
const radarCanvas = document.getElementById('radarCanvas');
const rctx = radarCanvas.getContext('2d');
let radarSweepAngle = 0;
function drawRadar(dt) {
  const cw = radarCanvas.width, ch = radarCanvas.height;
  const cx = cw / 2, cy = ch / 2;
  const range = Math.max(roomDim.w, roomDim.d) * 0.7;
  const scale = (cw / 2 - 6) / range;

  rctx.fillStyle = 'rgba(0, 14, 22, 0.22)';
  rctx.fillRect(0, 0, cw, ch);

  rctx.strokeStyle = 'rgba(0, 216, 255, 0.28)';
  rctx.lineWidth = 1;
  for (let r = 1; r <= 3; r++) {
    rctx.beginPath();
    rctx.arc(cx, cy, (cw / 2 - 6) * r / 3, 0, Math.PI * 2);
    rctx.stroke();
  }
  rctx.beginPath();
  rctx.moveTo(0, cy); rctx.lineTo(cw, cy);
  rctx.moveTo(cx, 0); rctx.lineTo(cx, ch);
  rctx.stroke();

  radarSweepAngle += dt * 2.0;
  if (rctx.createConicGradient) {
    const grad = rctx.createConicGradient(radarSweepAngle, cx, cy);
    grad.addColorStop(0, 'rgba(0, 216, 255, 0.55)');
    grad.addColorStop(0.08, 'rgba(0, 216, 255, 0.0)');
    grad.addColorStop(1, 'rgba(0, 216, 255, 0.0)');
    rctx.fillStyle = grad;
    rctx.beginPath();
    rctx.arc(cx, cy, cw / 2 - 6, 0, Math.PI * 2);
    rctx.fill();
  }
  rctx.strokeStyle = 'rgba(0, 216, 255, 0.85)';
  rctx.lineWidth = 1.5;
  rctx.beginPath();
  rctx.moveTo(cx, cy);
  rctx.lineTo(cx + Math.cos(radarSweepAngle) * (cw / 2 - 6), cy + Math.sin(radarSweepAngle) * (cw / 2 - 6));
  rctx.stroke();

  rctx.fillStyle = '#00d8ff';
  rctx.beginPath(); rctx.arc(cx, cy, 4, 0, Math.PI * 2); rctx.fill();

  let nearest = Infinity;
  for (const t of targets) {
    if (!t.alive) continue;
    const dx = t.pos.x - launcherGroup.position.x;
    const dz = t.pos.z - launcherGroup.position.z;
    const d = Math.hypot(dx, dz);
    nearest = Math.min(nearest, d);
    const px = cx + dx * scale, py = cy + dz * scale;
    rctx.fillStyle = '#ff5e7a';
    rctx.beginPath(); rctx.arc(px, py, 4, 0, Math.PI * 2); rctx.fill();
    rctx.strokeStyle = 'rgba(255,94,122,0.6)';
    rctx.beginPath(); rctx.arc(px, py, 8 + Math.sin(performance.now() / 200) * 2, 0, Math.PI * 2); rctx.stroke();
  }
  for (const m of missiles) {
    if (!m.alive) continue;
    const dx = m.pos.x - launcherGroup.position.x;
    const dz = m.pos.z - launcherGroup.position.z;
    const px = cx + dx * scale, py = cy + dz * scale;
    rctx.fillStyle = '#5fb6ff';
    rctx.beginPath(); rctx.arc(px, py, 3, 0, Math.PI * 2); rctx.fill();
  }

  rctx.fillStyle = 'rgba(0,216,255,0.6)';
  rctx.font = '9px monospace';
  rctx.fillText('N', cx - 4, 12);
  rctx.fillText('S', cx - 4, ch - 4);
  rctx.fillText('W', 2, cy + 4);
  rctx.fillText('E', cw - 10, cy + 4);

  document.getElementById('radar-stats').textContent =
    isFinite(nearest) ? `NEAREST: ${nearest.toFixed(1)} m` : `RANGE: ${range.toFixed(0)} m`;
}

// ============== Init ==============
updateRoom();
// Force immediate env build at startup (bypass debounce)
if (envRebuildTimer) { clearTimeout(envRebuildTimer); envRebuildTimer = null; }
rebuildEnvironmentInside(scene, roomDim.w, roomDim.h, roomDim.d);
spawnNewTarget();

// ============== Loop ==============
const clock = new THREE.Clock();
let hudAcc = 0, radarAcc = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());

  for (const t of targets) updateTarget(t, dt);
  for (const m of missiles) {
    updateMissile(m, dt);
    fadeTrailObj(m.trail, dt);
  }
  updateParticles(dt);

  if (radarSweepMesh) radarSweepMesh.rotation.y += dt * 1.5;
  if (radarLed) {
    radarLed.material.color.setHex(Math.sin(performance.now() / 200) > 0 ? 0xff2222 : 0x440000);
  }

  hudAcc += dt;
  if (hudAcc > 0.08) { updateCoordsHUD(); hudAcc = 0; }
  radarAcc += dt;
  if (radarAcc > 0.05) { drawRadar(radarAcc); radarAcc = 0; }

  controls.update();
  renderer.render(scene, camera);
}
animate();
