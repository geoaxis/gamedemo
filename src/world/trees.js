import * as THREE from 'three';
import { Builder, cyl, ico, sph, box, cone } from '../models/build.js';
import { getTexture } from '../models/textures.js';
import { grime } from '../models/grime.js';
import { windify, windDepth } from '../systems/wind.js';
import { laneCentre, roadZ } from './paths.js';
import { CANAL, BRIDGES, ROAD, POND, TUBEWELL, HALF } from '../data/layout.js';
import { heightAt } from './terrain.js';
import { addCircle } from '../systems/collision.js';
import { makeRng } from '../util/rng.js';

// Trees of the Punjab plain, each modelled once and drawn many times with instancing.

const BARK = '#7e6650';

// Crowns are clouds of crossed leaf cards. Their normals point out from the crown centre,
// so light falls on the crown as a whole instead of on each flat card.
class Foliage {
  constructor(rng) { this.rng = rng; this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }
  crown({ x = 0, y, z = 0, r, sy = 1, n, size, low = '#3f6b2c', high = '#7dad4b', lean = 0.6 }) {
    const rng = this.rng, lo = new THREE.Color(low), hi = new THREE.Color(high), c = new THREE.Color();
    const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), nrm = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      // points crowd toward the outside of the crown, where the leaves are
      const u = rng() * 2 - 1, a = rng() * Math.PI * 2, k = Math.sqrt(1 - u * u);
      const rad = r * (0.45 + 0.55 * Math.sqrt(rng()));
      const px = x + Math.cos(a) * k * rad, py = y + u * rad * sy, pz = z + Math.sin(a) * k * rad;
      const sz = size * rng.range(0.75, 1.25);
      e.set(rng.range(-lean, lean), rng() * Math.PI * 2, rng.range(-lean, lean));
      q.setFromEuler(e);
      const t = (py - (y - r * sy)) / (2 * r * sy);
      const inner = rad / r;
      c.copy(lo).lerp(hi, Math.min(1, Math.max(0, t * 0.8 + inner * 0.3 - 0.1))).multiplyScalar(rng.range(0.85, 1.12));
      const base = this.pos.length / 3;
      for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        v.set(cx * sz / 2, cy * sz / 2, 0).applyQuaternion(q);
        this.pos.push(px + v.x, py + v.y, pz + v.z);
        nrm.set(px + v.x - x, (py + v.y - y) / Math.max(0.3, sy) + r * 0.25, pz + v.z - z).normalize();
        this.nor.push(nrm.x, nrm.y, nrm.z);
        this.uv.push((cx + 1) / 2, (cy + 1) / 2);
        this.col.push(c.r, c.g, c.b);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    return g;
  }
}

// A limb from (x0,y0,z0) to (x1,y1,z1).
function limb(b, [x0, y0, z0], [x1, y1, z1], r0, r1, color = BARK, seg = 5) {
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dx, dy, dz);
  const g = cyl(r1, r0, len, color, seg);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
  g.applyQuaternion(q);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  b.add(g);
}

