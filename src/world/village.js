import * as THREE from 'three';
import { Builder, box, tbox, cyl, sph, dome, cone } from '../models/build.js';
import { COMPOUNDS, MOSQUE, CHOWK, POND, KILN } from '../data/layout.js';
import { SIGNS } from '../data/strings.js';
import { signBoard } from '../ui/signs.js';
import { addTree, banyan } from './trees.js';
import * as P from '../models/props.js';
import { crow } from '../models/animals.js';
import { makeRng } from '../util/rng.js';

// The village: walled family compounds of mud and brick, the mosque, the square under the
// banyan, and the bits and pieces of daily life around them.

const FACE = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
const PASTEL = ['#cfe0d0', '#d6e2ee', '#f0e2c0', '#e8d6d0'];
const GATE = ['#2f6fb0', '#2f7a4f', '#7a2f2f', '#3a3a3a'];

function compound(b, c, rng, out) {
  const ry = FACE[c.face];
  b.push(c.x, 0, c.z, ry);
  const mud = c.wall === 'mud';
  const tex = mud ? 'mud' : 'brick', tile = mud ? 2.5 : 1;
  const hw = c.w / 2, hd = c.d / 2, T = 0.4, WH = mud ? 1.9 : 2.1;
  const cap = mud ? '#c2a06a' : '#b9a48a';

  const wall = (cx, cz, lx, lz, h = WH) => {
    b.add(tbox(lx, h, lz, tile, { x: cx, y: h / 2, z: cz }), tex);
    b.add(box(lx + 0.08, 0.1, lz + 0.08, cap, { x: cx, y: h + 0.05, z: cz }));
    P.solidBox(b, lx / 2, lz / 2, cx, cz);
  };

  // boundary wall with a gate in the front
  const gx = (rng.chance(0.5) ? 1 : -1) * c.w * 0.24, GW = 2.9;
  wall(0, -hd + T / 2, c.w, T);
  wall(-hw + T / 2, 0, T, c.d - T * 2);
  wall(hw - T / 2, 0, T, c.d - T * 2);
  const l0 = -hw, l1 = gx - GW / 2, r0 = gx + GW / 2, r1 = hw;
  wall((l0 + l1) / 2, hd - T / 2, l1 - l0, T);
  wall((r0 + r1) / 2, hd - T / 2, r1 - r0, T);
  for (const s of [-1, 1]) b.add(tbox(0.6, WH + 0.5, 0.6, tile, { x: gx + s * (GW / 2 + 0.05), y: (WH + 0.5) / 2, z: hd - T / 2 }), tex);
  // door leaves standing open into the yard
  const leaf = mud ? ['#ffffff', 'wood'] : [rng.pick(GATE), 'flat'];
  for (const [s, phi] of [[-1, 1.42], [1, 1.2]]) {
    const hx = gx + s * (GW / 2 - 0.28);
    b.add(tbox(1.2, 1.95, 0.07, 1.2, { x: hx - s * Math.cos(phi) * 0.6, y: 1.0, z: hd - T / 2 - Math.sin(phi) * 0.6, ry: s < 0 ? phi : Math.PI - phi }, leaf[0]), leaf[1]);
  }

  // main rooms along the back wall
  const side = gx > 0 ? -1 : 1; // rooms go on the far side from the gate
  const rw = c.w * 0.58, rd = 5.2, rh = 3.3;
  const rx = side * (hw - T - rw / 2 - 0.05), rz = -hd + T + rd / 2;
  const wallCol = mud ? '#ffffff' : rng.pick(PASTEL);
  b.add(tbox(rw, rh, rd, mud ? 2.5 : 3, { x: rx, y: rh / 2, z: rz }, wallCol), mud ? 'mud' : 'plaster');
  b.add(box(rw + 0.5, 0.22, rd + 0.5, mud ? '#a88a5a' : '#b9b4a8', { x: rx, y: rh + 0.11, z: rz }));
  P.solidBox(b, rw / 2, rd / 2, rx, rz);
  const fz = rz + rd / 2;
  if (mud) {
    for (let i = 0; i < Math.floor(rw / 0.7); i++) b.add(box(0.12, 0.12, 0.5, '#4e3520', { x: rx - rw / 2 + 0.4 + i * 0.7, y: rh - 0.18, z: fz + 0.1 }));
  } else {
    for (const [px, pz, lx, lz] of [[0, rd / 2 + 0.2, rw + 0.5, 0.12], [0, -rd / 2 - 0.2, rw + 0.5, 0.12], [rw / 2 + 0.2, 0, 0.12, rd + 0.5], [-rw / 2 - 0.2, 0, 0.12, rd + 0.5]]) {
      b.add(box(lx, 0.4, lz, wallCol, { x: rx + px, y: rh + 0.42, z: rz + pz }));
    }
    // rooftop water tank, and solar panels on some houses
    b.add(cyl(0.55, 0.55, 1.0, '#2f6fc4', 10, { x: rx + side * (rw / 2 - 1), y: rh + 0.75, z: rz - 1 }));
    if (rng.chance(0.6)) {
      b.add(box(2.0, 0.05, 1.2, '#1c2f52', { x: rx - side * (rw / 2 - 1.6), y: rh + 0.75, z: rz, rx: 0.45 }));
      b.add(box(0.06, 0.6, 0.06, '#8a8a8a', { x: rx - side * (rw / 2 - 1.6), y: rh + 0.5, z: rz - 0.4 }));
    }
  }
  b.add(box(0.2, 0.1, 0.5, '#8a8a8a', { x: rx + side * (rw / 2 - 0.5), y: rh - 0.05, z: fz + 0.3 }));
  // doors and a shuttered window
  const doorCol = mud ? '#5a3f28' : '#3f6a5a';
  for (const dx of [-rw * 0.27, rw * 0.27]) {
    b.add(box(1.0, 2.0, 0.08, doorCol, { x: rx + dx, y: 1.0, z: fz + 0.03 }));
    b.add(box(1.16, 0.1, 0.1, '#3a2a1c', { x: rx + dx, y: 2.06, z: fz + 0.04 }));
  }
  b.add(box(0.9, 0.8, 0.08, '#3d5a4c', { x: rx, y: 1.7, z: fz + 0.03 }));
  b.add(box(0.04, 0.8, 0.1, '#2a2a2a', { x: rx, y: 1.7, z: fz + 0.04 }));
  // veranda
  const vd = 2.6;
  b.add(box(rw + 0.3, 0.14, vd, mud ? '#a88a5a' : '#b9b4a8', { x: rx, y: 2.75, z: fz + vd / 2 }));
  const posts = Math.max(3, Math.round(rw / 3.5));
  for (let i = 0; i < posts; i++) {
    const px = rx - rw / 2 + 0.2 + (i * (rw - 0.4)) / (posts - 1);
    if (mud) b.add(cyl(0.07, 0.08, 2.7, '#5a3f28', 6, { x: px, y: 1.35, z: fz + vd - 0.2 }));
    else b.add(tbox(0.34, 2.7, 0.34, 1, { x: px, y: 1.35, z: fz + vd - 0.2 }), 'brick');
    P.solidCircle(b, 0.2, px, fz + vd - 0.2);
  }

  // kitchen / store room in the other back corner
  const kw = Math.min(4, c.w - rw - T * 2 - 1.2), kx = -side * (hw - T - kw / 2 - 0.05), kz = -hd + T + 1.9;
  if (kw > 2.4) {
    b.add(tbox(kw, 2.5, 3.8, 2.5, { x: kx, y: 1.25, z: kz }), 'mud');
    b.add(box(kw + 0.4, 0.2, 4.2, '#a88a5a', { x: kx, y: 2.6, z: kz }));
    b.add(box(0.85, 1.8, 0.08, '#4e3520', { x: kx, y: 0.9, z: kz + 1.93 }));
    P.solidBox(b, kw / 2, 1.9, kx, kz);
    P.chulha(b, kx + side * 0.3, kz + 3.3, 0);
    for (let i = 0; i < 3; i++) b.add(cyl(0.16 - i * 0.02, 0.14 - i * 0.02, 0.2, '#b9bdc0', 8, { x: kx - side * 0.9, y: 0.1 + i * 0.2, z: kz + 2.6 }));
  }

  // manger and tethered animals along the side wall away from the rooms
  const ks = -side;
  const n = c.animals.length;
  if (n) {
    const kxw = ks * (hw - T - 0.5), kzc = hd - 3.2 - n * 0.9;
    P.khurli(b, kxw, kzc, Math.PI / 2, n * 1.7 + 0.6);
    c.animals.forEach((kind, i) => {
      const big = kind === 'buffalo' || kind === 'cow';
      const az = kzc - ((n - 1) * 1.7) / 2 + i * 1.7;
      const ax = kxw - ks * (big ? 1.75 : 1.05);
      const [wx, wz] = b.point(ax, az);
      out.animals.push({ kind, x: wx, z: wz, yaw: (ks * Math.PI) / 2 + ry, variant: Math.floor(rng() * 4) });
      P.peg(b, kxw - ks * 0.55, az + 0.6);
    });
  }

  // yard life
  const cz0 = fz + vd + 1.6;
  out.charpais.push(P.charpai(b, rx + rng.range(-1.5, 1.5), cz0 + rng.range(0, 1), Math.PI / 2 + rng.range(-0.2, 0.2)));
  if (rng.chance(0.5)) out.charpais.push(P.charpai(b, rx + side * rng.range(0, 2), cz0 + 2.4, rng.range(-0.3, 0.3)));
  P.gharaStand(b, rx - side * (rw / 2 - 1.2), fz + 0.7, 0);
  if (rng.chance(0.65)) {
    const [tx, tz] = b.point(-side * hw * 0.15, hd * 0.35);
    addTree(rng.pick(['sheesham', 'sheesham', 'kikar']), tx, tz, rng.range(0.8, 0.95));
  }
  if (c.home || rng.chance(0.3)) out.pumps.push(P.handPump(b, gx - Math.sign(gx) * 3.2, hd - 2.4, Math.PI));
  if (mud && rng.chance(0.7)) P.dungStore(b, -ks * (hw - 2.0), hd - 2.0, 0.8);
  // washing line
  if (rng.chance(0.6)) {
    const lz = cz0 + 4.6, lx = rx;
    for (const s of [-1, 1]) b.add(cyl(0.03, 0.03, 1.9, '#4e3520', 4, { x: lx + s * 2, y: 0.95, z: lz }));
    b.add(box(4, 0.012, 0.012, '#2a2a2a', { x: lx, y: 1.85, z: lz }));
    ['#c9463d', '#e9e4d6', '#2f8a7a', '#e2b84a', '#5a4a8a'].forEach((col, i) => {
      b.add(box(0.5, 0.6 + (i % 2) * 0.25, 0.02, col, { x: lx - 1.5 + i * 0.75, y: 1.52 - (i % 2) * 0.12, z: lz }));
    });
  }

  // outside: dung cakes drying on mud walls, and a spot for wall chalking
  const longLeft = l1 - l0 > r1 - r0;
  const mid = longLeft ? (l0 + l1) / 2 : (r0 + r1) / 2;
  if (mud && !c.home && rng.chance(0.7)) P.dungCakes(b, mid, 0.45, hd + 0.03, 0, 9, 4);
  else {
    const [sx, sz] = b.point(mid, hd + 0.03);
    out.signSpots[c.id] = { x: sx, z: sz, ry };
  }

  if (c.home) {
    const [ax, az] = b.point(kx + side * 1.4, kz + 3.9);
    out.ammi = { x: ax, z: az, yaw: ry };
  }
  // hens scratching in the yard
  const [hx, hz] = b.point(rx * 0.3, hd * 0.45);
  out.hens.push({ x: hx, z: hz, n: mud ? 3 : 2 });
  const [cx2, cz2] = b.point(rx, rz);
  if (rng.chance(0.5)) out.crows.push({ x: cx2 + rng.range(-2, 2), y: rh + 0.25, z: cz2 + rng.range(-1.5, 1.5) });
  b.pop();
}

