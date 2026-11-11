import { box, cyl, sph, cone, dome, torus, tbox } from './build.js';
import { addBox, addCircle, addOBB } from '../systems/collision.js';

// Everyday village objects. Each function draws into a Builder at (x, z) turned by ry
// and registers its own obstacle where one is needed.

const WOOD = '#7a5230', DARKWOOD = '#4e3520', IRON = '#3f4a46', CLAY = '#b5673c', STEEL = '#b9bdc0';

export function solidBox(b, hw, hd, cx = 0, cz = 0) {
  const [px, pz] = b.point(cx, cz), [ax, az] = b.point(cx + 1, cz), [bx, bz] = b.point(cx, cz + 1);
  const ux = ax - px, uz = az - pz;
  // square to the map: a plain box; turned at some odd angle: a turned box
  if (Math.abs(ux * uz) < 1e-6) {
    const [x0, z0] = b.point(cx - hw, cz - hd);
    const [x1, z1] = b.point(cx + hw, cz + hd);
    addBox(x0, z0, x1, z1);
  } else addOBB(px, pz, ux, uz, bx - px, bz - pz, hw, hd);
}
export function solidCircle(b, r, cx = 0, cz = 0) {
  const [x, z] = b.point(cx, cz);
  addCircle(x, z, r);
}

// Rope-strung bed. Returns its world position so it can be sat on.
export function charpai(b, x, z, ry = 0, solid = true) {
  b.push(x, 0, z, ry);
  const L = 1.9, W = 0.95, H = 0.46;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.add(cyl(0.04, 0.03, H + 0.06, WOOD, 6, { x: (sx * W) / 2, y: (H + 0.06) / 2, z: (sz * L) / 2 }));
  }
  for (const sx of [-1, 1]) b.add(box(0.06, 0.06, L, WOOD, { x: (sx * W) / 2, y: H }));
  for (const sz of [-1, 1]) b.add(box(W, 0.06, 0.06, WOOD, { y: H, z: (sz * L) / 2 }));
  b.add(tbox(W - 0.06, 0.03, L - 0.3, 0.45, { y: H + 0.01, z: -0.1 }), 'weave');
  for (let i = 0; i < 5; i++) b.add(box(0.012, 0.012, 0.22, '#d9cdb4', { x: -0.36 + i * 0.18, y: H, z: L / 2 - 0.13 }));
  if (solid) solidBox(b, W / 2, L / 2);
  const [wx, wz] = b.point(0, 0);
  b.pop();
  return { x: wx, z: wz, ry, h: H };
}

export function handPump(b, x, z, ry = 0) {
  b.push(x, 0, z, ry);
  b.add(box(1.5, 0.12, 1.5, '#aaa397', { y: 0.06 }));
  b.add(cyl(0.05, 0.05, 0.75, IRON, 6, { y: 0.5 }));
  b.add(cyl(0.085, 0.085, 0.32, IRON, 6, { y: 0.98 }));
  b.add(cyl(0.035, 0.045, 0.34, IRON, 5, { y: 0.9, z: 0.2, rx: Math.PI / 2.4 }));
  b.add(box(0.035, 0.04, 0.95, IRON, { y: 1.22, z: -0.36, rx: -0.38 }));
  b.add(cyl(0.02, 0.02, 0.26, IRON, 5, { y: 1.22 }));
  solidCircle(b, 0.3);
  const [wx, wz] = b.point(0, 0);
  b.pop();
  return { x: wx, z: wz };
}

export function tandoor(b, x, z) {
  b.push(x, 0, z);
  b.add(cyl(0.75, 0.85, 0.35, '#b08a58', 10, { y: 0.175 }));
  b.add(cyl(0.34, 0.52, 0.7, '#a0643c', 10, { y: 0.7 }));
  b.add(cyl(0.27, 0.27, 0.03, '#1a1410', 10, { y: 1.05 }));
  b.add(cyl(0.2, 0.2, 0.02, '#e8862a', 10, { y: 1.02 }), 'glow');
  solidCircle(b, 0.8);
  b.pop();
}

