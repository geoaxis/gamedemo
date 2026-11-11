import * as THREE from 'three';
import { CANAL, POND, ROAD, HALF, CHOWK, FIELD_BLOCKS, BRIDGES } from '../data/layout.js';
import { inFrame, nearWall, toWorld } from './frames.js';
import { PATHS, nearestLane, roadZ } from './paths.js';
import { heightAt } from './terrain.js';
import { addTree } from './trees.js';
import { blocked } from '../systems/collision.js';
import { windify } from '../systems/wind.js';
import { makeRng, noise2 } from '../util/rng.js';

// Grass and weeds. February in the Punjab: the open ground in the village is trodden bare,
// but grass grows wherever feet and hooves do not reach: along the foot of walls, on the
// edges of lanes, on field bunds and canal banks. Akk and thorn scrub take the waste corners.

// Where the compounds really stand (from the village), for telling yards from open ground.
let frames = [];

// What kind of ground a point is, for deciding what grows (or lies) there.
export function groundKind(x, z, plots) {
  if (Math.abs(x) > HALF - 1 || Math.abs(z) > HALF - 1) return 'edge';
  const dc = Math.abs(x - CANAL.x);
  if (dc < CANAL.bankIn + 0.4) return 'water';
  if (dc < CANAL.toe) return BRIDGES.some((b) => Math.abs(z - b.z) < b.half + 1.5) ? 'busy' : 'bank';
  const px = (x - POND.x) / 1.15, pz = (z - POND.z) / 0.9;
  if (Math.hypot(px, pz) < POND.r + 0.5) return 'water';
  if (Math.abs(z - roadZ(x)) < ROAD.half + 0.4) return 'road';
  const ln = nearestLane(x, z);
  if (ln && ln.edge < 0) return 'lane';
  for (const p of plots) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) return 'field';
  for (const b of FIELD_BLOCKS) if (x > b.x0 - 0.7 && x < b.x1 + 0.7 && z > b.z0 - 0.7 && z < b.z1 + 0.7) return 'bund';
  if (ln && ln.edge < 1.4) return 'verge';
  if (Math.hypot(x - CHOWK.x, z - CHOWK.z) < 17) return 'busy';
  for (const f of frames) if (inFrame(f, x, z)) return 'yard';
  return 'open';
}

// ---- blade geometry ----

