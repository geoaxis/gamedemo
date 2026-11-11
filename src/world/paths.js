import { LANES, ROAD } from '../data/layout.js';
import { smooth } from '../util/rng.js';

// The lanes as wandering centre lines. Each lane is sampled every metre or so; the samples
// carry the centre point, the direction, and a slightly uneven half-width on each side.

const STEP = 1.5;

// Cheap smooth 1-D noise: a few sines at unrelated frequencies.
const wobble = (s, seed) =>
  Math.sin(s * 0.041 + seed) * 0.55 + Math.sin(s * 0.097 + seed * 2.3) * 0.3 + Math.sin(s * 0.23 + seed * 4.1) * 0.15;

function sample(lane, seed) {
  const [[ax, az], [bx, bz]] = lane.pts;
  const len = Math.hypot(bx - ax, bz - az);
  const dx = (bx - ax) / len, dz = (bz - az) / len;
  const px = -dz, pz = dx;
  const n = Math.max(2, Math.ceil(len / STEP));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * len;
    // fade the bend to nothing at the ends, at junctions and over calm stretches
    let k = smooth(Math.min(s, len - s) / 10);
    for (const p of lane.pins || []) k *= smooth(Math.abs(s - p) / 12);
    for (const [c0, c1] of lane.calm || []) {
      if (s >= c0 && s <= c1) k = 0;
      else k *= smooth(Math.min(Math.abs(s - c0), Math.abs(s - c1)) / 12);
    }
    const off = wobble(s, seed) * (lane.bend || 0) * k;
    const hw = lane.w / 2;
    // ragged edges: each side eats in or spills out a little on its own
    const wl = hw * (1 + 0.07 * Math.sin(s * 0.53 + seed * 3) + 0.05 * Math.sin(s * 1.37 + seed));
    const wr = hw * (1 + 0.07 * Math.sin(s * 0.61 + seed * 5) + 0.05 * Math.sin(s * 1.19 + seed * 2));
    pts.push({ x: ax + dx * s + px * off, z: az + dz * s + pz * off, s, wl, wr });
  }
  // direction from neighbours so the strip turns smoothly
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    pts[i].dx = (b.x - a.x) / l; pts[i].dz = (b.z - a.z) / l;
  }
  return pts;
}

export const PATHS = LANES.map((l, i) => {
  const pts = sample(l, i * 1.7 + 0.4);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  const pad = l.w;
  return { ...l, path: pts, box: { x0: x0 - pad, x1: x1 + pad, z0: z0 - pad, z1: z1 + pad } };
});

export const pathById = (id) => PATHS.find((p) => p.id === id);

// The centre line of a lane as [[x, z], ...], thinned out: handy as a walking route.
export function lanePath(id, from = 0, to = Infinity, every = 6) {
  const p = pathById(id);
  const out = [];
  let last = -Infinity;
  for (const q of p.path) {
    if (q.s < from || q.s > to) continue;
    if (q.s - last >= every) { out.push([q.x, q.z]); last = q.s; }
  }
  const end = p.path.filter((q) => q.s <= to).pop();
  if (end && out.length && (out[out.length - 1][0] !== end.x || out[out.length - 1][1] !== end.z)) out.push([end.x, end.z]);
  return out;
}

// Centre of a lane where it crosses a given x (east-west lanes) or z (north-south lanes).
export function laneCentre(id, along) {
  const p = pathById(id);
  const horizontal = Math.abs(p.pts[1][0] - p.pts[0][0]) > Math.abs(p.pts[1][1] - p.pts[0][1]);
  const key = horizontal ? 'x' : 'z', other = horizontal ? 'z' : 'x';
  const pts = p.path;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if ((along - a[key]) * (along - b[key]) <= 0) {
      const t = (along - a[key]) / ((b[key] - a[key]) || 1);
      return a[other] + (b[other] - a[other]) * t;
    }
  }
  return horizontal ? p.pts[0][1] : p.pts[0][0];
}

// Distance from (x, z) to a lane's centre line, and how far that is past its edge
// (negative when on the lane). Returns null when the point is nowhere near.
export function laneDistance(p, x, z) {
  const b = p.box;
  if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return null;
  let best = Infinity, edge = Infinity;
  const pts = p.path;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], c = pts[i + 1];
    const ex = c.x - a.x, ez = c.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / (ex * ex + ez * ez)));
    const qx = a.x + ex * t, qz = a.z + ez * t;
    const d = Math.hypot(x - qx, z - qz);
    if (d < best) {
      best = d;
      // which side of the lane decides which half-width applies
      const side = (x - qx) * -ez + (z - qz) * ex;
      edge = d - (side >= 0 ? a.wl : a.wr);
    }
  }
  return { d: best, edge };
}

// The nearest lane to a point and how far past its edge the point lies.
export function nearestLane(x, z) {
  let best = null;
  for (const p of PATHS) {
    const r = laneDistance(p, x, z);
    if (r && (!best || r.edge < best.edge)) best = { lane: p, ...r };
  }
  return best;
}

// Centre line of the paved road at a given x, and its slope dz/dx.
export function roadZ(x) {
  const [c0, c1] = ROAD.calm;
  const k = x < c0 ? smooth((c0 - x) / 40) : x > c1 ? smooth((x - c1) / 40) : 0;
  return ROAD.z + k * ROAD.bend * (Math.sin(x * 0.019 + 1.1) * 0.7 + Math.sin(x * 0.043 + 0.3) * 0.3);
}
export const roadSlope = (x) => (roadZ(x + 0.5) - roadZ(x - 0.5));