// Each maker draws the wood into a Builder and the leaves into a Foliage, and says which leaf
// texture it uses and how tall it is (for the sway).
const makers = {
  // Sheesham (tahli): tall, airy, yellow-green; the classic shade tree of the canal colonies.
  sheesham(b, f) {
    limb(b, [0, 0, 0], [0.2, 3.4, 0.1], 0.32, 0.22);
    limb(b, [0.2, 3.3, 0.1], [1.5, 5.6, 0.4], 0.18, 0.09);
    limb(b, [0.2, 3.3, 0.1], [-1.3, 5.3, -0.5], 0.17, 0.08);
    limb(b, [0.2, 3.6, 0.1], [0.1, 6.6, 1.2], 0.15, 0.07);
    limb(b, [0.2, 3.6, 0.1], [-0.2, 6.2, -1.6], 0.12, 0.06);
    const L = { low: '#5a8434', high: '#a9cf66', size: 1.9 };
    f.crown({ ...L, x: 1.3, y: 6.3, z: 0.3, r: 2.0, sy: 0.75, n: 46 });
    f.crown({ ...L, x: -1.3, y: 6.0, z: -0.5, r: 1.9, sy: 0.75, n: 42 });
    f.crown({ ...L, x: 0, y: 7.5, z: 0.6, r: 1.8, sy: 0.8, n: 40 });
    f.crown({ ...L, x: 0.1, y: 6.0, z: 1.6, r: 1.4, sy: 0.75, n: 26 });
    f.crown({ ...L, x: -0.2, y: 6.0, z: -1.8, r: 1.4, sy: 0.75, n: 26 });
    return { leaf: 'leavesFine', h: 8.5 };
  },
  // Kikar (acacia): dark leaning trunk and a flat, sparse, grey-green crown.
  kikar(b, f) {
    const D = '#4a3b30';
    limb(b, [0, 0, 0], [0.7, 3.0, 0], 0.26, 0.16, D);
    limb(b, [0.7, 2.9, 0], [2.0, 4.3, 0.2], 0.14, 0.06, D);
    limb(b, [0.7, 2.9, 0], [-0.4, 4.4, 0.6], 0.13, 0.06, D);
    limb(b, [0.7, 3.0, 0], [0.7, 4.6, -1.1], 0.11, 0.05, D);
    const L = { low: '#65793f', high: '#adbd7e', size: 1.8, lean: 0.35 };
    f.crown({ ...L, x: 1.8, y: 4.6, r: 2.0, sy: 0.32, n: 40 });
    f.crown({ ...L, x: -0.6, y: 4.8, z: 0.5, r: 1.9, sy: 0.32, n: 36 });
    f.crown({ ...L, x: 0.6, y: 5.1, z: -0.9, r: 1.5, sy: 0.32, n: 24 });
    return { leaf: 'leavesFine', h: 5.5 };
  },
  // Mango: short thick trunk, dense dark dome.
  mango(b, f) {
    limb(b, [0, 0, 0], [0, 2.6, 0], 0.44, 0.3, '#5a4636', 7);
    limb(b, [0, 2.4, 0], [1.6, 3.8, 0.4], 0.2, 0.1, '#5a4636');
    limb(b, [0, 2.4, 0], [-1.5, 3.9, -0.6], 0.2, 0.1, '#5a4636');
    const L = { low: '#2c5622', high: '#5a8f3c', size: 2.0, lean: 0.8 };
    f.crown({ ...L, y: 4.7, r: 3.1, sy: 0.8, n: 110 });
    f.crown({ ...L, x: 2.0, y: 4.0, z: 0.6, r: 2.0, sy: 0.8, n: 40 });
    f.crown({ ...L, x: -1.9, y: 4.1, z: -0.8, r: 2.0, sy: 0.8, n: 40 });
    return { leaf: 'leavesBroad', h: 7.5 };
  },
  // Safeda (eucalyptus): planted in rows along roads; pale bark, thin drooping crown.
  safeda(b, f) {
    limb(b, [0, 0, 0], [0.15, 11, 0], 0.24, 0.1, '#cfc6b4', 6);
    limb(b, [0.1, 7, 0], [1.0, 9.5, 0.3], 0.07, 0.03, '#cfc6b4');
    limb(b, [0.1, 8, 0], [-0.8, 10.5, -0.2], 0.06, 0.03, '#cfc6b4');
    const L = { low: '#5a7a4c', high: '#a6bf92', size: 1.8, lean: 0.3 };
    f.crown({ ...L, y: 8.4, r: 1.4, sy: 1.8, n: 40 });
    f.crown({ ...L, x: 0.5, y: 11.0, r: 1.1, sy: 1.5, n: 24 });
    f.crown({ ...L, x: -0.6, y: 6.6, z: 0.4, r: 0.9, sy: 1.4, n: 14 });
    return { leaf: 'leavesLong', h: 12 };
  },
  // Khajoor (date palm).
  khajoor(b) {
    for (let i = 0; i < 6; i++) b.add(cyl(0.2 - i * 0.012, 0.22 - i * 0.012, 1.25, i % 2 ? '#7a6248' : '#6d573f', 6, { y: 0.62 + i * 1.22 }));
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + (i % 2) * 0.2;
      const dead = i % 5 === 0;
      const g = box(0.55, 0.04, 3.0, dead ? '#9a8a5a' : i % 2 ? '#4f7a2f' : '#5c8a36', { z: 1.5, rx: dead ? -0.9 : 0.25 + (i % 3) * 0.2 });
      g.rotateY(a); g.translate(0, 7.5, 0);
      b.add(g);
    }
    b.add(sph(0.45, '#4f7a2f', { y: 7.5 }));
    b.add(sph(0.22, '#d98a2b', { x: 0.35, y: 7.0 }));
    b.add(sph(0.22, '#d98a2b', { x: -0.3, y: 7.0, z: 0.25 }));
    return { h: 9 };
  },
  // Kinnow orange tree, heavy with fruit in February.
  kinnow(b, f) {
    limb(b, [0, 0, 0], [0, 1.1, 0], 0.13, 0.09, '#5a4636');
    f.crown({ y: 2.0, r: 1.45, sy: 0.9, n: 50, size: 0.9, low: '#1f4a1e', high: '#4a8a36', lean: 0.9 });
    const rng = makeRng(11);
    for (let i = 0; i < 16; i++) {
      const a = rng() * Math.PI * 2, e = rng.range(-0.5, 0.9);
      b.add(ico(0.11, '#f08a1c', 0, { x: Math.cos(a) * Math.cos(e) * 1.45, y: 2.0 + Math.sin(e) * 1.3, z: Math.sin(a) * Math.cos(e) * 1.45 }));
    }
    return { leaf: 'leavesBroad', h: 3.4 };
  },
  // Akk (calotropis): the grey-green waste-ground shrub with big leaves and lilac flowers.
  akk(b, f) {
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      limb(b, [0, 0, 0], [Math.cos(a) * 0.5, 1.0 + (i % 2) * 0.3, Math.sin(a) * 0.5], 0.04, 0.025, '#9a9a80');
    }
    f.crown({ y: 0.9, r: 0.8, sy: 0.7, n: 22, size: 0.75, low: '#7d9178', high: '#c4d2b4', lean: 1.2 });
    const rng = makeRng(17);
    for (let i = 0; i < 6; i++) b.add(ico(0.06, '#c9b6d9', 0, { x: rng.range(-0.6, 0.6), y: 1.25 + rng() * 0.3, z: rng.range(-0.6, 0.6) }));
    return { leaf: 'leavesBroad', h: 1.6 };
  },
  // Jhari: a low thorny scrub bush (ber / wild kikar) on field corners and waste ground.
  jhari(b, f) {
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1;
      limb(b, [0, 0, 0], [Math.cos(a) * 0.9, 0.9 + (i % 3) * 0.25, Math.sin(a) * 0.9], 0.05, 0.02, '#5a4a3a', 4);
    }
    f.crown({ y: 0.9, r: 1.1, sy: 0.6, n: 30, size: 0.9, low: '#55663a', high: '#9aae6a', lean: 1.0 });
    return { leaf: 'leavesFine', h: 1.8 };
  },
  // Sarkanda: tall reed grass with feathery plumes on canal banks.
  sarkanda(b) {
    const rng = makeRng(5);
    for (let i = 0; i < 14; i++) {
      const a = rng() * Math.PI * 2, lean = rng.range(0.1, 0.5), h = rng.range(1.5, 2.7);
      const xo = rng.range(-0.3, 0.3);
      const g = cone(0.06, h, rng.pick(['#9aa45a', '#b3a865', '#c2b37a', '#8a9a52']), 3, { y: h / 2, rz: lean, x: xo });
      g.rotateY(a);
      b.add(g);
      if (i % 3 === 0) {
        // the plume: a loose fan of silky strands nodding over at the top of the stem
        const tx = -Math.sin(lean) * h + xo, ty = Math.cos(lean) * h;
        for (let k = 0; k < 5; k++) {
          const p = cone(0.035, rng.range(0.5, 0.8), rng.pick(['#efe6cc', '#e2d6b4', '#f4eedc']), 3, { y: 0.3, rz: lean + 0.5 + k * 0.12, rx: (k - 2) * 0.18 });
          p.translate(tx, ty, 0);
          p.rotateY(a);
          b.add(p);
        }
      }
    }
    return { h: 2.8, amt: 0.5 };
  },
};