function tuft(rng, { blades, h, w, lean, base, tip, spread = 0.16 }) {
  const pos = [], col = [], nor = [];
  const cb = new THREE.Color(base), ct = new THREE.Color(tip), c = new THREE.Color();
  for (let i = 0; i < blades; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * spread;
    const bh = h * rng.range(0.6, 1.15), bw = w * rng.range(0.7, 1.3);
    const ox = Math.cos(a) * r, oz = Math.sin(a) * r;
    const la = rng() * Math.PI * 2, l = lean * rng.range(0.3, 1);
    const side = a + Math.PI / 2;
    const sx = Math.cos(side) * bw / 2, sz = Math.sin(side) * bw / 2;
    pos.push(ox - sx, 0, oz - sz, ox + sx, 0, oz + sz, ox + Math.cos(la) * l * bh, bh, oz + Math.sin(la) * l * bh);
    c.copy(cb).multiplyScalar(rng.range(0.85, 1.1));
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    c.copy(ct).multiplyScalar(rng.range(0.85, 1.15));
    col.push(c.r, c.g, c.b);
    // grass is lit as if facing the sky, so the back of a blade is not black
    for (let k = 0; k < 3; k++) nor.push(Math.cos(a) * 0.3, 0.9, Math.sin(a) * 0.3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

function flowers(rng, colors) {
  const g = tuft(rng, { blades: 6, h: 0.32, w: 0.035, lean: 0.25, base: '#3f6a2a', tip: '#7aa04a' });
  const pos = [...g.attributes.position.array], col = [...g.attributes.color.array], nor = [...g.attributes.normal.array];
  const c = new THREE.Color();
  for (let i = 0; i < 5; i++) {
    const x = rng.range(-0.12, 0.12), z = rng.range(-0.12, 0.12), y = rng.range(0.22, 0.36), s = 0.035;
    c.set(rng.pick(colors));
    pos.push(x - s, y, z, x + s, y, z + s * 0.3, x, y + s * 0.4, z - s);
    for (let k = 0; k < 3; k++) { col.push(c.r, c.g, c.b); nor.push(0, 1, 0); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

// Places many copies of a geometry, split into map cells so off-screen cells are culled.
// Cells far from the camera are hidden by updateDetail(); `far` is how far each one shows.
const detail = [];
export function updateDetail(cam) {
  for (const d of detail) {
    const dx = d.x - cam.x, dz = d.z - cam.z;
    d.mesh.visible = dx * dx + dz * dz < d.far2;
  }
}

export function scatter(group, geo, mat, list, { cell = 48, shadow = false, far = Infinity } = {}) {
  const cells = new Map();
  for (const t of list) {
    const k = `${Math.floor(t.x / cell)},${Math.floor(t.z / cell)}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(t);
  }
  const d = new THREE.Object3D();
  const c = new THREE.Color();
  for (const items of cells.values()) {
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((t, i) => {
      d.position.set(t.x, t.y ?? heightAt(t.x, t.z), t.z);
      d.rotation.set(t.rx || 0, t.ry ?? 0, t.rz || 0);
      d.scale.set(t.s, t.sy ?? t.s, t.s);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      if (t.color) mesh.setColorAt(i, c.set(t.color));
    });
    mesh.computeBoundingSphere();
    mesh.receiveShadow = true;
    mesh.castShadow = shadow;
    group.add(mesh);
    if (far < Infinity) {
      const c = mesh.boundingSphere.center, r = mesh.boundingSphere.radius + far;
      detail.push({ mesh, x: c.x, z: c.z, far2: r * r });
    }
  }
}

export function buildVegetation(scene, { plots, gates = [], compounds = [], thin = 1 }) {
  frames = compounds;
  const rng = makeRng(808);
  const group = new THREE.Group();
  const kinds = {
    green: { list: [], geo: tuft(rng, { blades: 22, h: 0.34, w: 0.07, lean: 0.45, base: '#4a6a2c', tip: '#a3c25e', spread: 0.22 }) },
    lush: { list: [], geo: tuft(rng, { blades: 26, h: 0.55, w: 0.08, lean: 0.5, base: '#3c6226', tip: '#94b850', spread: 0.25 }) },
    dry: { list: [], geo: tuft(rng, { blades: 18, h: 0.5, w: 0.06, lean: 0.55, base: '#8a7a4a', tip: '#dccb90', spread: 0.2 }) },
    flower: { list: [], geo: flowers(rng, ['#f2d21e', '#f2f0e6', '#c9a0e0', '#f2d21e']) },
  };
  // each call plants a small clump of tufts, the way grass actually grows
  const put = (k, x, z, s = 1, y) => {
    const n = rng.int(1, 3);
    if (rng() > thin) return;
    for (let i = 0; i < n; i++) {
      const px = x + (i ? rng.range(-0.35, 0.35) : 0), pz = z + (i ? rng.range(-0.35, 0.35) : 0);
      const ss = s * rng.range(0.7, 1.2) * (i ? 0.8 : 1);
      kinds[i && k === 'flower' ? 'green' : k].list.push({ x: px, z: pz, y, s: ss, sy: ss * rng.range(0.75, 1.3), ry: rng() * 6.28 });
    }
  };
  const free = (x, z) => !blocked(x, z, 0.12);
  const pick = (x, z) => {
    const n = noise2(x * 0.15, z * 0.15);
    return n < 0.35 ? 'dry' : n > 0.8 ? 'flower' : n > 0.62 ? 'lush' : 'green';
  };

  // 1. Lane edges: a fringe of grass where wheels and feet do not go.
  for (const l of PATHS) {
    for (const p of l.path) {
      for (const side of [-1, 1]) {
        const n = rng.int(1, 4);
        for (let i = 0; i < n; i++) {
          const w = side > 0 ? p.wl : p.wr;
          const off = w + rng.range(-0.2, 1.6) ** 1.4;
          const x = p.x + -p.dz * off * side + rng.range(-0.7, 0.7) * p.dx;
          const z = p.z + p.dx * off * side + rng.range(-0.7, 0.7) * p.dz;
          const g = groundKind(x, z, plots);
          if (g === 'lane' && rng.chance(0.8)) continue;
          if (g === 'field' || g === 'water' || g === 'road' || g === 'busy' || !free(x, z)) continue;
          put(pick(x, z), x, z, g === 'lane' ? 0.6 : 1);
        }
      }
      // the odd tuft right in the middle, where the cart wheels leave a strip between the ruts
      if (l.kind === 'dirt' && rng.chance(0.5)) put('green', p.x + rng.range(-0.3, 0.3), p.z + rng.range(-0.3, 0.3), 0.6);
    }
  }

  // 2. Along the foot of every compound wall, inside and out.
  for (const f of compounds) {
    const per = 4 * (f.hw + f.hd);
    for (let i = 0; i < per * 2.2; i++) {
      // inOut > 0 puts the tuft just inside the wall, < 0 just outside
      const inOut = rng.chance(0.6) ? 1 : -1;
      const d = inOut > 0 ? rng.range(0.25, 0.9) : rng.range(0.6, 1.4);
      const [x, z] = nearWall(f, rng, d, inOut);
      if (gates.some((gt) => Math.hypot(gt.x - x, gt.z - z) < 2.2)) continue;
      const g = groundKind(x, z, plots);
      if (g === 'lane' || g === 'field' || g === 'road' || !free(x, z)) continue;
      put(rng.chance(0.25) ? 'dry' : pick(x, z), x, z, rng.range(0.8, 1.3));
    }
    // a waste corner behind most compounds: akk and scrub
    if (rng.chance(0.6)) {
      const [x, z] = toWorld(f, (rng.chance(0.5) ? 1 : -1) * (f.hw + 2.2), rng.range(-f.hd, f.hd));
      if (groundKind(x, z, plots) === 'open' && free(x, z)) addTree(rng.chance(0.6) ? 'akk' : 'jhari', x, z, rng.range(0.7, 1.2), false);
    }
  }

  // 3. Field bunds: a line of grass along each one, with weeds and flowers.
  for (const p of plots) {
    const edges = [[p.x0 - 0.65, p.z0, p.x0 - 0.65, p.z1], [p.x1 + 0.65, p.z0, p.x1 + 0.65, p.z1], [p.x0, p.z0 - 0.65, p.x1, p.z0 - 0.65], [p.x0, p.z1 + 0.65, p.x1, p.z1 + 0.65]];
    for (const [ax, az, bx, bz] of edges) {
      const len = Math.hypot(bx - ax, bz - az);
      for (let i = 0; i < len * 0.9; i++) {
        const t = rng(), x = ax + (bx - ax) * t + rng.range(-0.35, 0.35), z = az + (bz - az) * t + rng.range(-0.35, 0.35);
        if (Math.abs(x) > HALF - 2 || Math.abs(z) > HALF - 2) continue;
        put(rng.chance(0.15) ? 'flower' : rng.chance(0.3) ? 'lush' : 'green', x, z, rng.range(0.7, 1.1), 0.27);
      }
    }
  }

  // 4. Canal banks: thick grass all along both banks.
  for (let i = 0; i < 9000; i++) {
    const side = rng.chance(0.5) ? 1 : -1;
    const x = CANAL.x + side * rng.range(CANAL.bankIn + 0.3, CANAL.toe + 3), z = rng.range(-HALF + 2, HALF - 2);
    const g = groundKind(x, z, plots);
    if (g !== 'bank' && g !== 'open' && g !== 'verge') continue;
    if (!free(x, z)) continue;
    const near = Math.abs(Math.abs(x - CANAL.x) - CANAL.bankIn);
    put(near < 2 ? 'lush' : pick(x, z), x, z, near < 2 ? 1.3 : 1);
  }

  // 5. The rest of the open ground, in patches.
  for (let i = 0; i < 60000; i++) {
    const x = rng.range(-HALF + 2, HALF - 2), z = rng.range(-HALF + 2, HALF - 2);
    const g = groundKind(x, z, plots);
    if (g !== 'open' && g !== 'yard' && g !== 'verge') continue;
    const village = x > -16 && x < 156 && z > -50 && z < 80;
    const patch = noise2(x * 0.06 + 3, z * 0.06);
    const want = village ? (g === 'yard' ? 0.06 : 0.18) : 0.65;
    if (rng() > want * (patch > 0.45 ? 1 : 0.15)) continue;
    if (!free(x, z)) continue;
    put(pick(x, z), x, z);
    if (!village && rng.chance(0.004)) addTree(rng.chance(0.5) ? 'akk' : 'jhari', x, z, rng.range(0.7, 1.3), false);
  }

  // round the pond the grass grows lush to the water
  for (let i = 0; i < 900; i++) {
    const a = rng() * Math.PI * 2, r = POND.r + rng.range(0.6, 6);
    const x = POND.x + Math.cos(a) * r * 1.15, z = POND.z + Math.sin(a) * r * 0.9;
    if (groundKind(x, z, plots) === 'water' || !free(x, z)) continue;
    put(r < POND.r + 2.5 ? 'lush' : 'green', x, z, 1.2);
  }

  const mat = windify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { height: 0.6, amt: 0.16, flutter: 0.02, push: 0.35 });
  // phones get bigger cells (fewer draw calls) and a shorter reach
  for (const k of Object.values(kinds)) scatter(group, k.geo, mat, k.list, thin < 1 ? { cell: 48, far: 75 } : { cell: 32, far: 120 });
  scene.add(group);
  return { group, count: Object.values(kinds).reduce((s, k) => s + k.list.length, 0) };
}
