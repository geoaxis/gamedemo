import * as THREE from 'three';
import { Builder, box, cyl, sph, dome } from './build.js';

// A jointed low-poly person dressed the way people dress in a Punjab village:
// shalwar kameez, with a turban, prayer cap, dupatta, shawl, waistcoat or dhoti as options.

const SKIN = ['#b98a62', '#a97b55', '#c49a70', '#9c6f4c'];

const DEFAULTS = {
  kameez: '#8fb0c9',
  shalwar: null, // defaults to the kameez colour: suits are usually one cloth
  skin: SKIN[0],
  hair: '#1a1512',
  headwear: 'none', // none | topi | pagri | dupatta
  headColor: '#f2efe6',
  beard: 'none', // none | full | white
  moustache: true,
  shoulderCloth: null,
  waistcoat: null,
  shawl: null,
  lower: 'shalwar', // shalwar | dhoti
  dhotiColor: '#d8d2c2',
  female: false,
  scale: 1,
};

function mesh(b) {
  const g = b.build();
  return g.children.length === 1 ? g.children[0] : g;
}

export function makeHuman(options = {}) {
  const o = { ...DEFAULTS, ...options };
  const shalwar = o.shalwar || o.kameez;
  const group = new THREE.Group();
  const root = new THREE.Group();
  group.add(root);

  // ---- torso ----
  const t = new Builder();
  const sh = o.female ? 0.4 : 0.46;
  const hem = o.lower === 'dhoti' ? 0.72 : o.female ? 0.44 : 0.5;
  t.add(cyl(0.185, o.female ? 0.25 : 0.215, 1.0 - hem, o.kameez, 8, { y: (1.0 + hem) / 2, sz: 0.72 }));
  t.add(cyl(0.2, 0.185, 0.44, o.kameez, 8, { y: 1.21, sz: 0.62 }));
  t.add(box(sh, 0.1, 0.2, o.kameez, { y: 1.4 }));
  t.add(cyl(0.05, 0.055, 0.12, o.skin, 6, { y: 1.49 }));
  t.add(cyl(0.068, 0.07, 0.05, o.kameez, 6, { y: 1.455 }));
  if (!o.female) t.add(box(0.036, 0.3, 0.012, '#ffffff', { y: 1.27, z: 0.123 }));
  if (o.lower === 'dhoti') t.add(cyl(0.19, 0.26, 0.8, o.dhotiColor, 8, { y: 0.56, sz: 0.75 }));
  if (o.waistcoat) {
    t.add(cyl(0.212, 0.2, 0.42, o.waistcoat, 8, { y: 1.2, sz: 0.66 }));
    t.add(box(sh + 0.01, 0.06, 0.21, o.waistcoat, { y: 1.41 }));
  }
  if (o.shawl) {
    t.add(cyl(0.27, 0.3, 0.52, o.shawl, 8, { y: 1.2, sz: 0.72 }));
    t.add(box(0.5, 0.08, 0.26, o.shawl, { y: 1.44 }));
  }
  if (o.shoulderCloth) {
    t.add(box(0.13, 0.035, 0.26, o.shoulderCloth, { x: -0.17, y: 1.46 }));
    t.add(box(0.13, 0.44, 0.02, o.shoulderCloth, { x: -0.17, y: 1.24, z: 0.135 }));
    t.add(box(0.13, 0.3, 0.02, o.shoulderCloth, { x: -0.17, y: 1.31, z: -0.135 }));
  }
  if (o.headwear === 'dupatta') {
    t.add(box(0.36, 0.62, 0.03, o.headColor, { y: 1.2, z: -0.14 }));
    t.add(box(0.44, 0.1, 0.03, o.headColor, { y: 1.33, z: 0.13, rz: 0.35 }));
  }
  root.add(mesh(t));

  // ---- head ----
  const head = new THREE.Group();
  head.position.y = 1.52;
  const h = new Builder();
  h.add(sph(0.108, o.skin, { y: 0.11, sy: 1.12 }, 8, 6));
  h.add(box(0.022, 0.036, 0.03, o.skin, { y: 0.1, z: 0.105 }));
  for (const s of [-1, 1]) {
    h.add(box(0.022, 0.014, 0.01, '#1a1512', { x: s * 0.04, y: 0.128, z: 0.097 }));
    h.add(box(0.02, 0.04, 0.02, o.skin, { x: s * 0.106, y: 0.11 }));
  }
  if (o.headwear !== 'dupatta') {
    h.add(dome(0.114, o.hair, { y: 0.158, rx: -0.2, sy: 0.72 }, 8, 3));
    h.add(box(0.2, 0.11, 0.09, o.hair, { y: 0.125, z: -0.065 }));
  }
  if (o.female) h.add(box(0.16, 0.22, 0.05, o.hair, { y: 0.06, z: -0.08 }));
  if (o.moustache && !o.female) h.add(box(0.07, 0.016, 0.012, o.beard === 'white' ? '#e6e2da' : o.hair, { y: 0.07, z: 0.102 }));
  if (o.beard !== 'none') {
    const c = o.beard === 'white' ? '#e6e2da' : o.hair;
    h.add(sph(0.085, c, { y: 0.03, z: 0.04, sy: 1.0, sz: 0.85 }, 7, 4));
  }
  if (o.headwear === 'topi') h.add(cyl(0.098, 0.106, 0.07, o.headColor, 9, { y: 0.215 }));
  if (o.headwear === 'pagri') {
    h.add(sph(0.155, o.headColor, { y: 0.2, sy: 0.62 }, 8, 4));
    h.add(sph(0.12, o.headColor, { y: 0.26, sy: 0.6, x: 0.02 }, 7, 4));
    h.add(box(0.07, 0.3, 0.02, o.headColor, { x: 0.05, y: 0.02, z: -0.12, rz: 0.1 }));
  }
  if (o.headwear === 'dupatta') {
    h.add(dome(0.128, o.headColor, { y: 0.115, rx: -0.3, sy: 1.1 }, 8, 4));
    h.add(box(0.27, 0.2, 0.05, o.headColor, { y: 0.02, z: -0.09 }));
  }
  head.add(mesh(h));
  root.add(head);

  // ---- arms ----
  const arm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * (sh / 2 + 0.02), 1.39, 0);
    const b = new Builder();
    b.add(cyl(0.058, 0.046, 0.56, o.shawl || o.kameez, 6, { y: -0.27 }));
    b.add(sph(0.043, o.skin, { y: -0.59 }, 6, 4));
    pivot.add(mesh(b));
    pivot.rotation.z = side * 0.07;
    root.add(pivot);
    return pivot;
  };
  const armL = arm(-1), armR = arm(1);

  // ---- legs: hip pivot, knee pivot ----
  const bare = o.lower === 'dhoti';
  const leg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.095, 0.9, 0);
    const up = new Builder();
    up.add(cyl(bare ? 0.06 : 0.125, bare ? 0.05 : 0.1, 0.46, bare ? o.skin : shalwar, 6, { y: -0.22 }));
    hip.add(mesh(up));
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    const lo = new Builder();
    lo.add(cyl(bare ? 0.05 : 0.1, bare ? 0.04 : 0.068, 0.4, bare ? o.skin : shalwar, 6, { y: -0.2 }));
    lo.add(box(0.085, 0.05, 0.23, o.skin, { y: -0.415, z: 0.05 }));
    lo.add(box(0.1, 0.025, 0.26, '#4a3020', { y: -0.447, z: 0.05 }));
    lo.add(box(0.1, 0.03, 0.05, '#4a3020', { y: -0.4, z: 0.1 }));
    knee.add(mesh(lo));
    hip.add(knee);
    root.add(hip);
    return [hip, knee];
  };
  const [legL, kneeL] = leg(-1);
  const [legR, kneeR] = leg(1);

  group.scale.setScalar(o.scale);
  group.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; } });

  const state = { phase: Math.random() * 6, sitting: false, driving: false, idle: Math.random() * 10, blend: 0 };

  return {
    group, root, head, armL, armR, legL, legR,
    state,
    setSitting(v, seat = 0.46) {
      state.sitting = v;
      root.position.y = v ? seat + 0.1 - 0.9 : 0;
    },
    setDriving(v) { state.driving = v; },
    // speed is metres per second along the ground; 0 means standing.
    update(dt, speed = 0) {
      state.idle += dt;
      if (state.sitting) {
        legL.rotation.x = legR.rotation.x = -1.45;
        kneeL.rotation.x = kneeR.rotation.x = 1.45;
        const reach = state.driving ? -1.15 : -0.35;
        armL.rotation.x = armR.rotation.x = reach;
        root.rotation.x = 0;
        return;
      }
      const moving = speed > 0.15;
      state.blend += ((moving ? 1 : 0) - state.blend) * Math.min(1, dt * 10);
      if (moving) state.phase += dt * (3.2 + speed * 1.75);
      const run = Math.min(1, Math.max(0, (speed - 2.2) / 3));
      const A = (0.5 + run * 0.45) * state.blend;
      const s = Math.sin(state.phase), c = Math.cos(state.phase);
      legL.rotation.x = -s * A;
      legR.rotation.x = s * A;
      kneeL.rotation.x = Math.max(0, c) * (0.8 + run * 0.6) * state.blend;
      kneeR.rotation.x = Math.max(0, -c) * (0.8 + run * 0.6) * state.blend;
      const breathe = Math.sin(state.idle * 1.6) * 0.03 * (1 - state.blend);
      armL.rotation.x = s * A * 0.8 + breathe;
      armR.rotation.x = -s * A * 0.8 - breathe;
      root.position.y = Math.abs(c) * 0.035 * state.blend;
      root.rotation.x = run * 0.12 * state.blend;
    },
  };
}

