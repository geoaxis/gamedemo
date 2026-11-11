import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder, box, cyl, ico, sph, dome, torus } from '../models/build.js';
import { getTexture } from '../models/textures.js';
import { CHOWK, SHOPS, ROAD, POND, TUBEWELL, HALF } from '../data/layout.js';
import { inFrame, nearWall, toWorld, toFrame } from './frames.js';
import { PATHS, roadZ } from './paths.js';
import { heightAt } from './terrain.js';
import { treeSpots } from './trees.js';
import { groundKind, scatter } from './vegetation.js';
import { blocked } from '../systems/collision.js';
import { makeRng, noise2 } from '../util/rng.js';

// The mess of a lived-in village: plastic bags and sweet wrappers along every lane, broken
// brick and stones, dung, straw, tea cups outside the shops, leaves under the trees, open
// drains along the main street, puddles round the hand pumps and the rubbish heaps at the
// edge of the village that smoulder all winter.

const plain = (g) => {
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal') out.deleteAttribute(k);
  out.computeVertexNormals();
  return out;
};

// Shapes, each drawn in white and coloured per copy.
function shapes() {
  const bag = new THREE.IcosahedronGeometry(0.13, 0).scale(1, 0.38, 0.8);
  const p = bag.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.8 + Math.sin(i * 7.1) * 0.25), p.getY(i), p.getZ(i) * (0.85 + Math.cos(i * 3.3) * 0.2));
  const bottle = mergeGeometries([
    plain(new THREE.CylinderGeometry(0.036, 0.036, 0.2, 7).rotateZ(Math.PI / 2).translate(0, 0.036, 0)),
    plain(new THREE.CylinderGeometry(0.014, 0.034, 0.07, 6).rotateZ(Math.PI / 2).translate(0.13, 0.036, 0)),
  ]);
  return {
    bag: plain(bag),
    bottle,
    wrapper: plain(new THREE.BoxGeometry(0.15, 0.008, 0.09).rotateZ(0.1).rotateX(0.08)),
    paper: plain(new THREE.BoxGeometry(0.24, 0.004, 0.17).rotateX(0.05)),
    cup: plain(new THREE.CylinderGeometry(0.038, 0.026, 0.075, 7, 1, true).rotateZ(Math.PI / 2 - 0.15).translate(0, 0.035, 0)),
    can: plain(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 8).rotateZ(Math.PI / 2).translate(0, 0.033, 0)),
    brickbat: plain(new THREE.BoxGeometry(0.11, 0.065, 0.09).translate(0, 0.025, 0)),
    stone: plain(new THREE.IcosahedronGeometry(0.07, 0).scale(1, 0.6, 0.85)),
    dung: plain(new THREE.SphereGeometry(0.12, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.32, 0.85)),
    straw: plain(new THREE.BoxGeometry(0.3, 0.008, 0.012).translate(0, 0.006, 0)),
    leaf: plain(new THREE.CircleGeometry(0.05, 4).scale(1, 1.6, 1).rotateX(-Math.PI / 2 + 0.2).translate(0, 0.012, 0)),
    twig: plain(new THREE.CylinderGeometry(0.008, 0.012, 0.5, 4).rotateZ(Math.PI / 2).translate(0, 0.01, 0)),
    rag: plain(new THREE.BoxGeometry(0.4, 0.02, 0.28).rotateX(0.1).rotateZ(-0.08)),
    tyre: plain(new THREE.TorusGeometry(0.28, 0.08, 5, 12).rotateX(Math.PI / 2).translate(0, 0.07, 0)),
    chappal: plain(new THREE.BoxGeometry(0.1, 0.018, 0.26).translate(0, 0.01, 0)),
  };
}

