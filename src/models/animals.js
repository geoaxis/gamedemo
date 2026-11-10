import * as THREE from 'three';
import { Builder, box, cyl, sph, cone, torus, capsule, ico } from './build.js';
import { heightAt } from '../world/terrain.js';
import { resolve, blocked, addDynamic } from '../systems/collision.js';
import { angDiff } from '../util/rng.js';

// Farm animals of a Punjab village. Four-legged ones share one skeleton: body, neck-and-head,
// four leg pivots and a tail. They face +z.

const SPEC = {
  // Nili-Ravi buffalo: black, heavy, tightly curled horns, white on the forehead and tail tip.
  buffalo: { L: 2.2, H: 1.0, W: 0.92, legH: 0.6, legR: 0.1, col: '#1e1c1d', neck: [0.5, 0.12, 0.22], head: [0.56, 0.3, 0.3, 0.45], tail: [0.95, '#e9e4d8'], r: 0.85 },
  // Sahiwal cow: red-brown with a shoulder hump and a dewlap.
  cow: { L: 1.9, H: 0.85, W: 0.72, legH: 0.72, legR: 0.075, col: '#8a4b2a', neck: [0.5, 0.42, 0.17], head: [0.46, 0.24, 0.25, 0.5], tail: [0.95, '#2a1c14'], r: 0.75 },
  // Beetal goat: long hanging ears and a roman nose.
  goat: { L: 0.9, H: 0.46, W: 0.36, legH: 0.38, legR: 0.035, col: '#2a2320', neck: [0.22, 0.75, 0.085], head: [0.22, 0.12, 0.14, 0.6], tail: [0.14, null], r: 0.38 },
  sheep: { L: 0.95, H: 0.55, W: 0.5, legH: 0.36, legR: 0.04, col: '#e6dfcc', neck: [0.24, 0.7, 0.1], head: [0.24, 0.14, 0.15, 0.5], tail: [0.2, null], r: 0.4 },
  donkey: { L: 1.25, H: 0.58, W: 0.46, legH: 0.68, legR: 0.05, col: '#8d8478', neck: [0.5, 0.85, 0.12], head: [0.44, 0.17, 0.2, 0.75], tail: [0.6, '#3a342e'], r: 0.6 },
  dog: { L: 0.72, H: 0.28, W: 0.22, legH: 0.36, legR: 0.03, col: '#c49a62', neck: [0.2, 0.75, 0.07], head: [0.2, 0.12, 0.12, 0.2], tail: [0.34, null], r: 0.35 },
};

const COATS = {
  cow: ['#8a4b2a', '#6f3a22', '#e9e2d2', '#a05a34'],
  goat: ['#2a2320', '#7a5236', '#e9e2d2', '#4a3526'],
  dog: ['#c49a62', '#a8804e', '#d9c7a0'],
};

function only(b) {
  const g = b.build();
  const m = g.children[0];
  m.castShadow = true;
  return m;
}

