import * as THREE from 'three';
import { Builder, box, cyl, sph, torus, dome, registerTexture } from './build.js';
import { signBoard, truckArt } from '../ui/signs.js';
import { SIGNS } from '../data/strings.js';

// A red Massey Ferguson style tractor, dressed up the Punjabi way with a painted canopy
// and tassels, pulling a blue trolley. The model faces +z.

const RED = '#c4221a', GREY = '#6b6f72', RIM = '#c8c8c0', TYRE = '#1c1c1c';

function wheelMesh(r, w, lugs) {
  const b = new Builder();
  b.add(cyl(r, r, w, TYRE, 14, { rz: Math.PI / 2 }));
  b.add(cyl(r * 0.6, r * 0.6, w + 0.03, RIM, 10, { rz: Math.PI / 2 }));
  b.add(cyl(r * 0.2, r * 0.2, w + 0.08, RED, 6, { rz: Math.PI / 2 }));
  for (let i = 0; i < lugs; i++) {
    const a = (i / lugs) * Math.PI * 2;
    b.add(box(w + 0.02, 0.07, r * 0.22, '#111111', { y: Math.cos(a) * r, z: Math.sin(a) * r, rx: a + Math.PI / 2 + 0.5 }));
  }
  const m = b.build().children[0];
  m.castShadow = true;
  return m;
}

export function makeTractor() {
  const group = new THREE.Group();
  const b = new Builder();

  // engine, gearbox and bonnet
  b.add(box(0.5, 0.5, 1.3, GREY, { y: 0.74, z: -0.35 }));
  b.add(box(0.42, 0.52, 1.05, '#5d6164', { y: 0.78, z: 0.68 }));
  b.add(box(0.58, 0.36, 1.5, RED, { y: 1.2, z: 0.62 }));
  b.add(box(0.58, 0.64, 0.08, '#3a3a3a', { y: 1.02, z: 1.4 }));
  b.add(box(0.5, 0.1, 0.1, '#d9d4c4', { y: 1.26, z: 1.43 }));
  for (const s of [-1, 1]) {
    b.add(sph(0.065, '#f1ecd2', { x: s * 0.19, y: 1.04, z: 1.45 }));
    b.add(box(0.05, 0.6, 0.1, RED, { x: s * 0.31, y: 0.98, z: 1.42 }));
  }
  b.add(box(0.66, 0.1, 0.12, RED, { y: 0.66, z: 1.44 }));
  b.add(box(0.34, 0.12, 0.03, '#f4f2ec', { y: 0.86, z: 1.46 }));
  b.add(box(1.24, 0.08, 0.1, '#4a4a4a', { y: 0.38, z: 1.2 }));
  // dashboard, steering, seat
  b.add(box(0.52, 0.34, 0.26, RED, { y: 1.26, z: -0.16 }));
  b.add(cyl(0.02, 0.02, 0.5, '#2a2a2a', 5, { y: 1.52, z: -0.36, rx: -0.75 }));
  b.add(torus(0.19, 0.02, '#1c1c1c', Math.PI * 2, { y: 1.68, z: -0.52, rx: Math.PI / 2 - 0.75 }, 4, 10));
  b.add(box(0.46, 0.08, 0.42, '#1a1a1a', { y: 1.13, z: -0.86 }));
  b.add(box(0.46, 0.32, 0.06, '#1a1a1a', { y: 1.32, z: -1.08 }));
  // fenders over the big rear wheels
  for (const s of [-1, 1]) {
    b.add(box(0.44, 0.06, 0.9, RED, { x: s * 0.78, y: 1.46, z: -0.75 }));
    b.add(box(0.44, 0.06, 0.6, RED, { x: s * 0.78, y: 1.3, z: -0.06, rx: 0.62 }));
    b.add(box(0.44, 0.06, 0.6, RED, { x: s * 0.78, y: 1.3, z: -1.44, rx: -0.62 }));
    b.add(box(0.04, 0.55, 1.5, RED, { x: s * 0.57, y: 1.2, z: -0.75 }));
    b.add(sph(0.05, '#f2c230', { x: s * 0.78, y: 1.53, z: -0.2 }));
  }
  b.add(box(1.2, 0.12, 0.12, GREY, { y: 0.68, z: -0.75 }));
  // exhaust stack
  b.add(cyl(0.03, 0.03, 0.75, '#2a2a2a', 6, { x: 0.2, y: 1.72, z: 0.95 }));
  b.add(cyl(0.045, 0.045, 0.16, '#3a3a3a', 6, { x: 0.2, y: 1.48, z: 0.95 }));
  // drawbar
  b.add(box(0.12, 0.08, 0.5, '#3a3a3a', { y: 0.5, z: -1.35 }));

  // canopy with coloured tassels
  for (const s of [-1, 1]) for (const z of [0.0, -1.45]) b.add(cyl(0.022, 0.022, 0.95, '#2a2a2a', 4, { x: s * 0.72, y: 1.95, z }));
  b.add(box(1.6, 0.05, 1.75, '#1f6fd0', { y: 2.44, z: -0.72 }));
  b.add(box(1.64, 0.1, 0.04, '#f2c230', { y: 2.4, z: 0.16 }));
  const tassel = ['#d81e2c', '#f7c81e', '#1f9d55', '#ffffff', '#e8459a'];
  for (let i = 0; i < 9; i++) {
    const c = tassel[i % tassel.length];
    b.add(box(0.1, 0.16, 0.02, c, { x: -0.72 + i * 0.18, y: 2.3, z: 0.17 }));
    b.add(box(0.1, 0.16, 0.02, c, { x: -0.72 + i * 0.18, y: 2.3, z: -1.6 }));
    for (const s of [-1, 1]) b.add(box(0.02, 0.16, 0.1, c, { x: s * 0.8, y: 2.3, z: 0.0 - i * 0.19 }));
  }
  for (const s of [-1, 1]) {
    b.add(cyl(0.012, 0.012, 0.5, '#2a2a2a', 4, { x: s * 0.5, y: 2.7, z: 0.1 }));
    b.add(box(0.3, 0.18, 0.012, s > 0 ? '#1f9d55' : '#d81e2c', { x: s * 0.5 + 0.15, y: 2.84, z: 0.1 }));
  }
  const body = b.build();
  group.add(body);

  // wheels
  const wheels = [];
  const frontPivots = [];
  for (const s of [-1, 1]) {
    const rear = wheelMesh(0.68, 0.36, 12);
    rear.position.set(s * 0.78, 0.68, -0.75);
    group.add(rear);
    wheels.push({ mesh: rear, r: 0.68 });
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.62, 0.37, 1.2);
    const front = wheelMesh(0.37, 0.18, 0);
    pivot.add(front);
    group.add(pivot);
    frontPivots.push(pivot);
    wheels.push({ mesh: front, r: 0.37 });
  }

  // headlights that come on at night
  const lamp = new THREE.SpotLight(0xfff0c8, 0, 40, 0.5, 0.6, 1.2);
  lamp.position.set(0, 1.1, 1.5);
  lamp.target.position.set(0, 0.2, 12);
  group.add(lamp, lamp.target);

  return { group, wheels, frontPivots, lamp, seat: new THREE.Vector3(0, 1.17, -0.84) };
}