const trunkRadius = { sheesham: 0.38, kikar: 0.34, mango: 0.5, safeda: 0.3, khajoor: 0.3, kinnow: 0.25, sarkanda: 0, akk: 0, jhari: 0 };
const pending = Object.fromEntries(Object.keys(makers).map((k) => [k, []]));
const spin = makeRng(77);

// Where the trees stand (for leaf litter and falling leaves).
export function treeSpots(types = ['sheesham', 'kikar', 'mango', 'safeda', 'kinnow']) {
  return types.flatMap((t) => pending[t].map((p) => ({ ...p, type: t })));
}

export function addTree(type, x, z, s = 1, solid = true) {
  pending[type].push({ x, z, s, rot: spin() * Math.PI * 2 });
  if (solid && trunkRadius[type] > 0) addCircle(x, z, trunkRadius[type] * s);
}

const leafMats = new Map();
function leafMaterial(leaf, h) {
  const key = `${leaf}-${h}`;
  if (!leafMats.has(key)) {
    const map = getTexture(leaf);
    const opts = { height: h, amt: 0.22 + h * 0.012, flutter: 0.05, base: Math.min(1, h * 0.15) };
    const mat = windify(new THREE.MeshLambertMaterial({ map, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide }), opts);
    leafMats.set(key, { mat, depth: windDepth(opts, { map, alphaTest: 0.45 }) });
  }
  return leafMats.get(key);
}

