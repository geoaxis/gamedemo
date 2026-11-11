import * as THREE from 'three';
import { CANAL, BRIDGES, ROAD } from '../data/layout.js';
import { PATHS, laneDistance, roadZ, roadSlope } from './paths.js';
import { getTexture } from '../models/textures.js';
import { groundVariation, wetOnly } from '../models/grime.js';
import { smooth } from '../util/rng.js';

// The land is flat (it is the Punjab plain) apart from the canal banks and bridge ramps.
export function heightAt(x, z) {
  const d = Math.abs(x - CANAL.x);
  let h = 0;
  if (d < CANAL.toe) {
    h = d >= CANAL.bankOut ? CANAL.h * (1 - (d - CANAL.bankOut) / (CANAL.toe - CANAL.bankOut)) : CANAL.h;
  }
  for (const b of BRIDGES) {
    if (Math.abs(z - b.z) <= b.half && d < b.approach) {
      const hb = d <= b.span ? b.deck : b.deck * (1 - smooth((d - b.span) / (b.approach - b.span)));
      if (hb > h) h = hb;
    }
  }
  return h;
}

// What is underfoot: decides the footstep sound.
export function surfaceAt(x, z) {
  if (Math.abs(z - roadZ(x)) < ROAD.half) return 'asphalt';
  for (const l of PATHS) {
    if (l.kind !== 'brick') continue;
    const r = laneDistance(l, x, z);
    if (r && r.edge < 0) return 'brick';
  }
  return 'dirt';
}

// A strip laid along a sampled lane centre line, following the ground height.
// `grow` widens it (for the dusty verge); `ragged` lets each side wander in and out.
export function pathRibbon(pts, { grow = 0, tile = 1, yOff = 0.03, uScale = null } = {}) {
  const pos = [], uv = [], idx = [];
  let run = 0;
  pts.forEach((p, i) => {
    if (i) run += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    const px = -p.dz, pz = p.dx;
    const l = p.wl + grow, r = p.wr + grow;
    const lx = p.x + px * l, lz = p.z + pz * l, rx = p.x - px * r, rz = p.z - pz * r;
    pos.push(lx, heightAt(lx, lz) + yOff, lz, rx, heightAt(rx, rz) + yOff, rz);
    const w = uScale ?? (l + r) / tile;
    uv.push(0, run / tile, w, run / tile);
    if (i < pts.length - 1) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Earth ramp that carries a lane or the road up to bridge height on one side of the canal.
function embankment(b, side) {
  const pos = [], idx = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const d = b.span - 1 + ((b.approach - b.span + 1) * i) / n;
    const x = CANAL.x + side * d;
    const h = Math.max(0.001, heightAt(x, b.z));
    const out = b.half + h * 1.4;
    pos.push(x, 0, b.z - out, x, h - 0.02, b.z - b.half, x, h - 0.02, b.z + b.half, x, 0, b.z + out);
    if (i < n) {
      const k = i * 4;
      for (let j = 0; j < 3; j++) {
        const a = k + j, c = k + j + 4;
        if (side > 0) idx.push(a, a + 1, c, a + 1, c + 1, c);
        else idx.push(a, c, a + 1, a + 1, c, c + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildTerrain(scene) {
  const group = new THREE.Group();

  const dirt = getTexture('dirt').clone();
  dirt.repeat.set(200, 200);
  dirt.needsUpdate = true;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2),
    groundVariation(new THREE.MeshLambertMaterial({ map: dirt })),
  );
  ground.receiveShadow = true;
  group.add(ground);

  const mat = (name, color = 0xffffff) => wetOnly(new THREE.MeshLambertMaterial({ map: getTexture(name), color }));
  const lay = (g, m, order = 0) => { const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.renderOrder = order; group.add(mesh); };

  const earth = new THREE.MeshLambertMaterial({ color: 0xb59f78 });
  for (const b of BRIDGES) for (const side of [-1, 1]) lay(embankment(b, side), earth);

  // Lanes: a soft band of dust first, then the brick or the beaten track on top.
  const brick = mat('soling'), track = mat('track'), asphalt = mat('asphalt');
  // The verge is see-through, so it is drawn after the opaque lanes; the lanes are pulled
  // slightly toward the camera in depth so the verge never paints over them.
  const verge = wetOnly(new THREE.MeshLambertMaterial({ map: getTexture('verge'), transparent: true, depthWrite: false }), 0.3);
  for (const m of [brick, track, asphalt]) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -4; }
  for (const l of PATHS) {
    const brickLane = l.kind === 'brick';
    lay(pathRibbon(l.path, { grow: brickLane ? 0.9 : 1.3, tile: 6, uScale: 1, yOff: 0.015 }), verge, 1);
    lay(pathRibbon(l.path, { tile: brickLane ? 1 : l.w, yOff: 0.035 }), brickLane ? brick : track, 2);
  }

  // Paved road: the tarmac edge has crumbled and the earth shoulders are uneven.
  const road = [];
  for (let x = -420; x <= 420; x += 2) {
    const sl = roadSlope(x), n = Math.hypot(1, sl);
    road.push({
      x, z: roadZ(x), dx: 1 / n, dz: sl / n,
      wl: ROAD.half + 0.22 * Math.sin(x * 0.37) + 0.12 * Math.sin(x * 1.13 + 2) - 0.1,
      wr: ROAD.half + 0.22 * Math.sin(x * 0.29 + 1) + 0.12 * Math.sin(x * 0.97) - 0.1,
    });
  }
  lay(pathRibbon(road, { grow: 2.4, tile: 6, uScale: 1, yOff: 0.02 }), verge, 1);
  lay(pathRibbon(road, { tile: 4, uScale: 1, yOff: 0.05 }), asphalt, 2);

  scene.add(group);
  return group;
}