// Mud stove with a cooking pot.
export function chulha(b, x, z, ry = 0) {
  b.push(x, 0, z, ry);
  b.add(box(0.7, 0.3, 0.14, '#a9834f', { y: 0.15, z: -0.28 }));
  for (const s of [-1, 1]) b.add(box(0.14, 0.3, 0.6, '#a9834f', { x: s * 0.28, y: 0.15 }));
  b.add(box(0.3, 0.08, 0.3, '#e0701c', { y: 0.06 }), 'glow');
  b.add(cyl(0.24, 0.2, 0.22, '#2b2826', 9, { y: 0.42 }));
  b.add(cyl(0.25, 0.25, 0.03, STEEL, 9, { y: 0.55 }));
  solidCircle(b, 0.45);
  b.pop();
}

// Feeding trough with green fodder, and a tethering peg.
export function khurli(b, x, z, ry = 0, len = 2.6) {
  b.push(x, 0, z, ry);
  b.add(tbox(len, 0.5, 0.75, 2, { y: 0.25 }), 'mud');
  b.add(box(len - 0.25, 0.1, 0.5, '#4f8a2c', { y: 0.5 }));
  solidBox(b, len / 2, 0.38);
  b.pop();
}

export function peg(b, x, z) {
  b.add(cyl(0.035, 0.045, 0.4, DARKWOOD, 5, { x, y: 0.2, z }));
}

export function ghara(b, x, y, z, s = 1) {
  b.add(sph(0.2 * s, CLAY, { x, y: y + 0.19 * s, z, sy: 0.95 }));
  b.add(cyl(0.085 * s, 0.07 * s, 0.09 * s, '#a85b33', 7, { x, y: y + 0.41 * s, z }));
}

// Wooden stand holding the family's drinking water pots.
export function gharaStand(b, x, z, ry = 0) {
  b.push(x, 0, z, ry);
  for (const sx of [-0.55, 0.55]) for (const sz of [-0.2, 0.2]) b.add(box(0.05, 0.6, 0.05, WOOD, { x: sx, y: 0.3, z: sz }));
  b.add(box(1.3, 0.05, 0.5, WOOD, { y: 0.6 }));
  for (const px of [-0.42, 0, 0.42]) ghara(b, px, 0.62, 0);
  b.add(cyl(0.1, 0.1, 0.02, STEEL, 7, { x: 0.42, y: 1.07 }));
  solidBox(b, 0.65, 0.25);
  b.pop();
}

export function hookah(b, x, z) {
  b.push(x, 0, z);
  b.add(sph(0.13, '#b88a2a', { y: 0.13, sy: 0.9 }));
  b.add(cyl(0.022, 0.03, 0.55, '#6b4a2e', 5, { y: 0.48 }));
  b.add(cyl(0.07, 0.04, 0.1, CLAY, 6, { y: 0.8 }));
  b.add(cyl(0.012, 0.012, 0.6, '#8a2f2f', 4, { x: 0.2, y: 0.36, rz: 1.0 }));
  b.pop();
}

// Dung cakes slapped on a wall to dry: rows of dark discs.
export function dungCakes(b, x, y, z, ry, cols, rows) {
  b.push(x, y, z, ry);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    b.add(cyl(0.13, 0.13, 0.04, r % 2 ? '#5b4630' : '#665038', 7, { x: (c - (cols - 1) / 2) * 0.34 + (r % 2) * 0.1, y: r * 0.31, rx: Math.PI / 2 }));
  }
  b.pop();
}