export function makeTrolley() {
  registerTexture('trolleyArt', truckArt('trolley', null));
  const group = new THREE.Group();
  const b = new Builder();
  const BLUE = '#1f6fd0';
  // A-frame drawbar from the hitch pin at the origin
  b.add(box(0.1, 0.1, 1.4, '#3a3a3a', { y: 0.55, z: -0.7 }));
  for (const s of [-1, 1]) b.add(box(0.08, 0.08, 1.3, '#3a3a3a', { x: s * 0.35, y: 0.62, z: -0.95, ry: s * -0.5 }));
  // bed and boards
  b.add(box(1.95, 0.12, 3.7, '#5a4632', { y: 0.92, z: -3.2 }));
  for (const s of [-1, 1]) {
    b.add(box(0.07, 0.62, 3.7, '#ffffff', { x: s * 0.97, y: 1.28, z: -3.2 }), 'trolleyArt');
    for (let i = 0; i < 4; i++) b.add(box(0.09, 0.7, 0.09, '#f2c230', { x: s * 0.99, y: 1.3, z: -1.45 - i * 1.17 }));
  }
  b.add(box(1.95, 0.62, 0.07, BLUE, { y: 1.28, z: -1.36 }));
  b.add(box(1.95, 0.62, 0.07, BLUE, { y: 1.28, z: -5.04 }));
  b.add(box(1.7, 0.1, 0.1, '#3a3a3a', { y: 0.5, z: -3.5 }));
  // a load of cut fodder
  b.add(dome(0.95, '#5a9433', { y: 1.0, z: -2.5, sy: 0.75, sz: 1.3 }, 8, 3));
  b.add(dome(0.9, '#4f8a2c', { y: 1.0, z: -3.9, sy: 0.7, sz: 1.2 }, 8, 3));
  for (const s of [-1, 1]) for (const z of [-4.7, -5.0]) b.add(sph(0.05, '#d81e2c', { x: s * (z < -4.8 ? 0.8 : 0.6), y: 1.05, z: -5.09 }), 'glow');
  group.add(b.build());

  const tail = signBoard(SIGNS.trolley, { w: 1.5, h: 0.42, bg: '#f7c81e', fg: '#b0101c', border: '#d81e2c' });
  tail.position.set(0, 1.3, -5.08);
  tail.rotation.y = Math.PI;
  group.add(tail);

  const wheels = [];
  for (const s of [-1, 1]) {
    const w = wheelMesh(0.42, 0.22, 0);
    w.position.set(s * 0.98, 0.42, -3.5);
    group.add(w);
    wheels.push({ mesh: w, r: 0.42 });
  }
  return { group, wheels, axle: 3.5 };
}
