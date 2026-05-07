// Environment built INSIDE the resizable defended area.
// Sky + outer ground are static; inner content (buildings, roads, trees)
// rebuilds when the box dimensions change.
import * as THREE from 'three';

let staticBuilt = false;
let insideRoot = null;

export function buildEnvironmentStatic(scene) {
  if (staticBuilt) return;
  staticBuilt = true;
  buildSky(scene);
  buildOuterGround(scene);
}

export function rebuildEnvironmentInside(scene, W, H, D) {
  if (insideRoot) {
    disposeGroup(insideRoot);
    scene.remove(insideRoot);
    insideRoot = null;
  }
  insideRoot = new THREE.Group();
  insideRoot.name = 'env-inside';
  scene.add(insideRoot);

  const cfg = computeConfig(W, H, D);
  buildRoadsInside(insideRoot, W, D, cfg);
  buildBuildingsInside(insideRoot, W, H, D, cfg);
  buildTreesInside(insideRoot, W, D, cfg);
  buildSmallProps(insideRoot, W, D, cfg);
}

function computeConfig(W, H, D) {
  const area = W * D;
  const roadW = Math.min(12, Math.max(4, W * 0.025));
  return {
    roadW,
    roadHalfBuf: roadW / 2 + 2,
    minSafeR: 18,           // launcher exclusion radius
    cornerSafe: Math.max(8, Math.min(W, D) * 0.04), // pillar exclusion
    maxBldgH: Math.min(60, Math.max(8, H * 0.7)),
    targetBuildings: Math.min(220, Math.max(8, Math.floor(area / 1400))),
    targetTrees: Math.min(500, Math.max(20, Math.floor(area / 600))),
    targetProps: Math.min(80, Math.max(4, Math.floor(area / 6000))),
  };
}

function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose && m.dispose());
      else if (obj.material.dispose) obj.material.dispose();
    }
  });
}