// Plastered beehive store of dung cakes kept for fuel.
// Bhoonga: a store of dried dung cakes, plastered over with mud against the rain. The plaster
// slumps and cracks; a few cakes stick out at the bottom where someone has been taking them.
export function dungStore(b, x, z, s = 1) {
  b.push(x, 0, z, x * 0.37);
  b.add(cyl(0.6 * s, 1.15 * s, 1.5 * s, '#d8c8a8', 14, { y: 0.75 * s, rz: 0.03 }), 'mud');
  b.add(dome(0.62 * s, '#d0bf9c', { y: 1.48 * s, sy: 0.75, x: 0.03 }, 14, 4), 'mud');
  b.add(cyl(0.08 * s, 0.14 * s, 0.25 * s, '#b09668', 6, { y: 1.98 * s }));
  for (let i = 0; i < 7; i++) {
    const a = 0.4 + i * 0.32;
    b.add(cyl(0.13 * s, 0.13 * s, 0.035, '#5a4630', 8, { x: Math.cos(a) * 1.1 * s, y: 0.12 + (i % 3) * 0.1, z: Math.sin(a) * 1.1 * s, rx: Math.PI / 2, ry: -a + Math.PI / 2 }));
  }
  solidCircle(b, 1.1 * s);
  b.pop();
}
export function strawStack(b, x, z, s = 1) {
  b.push(x, 0, z);
  b.add(cyl(1.7 * s, 1.95 * s, 1.8 * s, '#ffffff', 16, { y: 0.9 * s }), 'straw');
  b.add(dome(1.75 * s, '#f4eedc', { y: 1.8 * s, sy: 0.8 }, 16, 5), 'straw');
  // loose straw pulled out round the foot, and a rope tying down the top
  b.add(cyl(2.15 * s, 2.3 * s, 0.12, '#e8d8a8', 16, { y: 0.06 }), 'straw');
  b.add(torus(1.55 * s, 0.03, '#6a5a3a', Math.PI * 2, { y: 2.55 * s, rx: Math.PI / 2 }, 4, 16));
  solidCircle(b, 1.8 * s);
  b.pop();
}

export function bench(b, x, z, ry = 0, len = 1.8) {
  b.push(x, 0, z, ry);
  b.add(box(len, 0.05, 0.32, WOOD, { y: 0.44 }));
  for (const s of [-1, 1]) b.add(box(0.06, 0.44, 0.3, DARKWOOD, { x: s * (len / 2 - 0.12), y: 0.22 }));
  solidBox(b, len / 2, 0.16);
  b.pop();
}

export function table(b, x, z, ry = 0) {
  b.push(x, 0, z, ry);
  b.add(box(1.1, 0.05, 0.6, '#3c6f9c', { y: 0.72 }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.05, 0.72, 0.05, DARKWOOD, { x: sx * 0.48, y: 0.36, z: sz * 0.24 }));
  // tea things
  b.add(cyl(0.035, 0.03, 0.06, '#f4f1ea', 6, { x: -0.2, y: 0.78 }));
  b.add(cyl(0.035, 0.03, 0.06, '#f4f1ea', 6, { x: 0.15, y: 0.78, z: 0.1 }));
  solidBox(b, 0.55, 0.3);
  b.pop();
}

function wheel(b, r, w, x, y, z, tyre = '#1d1d1d', rim = '#9a9a9a') {
  b.add(cyl(r, r, w, tyre, 10, { x, y, z, rz: Math.PI / 2 }));
  b.add(cyl(r * 0.55, r * 0.55, w + 0.02, rim, 8, { x, y, z, rz: Math.PI / 2 }));
}

// The red 70cc motorcycle found outside every shop.
export function motorcycle(b, x, z, ry = 0, solid = true) {
  b.push(x, 0, z, ry);
  b.add(torus(0.3, 0.045, '#1d1d1d', Math.PI * 2, { y: 0.3, z: 0.62, ry: Math.PI / 2 }));
  b.add(torus(0.3, 0.045, '#1d1d1d', Math.PI * 2, { y: 0.3, z: -0.6, ry: Math.PI / 2 }));
  b.add(box(0.1, 0.1, 0.9, '#2a2a2a', { y: 0.48 }));
  b.add(box(0.2, 0.2, 0.26, '#8a8d90', { y: 0.38, z: 0.05 }));
  b.add(box(0.24, 0.2, 0.44, '#c81e1e', { y: 0.72, z: 0.2 }));
  b.add(box(0.24, 0.09, 0.62, '#1a1a1a', { y: 0.74, z: -0.34 }));
  b.add(cyl(0.025, 0.025, 0.62, '#9a9a9a', 5, { y: 0.62, z: 0.6, rx: -0.42 }));
  b.add(cyl(0.02, 0.02, 0.6, '#2a2a2a', 5, { y: 0.98, z: 0.48, rz: Math.PI / 2 }));
  b.add(sph(0.09, '#e9e6d8', { y: 0.86, z: 0.6 }));
  b.add(box(0.2, 0.03, 0.4, '#c81e1e', { y: 0.63, z: -0.62 }));
  b.add(cyl(0.035, 0.035, 0.6, '#b9bdc0', 5, { x: 0.14, y: 0.3, z: -0.32, rx: Math.PI / 2 }));
  b.add(box(0.02, 0.3, 0.02, '#2a2a2a', { x: -0.14, y: 0.15, z: -0.1, rz: -0.3 }));
  if (solid) solidBox(b, 0.3, 0.9);
  b.pop();
}