const woodMats = new Map();
function woodMaterial(h, amt) {
  const key = `${h}-${amt}`;
  if (!woodMats.has(key)) {
    const opts = { height: h, amt, base: Math.min(1, h * 0.15) };
    const mat = windify(grime(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 0.5), opts);
    woodMats.set(key, { mat, depth: windDepth(opts) });
  }
  return woodMats.get(key);
}

// The old banyan (bohr) in the square: one of a kind, so built as its own mesh.
export function banyan(scene, x, z) {
  const b = new Builder();
  const f = new Foliage(makeRng(8));
  const rng = makeRng(3);
  b.add(cyl(0.9, 1.4, 4.2, '#6b5a4a', 9, { y: 2.1 }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    b.add(cyl(0.3, 0.42, 4.0, '#665545', 6, { x: Math.cos(a) * 1.0, y: 2.0, z: Math.sin(a) * 1.0 }));
    const lb = cyl(0.22, 0.4, 6.5, '#665545', 6, { x: 2.8, y: 1.6, rz: -1.05 });
    lb.rotateY(a); lb.translate(0, 3.6, 0);
    b.add(lb);
    // aerial roots hanging from the limbs
    for (let k = 0; k < 3; k++) {
      const r = 3.0 + k * 1.6 + rng() * 0.8, h = 4.2 + rng() * 1.6;
      b.add(cyl(0.03, 0.05, h, '#7a6957', 4, { x: Math.cos(a + 0.1 + k * 0.15) * r, y: 6.3 - h / 2, z: -Math.sin(a + 0.1 + k * 0.15) * r }));
    }
  }
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2, r = rng.range(1.5, 8.0);
    f.crown({ x: Math.cos(a) * r, y: rng.range(7.2, 9.6) - r * 0.12, z: Math.sin(a) * r, r: rng.range(2.4, 3.4), sy: 0.6, n: 70, size: 1.9, low: '#22451b', high: '#5a8a3a', lean: 0.9 });
  }
  f.crown({ y: 10.2, r: 4.2, sy: 0.6, n: 120, size: 2.0, low: '#2a5220', high: '#64953f', lean: 0.9 });
  const wood = woodMaterial(12, 0.04), leaves = leafMaterial('leavesBroad', 12);
  const w = new THREE.Mesh(b.geometry(), wood.mat);
  const l = new THREE.Mesh(f.geometry(), leaves.mat);
  for (const m of [w, l]) { m.position.set(x, 0, z); m.castShadow = m.receiveShadow = true; scene.add(m); }
  w.customDepthMaterial = wood.depth;
  l.customDepthMaterial = leaves.depth;
  addCircle(x, z, 1.5);
}