export function makeAnimal(kind, variant = 0) {
  if (kind === 'chicken') return makeChicken(variant);
  const s = SPEC[kind];
  const col = COATS[kind] ? COATS[kind][variant % COATS[kind].length] : s.col;
  const dark = '#241c18';
  const group = new THREE.Group();
  const bodyY = s.legH + s.H / 2;

  // ---- body ----
  const b = new Builder();
  b.add(capsule(s.H / 2, s.L - s.H, col, { rx: Math.PI / 2, sx: s.W / s.H, y: bodyY }, 3, 8));
  if (kind === 'buffalo') {
    b.add(sph(0.52, col, { y: bodyY - 0.12, z: -0.1, sx: 0.95, sz: 1.5 }));
    for (const sd of [-1, 1]) b.add(box(0.1, 0.14, 0.2, col, { x: sd * 0.3, y: bodyY + 0.45, z: -0.75 }));
  }
  if (kind === 'cow') {
    b.add(sph(0.2, col, { y: bodyY + 0.42, z: 0.52, sz: 1.3 }));
    b.add(box(0.05, 0.3, 0.5, col, { y: bodyY - 0.25, z: 0.85, rx: -0.5 }));
    b.add(sph(0.16, '#d9b9a8', { y: s.legH + 0.02, z: -0.5 }));
  }
  if (kind === 'goat' && variant % 2 === 0) b.add(sph(0.17, '#e9e2d2', { x: 0.1, y: bodyY + 0.06, z: -0.1, sz: 1.5 }));
  if (kind === 'sheep') {
    b.add(ico(0.36, '#efe9d8', 1, { y: bodyY + 0.03, z: 0.12, sz: 1.3 }));
    b.add(ico(0.34, '#e2dbc6', 1, { y: bodyY + 0.02, z: -0.22, sz: 1.2 }));
  }
  if (kind === 'donkey') b.add(sph(0.2, '#d9d2c2', { y: s.legH + 0.12, sz: 2.2, sx: 0.9 }));
  group.add(only(b));

  // ---- neck and head ----
  const head = new THREE.Group();
  head.position.set(0, s.legH + s.H * 0.72, s.L / 2 - s.H * 0.28);
  const [nl, na, nr] = s.neck;
  const [hl, hw, hh, droop] = s.head;
  const hb = new Builder();
  const ny = Math.sin(na) * nl, nz = Math.cos(na) * nl;
  hb.add(cyl(nr, nr * 1.25, nl + 0.1, col, 7, { y: ny / 2, z: nz / 2, rx: Math.PI / 2 - na }));
  const faceCol = kind === 'sheep' ? '#3a2a22' : col;
  hb.push(0, ny, nz);
  const hx = Math.cos(droop), hy = -Math.sin(droop);
  hb.add(box(hw, hh, hl, faceCol, { y: (hy * hl) / 2, z: (hx * hl) / 2, rx: droop }));
  const mz = hx * hl, my = hy * hl;
  const muzzle = { buffalo: '#3a3436', cow: '#3a2a24', donkey: '#e3ddd0', goat: faceCol, sheep: faceCol, dog: '#2a2320' }[kind];
  hb.add(box(hw * 0.85, hh * 0.75, hl * 0.3, muzzle, { y: my * 0.95, z: mz * 0.95, rx: droop }));
  for (const sd of [-1, 1]) hb.add(box(0.02, 0.03, 0.03, '#0d0b0a', { x: sd * (hw / 2), y: my * 0.35 + hh * 0.2, z: mz * 0.4 }));
  if (kind === 'buffalo') {
    hb.add(box(0.12, 0.03, 0.14, '#e9e4d8', { y: hh / 2 + 0.01, z: 0.12, rx: droop }));
    for (const sd of [-1, 1]) {
      hb.add(torus(0.15, 0.05, '#3c3836', 4.3, { x: sd * 0.26, y: 0.1, z: -0.06, ry: sd * 0.5, rz: sd > 0 ? 0.4 : Math.PI - 0.4 - 4.3 }, 5, 8));
      hb.add(box(0.2, 0.03, 0.12, col, { x: sd * 0.24, y: -0.02, z: -0.02, rz: sd * -0.25 }));
    }
  } else if (kind === 'cow') {
    for (const sd of [-1, 1]) {
      hb.add(cone(0.035, 0.16, '#cfc6b0', 5, { x: sd * 0.1, y: 0.2, z: -0.02, rz: sd * -0.5 }));
      hb.add(box(0.18, 0.03, 0.09, col, { x: sd * 0.2, y: 0.06, z: -0.02, rz: sd * -0.35 }));
    }
  } else if (kind === 'goat') {
    for (const sd of [-1, 1]) {
      hb.add(box(0.03, 0.2, 0.08, variant % 2 ? col : '#e9e2d2', { x: sd * 0.085, y: -0.07, z: 0.02 }));
      hb.add(cone(0.02, 0.12, '#55493c', 4, { x: sd * 0.035, y: 0.12, z: -0.04, rx: -0.7 }));
    }
    hb.add(cone(0.025, 0.1, col, 4, { y: my - 0.07, z: mz * 0.8, rx: Math.PI }));
  } else if (kind === 'sheep') {
    for (const sd of [-1, 1]) hb.add(box(0.1, 0.025, 0.06, faceCol, { x: sd * 0.11, y: 0.02, z: 0.0, rz: sd * -0.5 }));
    hb.add(ico(0.1, '#efe9d8', 0, { y: 0.07, z: -0.03 }));
  } else if (kind === 'donkey') {
    for (const sd of [-1, 1]) hb.add(box(0.05, 0.26, 0.03, col, { x: sd * 0.07, y: 0.2, z: -0.04, rz: sd * -0.18 }));
    hb.add(box(0.03, 0.14, 0.4, dark, { y: 0.04 - ny * 0.4, z: -0.12 - nz * 0.45, rx: Math.PI / 2 - na }));
  } else if (kind === 'dog') {
    for (const sd of [-1, 1]) hb.add(cone(0.03, 0.07, col, 4, { x: sd * 0.045, y: 0.09, z: 0.0 }));
  }
  hb.pop();
  head.add(only(hb));
  group.add(head);

  // ---- legs ----
  const legs = [];
  const lz = s.L / 2 - s.H * 0.38, lx = s.W * 0.3;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * lx, s.legH + 0.12, sz * lz);
    const lb = new Builder();
    lb.add(cyl(s.legR * 1.25, s.legR * 0.8, s.legH + 0.12, col, 6, { y: -(s.legH + 0.12) / 2 }));
    lb.add(cyl(s.legR * 0.95, s.legR * 1.0, 0.06, dark, 6, { y: -(s.legH + 0.09) }));
    pivot.add(only(lb));
    group.add(pivot);
    legs.push(pivot);
  }

  // ---- tail ----
  const tail = new THREE.Group();
  tail.position.set(0, s.legH + s.H * 0.86, -s.L / 2 + 0.03);
  const tb = new Builder();
  const [tl, tuft] = s.tail;
  if (kind === 'dog') {
    tb.add(cyl(0.02, 0.03, tl, col, 5, { y: tl / 2 - 0.02, z: -0.08, rx: -0.6 }));
  } else if (kind === 'goat' || kind === 'sheep') {
    tb.add(box(0.05, tl, 0.04, col, { y: kind === 'goat' ? tl / 2 : -tl / 2, z: -0.02, rx: kind === 'goat' ? -0.5 : 0.2 }));
  } else {
    tb.add(cyl(0.028, 0.02, tl, col, 5, { y: -tl / 2, z: -0.04 }));
    tb.add(cyl(0.045, 0.02, 0.24, tuft, 5, { y: -tl - 0.08, z: -0.04 }));
  }
  tail.add(only(tb));
  group.add(tail);

  const anim = { phase: Math.random() * 6, t: Math.random() * 20, graze: 0, grazeTarget: 0, blend: 0 };
  const lowHead = kind === 'buffalo' ? 0.75 : kind === 'dog' ? 0.5 : 1.15;

  return {
    kind, group, radius: s.r, anim,
    setGraze(v) { anim.grazeTarget = v ? 1 : 0; },
    update(dt, speed = 0) {
      anim.t += dt;
      const moving = speed > 0.05;
      anim.blend += ((moving ? 1 : 0) - anim.blend) * Math.min(1, dt * 8);
      if (moving) anim.phase += dt * (2.5 + speed * 3.2);
      const a = Math.sin(anim.phase) * 0.45 * anim.blend;
      legs[0].rotation.x = -a; legs[3].rotation.x = -a;
      legs[1].rotation.x = a; legs[2].rotation.x = a;
      anim.graze += (anim.grazeTarget - anim.graze) * Math.min(1, dt * 2.5);
      const chew = Math.sin(anim.t * 5) * 0.03 * anim.graze;
      head.rotation.x = anim.graze * lowHead + chew + Math.sin(anim.t * 0.7) * 0.04 + Math.abs(Math.sin(anim.phase)) * 0.05 * anim.blend;
      head.rotation.y = Math.sin(anim.t * 0.33) * 0.18 * (1 - anim.graze);
      const flick = Math.max(0, Math.sin(anim.t * 0.9)) ** 6;
      tail.rotation.z = Math.sin(anim.t * (kind === 'dog' ? 9 : 4)) * (kind === 'dog' ? 0.5 : 0.12 + flick * 0.6);
    },
  };
}