function mosque(b, scene, out) {
  const m = MOSQUE;
  const ry = FACE.e;
  b.push(m.x, 0, m.z, ry);
  const w = m.d, d = m.w, hw = w / 2, hd = d / 2, T = 0.35, WH = 1.7;
  const CREAM = '#efe7d2', GREEN = '#0f6b3f';
  const wall = (cx, cz, lx, lz) => {
    b.add(tbox(lx, WH, lz, 3, { x: cx, y: WH / 2, z: cz }, CREAM), 'plaster');
    b.add(box(lx + 0.06, 0.16, lz + 0.06, GREEN, { x: cx, y: WH + 0.08, z: cz }));
    P.solidBox(b, lx / 2, lz / 2, cx, cz);
  };
  wall(0, -hd + T / 2, w, T);
  wall(-hw + T / 2, 0, T, d - T * 2);
  wall(hw - T / 2, 0, T, d - T * 2);
  const GW = 3.2;
  wall(-(hw + GW / 2) / 2, hd - T / 2, hw - GW / 2, T);
  wall((hw + GW / 2) / 2, hd - T / 2, hw - GW / 2, T);
  // gateway
  for (const s of [-1, 1]) {
    b.add(tbox(0.7, 3.4, 0.7, 3, { x: s * (GW / 2 + 0.1), y: 1.7, z: hd - T / 2 }, CREAM), 'plaster');
    b.add(dome(0.42, GREEN, { x: s * (GW / 2 + 0.1), y: 3.4, z: hd - T / 2 }, 8, 4));
  }
  b.add(box(GW + 0.9, 0.8, 0.5, CREAM, { y: 3.0, z: hd - T / 2 }));
  b.add(box(GW + 1.0, 0.12, 0.6, GREEN, { y: 3.45, z: hd - T / 2 }));
  // paved courtyard with rows of prayer mats
  b.add(box(w - 1, 0.06, d - 1, '#cfc8b8', { y: 0.03 }));
  for (let i = 0; i < 4; i++) b.add(box(w - 6, 0.02, 1.1, i % 2 ? '#c9b074' : '#b8a060', { y: 0.075, z: -1.5 + i * 2.4 }));

  // prayer hall along the qibla (west) wall
  const hwid = w - 4, hdep = 7.5, hh = 4.4, hz = -hd + T + hdep / 2 + 0.2, front = hz + hdep / 2;
  b.add(tbox(hwid, hh, hdep, 3, { y: hh / 2, z: hz }, CREAM), 'plaster');
  P.solidBox(b, hwid / 2, hdep / 2, 0, hz);
  b.add(box(hwid + 0.3, 0.35, hdep + 0.3, GREEN, { y: hh + 0.17, z: hz }));
  for (let i = 0; i < Math.floor(hwid / 1.2); i++) b.add(box(0.5, 0.35, 0.2, CREAM, { x: -hwid / 2 + 0.6 + i * 1.2, y: hh + 0.5, z: front }));
  for (const ax of [-6, 0, 6]) {
    b.add(box(2.4, 2.4, 0.12, '#243a30', { x: ax, y: 1.2, z: front + 0.02 }));
    b.add(cyl(1.2, 1.2, 0.12, '#243a30', 12, { x: ax, y: 2.4, z: front + 0.02, rx: Math.PI / 2 }));
    b.add(box(2.9, 0.14, 0.2, GREEN, { x: ax, y: 3.75, z: front + 0.05 }));
  }
  b.add(cyl(1.1, 1.1, 2.6, CREAM, 8, { y: 1.3, z: hz - hdep / 2, sz: 0.5 }));
  // domes
  for (const [dx, r] of [[0, 2.9], [-7, 1.6], [7, 1.6]]) {
    b.add(cyl(r * 0.95, r, 0.7, CREAM, 14, { x: dx, y: hh + 0.6, z: hz }));
    b.add(dome(r, GREEN, { x: dx, y: hh + 0.95, z: hz, sy: 1.15 }, 14, 6));
    b.add(sph(0.16, '#d9b23a', { x: dx, y: hh + 1.05 + r * 1.15, z: hz }));
    b.add(cone(0.07, 0.6, '#d9b23a', 5, { x: dx, y: hh + 1.45 + r * 1.15, z: hz }));
  }
  // minarets with loudspeakers
  for (const s of [-1, 1]) {
    const mx = s * (hwid / 2 - 0.2), mz = front + 0.3;
    b.add(cyl(0.6, 0.75, 8.4, CREAM, 8, { x: mx, y: 4.2, z: mz }));
    for (const y of [2.8, 5.6]) b.add(cyl(0.72, 0.72, 0.22, GREEN, 8, { x: mx, y, z: mz }));
    b.add(cyl(1.05, 0.7, 0.3, CREAM, 8, { x: mx, y: 8.5, z: mz }));
    b.add(cyl(0.45, 0.5, 1.5, CREAM, 8, { x: mx, y: 9.4, z: mz }));
    b.add(dome(0.6, GREEN, { x: mx, y: 10.15, z: mz, sy: 1.3 }, 8, 4));
    b.add(cone(0.05, 0.6, '#d9b23a', 5, { x: mx, y: 11.2, z: mz }));
    b.add(box(0.5, 0.08, 0.08, '#62d98a', { x: mx, y: 8.2, z: mz + 0.72 }), 'glow');
    if (s > 0) for (const a of [0.6, 2.2, 3.8, 5.4]) {
      b.add(cone(0.28, 0.5, '#9a9a94', 8, { x: mx + Math.sin(a) * 0.95, y: 8.95, z: mz + Math.cos(a) * 0.95, rx: -Math.PI / 2 * Math.cos(a), rz: Math.PI / 2 * Math.sin(a) }));
    }
    P.solidCircle(b, 0.8, mx, mz);
  }
  // ablution taps along the side wall
  b.add(box(0.5, 0.3, 8, '#bdb6a6', { x: hw - 1.2, y: 0.15, z: 4 }));
  for (let i = 0; i < 6; i++) b.add(box(0.06, 0.4, 0.06, '#8a8a8a', { x: hw - 0.7, y: 0.6, z: 0.8 + i * 1.3 }));
  P.solidBox(b, 0.4, 4, hw - 1.1, 4);

  const [sx, sz] = b.point(0, hd - T / 2 + 0.27);
  const [ix, iz] = b.point(2.6, hd + 1.4);
  const [lx, lz] = b.point(0, 4);
  b.pop();

  const sign = signBoard(SIGNS.mosque, { w: 3.6, h: 0.7, bg: '#0f6b3f', fg: '#ffffff', border: '#d9b23a' });
  sign.position.set(sx, 3.0, sz);
  sign.rotation.y = ry;
  scene.add(sign);
  out.imam = { x: ix, z: iz, yaw: ry };
  out.lights.push({ x: lx, y: 3.5, z: lz, color: 0xd8ffe0 });
}