export function scatterTrees() {
  const rng = makeRng(2024);
  const nearBridge = (z) => BRIDGES.some((b) => Math.abs(z - b.z) < b.half + 9);

  // Along the canal: trees at the foot of the banks, reeds at the water's edge.
  for (const side of [-1, 1]) {
    for (let z = -HALF + 6; z < HALF; z += rng.range(11, 24)) {
      if (nearBridge(z)) continue;
      addTree(rng.chance(0.55) ? 'kikar' : 'sheesham', CANAL.x + side * rng.range(14.5, 17), z, rng.range(0.85, 1.25));
    }
    for (let z = -HALF + 3; z < HALF; z += rng.range(5, 13)) {
      if (nearBridge(z)) continue;
      addTree('sarkanda', CANAL.x + side * rng.range(7.7, 8.3), z, rng.range(0.8, 1.3));
    }
  }

  // Eucalyptus rows along the paved road.
  for (const side of [-1, 1]) {
    for (let x = -HALF - 150; x < HALF + 150; x += 12) {
      if (Math.abs(x - CANAL.x) < 44) continue;
      if (side < 0 && x > 22 && x < 116) continue;
      const tx = x + rng.range(-1, 1);
      addTree('safeda', tx, roadZ(tx) + side * rng.range(7.6, 8.6), rng.range(0.85, 1.15));
    }
  }

  // Sheesham shading the lane from the road to the village.
  for (let z = 84; z < 146; z += 15) {
    const za = z + rng.range(-2, 2), zb = z + 7 + rng.range(-2, 2);
    addTree('sheesham', laneCentre('link', za) - 4.4, za, rng.range(0.9, 1.1));
    addTree('sheesham', laneCentre('link', zb) + 4.4, zb, rng.range(0.9, 1.1));
  }

  // Kinnow orchard between the village and the canal.
  for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 10; iz++) {
    addTree('kinnow', -35 + ix * 6.5 + rng.range(-0.4, 0.4), -50 + iz * 6.2 + rng.range(-0.4, 0.4), rng.range(0.85, 1.15));
  }

  // Round the pond.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const r = POND.r + rng.range(4.5, 7);
    addTree(rng.pick(['kikar', 'sheesham', 'khajoor', 'kikar']), POND.x + Math.cos(a) * r * 1.15, POND.z + Math.sin(a) * r * 0.9, rng.range(0.9, 1.2));
  }
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2;
    addTree('sarkanda', POND.x + Math.cos(a) * (POND.r + 1.2) * 1.15, POND.z + Math.sin(a) * (POND.r + 1.2) * 0.9, rng.range(0.7, 1.1));
  }

  // Shade at the tube well.
  addTree('mango', TUBEWELL.x - 11, TUBEWELL.z - 5.5, 1.15);
  addTree('sheesham', TUBEWELL.x + 8, TUBEWELL.z + 9, 1.1);
  addTree('sheesham', TUBEWELL.x - 5, TUBEWELL.z + 13, 1.0);
  addTree('khajoor', TUBEWELL.x + 10, TUBEWELL.z - 9, 1.0);
  addTree('khajoor', TUBEWELL.x + 12.5, TUBEWELL.z - 6, 0.85);

  // Far tree line so the horizon is never bare.
  for (let i = 0; i < 260; i++) {
    const a = rng() * Math.PI * 2, r = rng.range(HALF + 25, HALF + 260);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x - CANAL.x) < 20 || Math.abs(z - roadZ(x)) < 9) continue;
    addTree(rng.pick(['sheesham', 'kikar', 'sheesham', 'safeda', 'mango']), x, z, rng.range(0.9, 1.5), false);
  }
}

export function buildTrees(scene) {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  for (const [type, list] of Object.entries(pending)) {
    if (!list.length) continue;
    const b = new Builder();
    const f = new Foliage(makeRng(type.length * 13));
    const spec = makers[type](b, f);
    const place = (geo, { mat, depth }) => {
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((t, i) => {
        dummy.position.set(t.x, heightAt(t.x, t.z) - 0.05, t.z);
        dummy.rotation.set(0, t.rot, 0);
        dummy.scale.setScalar(t.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.customDepthMaterial = depth;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    };
    place(b.geometry(), woodMaterial(spec.h, spec.amt ?? 0.06));
    if (spec.leaf) place(f.geometry(), leafMaterial(spec.leaf, spec.h));
  }
  scene.add(group);
  return group;
}