function makeChicken(variant) {
  const cols = [['#8a4a22', '#5a2f18'], ['#efe9dc', '#d9d2c2'], ['#2a2422', '#8a2a1a'], ['#b8743a', '#7a4a22']][variant % 4];
  const rooster = variant % 4 === 2;
  const group = new THREE.Group();
  const b = new Builder();
  b.add(sph(0.14, cols[0], { y: 0.26, sz: 1.3, sy: 0.95 }));
  b.add(box(0.03, 0.2, 0.2, cols[1], { y: 0.4, z: -0.2, rx: -0.6 }));
  if (rooster) b.add(box(0.03, 0.28, 0.16, '#1f3a2a', { y: 0.47, z: -0.24, rx: -0.9 }));
  for (const sd of [-1, 1]) {
    b.add(cyl(0.012, 0.012, 0.16, '#d9a83a', 4, { x: sd * 0.05, y: 0.08 }));
    b.add(box(0.05, 0.012, 0.08, '#d9a83a', { x: sd * 0.05, y: 0.006, z: 0.02 }));
  }
  group.add(only(b));
  const head = new THREE.Group();
  head.position.set(0, 0.32, 0.14);
  const hb = new Builder();
  hb.add(cyl(0.04, 0.06, 0.18, cols[0], 5, { y: 0.07, z: 0.02, rx: 0.3 }));
  hb.add(sph(0.05, cols[0], { y: 0.17, z: 0.05 }));
  hb.add(cone(0.018, 0.05, '#d9a83a', 4, { y: 0.165, z: 0.11, rx: Math.PI / 2 }));
  hb.add(box(0.015, rooster ? 0.06 : 0.035, 0.06, '#c81e1e', { y: 0.225, z: 0.05 }));
  hb.add(box(0.015, 0.035, 0.02, '#c81e1e', { y: 0.125, z: 0.09 }));
  head.add(only(hb));
  group.add(head);
  if (rooster) group.scale.setScalar(1.2);

  const anim = { t: Math.random() * 10, peck: 0, grazeTarget: 0 };
  return {
    kind: 'chicken', group, radius: 0.15, anim,
    setGraze(v) { anim.grazeTarget = v ? 1 : 0; },
    update(dt, speed = 0) {
      anim.t += dt;
      const walk = speed > 0.05 ? Math.sin(anim.t * 14) * 0.12 : 0;
      const peck = anim.grazeTarget ? Math.max(0, Math.sin(anim.t * 6)) * 1.1 : 0;
      head.rotation.x = peck + walk;
      group.children[0].rotation.x = peck * 0.25;
    },
  };
}