const COLORS = {
  bag: ['#f2f2ee', '#f2f2ee', '#1c1c1c', '#2f5fb0', '#d6409a', '#e8e2d0', '#3a8a4a', '#c02a2a', '#e8c81a'],
  bottle: ['#cfe3e8', '#bcd8c8', '#2f6a3a', '#d8d8d0', '#e8eef0'],
  wrapper: ['#e81e2c', '#f7c81e', '#1f6fd0', '#f08a1c', '#e8459a', '#ffffff', '#1f9d55', '#7a2fb0', '#c0c0c8'],
  paper: ['#e8e4d8', '#d8d0b8', '#c8c0a8', '#b8b0a0'],
  cup: ['#f4f2ec', '#e8e0cc', '#d8c8a8'],
  can: ['#c81e1e', '#1f6fd0', '#c0c0c0', '#2a2a2a', '#1f9d55'],
  brickbat: ['#9c5a3c', '#a86243', '#8f5136', '#b06a48', '#7d4a33'],
  stone: ['#9a948a', '#b0a898', '#857e72', '#a89a84', '#c4b8a0'],
  dung: ['#4a3a28', '#5a4630', '#3e3022', '#6a5a40'],
  straw: ['#d9c07a', '#c9a85c', '#e0cf94', '#b8985a'],
  leaf: ['#b89a4a', '#9a7a3a', '#c4a860', '#7a6a3a', '#8a9a4a', '#a88a3a'],
  twig: ['#5a4a3a', '#6a5440', '#4a3b30'],
  rag: ['#c9463d', '#5a4a8a', '#2f8a7a', '#8a7a6a', '#3a3a3a', '#e2b84a'],
  tyre: ['#1c1c1c', '#2a2a2a'],
  chappal: ['#1c1c1c', '#5a3a22', '#2f5fb0'],
};

// How common each kind is in each sort of place.
const MIX = {
  lane: { bag: 4, wrapper: 5, paper: 2, stone: 5, brickbat: 3, cup: 1, bottle: 1, can: 0.5, straw: 4, dung: 2, twig: 1, chappal: 0.1, rag: 0.3 },
  track: { stone: 6, straw: 4, dung: 4, bag: 1, wrapper: 1, twig: 2, brickbat: 1 },
  shops: { wrapper: 8, cup: 6, bag: 4, bottle: 3, can: 2, paper: 4, stone: 1, straw: 1 },
  wall: { bag: 5, wrapper: 4, paper: 2, straw: 3, brickbat: 3, stone: 2, rag: 0.4, bottle: 0.6 },
  dump: { bag: 10, wrapper: 6, paper: 4, bottle: 3, can: 2, rag: 3, cup: 2, brickbat: 2, tyre: 0.15, chappal: 0.4, straw: 3 },
  tree: { leaf: 12, twig: 1.5 },
  square: { straw: 6, dung: 1, wrapper: 2, bag: 1, stone: 2, leaf: 3, cup: 1 },
};

const DUST = new THREE.Color('#b8a284'), dusty = new THREE.Color();