export function bicycle(b, x, z, ry = 0, solid = true) {
  b.push(x, 0, z, ry);
  for (const wz of [-0.55, 0.55]) b.add(torus(0.34, 0.02, '#1d1d1d', Math.PI * 2, { y: 0.34, z: wz, ry: Math.PI / 2 }));
  b.add(cyl(0.018, 0.018, 0.75, '#1f1f1f', 4, { y: 0.62, rx: Math.PI / 2 - 0.25 }));
  b.add(cyl(0.018, 0.018, 0.65, '#1f1f1f', 4, { y: 0.5, z: -0.22, rx: -0.5 }));
  b.add(cyl(0.018, 0.018, 0.7, '#1f1f1f', 4, { y: 0.66, z: 0.5, rx: 0.3 }));
  b.add(box(0.14, 0.05, 0.24, '#4e3520', { y: 0.88, z: -0.3 }));
  b.add(cyl(0.015, 0.015, 0.5, '#9a9a9a', 4, { y: 1.0, z: 0.42, rz: Math.PI / 2 }));
  b.add(box(0.2, 0.02, 0.3, '#3a3a3a', { y: 0.72, z: -0.62 }));
  if (solid) solidBox(b, 0.25, 0.85);
  b.pop();
}

// Two-wheeled flat cart pulled by a donkey.
export function donkeyCart(b, x, z, ry = 0) {
  b.push(x, 0, z, ry);
  b.add(box(1.5, 0.08, 2.2, WOOD, { y: 0.72 }));
  for (const s of [-1, 1]) {
    b.add(box(0.06, 0.25, 2.2, DARKWOOD, { x: s * 0.72, y: 0.88 }));
    wheel(b, 0.36, 0.2, s * 0.85, 0.36, -0.15);
    b.add(box(0.06, 0.06, 2.0, WOOD, { x: s * 0.42, y: 0.74, z: 2.0 }));
  }
  b.add(box(1.4, 0.06, 0.08, '#2a2a2a', { y: 0.4, z: -0.15 }));
  b.add(box(1.2, 0.35, 1.5, '#4f8a2c', { y: 0.95, z: -0.2 }));
  solidBox(b, 0.9, 1.2);
  b.pop();
}

export function tyreStack(b, x, z, n = 3) {
  b.push(x, 0, z);
  for (let i = 0; i < n; i++) b.add(torus(0.3, 0.11, '#1b1b1b', Math.PI * 2, { y: 0.11 + i * 0.21, rx: Math.PI / 2 }));
  solidCircle(b, 0.42);
  b.pop();
}

// Blue drum of drinking water with a tap and a steel glass on a chain.
export function waterCooler(b, x, z) {
  b.push(x, 0, z);
  b.add(box(0.6, 0.5, 0.6, '#8d8a84', { y: 0.25 }));
  b.add(cyl(0.26, 0.26, 0.62, '#2f6fc4', 10, { y: 0.81 }));
  b.add(cyl(0.27, 0.27, 0.05, '#e9e6d8', 10, { y: 1.14 }));
  b.add(box(0.05, 0.05, 0.1, '#b9bdc0', { y: 0.62, z: 0.3 }));
  solidCircle(b, 0.35);
  b.pop();
}