export function buildVillage(scene) {
  const rng = makeRng(47);
  const b = new Builder();
  const out = { animals: [], charpais: [], pumps: [], signSpots: {}, hens: [], crows: [], lights: [], poles: [] };

  for (const c of COMPOUNDS) compound(b, c, rng, out);
  mosque(b, scene, out);

  // ---- the square ----
  banyan(scene, CHOWK.x, CHOWK.z);
  P.platform(b, CHOWK.x, CHOWK.z, 3.3, 0.5);
  out.bashirCharpai = P.charpai(b, 60.5, 9.5, 0.3);
  P.hookah(b, 61.6, 10.6);
  P.charpai(b, 63, 12.6, 1.5);
  out.chowkPump = P.handPump(b, 53.5, 6, Math.PI / 2);
  P.ghara(b, 54.3, 0.12, 6.5);
  // Masi Sughran's tandoor in the corner of the square, under a thatch shade
  P.tandoor(b, 84, -5.5);
  for (const [px, pz] of [[82.2, -7.4], [86.2, -7.4], [82.2, -3.6], [86.2, -3.6]]) b.add(cyl(0.05, 0.06, 2.3, '#5a3f28', 5, { x: px, y: 1.15, z: pz }));
  b.add(tbox(4.8, 0.14, 4.6, 1.5, { x: 84.2, y: 2.36, z: -5.5 }), 'straw');
  b.add(box(1.2, 0.5, 0.7, '#8a6a4a', { x: 85.8, y: 0.25, z: -5.3 }));
  for (let i = 0; i < 5; i++) b.add(cyl(0.16, 0.16, 0.015, '#d9b98a', 8, { x: 85.8, y: 0.51 + i * 0.016, z: -5.3 }));
  out.sughran = { x: 84.1, z: -4.2, yaw: 0 };
  out.lights.push({ x: 62, y: 3.2, z: 9, color: 0xffd9a0 });

  // cricket in the back lane: three bricks for a wicket
  for (let i = 0; i < 3; i++) b.add(box(0.11, 0.23, 0.08, '#9c5a3c', { x: 34.6, y: 0.115, z: -20.25 + i * 0.25 }));
  b.add(sph(0.045, '#c8e03a', { x: 38.5, y: 0.05, z: -19.2 }));

  // odds and ends at the edges of the village
  P.strawStack(b, -12, -8, 1.0);
  P.strawStack(b, 131, -34, 1.15);
  P.strawStack(b, 96, 60, 0.9);
  P.dungStore(b, -11, 44, 1);
  P.dungStore(b, 112, 62, 1.1);
  P.dungStore(b, 114.5, 64.5, 0.8);
  P.donkeyCart(b, 128, 58, 0.4);
  P.bicycle(b, 49.6, 22.9, 1.45);

  // electricity poles along the main street and the lane to the road
  const street = [];
  for (const x of [-22, 6, 34, 64.5, 92, 118, 148]) { P.pole(b, x, 23.0, 0); street.push([x, 23.0]); }
  const lane = [];
  for (const z of [50, 78, 106, 134, 160]) { P.pole(b, 63.6, z, Math.PI / 2); lane.push([63.6, z]); }
  out.poles.push({ pts: street, along: 'x' }, { pts: lane, along: 'z' });
  for (const [px, pz] of [[34, 23], [92, 23], [63.6, 78]]) crow(b, px + 0.4, 7.14, pz, 1);

  for (const c of out.crows) crow(b, c.x, c.y, c.z, rng() * 6);

  // brick kiln on the horizon
  b.push(KILN.x, 0, KILN.z);
  b.add(cyl(1.0, 2.2, 24, '#ffffff', 10, { y: 12 }), 'brick');
  b.add(cyl(1.15, 1.15, 0.5, '#5a3a2a', 10, { y: 24 }));
  b.add(tbox(34, 2.4, 14, 1, { y: 1.2, z: 9 }), 'brick');
  b.add(box(35, 0.5, 15, '#a88a6a', { y: 2.5, z: 9 }));
  for (let i = 0; i < 6; i++) b.add(tbox(3, 1.2 + (i % 3) * 0.4, 1.6, 1, { x: -16 + i * 5.5, y: 0.6 + (i % 3) * 0.2, z: 22 + (i % 2) * 3 }), 'brick');
  P.solidCircle(b, 2.4);
  P.solidBox(b, 17, 7, 0, 9);
  b.pop();

  scene.add(b.build());

  // ---- wall chalking and painted notices ----
  const chalk = (id, text, opts) => {
    const s = out.signSpots[id];
    if (!s) return;
    const m = signBoard(text, opts);
    m.position.set(s.x, 1.05, s.z);
    m.rotation.y = s.ry;
    scene.add(m);
  };
  chalk('E', SIGNS.school, { w: 5.2, h: 1.3, bg: '#f4efe2', fg: '#1d4f8a', sub: SIGNS.schoolSub, subFg: '#b0101c', border: '#1d4f8a' });
  chalk('B', SIGNS.polio, { w: 5.4, h: 0.9, bg: null, fg: '#1a3f7a' });
  chalk('I', SIGNS.seed, { w: 4.2, h: 0.95, bg: '#f7c81e', fg: '#14532d', border: '#14532d' });
  chalk('L', SIGNS.polio, { w: 5.0, h: 0.85, bg: null, fg: '#7a1a1a' });
  chalk('O', SIGNS.seed, { w: 4.2, h: 0.95, bg: null, fg: '#14532d' });

  // overhead wires between the poles
  const wires = [];
  for (const run of out.poles) {
    for (let i = 0; i < run.pts.length - 1; i++) {
      const [ax, az] = run.pts[i], [bx, bz] = run.pts[i + 1];
      for (const off of [-0.8, 0, 0.8]) {
        const ox = run.along === 'x' ? 0 : off, oz = run.along === 'x' ? off : 0;
        for (let k = 0; k < 8; k++) {
          const t0 = k / 8, t1 = (k + 1) / 8;
          const sag = (t) => 7.2 - Math.sin(t * Math.PI) * 0.55;
          wires.push(ax + (bx - ax) * t0 + ox, sag(t0), az + (bz - az) * t0 + oz, ax + (bx - ax) * t1 + ox, sag(t1), az + (bz - az) * t1 + oz);
        }
      }
    }
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
  scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x1c1c1c })));

  out.pond = POND;
  return out;
}