// ---- Behaviour -------------------------------------------------------------

const SPEEDS = { buffalo: 0.7, cow: 0.8, goat: 1.1, sheep: 0.9, donkey: 0.9, dog: 1.6, chicken: 0.9 };

export const animals = [];

// tether: stays where it is (tied at a manger or wallowing in the pond).
export function spawnAnimal(scene, kind, x, z, { variant = 0, tether = false, roam = 8, yaw = 0, sunk = 0, graze = false } = {}) {
  const a = makeAnimal(kind, variant);
  a.x = x; a.z = z; a.yaw = yaw; a.sunk = sunk;
  a.home = { x, z }; a.roam = roam; a.tether = tether;
  a.mode = 'idle'; a.timer = Math.random() * 4; a.speed = 0; a.target = null; a.scare = 0;
  a.group.position.set(x, heightAt(x, z) - sunk, z);
  a.group.rotation.y = yaw;
  if (graze) a.setGraze(true);
  if (kind !== 'chicken') a.body = addDynamic({ x, z, r: a.radius, off: sunk > 0 });
  scene.add(a.group);
  animals.push(a);
  return a;
}

export function updateAnimals(dt, player, camPos) {
  for (const a of animals) {
    // Skip the thinking for animals that are far away; keep them posed.
    const far = (a.x - camPos.x) ** 2 + (a.z - camPos.z) ** 2 > 110 * 110;
    if (far) continue;

    if (a.tether) {
      a.timer -= dt;
      if (a.timer <= 0) { a.timer = 3 + Math.random() * 6; if (!a.sunk) a.setGraze(Math.random() < 0.6); }
      a.update(dt, 0);
      continue;
    }

    const pdx = a.x - player.x, pdz = a.z - player.z;
    const pd = Math.hypot(pdx, pdz);

    // Chickens scatter when someone comes close; the dog comes to say hello.
    if (a.kind === 'chicken' && pd < 2.2 && a.scare <= 0) {
      a.scare = 1.2;
      a.target = { x: a.x + (pdx / (pd || 1)) * 4, z: a.z + (pdz / (pd || 1)) * 4 };
      a.mode = 'walk';
      a.setGraze(false);
    }
    a.scare -= dt;

    if (a.mode === 'walk' && a.target) {
      const dx = a.target.x - a.x, dz = a.target.z - a.z;
      const d = Math.hypot(dx, dz);
      const sp = SPEEDS[a.kind] * (a.scare > 0 ? 3.2 : 1);
      if (d < 0.4) { a.mode = 'idle'; a.timer = 2 + Math.random() * 7; a.setGraze(a.kind !== 'dog' && Math.random() < 0.7); }
      else {
        const want = Math.atan2(dx, dz);
        a.yaw += angDiff(a.yaw, want) * Math.min(1, dt * 3);
        a.speed = sp;
        const px = a.x, pz = a.z;
        a.x += Math.sin(a.yaw) * sp * dt;
        a.z += Math.cos(a.yaw) * sp * dt;
        if (a.kind !== 'chicken' && resolve(a, a.radius, a.body)) {
          if (Math.hypot(a.x - px, a.z - pz) < sp * dt * 0.4) { a.mode = 'idle'; a.timer = 1 + Math.random() * 2; }
        }
      }
    } else {
      a.speed = 0;
      a.timer -= dt;
      if (a.kind === 'dog' && pd < 7) {
        a.yaw += angDiff(a.yaw, Math.atan2(-pdx, -pdz)) * Math.min(1, dt * 4);
      }
      if (a.timer <= 0) {
        for (let tries = 0; tries < 6; tries++) {
          const ang = Math.random() * Math.PI * 2, r = Math.random() * a.roam;
          const tx = a.home.x + Math.cos(ang) * r, tz = a.home.z + Math.sin(ang) * r;
          if (!blocked(tx, tz, a.radius + 0.2)) { a.target = { x: tx, z: tz }; a.mode = 'walk'; a.setGraze(false); break; }
        }
        if (a.mode !== 'walk') a.timer = 2;
      }
    }

    if (a.body) { a.body.x = a.x; a.body.z = a.z; }
    a.group.position.set(a.x, heightAt(a.x, a.z), a.z);
    a.group.rotation.y = a.yaw;
    a.update(dt, a.speed);
  }
}