export function crates(b, x, z, ry = 0) {
  b.push(x, 0, z, ry);
  b.add(box(0.5, 0.3, 0.36, '#c81e1e', { y: 0.15 }));
  b.add(box(0.5, 0.3, 0.36, '#1f6fd0', { y: 0.45, ry: 0.2 }));
  b.add(box(0.5, 0.3, 0.36, '#f2c230', { x: 0.56, y: 0.15 }));
  solidBox(b, 0.6, 0.25, 0.25);
  b.pop();
}

// Sacks of flour, sugar and fertiliser stacked outside the general store.
export function sacks(b, x, z, ry = 0) {
  b.push(x, 0, z, ry);
  const cols = ['#e6dcc4', '#d9cfae', '#efe7d3'];
  for (let i = 0; i < 4; i++) {
    b.add(box(0.75, 0.24, 0.45, cols[i % 3], { x: (i % 2) * 0.1, y: 0.12 + i * 0.24, ry: (i % 2) * 0.25 }));
  }
  solidBox(b, 0.45, 0.3);
  b.pop();
}

// Concrete electricity pole with a cross arm. Wires are strung separately.
export function pole(b, x, z, ry = 0, h = 7.5) {
  b.push(x, 0, z, ry);
  b.add(cyl(0.09, 0.14, h, '#a39e94', 6, { y: h / 2 }));
  b.add(box(1.8, 0.08, 0.08, '#6c6a64', { y: h - 0.4 }));
  for (const s of [-0.8, 0, 0.8]) b.add(cyl(0.035, 0.045, 0.14, '#ded9cc', 5, { x: s, y: h - 0.29 }));
  solidCircle(b, 0.18);
  b.pop();
}

export function milestone(b, x, z, ry = 0) {
  b.push(x, 0, z, ry);
  b.add(box(0.5, 0.6, 0.2, '#f0ede4', { y: 0.3 }));
  b.add(cyl(0.25, 0.25, 0.2, '#f2c230', 8, { y: 0.6, rx: Math.PI / 2, sy: 1 }));
  solidCircle(b, 0.3);
  b.pop();
}

// Raised brick platform people sit on under a big tree.
export function platform(b, x, z, r = 3.2, h = 0.5) {
  b.push(x, 0, z);
  b.add(cyl(r, r + 0.1, h, '#ffffff', 16, { y: h / 2 }), 'brick');
  b.add(cyl(r - 0.05, r - 0.05, 0.03, '#c2ab84', 16, { y: h + 0.015 }));
  solidCircle(b, r);
  b.pop();
}

// Sugarcane bundle or fodder heap: a simple green mound.
// A heap of fresh-cut fodder (berseem or green wheat): a dark core with loose stalks
// sticking out all over it. sy squashes it, sz stretches it along z, y lifts it.
let fodderSeed = 1;
export function fodderHeap(b, x, z, s = 1, { y = 0, sy = 0.6, sz = 1 } = {}) {
  const r = 0.9 * s;
  b.add(dome(r * 0.95, '#3f6e26', { x, y, z, sy, sz }, 8, 3));
  const greens = ['#5a9433', '#4f8a2c', '#6aa43c', '#7ab04a', '#8a9a4a'];
  for (let i = 0; i < 90; i++) {
    fodderSeed = (fodderSeed * 16807) % 2147483647;
    const u = (fodderSeed % 1000) / 1000, v = ((fodderSeed >> 10) % 1000) / 1000, w = ((fodderSeed >> 20) % 1000) / 1000;
    const a = u * Math.PI * 2, e = Math.acos(1 - v * 0.95);
    const px = Math.sin(e) * Math.cos(a) * r, py = Math.cos(e) * r * sy, pz = Math.sin(e) * Math.sin(a) * r * sz;
    b.add(box(0.025, 0.012, 0.35 + w * 0.3, greens[i % greens.length], { x: x + px, y: y + py, z: z + pz, ry: a + w * 2, rx: (w - 0.5) * 1.2, rz: (u - 0.5) * 0.8 }));
  }
}

export function coneRoof(b, r, h, color, y) {
  b.add(cone(r, h, color, 10, { y: y + h / 2 }));
}
