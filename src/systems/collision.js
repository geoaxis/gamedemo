import { CANAL, BRIDGES, HALF, POND } from '../data/layout.js';

// Static obstacles are axis-aligned boxes and circles kept in a coarse grid.
// Moving things (tractor, villagers, animals) register as dynamic circles.

const CELL = 12;
const grid = new Map();
export const dynamic = [];

const key = (ix, iz) => ix * 4096 + iz;

function insert(c, x0, z0, x1, z1) {
  for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++) {
    for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
      const k = key(ix, iz);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(c);
    }
  }
}

export function addBox(x0, z0, x1, z1) {
  const c = { box: true, x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) };
  insert(c, c.x0, c.z0, c.x1, c.z1);
  return c;
}
export const addBoxC = (cx, cz, hw, hd) => addBox(cx - hw, cz - hd, cx + hw, cz + hd);

export function addCircle(x, z, r) {
  const c = { box: false, x, z, r };
  insert(c, x - r, z - r, x + r, z + r);
  return c;
}

export function addDynamic(obj) { dynamic.push(obj); return obj; }

export const onBridge = (z, margin = 0.2) => BRIDGES.some((b) => Math.abs(z - b.z) < b.half - margin);

function pushFromCircle(p, r, cx, cz, cr) {
  const dx = p.x - cx, dz = p.z - cz;
  const min = r + cr;
  const d2 = dx * dx + dz * dz;
  if (d2 >= min * min) return false;
  const d = Math.sqrt(d2) || 0.0001;
  p.x = cx + (dx / d) * min;
  p.z = cz + (dz / d) * min;
  return true;
}

function pushFromBox(p, r, b) {
  const nx = Math.max(b.x0, Math.min(p.x, b.x1));
  const nz = Math.max(b.z0, Math.min(p.z, b.z1));
  const dx = p.x - nx, dz = p.z - nz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    p.x = nx + (dx / d) * r;
    p.z = nz + (dz / d) * r;
  } else {
    // centre is inside the box: leave through the nearest side
    const l = p.x - b.x0, rr = b.x1 - p.x, t = p.z - b.z0, bt = b.z1 - p.z;
    const m = Math.min(l, rr, t, bt);
    if (m === l) p.x = b.x0 - r; else if (m === rr) p.x = b.x1 + r;
    else if (m === t) p.z = b.z0 - r; else p.z = b.z1 + r;
  }
  return true;
}

// Moves p = {x, z} out of anything solid. Returns a short tag for what was hit, or null.
export function resolve(p, r, self = null) {
  let hit = null;
  for (let pass = 0; pass < 2; pass++) {
    const ix0 = Math.floor((p.x - r) / CELL), ix1 = Math.floor((p.x + r) / CELL);
    const iz0 = Math.floor((p.z - r) / CELL), iz1 = Math.floor((p.z + r) / CELL);
    for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
      const list = grid.get(key(ix, iz));
      if (!list) continue;
      for (const c of list) {
        if (c.box ? pushFromBox(p, r, c) : pushFromCircle(p, r, c.x, c.z, c.r)) hit = 'solid';
      }
    }
    for (const d of dynamic) {
      if (d === self || d.off) continue;
      if (pushFromCircle(p, r, d.x, d.z, d.r)) hit = 'solid';
    }
  }

  // The canal can only be crossed on a bridge.
  const dx = p.x - CANAL.x;
  const edge = CANAL.bankIn + 0.15 + r * 0.5;
  if (Math.abs(dx) < edge && !onBridge(p.z)) {
    p.x = CANAL.x + (dx >= 0 ? edge : -edge);
    hit = 'canal';
  }

  // The pond is for buffalo only.
  if (pushFromCircle(p, r, POND.x, POND.z, POND.r - 2.5)) hit = 'solid';

  const lim = HALF - 2;
  if (p.x < -lim) p.x = -lim; else if (p.x > lim) p.x = lim;
  if (p.z < -lim) p.z = -lim; else if (p.z > lim) p.z = lim;
  return hit;
}

// True when the point is inside a wall or building. Used to keep the camera out of them.
export function insideBox(x, z, pad = 0.25) {
  const list = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
  if (!list) return false;
  for (const c of list) {
    if (c.box && x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad) return true;
  }
  return false;
}

// True when a circle at (x, z) would overlap something static. Used by wandering animals.
export function blocked(x, z, r) {
  const p = { x, z };
  const before = dynamic.length;
  const saved = dynamic.splice(0, before);
  const hit = resolve(p, r);
  dynamic.push(...saved);
  return hit !== null || Math.abs(p.x - x) > 1e-4 || Math.abs(p.z - z) > 1e-4;
}