// =========================== SKY ===========================
function buildSky(scene) {
  const skyGeom = new THREE.SphereGeometry(1200, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(0x05101e) },
      mid: { value: new THREE.Color(0x1a3050) },
      bot: { value: new THREE.Color(0xff8c4a) },
    },
    vertexShader: `varying vec3 vW; void main(){ vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
    fragmentShader: `uniform vec3 top,mid,bot;varying vec3 vW;void main(){float h=normalize(vW).y;vec3 c;if(h>0.)c=mix(mid,top,smoothstep(0.,.7,h));else c=mix(mid,bot,smoothstep(0.,-.25,h));gl_FragColor=vec4(c,1.);} `,
    side: THREE.BackSide,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(skyGeom, skyMat));
}

// =========================== OUTER GROUND ===========================
function buildOuterGround(scene) {
  const g = new THREE.PlaneGeometry(4000, 4000);
  const ground = new THREE.Mesh(
    g,
    new THREE.MeshLambertMaterial({ color: 0x10171f })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.5;
  ground.receiveShadow = true;
  scene.add(ground);
}

// =========================== ROADS ===========================
function makeRoadTexture(repeats) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#1c1f24';
  g.fillRect(0, 0, c.width, c.height);
  // Edge stripes
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(0, 6, c.width, 1);
  g.fillRect(0, c.height - 7, c.width, 1);
  // Center dashed line
  g.fillStyle = '#ffd055';
  const dash = 30, gap = 22;
  for (let x = 6; x < c.width; x += dash + gap) {
    g.fillRect(x, 30, dash, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(repeats, 1);
  return t;
}

function buildRoadsInside(root, W, D, cfg) {
  const roadW = cfg.roadW;

  // E-W cross road
  const tex1 = makeRoadTexture(Math.max(2, Math.round(W / 18)));
  const r1 = new THREE.Mesh(
    new THREE.PlaneGeometry(W, roadW),
    new THREE.MeshLambertMaterial({ map: tex1 })
  );
  r1.rotation.x = -Math.PI / 2;
  r1.position.set(0, 0.05, 0);
  r1.receiveShadow = true;
  root.add(r1);

  // N-S cross road
  const tex2 = makeRoadTexture(Math.max(2, Math.round(D / 18)));
  const r2 = new THREE.Mesh(
    new THREE.PlaneGeometry(D, roadW),
    new THREE.MeshLambertMaterial({ map: tex2 })
  );
  r2.rotation.x = -Math.PI / 2;
  r2.rotation.z = -Math.PI / 2;
  r2.position.set(0, 0.05, 0);
  r2.receiveShadow = true;
  root.add(r2);

  // Sidewalks alongside roads (light gray strip)
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x4a4f56 });
  const swW = roadW * 0.35;
  const swInset = roadW / 2 + swW / 2 + 0.1;
  function addSidewalk(geomW, geomH, x, z, rotZ) {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(geomW, geomH), sidewalkMat);
    sw.rotation.x = -Math.PI / 2;
    sw.rotation.z = rotZ;
    sw.position.set(x, 0.04, z);
    sw.receiveShadow = true;
    root.add(sw);
  }
  addSidewalk(W, swW, 0, swInset, 0);
  addSidewalk(W, swW, 0, -swInset, 0);
  addSidewalk(D, swW, swInset, 0, -Math.PI / 2);
  addSidewalk(D, swW, -swInset, 0, -Math.PI / 2);
}

// =========================== BUILDINGS ===========================
function buildBuildingsInside(root, W, H, D, cfg) {
  const placements = [];
  const minSpacing = 11;
  const maxAttempts = cfg.targetBuildings * 6;
  let attempts = 0;

  while (placements.length < cfg.targetBuildings && attempts < maxAttempts) {
    attempts++;
    const x = (Math.random() - 0.5) * (W - cfg.cornerSafe * 2);
    const z = (Math.random() - 0.5) * (D - cfg.cornerSafe * 2);
    if (Math.hypot(x, z) < cfg.minSafeR) continue;
    if (Math.abs(x) < cfg.roadHalfBuf || Math.abs(z) < cfg.roadHalfBuf) continue;

    let tooClose = false;
    for (let i = 0; i < placements.length; i++) {
      const dx = x - placements[i][0];
      const dz = z - placements[i][1];
      if (dx * dx + dz * dz < minSpacing * minSpacing) { tooClose = true; break; }
    }
    if (tooClose) continue;

    const w = 5 + Math.random() * 10;
    const d = 5 + Math.random() * 10;
    const hMax = cfg.maxBldgH;
    const h = 5 + Math.pow(Math.random(), 1.4) * (hMax - 5); // bias to shorter
    placements.push([x, z, w, h, d]);
  }
  if (placements.length === 0) return;

  // Walls — InstancedMesh of unit box, scaled per instance
  const cubeGeom = new THREE.BoxGeometry(1, 1, 1);
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const walls = new THREE.InstancedMesh(cubeGeom, wallMat, placements.length);

  const palette = [
    new THREE.Color(0x6e7682),
    new THREE.Color(0x8a8f96),
    new THREE.Color(0x4a5460),
    new THREE.Color(0x9c8d7c),
    new THREE.Color(0x6e553f),
    new THREE.Color(0x576472),
    new THREE.Color(0x8e7560),
  ];
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < placements.length; i++) {
    const [x, z, w, h, d] = placements[i];
    m4.makeScale(w, h, d);
    m4.setPosition(x, h / 2, z);
    walls.setMatrixAt(i, m4);
    walls.setColorAt(i, palette[Math.floor(Math.random() * palette.length)]);
  }
  walls.instanceMatrix.needsUpdate = true;
  if (walls.instanceColor) walls.instanceColor.needsUpdate = true;
  root.add(walls);

  // Window grid as a single tiled emissive texture, draped on a slightly larger box per building
  const winTex = makeWindowTilingTexture();
  const winMat = new THREE.MeshLambertMaterial({
    map: winTex,
    emissive: 0xffaa44,
    emissiveMap: winTex,
    emissiveIntensity: 0.55,
    transparent: true,
    alphaTest: 0.05,
  });
  // Per-building window plane (one at a time too expensive at 200; use InstancedMesh of plane on +Z face)
  // Simplification: single textured cube slightly larger in Z to overlay onto wall — too complex.
  // Instead: single mesh per building for windows would be 200 meshes. Skip windows when many.
  if (placements.length <= 60) {
    const winGeom = new THREE.BoxGeometry(1, 1, 1);
    const winInst = new THREE.InstancedMesh(winGeom, winMat, placements.length);
    for (let i = 0; i < placements.length; i++) {
      const [x, z, w, h, d] = placements[i];
      m4.makeScale(w + 0.04, h * 0.92, d + 0.04);
      m4.setPosition(x, h * 0.46 + 0.5, z);
      winInst.setMatrixAt(i, m4);
    }
    winInst.instanceMatrix.needsUpdate = true;
    root.add(winInst);
  } else {
    // For many buildings, use texture on the wall itself by replacing material with a building-style mat
    // (kept simple for performance — windows omitted at high density to save draw cost)
    winTex.dispose();
  }

  // Roof caps (smaller box on top — adds skyline silhouette variety)
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x2d3540 });
  const roofGeom = new THREE.BoxGeometry(1, 1, 1);
  const roofs = new THREE.InstancedMesh(roofGeom, roofMat, placements.length);
  for (let i = 0; i < placements.length; i++) {
    const [x, z, w, h, d] = placements[i];
    const rw = w * 0.35, rd = d * 0.35, rh = 1.5;
    m4.makeScale(rw, rh, rd);
    m4.setPosition(x, h + rh / 2, z);
    roofs.setMatrixAt(i, m4);
  }
  roofs.instanceMatrix.needsUpdate = true;
  root.add(roofs);
}

function makeWindowTilingTexture() {
  const cols = 12, rows = 16;
  const cellPx = 12;
  const c = document.createElement('canvas');
  c.width = cols * cellPx; c.height = rows * cellPx;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0)';
  g.clearRect(0, 0, c.width, c.height);
  // Draw lit windows on transparent
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = Math.random() < 0.45;
      if (!lit) continue;
      const pad = 3;
      g.fillStyle = '#ffd078';
      g.fillRect(col * cellPx + pad, r * cellPx + pad, cellPx - pad * 2, cellPx - pad * 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearFilter;
  return t;
}

// =========================== TREES ===========================
function buildTreesInside(root, W, D, cfg) {
  const positions = [];
  const minSpacing = 4;
  const maxAttempts = cfg.targetTrees * 4;
  let attempts = 0;
  while (positions.length < cfg.targetTrees && attempts < maxAttempts) {
    attempts++;
    const x = (Math.random() - 0.5) * (W - cfg.cornerSafe * 2);
    const z = (Math.random() - 0.5) * (D - cfg.cornerSafe * 2);
    if (Math.hypot(x, z) < cfg.minSafeR) continue;
    if (Math.abs(x) < cfg.roadHalfBuf || Math.abs(z) < cfg.roadHalfBuf) continue;
    let tooClose = false;
    for (let i = 0; i < positions.length; i++) {
      const dx = x - positions[i][0];
      const dz = z - positions[i][1];
      if (dx * dx + dz * dz < minSpacing * minSpacing) { tooClose = true; break; }
    }
    if (tooClose) continue;
    positions.push([x, z, 0.7 + Math.random() * 0.9]);
  }
  if (positions.length === 0) return;

  const N = positions.length;
  const trunkGeom = new THREE.CylinderGeometry(0.2, 0.28, 1.4, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3520 });
  const trunks = new THREE.InstancedMesh(trunkGeom, trunkMat, N);

  const leafGeom = new THREE.ConeGeometry(1.0, 2.4, 6);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const leaves = new THREE.InstancedMesh(leafGeom, leafMat, N);
  const leafColors = [
    new THREE.Color(0x2d5a25),
    new THREE.Color(0x3a6f30),
    new THREE.Color(0x4a7d35),
    new THREE.Color(0x336622),
  ];
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < N; i++) {
    const [x, z, s] = positions[i];
    m4.makeScale(s, s, s);
    m4.setPosition(x, 0.7 * s, z);
    trunks.setMatrixAt(i, m4);
    m4.makeScale(s, s, s);
    m4.setPosition(x, (1.4 + 1.2) * s, z);
    leaves.setMatrixAt(i, m4);
    leaves.setColorAt(i, leafColors[Math.floor(Math.random() * leafColors.length)]);
  }
  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  root.add(trunks);
  root.add(leaves);
}

// =========================== SMALL PROPS (lampposts, parked cars) ===========================
function buildSmallProps(root, W, D, cfg) {
  const props = [];
  const maxAttempts = cfg.targetProps * 5;
  let attempts = 0;
  while (props.length < cfg.targetProps && attempts < maxAttempts) {
    attempts++;
    // Place along road sidewalks (within road buffer + small offset)
    const onEW = Math.random() < 0.5;
    const along = (Math.random() - 0.5) * (onEW ? W - cfg.cornerSafe * 2 : D - cfg.cornerSafe * 2);
    const off = (cfg.roadHalfBuf + 1.5 + Math.random() * 1.5) * (Math.random() < 0.5 ? 1 : -1);
    const x = onEW ? along : off;
    const z = onEW ? off : along;
    if (Math.hypot(x, z) < cfg.minSafeR) continue;
    props.push([x, z, Math.random() < 0.5 ? 'lamp' : 'box']);
  }
  if (props.length === 0) return;

  const lampMat = new THREE.MeshLambertMaterial({ color: 0x202225 });
  const lampGeom = new THREE.CylinderGeometry(0.08, 0.1, 4, 6);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffd078 });
  const headGeom = new THREE.SphereGeometry(0.2, 6, 6);
  const boxMat = new THREE.MeshLambertMaterial({ color: 0x3d4a52 });
  const boxGeom = new THREE.BoxGeometry(2, 1.2, 1);

  const lamps = props.filter(p => p[2] === 'lamp');
  const boxes = props.filter(p => p[2] === 'box');

  if (lamps.length > 0) {
    const lampInst = new THREE.InstancedMesh(lampGeom, lampMat, lamps.length);
    const headInst = new THREE.InstancedMesh(headGeom, headMat, lamps.length);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < lamps.length; i++) {
      const [x, z] = lamps[i];
      m4.makeTranslation(x, 2, z); lampInst.setMatrixAt(i, m4);
      m4.makeTranslation(x, 4, z); headInst.setMatrixAt(i, m4);
    }
    lampInst.instanceMatrix.needsUpdate = true;
    headInst.instanceMatrix.needsUpdate = true;
    root.add(lampInst);
    root.add(headInst);
  }
  if (boxes.length > 0) {
    const boxInst = new THREE.InstancedMesh(boxGeom, boxMat, boxes.length);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < boxes.length; i++) {
      const [x, z] = boxes[i];
      m4.makeRotationY(Math.random() * Math.PI * 2);
      m4.setPosition(x, 0.6, z);
      boxInst.setMatrixAt(i, m4);
    }
    boxInst.instanceMatrix.needsUpdate = true;
    root.add(boxInst);
  }
}