// ---- Birds that just stand about -------------------------------------------

// Cattle egret: the white bird that follows buffalo and tractors.
export function egret(b, x, z, ry = 0) {
  b.push(x, 0, z, ry);
  b.add(sph(0.12, '#f4f2ec', { y: 0.42, sz: 1.6 }));
  b.add(cyl(0.03, 0.04, 0.3, '#f4f2ec', 5, { y: 0.6, z: 0.14, rx: 0.4 }));
  b.add(sph(0.045, '#f4f2ec', { y: 0.75, z: 0.2 }));
  b.add(cone(0.015, 0.12, '#e2a83a', 4, { y: 0.74, z: 0.3, rx: Math.PI / 2 }));
  for (const s of [-1, 1]) b.add(cyl(0.008, 0.008, 0.34, '#3a3a34', 4, { x: s * 0.03, y: 0.17 }));
  b.pop();
}

export function crow(b, x, y, z, ry = 0) {
  b.push(x, y, z, ry);
  b.add(sph(0.07, '#17171a', { y: 0.08, sz: 1.7 }));
  b.add(sph(0.045, '#4a4a50', { y: 0.15, z: 0.09 }));
  b.add(cone(0.014, 0.07, '#17171a', 4, { y: 0.15, z: 0.16, rx: Math.PI / 2 }));
  b.add(box(0.05, 0.012, 0.14, '#17171a', { y: 0.07, z: -0.16, rx: 0.2 }));
  b.pop();
}
