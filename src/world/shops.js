import { Builder, box, tbox, cyl, sph, dome, torus } from '../models/build.js';
import { SHOPS, ROAD } from '../data/layout.js';
import { SIGNS } from '../data/strings.js';
import { signBoard } from '../ui/signs.js';
import * as P from '../models/props.js';
import { makeRng } from '../util/rng.js';

// The adda: the cluster of shops and the bus stop where the village lane meets the paved road.

export function buildShops(scene) {
  const b = new Builder();
  const rng = makeRng(9);
  const Z = SHOPS.z, front = Z + 3;
  const out = { lights: [] };
  const board = (text, x, y, z, opts) => {
    const m = signBoard(text, opts);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  };

  // ---- Haji's general store ----
  {
    const x = SHOPS.kiryana, w = 8;
    b.push(x, 0, Z);
    b.add(tbox(w, 3.4, 0.3, 3, { y: 1.7, z: -2.85 }, '#d9d0b8'), 'plaster');
    for (const s of [-1, 1]) b.add(tbox(0.3, 3.4, 6, 3, { x: s * (w / 2 - 0.15), y: 1.7 }, '#d9d0b8'), 'plaster');
    b.add(box(w + 0.3, 0.2, 6.3, '#b9b4a8', { y: 3.5 }));
    b.add(box(w, 0.9, 0.3, '#d9d0b8', { y: 2.95, z: 2.85 }));
    b.add(box(w - 0.6, 3.3, 0.1, '#2a2520', { y: 1.65, z: -2.6 }));
    // shelves of goods
    const goods = ['#d81e2c', '#f7c81e', '#1f9d55', '#1f6fd0', '#f08a1c', '#ffffff', '#e8459a', '#7a4a22'];
    for (let r = 0; r < 4; r++) {
      b.add(box(w - 0.8, 0.05, 0.4, '#6b4a2e', { y: 0.9 + r * 0.55, z: -2.4 }));
      for (let i = 0; i < 16; i++) {
        b.add(box(0.28, 0.24 + rng() * 0.16, 0.22, rng.pick(goods), { x: -w / 2 + 0.7 + i * 0.43, y: 1.08 + r * 0.55, z: -2.4 }));
      }
    }
    // counter with jars of sweets
    b.add(box(w - 2.6, 0.95, 0.6, '#6b4a2e', { x: -0.9, y: 0.475, z: 2.3 }));
    for (let i = 0; i < 5; i++) b.add(cyl(0.11, 0.11, 0.26, ['#e8459a', '#f7c81e', '#f08a1c'][i % 3], 7, { x: -2.9 + i * 0.5, y: 1.08, z: 2.3 }));
    // strings of snack packets hanging in the doorway
    for (let i = 0; i < 6; i++) for (let k = 0; k < 4; k++) b.add(box(0.16, 0.2, 0.03, goods[(i + k) % goods.length], { x: -3.2 + i * 0.45, y: 2.35 - k * 0.23, z: 2.7 }));
    // tin awning on poles
    b.add(box(w, 0.05, 2.6, '#9aa3a6', { y: 2.38, z: 4.2, rx: 0.1 }));
    for (const s of [-1, 1]) { b.add(cyl(0.04, 0.04, 2.26, '#6c6a64', 5, { x: s * (w / 2 - 0.2), y: 1.13, z: 5.3 })); P.solidCircle(b, 0.12, s * (w / 2 - 0.2), 5.3); }
    P.solidBox(b, w / 2, 0.3, 0, -2.85);
    for (const s of [-1, 1]) P.solidBox(b, 0.15, 3, s * (w / 2 - 0.15), 0);
    P.solidBox(b, (w - 2.6) / 2, 0.3, -0.9, 2.3);
    P.sacks(b, 3.1, 3.6, 0.2);
    P.sacks(b, 2.2, 3.9, -0.3);
    P.crates(b, -3.2, 3.7, 0.1);
    P.waterCooler(b, 3.2, 5.0);
    b.pop();
    board(SIGNS.kiryana, x, 2.95, front + 0.02, { w: 6.4, h: 0.82, bg: '#0f4f8a', fg: '#fff7d6', border: '#f2c230' });
    board(SIGNS.credit, x - 0.9, 0.52, Z + 2.62, { w: 3.2, h: 0.56, bg: '#fff7d6', fg: '#b0101c', border: '#b0101c' });
    out.haji = { x: x - 0.9, z: Z + 1.5, yaw: 0 };
    out.lights.push({ x, y: 2.6, z: Z + 2, color: 0xfff0d0 });
  }

  // ---- fruit cart ----
  {
    b.push(SHOPS.tandoor, 0, Z + 5.4, 0.15);
    b.add(box(2.0, 0.08, 1.2, '#7a5230', { y: 0.82 }));
    for (const sx of [-0.8, 0.8]) for (const sz of [-1, 1]) b.add(torus(0.3, 0.02, '#1d1d1d', Math.PI * 2, { x: sx, y: 0.32, z: sz * 0.62, ry: 0 }, 4, 12));
    for (const sx of [-0.8, 0.8]) b.add(box(0.04, 0.5, 1.2, '#4e3520', { x: sx, y: 0.57 }));
    b.add(dome(0.42, '#f08a1c', { x: -0.55, y: 0.86, sy: 0.6 }, 8, 3));
    b.add(dome(0.4, '#f2d21e', { x: 0.2, y: 0.86, z: 0.1, sy: 0.5 }, 8, 3));
    b.add(dome(0.34, '#8fbf3a', { x: 0.75, y: 0.86, z: -0.15, sy: 0.6 }, 8, 3));
    b.add(dome(0.3, '#c81e1e', { x: 0.2, y: 0.86, z: -0.38, sy: 0.55 }, 8, 3));
    for (const sx of [-0.95, 0.95]) b.add(cyl(0.02, 0.02, 1.3, '#4e3520', 4, { x: sx, y: 1.5, z: -0.55 }));
    b.add(box(2.1, 0.03, 1.4, '#e9e4d6', { y: 2.15, rx: 0.1 }));
    P.solidBox(b, 1.0, 0.65);
    b.pop();
  }

  // ---- Bismillah tea hotel ----
  {
    const x = SHOPS.chai, w = 11;
    b.push(x, 0, Z);
    b.add(tbox(w, 3.0, 0.3, 1, { y: 1.5, z: -2.85 }), 'brick');
    for (const s of [-1, 1]) b.add(tbox(0.3, 3.0, 5.4, 1, { x: s * (w / 2 - 0.15), y: 1.5, z: -0.3 }), 'brick');
    b.add(box(w + 0.6, 0.06, 8.6, '#9aa3a6', { y: 3.1, z: 1.2, rx: 0.05 }));
    for (const px of [-w / 2 + 0.2, 0, w / 2 - 0.2]) { b.add(cyl(0.06, 0.06, 2.9, '#5a3f28', 6, { x: px, y: 1.45, z: 5.2 })); P.solidCircle(b, 0.14, px, 5.2); }
    P.solidBox(b, w / 2, 0.15, 0, -2.85);
    for (const s of [-1, 1]) P.solidBox(b, 0.15, 2.7, s * (w / 2 - 0.15), -0.3);
    // the stove counter: kettle, milk pan, a row of cups
    b.add(tbox(3.4, 0.9, 0.9, 2, { x: -3.2, y: 0.45, z: 2.2 }), 'mud');
    P.solidBox(b, 1.7, 0.45, -3.2, 2.2);
    b.add(box(0.5, 0.06, 0.5, '#e0701c', { x: -4.1, y: 0.92, z: 2.2 }), 'glow');
    b.add(cyl(0.2, 0.24, 0.34, '#3a3a3a', 9, { x: -4.1, y: 1.12, z: 2.2 }));
    b.add(cyl(0.035, 0.05, 0.3, '#3a3a3a', 5, { x: -3.82, y: 1.2, z: 2.2, rz: -0.9 }));
    b.add(cyl(0.3, 0.26, 0.2, '#b9bdc0', 10, { x: -3.2, y: 1.02, z: 2.2 }));
    b.add(cyl(0.28, 0.28, 0.02, '#e9dcc0', 10, { x: -3.2, y: 1.11, z: 2.2 }));
    for (let i = 0; i < 6; i++) b.add(cyl(0.04, 0.032, 0.07, '#f4f1ea', 6, { x: -2.6 + i * 0.13, y: 0.94, z: 2.35 }));
    // glass jar of rusks and a tray of eggs
    b.add(cyl(0.13, 0.13, 0.3, '#d9b98a', 8, { x: -2.2, y: 1.06, z: 2.0 }));
    // seating inside and out
    P.table(b, 1.6, 0.4);
    P.bench(b, 1.6, -0.4, 0);
    P.bench(b, 1.6, 1.2, 0);
    P.table(b, 3.9, 2.8);
    P.bench(b, 3.9, 2.0, 0);
    P.bench(b, 3.9, 3.6, 0);
    out.chaiCharpai = P.charpai(b, -0.6, 4.2, 1.45);
    P.charpai(b, 2.2, 6.4, 1.7);
    b.pop();
    board(SIGNS.chai, x, 3.62, front + 2.3, { w: 6.6, h: 1.25, bg: '#8a1a20', fg: '#fff7d6', sub: SIGNS.chaiSub, subFg: '#f7c81e', border: '#f2c230' });
    for (const px of [-3.4, 3.4]) b.add(cyl(0.03, 0.03, 1.0, '#4a4a4a', 4, { x: x + px, y: 3.45, z: front + 2.28 }));
    out.billu = { x: x - 3.3, z: Z + 1.2, yaw: 0 };
    out.chaiSpot = { x: x - 3.2, z: Z + 3.3 };
    out.lights.push({ x, y: 2.6, z: Z + 2.5, color: 0xffe2b0 });
  }

  // ---- puncture shop: a painted wooden cabin ----
  {
    const x = SHOPS.puncture;
    b.push(x, 0, Z + 1);
    b.add(box(3.6, 2.5, 3.0, '#2f6f8a', { y: 1.25, z: -0.6 }));
    b.add(box(3.9, 0.08, 4.6, '#9aa3a6', { y: 2.6, z: 0.1, rx: 0.07 }));
    b.add(box(2.6, 1.9, 0.08, '#1a2a30', { y: 1.0, z: 0.92 }));
    P.solidBox(b, 1.8, 1.5, 0, -0.6);
    b.add(torus(0.3, 0.07, '#1b1b1b', Math.PI * 2, { x: -1.3, y: 1.7, z: 0.98 }, 5, 12));
    b.add(torus(0.24, 0.05, '#1b1b1b', Math.PI * 2, { x: 1.35, y: 1.5, z: 0.98 }, 5, 12));
    P.tyreStack(b, -1.5, 2.0, 4);
    P.tyreStack(b, -0.7, 2.3, 2);
    // air compressor
    b.add(cyl(0.22, 0.22, 0.9, '#c81e1e', 9, { x: 1.4, y: 0.42, z: 1.9, rz: Math.PI / 2 }));
    b.add(box(0.3, 0.3, 0.3, '#3a3a3a', { x: 1.4, y: 0.8, z: 1.9 }));
    P.solidCircle(b, 0.5, 1.4, 1.9);
    b.add(box(0.5, 0.25, 0.4, '#8a8a8a', { x: 0.2, y: 0.125, z: 2.2 }));
    b.pop();
    board(SIGNS.puncture, x, 2.95, Z + 2.0, { w: 3.2, h: 0.7, bg: '#f7c81e', fg: '#1a1a1a', border: '#d81e2c' });
    out.ustad = { x: x + 0.3, z: Z + 3.2, yaw: 0.2 };
  }

  // ---- bus stop ----
  {
    const x = SHOPS.busStop;
    b.push(x, 0, Z + 5.2);
    for (const sx of [-1.6, 1.6]) for (const sz of [-0.8, 0.8]) b.add(cyl(0.05, 0.05, 2.5, '#6c6a64', 5, { x: sx, y: 1.25, z: sz }));
    b.add(box(3.8, 0.06, 2.2, '#2f7a4f', { y: 2.53, rx: 0.06 }));
    b.add(box(3.2, 0.9, 0.06, '#e9e4d6', { y: 1.0, z: -0.82 }));
    P.bench(b, 0, -0.4, 0, 2.6);
    P.solidBox(b, 1.7, 0.1, 0, -0.82);
    b.pop();
    board(SIGNS.busStop, x, 2.25, Z + 6.05, { w: 2.8, h: 0.5, bg: '#14532d', fg: '#ffffff', border: '#ffffff' });
    out.musafir = { x: x + 2.6, z: Z + 6.3, yaw: 0.3 };
  }

  // ---- roadside ----
  P.milestone(b, 22, ROAD.z - 4.6, 0);
  board(SIGNS.milestone[0], 22, 0.42, ROAD.z - 4.49, { w: 0.46, h: 0.2, bg: '#f0ede4', fg: '#1a1a1a', border: null, ppm: 500 });
  board(SIGNS.milestone[1], 22, 0.2, ROAD.z - 4.49, { w: 0.3, h: 0.2, bg: '#f0ede4', fg: '#1a1a1a', border: null, ppm: 500 });
  P.motorcycle(b, 79.5, Z + 6.6, 0.5);
  P.motorcycle(b, 103.5, Z + 7.4, -0.4);
  P.bicycle(b, 33.6, Z + 4.4, 0.3);
  P.donkeyCart(b, 110.5, Z + 4.5, Math.PI / 2 + 0.1);
  out.donkey = { x: 113.4, z: Z + 4.3, yaw: Math.PI / 2 + 0.1 };
  out.bike = { x: 33.6, z: Z + 4.4 };

  // poles along the paved road
  out.poles = [];
  for (let x = -240; x <= 240; x += 40) {
    if (Math.abs(x + 60) < 30) continue;
    P.pole(b, x, ROAD.z + 5.9, Math.PI / 2);
    out.poles.push([x, ROAD.z + 5.9]);
  }

  scene.add(b.build());
  return out;
}