export function buildClutter(scene, { plots, gates = [], pumps = [], compounds = [], far = 70 }) {
  const rng = makeRng(1313);
  const group = new THREE.Group();
  const geo = shapes();
  const lists = Object.fromEntries(Object.keys(geo).map((k) => [k, []]));
  const pickFrom = (mix) => {
    const keys = Object.keys(mix), tot = keys.reduce((s, k) => s + mix[k], 0);
    let r = rng() * tot;
    for (const k of keys) { r -= mix[k]; if (r <= 0) return k; }
    return keys[0];
  };
  const drop = (kind, x, z, y) => {
    if (Math.abs(x) > HALF - 1 || Math.abs(z) > HALF - 1) return;
    const s = rng.range(0.75, 1.3);
    // everything that has lain out a while is sun-faded and dusty
    const color = dusty.set(rng.pick(COLORS[kind])).lerp(DUST, rng.range(0.15, 0.5)).getHexString();
    lists[kind].push({ x, z, y: (y ?? heightAt(x, z)) + 0.04, s, sy: s, ry: rng() * 6.28, rx: rng.range(-0.08, 0.08), rz: rng.range(-0.08, 0.08), color: `#${color}` });
  };
  // rubbish gathers in little drifts: one piece often has a few more beside it
  const litter = (mix, x, z, y) => {
    const n = rng.chance(0.3) ? rng.int(2, 4) : 1;
    for (let i = 0; i < n; i++) drop(pickFrom(mix), x + (i ? rng.range(-0.4, 0.4) : 0), z + (i ? rng.range(-0.4, 0.4) : 0), y);
  };
  const okGround = (x, z) => { const g = groundKind(x, z, plots); return g !== 'water' && g !== 'field' && !blocked(x, z, 0.05); };

  // ---- along the lanes: thickest at the edges, where the wind and brooms push it ----
  for (const l of PATHS) {
    const brick = l.kind === 'brick';
    for (const p of l.path) {
      const village = p.x > -16 && p.x < 156 && p.z > -50 && p.z < 166;
      const n = village ? rng.int(0, brick ? 3 : 2) : rng.chance(0.35) ? 1 : 0;
      for (let i = 0; i < n; i++) {
        const side = rng.chance(0.5) ? 1 : -1, w = side > 0 ? p.wl : p.wr;
        const off = rng.chance(0.25) ? rng.range(0, w * 0.8) : w + rng.range(-0.5, 0.9);
        const x = p.x - p.dz * off * side + rng.range(-0.7, 0.7) * p.dx, z = p.z + p.dx * off * side + rng.range(-0.7, 0.7) * p.dz;
        if (!okGround(x, z)) continue;
        litter(brick || village ? MIX.lane : MIX.track, x, z);
      }
      if (rng.chance(brick ? 0.05 : 0.12)) drop('dung', p.x + rng.range(-1, 1), p.z + rng.range(-1, 1));
    }
  }

  // ---- outside the shops at the adda, and on the road verge ----
  for (let i = 0; i < 900; i++) {
    const x = rng.range(28, 114), z = rng.range(SHOPS.z + 2, ROAD.z + ROAD.half + 3);
    if (Math.abs(z - ROAD.z) < ROAD.half - 0.4 && rng.chance(0.8)) continue;
    if (okGround(x, z)) litter(MIX.shops, x, z);
  }
  for (let x = -HALF; x < HALF; x += rng.range(1, 5)) {
    const side = rng.chance(0.5) ? 1 : -1, z = roadZ(x) + side * rng.range(ROAD.half - 0.2, ROAD.half + 2.4);
    if (okGround(x, z)) litter(rng.chance(0.4) ? MIX.track : MIX.lane, x, z);
  }

  // ---- the square ----
  for (let i = 0; i < 260; i++) {
    const a = rng() * 6.28, r = Math.sqrt(rng()) * 18;
    const x = CHOWK.x + Math.cos(a) * r, z = CHOWK.z + Math.sin(a) * r;
    if (okGround(x, z)) litter(MIX.square, x, z);
  }

  // ---- blown up against the foot of the walls ----
  for (const f of compounds) {
    for (let i = 0; i < 40; i++) {
      const [x, z] = nearWall(f, rng, rng.range(0.25, 0.7), -1);
      if (okGround(x, z)) litter(MIX.wall, x, z);
    }
    // straw and dung at the gate where the animals go in and out
    for (const g of gates) {
      if (!inFrame(f, g.x, g.z, 2)) continue;
      for (let i = 0; i < 10; i++) {
        const x = g.x + rng.range(-2, 2), z = g.z + rng.range(-2.2, 2.2);
        if (okGround(x, z)) drop(rng.chance(0.6) ? 'straw' : 'dung', x, z);
      }
    }
  }

  // ---- leaves and twigs under the trees ----
  for (const t of treeSpots()) {
    if (Math.abs(t.x) > HALF + 5 || Math.abs(t.z) > HALF + 5) continue;
    const r = (t.type === 'safeda' ? 2 : t.type === 'kinnow' ? 1.6 : 3.4) * t.s;
    const n = Math.round(r * r * 2.2);
    for (let i = 0; i < n; i++) {
      const a = rng() * 6.28, d = Math.sqrt(rng()) * r * 1.3;
      const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      const g = groundKind(x, z, plots);
      if (g === 'water' || g === 'road') continue;
      drop(pickFrom(MIX.tree), x, z, g === 'field' ? 0.06 : g === 'bund' ? 0.27 : undefined);
    }
  }
  // the banyan sheds the most
  for (let i = 0; i < 700; i++) {
    const a = rng() * 6.28, d = 3.4 + Math.sqrt(rng()) * 8;
    const x = CHOWK.x + Math.cos(a) * d, z = CHOWK.z + Math.sin(a) * d;
    if (okGround(x, z)) drop(rng.chance(0.92) ? 'leaf' : 'twig', x, z);
  }

  // ---- rubbish heaps at the edge of the village ----
  const dumps = [{ x: 118, z: 70, r: 3.2 }, { x: -18, z: 2, r: 2.6 }, { x: 128, z: -48, r: 2.4 }, { x: 22, z: 150, r: 2.2 }];
  const heap = new Builder();
  for (const d of dumps) {
    heap.add(dome(d.r, '#5e5446', { x: d.x, y: -0.05, z: d.z, sy: 0.16, sz: 0.8 }, 9, 3));
    heap.add(dome(d.r * 0.55, '#3e3a34', { x: d.x + 0.4, y: d.r * 0.08, z: d.z - 0.2, sy: 0.2 }, 7, 2));
    for (let i = 0; i < 26; i++) {
      const a = rng() * 6.28, r = Math.sqrt(rng()) * d.r * 0.9;
      const lx = d.x + Math.cos(a) * r, lz = d.z + Math.sin(a) * r * 0.8;
      const hy = d.r * 0.16 * Math.sqrt(Math.max(0, 1 - (r / d.r) ** 2));
      heap.add(ico(rng.range(0.12, 0.3), rng.pick([...COLORS.bag, ...COLORS.rag, '#4a4036']), 0, { x: lx, y: hy, z: lz, sy: 0.5 }));
    }
    for (let i = 0; i < 240; i++) {
      const a = rng() * 6.28, r = Math.sqrt(rng()) * d.r * 1.9;
      const x = d.x + Math.cos(a) * r, z = d.z + Math.sin(a) * r * 0.85;
      const hy = r < d.r ? d.r * 0.16 * Math.sqrt(Math.max(0, 1 - (r / d.r) ** 2)) : 0;
      if (r > d.r && !okGround(x, z)) continue;
      litter(MIX.dump, x, z, heightAt(x, z) + hy);
    }
  }
  const heapMesh = heap.build();
  group.add(heapMesh);

  // ---- open drains (nali) along both sides of the main street ----
  const drains = new Builder();
  // one along the front of every compound, following its wall wherever it stands
  const sludge = new Builder();
  for (const f of compounds) {
    const len = f.hw * 2 + 0.6, dz = f.hd + 0.45;
    for (const B of [drains, sludge]) B.push(f.x, 0, f.z, f.ry);
    drains.add(box(len, 0.1, 0.09, '#8f5c44', { y: 0.04, z: dz - 0.19 }), 'brick');
    drains.add(box(len, 0.1, 0.09, '#8f5c44', { y: 0.04, z: dz + 0.19 }), 'brick');
    sludge.add(box(len, 0.02, 0.3, '#3d4232', { y: 0.035, z: dz }));
    // slabs where the gate crosses the drain, and the odd plank someone laid down
    for (const g of gates) {
      if (!inFrame(f, g.x, g.z, 1)) continue;
      const [gx] = toFrame(f, g.x, g.z);
      drains.add(box(2.8, 0.08, 0.7, '#9a958a', { x: gx, y: 0.1, z: dz }));
    }
    for (let x = -f.hw + rng.range(3, 9); x < f.hw - 2; x += rng.range(8, 16)) {
      if (rng.chance(0.5)) drains.add(box(0.5, 0.05, 0.7, '#6b4a2e', { x, y: 0.1, z: dz, ry: rng.range(-0.15, 0.15) }));
      else for (let k = 0; k < 3; k++) { const [wx, wz] = toWorld(f, x + rng.range(-0.5, 0.5), dz); drop(rng.pick(['bag', 'wrapper', 'bottle']), wx, wz, 0); }
    }
    for (const B of [drains, sludge]) B.pop();
  }
  group.add(drains.build({ cast: false }));
  const sludgeMesh = new THREE.Mesh(sludge.geometry(), new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x2a2a24, shininess: 30 }));
  group.add(sludgeMesh);

  const mat = new THREE.MeshLambertMaterial({ flatShading: true, side: THREE.DoubleSide });
  for (const [k, list] of Object.entries(lists)) if (list.length) scatter(group, geo[k], mat, list, { cell: 32, far });

  // ---- flat marks on the ground: wet patches, oil, dung stains, potholes ----
  const marks = { stain: [], wet: [], pothole: [] };
  const mark = (kind, x, z, s, color, y) => marks[kind].push({ x, z, y: (y ?? heightAt(x, z)) + 0.075 + rng() * 0.004, s, sy: 1, ry: rng() * 6.28, color });
  for (const l of PATHS) for (const p of l.path) {
    if (rng.chance(0.08)) mark('stain', p.x + rng.range(-1.5, 1.5), p.z + rng.range(-1.5, 1.5), rng.range(0.8, 2.4), rng.pick(['#6a5a44', '#8a7458', '#5a4a3a', '#a08a6a']));
  }
  for (let x = -HALF; x < HALF; x += rng.range(6, 22)) {
    mark('pothole', x, roadZ(x) + rng.range(-ROAD.half + 0.6, ROAD.half - 0.6), rng.range(0.5, 1.5), '#2a2622');
    if (rng.chance(0.5)) mark('stain', x + 3, roadZ(x + 3) + rng.range(-2, 2), rng.range(0.6, 1.4), rng.pick(['#1e1c1a', '#3a342e', '#8a7a64']));
  }
  for (let i = 0; i < 40; i++) {
    const a = rng() * 6.28, r = Math.sqrt(rng()) * 14;
    mark('stain', CHOWK.x + Math.cos(a) * r, CHOWK.z + Math.sin(a) * r, rng.range(1, 3), rng.pick(['#8a7458', '#6a5a44', '#a89474']));
  }

  // ---- puddles: round every hand pump, along the drains, and in ruts ----
  const puddles = [];
  const puddle = (x, z, s) => {
    mark('wet', x, z, s * 1.6, '#4a3e30');
    puddles.push({ x, z, y: heightAt(x, z) + 0.085, s, sy: 1, ry: rng() * 6.28 });
  };
  for (const p of pumps) puddle(p.x + rng.range(-0.8, 0.8), p.z + rng.range(-0.8, 0.8), rng.range(0.9, 1.5));
  puddle(TUBEWELL.x + 4, TUBEWELL.z + 6, 1.6);
  for (let i = 0; i < 8; i++) {
    const a = rng() * 6.28;
    puddle(POND.x + Math.cos(a) * (POND.r + 1.5) * 1.15, POND.z + Math.sin(a) * (POND.r + 1.5) * 0.9, rng.range(0.8, 1.8));
  }
  for (const l of PATHS) {
    for (const p of l.path) {
      if (!rng.chance(l.kind === 'brick' ? 0.012 : 0.02)) continue;
      const off = l.kind === 'brick' ? rng.range(-1, 1) : (rng.chance(0.5) ? 1 : -1) * l.w * 0.23;
      puddle(p.x - p.dz * off, p.z + p.dx * off, rng.range(0.5, 1.3));
    }
  }

  const decal = (name) => new THREE.MeshLambertMaterial({ map: getTexture(name), transparent: true, depthWrite: false });
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const markMats = { stain: decal('stain'), wet: decal('stain'), pothole: decal('puddle') };
  for (const [k, list] of Object.entries(marks)) {
    if (!list.length) continue;
    const before = group.children.length;
    scatter(group, flat, markMats[k], list.map((m) => ({ ...m, sy: 1 })), { cell: 96 });
    for (const m of group.children.slice(before)) m.renderOrder = 3;
  }
  // standing water: dark, glossy, catches the sun
  const waterMat = new THREE.MeshPhongMaterial({ color: 0x5d5a52, specular: 0x6a6a66, shininess: 120, map: getTexture('puddle'), transparent: true, depthWrite: false, opacity: 0.9 });
  const before = group.children.length;
  scatter(group, flat, waterMat, puddles, { cell: 96 });
  for (const m of group.children.slice(before)) m.renderOrder = 4;

  scene.add(group);
  return { group, dumps };
}