// Ready-made outfits for the people of the village.
export const OUTFITS = {
  player: { kameez: '#8fb0c9', shoulderCloth: '#c9463d', moustache: true },
  bashir: { kameez: '#e9e4d6', lower: 'dhoti', dhotiColor: '#5b6f8a', headwear: 'pagri', headColor: '#f4f1e8', beard: 'white', shawl: '#8a6a4a', skin: SKIN[1] },
  aslam: { kameez: '#b9a888', headwear: 'pagri', headColor: '#d9d2c0', waistcoat: '#4a4238', beard: 'none', skin: SKIN[3], shoulderCloth: '#6f8a5a' },
  haji: { kameez: '#f1eee6', headwear: 'topi', beard: 'white', waistcoat: '#2f3a4a', skin: SKIN[2] },
  billu: { kameez: '#6c7d5a', waistcoat: '#3a2f2a', skin: SKIN[0], shoulderCloth: '#d9c9a0' },
  sughran: { kameez: '#9c3f5a', shalwar: '#9c3f5a', headwear: 'dupatta', headColor: '#e2b84a', female: true, skin: SKIN[1], moustache: false },
  nasreen: { kameez: '#2f8a7a', shalwar: '#2f8a7a', headwear: 'dupatta', headColor: '#e86a8a', female: true, skin: SKIN[2], moustache: false },
  ammi: { kameez: '#5a4a8a', shalwar: '#5a4a8a', headwear: 'dupatta', headColor: '#efe7d3', female: true, skin: SKIN[0], moustache: false, shawl: '#7a5a4a' },
  imam: { kameez: '#f4f2ec', headwear: 'topi', beard: 'full', waistcoat: '#5a5148', skin: SKIN[0] },
  jeeda: { kameez: '#a8643c', scale: 0.8, moustache: false, shoulderCloth: '#e9e4d6', skin: SKIN[3] },
  musafir: { kameez: '#4a5a6a', waistcoat: '#2a2a2a', skin: SKIN[1], beard: 'full' },
  ustad: { kameez: '#5a5a5a', skin: SKIN[3], moustache: true },
  kid1: { kameez: '#d9463d', shalwar: '#e9e4d6', scale: 0.62, moustache: false, skin: SKIN[2] },
  kid2: { kameez: '#3d7ad9', scale: 0.58, moustache: false, skin: SKIN[0] },
  kid3: { kameez: '#e2b84a', shalwar: '#e9e4d6', scale: 0.66, moustache: false, skin: SKIN[1], headwear: 'topi' },
};
