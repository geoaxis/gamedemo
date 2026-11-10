import * as THREE from 'three';
import { Builder, box, cyl, sph, cone, dome, registerTexture } from './build.js';
import { signBoard, truckArt } from '../ui/signs.js';
import { SIGNS } from '../data/strings.js';
import { makeHuman } from './human.js';
import { ROAD } from '../data/layout.js';
import { heightAt } from '../world/terrain.js';
import { addDynamic } from '../systems/collision.js';

// Traffic on the paved road: a decorated Bedford truck and a motorcycle rickshaw.
// Pakistan drives on the left, so eastbound traffic keeps to the north side.

function artPlane(tex, w, h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex }));
  return m;
}

function wheel(b, r, w, x, y, z) {
  b.add(cyl(r, r, w, '#1c1c1c', 12, { x, y, z, rz: Math.PI / 2 }));
  b.add(cyl(r * 0.5, r * 0.5, w + 0.03, '#d81e2c', 8, { x, y, z, rz: Math.PI / 2 }));
}

export function makeTruck() {
  const group = new THREE.Group();
  const b = new Builder();
  const BLUE = '#1f6fd0';
  b.add(box(2.0, 0.25, 6.8, '#2a2a2a', { y: 0.78 }));
  for (const s of [-1, 1]) {
    wheel(b, 0.5, 0.3, s * 0.95, 0.5, 2.3);
    wheel(b, 0.5, 0.55, s * 0.9, 0.5, -1.7);
  }
  // bonnet and grille
  b.add(box(1.5, 0.75, 1.35, BLUE, { y: 1.35, z: 2.8 }));
  b.add(box(1.2, 0.5, 0.06, '#e9e4d0', { y: 1.3, z: 3.49 }));
  for (let i = 0; i < 5; i++) b.add(box(1.1, 0.03, 0.02, '#2a2a2a', { y: 1.12 + i * 0.09, z: 3.53 }));
  for (const s of [-1, 1]) {
    b.add(sph(0.11, '#f4eecf', { x: s * 0.55, y: 1.42, z: 3.47 }));
    b.add(box(0.5, 0.5, 1.2, BLUE, { x: s * 0.95, y: 1.05, z: 2.4 }));
  }
  b.add(box(2.2, 0.22, 0.22, '#f4f2ec', { y: 0.8, z: 3.6 }));
  for (let i = 0; i < 6; i++) b.add(box(0.18, 0.23, 0.23, '#d81e2c', { x: -0.9 + i * 0.36, y: 0.8, z: 3.6 }));
  // chains and bells swinging under the bumper
  for (let i = 0; i < 11; i++) b.add(box(0.03, 0.22 + (i % 2) * 0.08, 0.03, '#c9c9c9', { x: -1.0 + i * 0.2, y: 0.56, z: 3.62 }));
  // cab
  b.add(box(2.15, 1.5, 1.45, BLUE, { y: 1.9, z: 1.45 }));
  b.add(box(1.8, 0.62, 0.05, '#1c2a33', { y: 2.2, z: 2.19 }));
  b.add(box(0.06, 0.62, 0.06, '#f7c81e', { y: 2.2, z: 2.21 }));
  for (const s of [-1, 1]) {
    b.add(box(0.05, 0.5, 0.7, '#1c2a33', { x: s * 1.08, y: 2.25, z: 1.5 }));
    b.add(box(0.05, 0.6, 1.2, '#f7c81e', { x: s * 1.09, y: 1.55, z: 1.45 }));
    b.add(box(0.06, 0.4, 0.9, '#d81e2c', { x: s * 1.1, y: 1.55, z: 1.45 }));
    for (let i = 0; i < 5; i++) b.add(box(0.05, 0.3, 0.05, ['#e8459a', '#f7c81e', '#1f9d55'][i % 3], { x: s * 1.12, y: 2.5 - i * 0.03, z: 2.1 - i * 0.07 }));
  }
  // the crown above the cab
  b.add(box(2.35, 1.05, 1.9, '#d81e2c', { y: 3.2, z: 1.85 }));
  for (let i = 0; i < 9; i++) b.add(cone(0.13, 0.3, i % 2 ? '#f7c81e' : '#1f9d55', 4, { x: -1.04 + i * 0.26, y: 3.87, z: 2.7 }));
  // cargo body and a tarpaulin-covered load
  b.add(box(2.35, 2.25, 4.4, '#8a1a20', { y: 2.05, z: -1.55 }));
  b.add(dome(1.2, '#8a8068', { y: 3.15, z: -1.55, sz: 1.75, sy: 0.6 }, 8, 3));
  for (const s of [-1, 1]) b.add(box(0.5, 0.6, 0.04, '#2a2a2a', { x: s * 0.9, y: 0.55, z: -2.5 }));
  group.add(b.build());

  const crown = artPlane(truckArt('crown', SIGNS.truckCrown), 2.35, 1.05);
  crown.position.set(0, 3.2, 2.81);
  const back = artPlane(truckArt('back', SIGNS.truckBack, SIGNS.truckHorn), 2.35, 2.25);
  back.position.set(0, 2.05, -3.76);
  back.rotation.y = Math.PI;
  group.add(crown, back);
  const sideTex = truckArt('side', SIGNS.truckSide);
  for (const s of [-1, 1]) {
    const side = artPlane(sideTex, 4.4, 2.25);
    side.position.set(s * 1.185, 2.05, -1.55);
    side.rotation.y = (s * Math.PI) / 2;
    group.add(side);
  }
  group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group, length: 7.2, speed: 11 };
}

export function makeRickshaw() {
  const group = new THREE.Group();
  const b = new Builder();
  const GREEN = '#1f9d55';
  // motorcycle front
  wheel(b, 0.3, 0.1, 0, 0.3, 1.25);
  b.add(box(0.1, 0.1, 1.1, '#2a2a2a', { y: 0.5, z: 0.6 }));
  b.add(box(0.24, 0.2, 0.42, '#c81e1e', { y: 0.74, z: 0.75 }));
  b.add(box(0.24, 0.08, 0.5, '#1a1a1a', { y: 0.76, z: 0.25 }));
  b.add(cyl(0.025, 0.025, 0.66, '#9a9a9a', 5, { y: 0.63, z: 1.2, rx: -0.4 }));
  b.add(cyl(0.02, 0.02, 0.62, '#2a2a2a', 5, { y: 1.0, z: 1.07, rz: Math.PI / 2 }));
  b.add(sph(0.09, '#f1ecd2', { y: 0.88, z: 1.2 }));
  // passenger body
  b.add(box(1.35, 0.1, 1.7, '#2a2a2a', { y: 0.5, z: -0.95 }));
  for (const s of [-1, 1]) {
    wheel(b, 0.3, 0.14, s * 0.72, 0.3, -1.0);
    b.add(box(0.05, 0.4, 1.7, GREEN, { x: s * 0.66, y: 0.75, z: -0.95 }));
    for (const z of [-0.15, -1.75]) b.add(cyl(0.02, 0.02, 1.25, '#f7c81e', 4, { x: s * 0.64, y: 1.2, z }));
  }
  b.add(box(1.25, 0.1, 0.4, '#8a1a20', { y: 0.92, z: -0.4 }));
  b.add(box(1.25, 0.1, 0.4, '#8a1a20', { y: 0.92, z: -1.5 }));
  b.add(box(1.25, 0.45, 0.06, GREEN, { y: 0.8, z: -1.78 }));
  b.add(box(1.5, 0.06, 2.0, GREEN, { y: 1.83, z: -0.95 }));
  const tassel = ['#d81e2c', '#f7c81e', '#ffffff', '#e8459a'];
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) b.add(box(0.02, 0.14, 0.12, tassel[i % 4], { x: s * 0.75, y: 1.74, z: -0.1 - i * 0.24 }));
  group.add(b.build());

  const plate = signBoard(SIGNS.rickshaw, { w: 1.1, h: 0.36, bg: '#f7c81e', fg: '#b0101c', border: '#d81e2c' });
  plate.position.set(0, 0.82, -1.82);
  plate.rotation.y = Math.PI;
  group.add(plate);

  const driver = makeHuman({ kameez: '#7a6a5a', waistcoat: '#3a3a3a', headwear: 'topi', beard: 'full' });
  driver.setSitting(true, 0.7);
  driver.setDriving(true);
  driver.update(0, 0);
  driver.group.position.set(0, 0, 0.2);
  group.add(driver.group);
  // two passengers on the benches
  for (const [x, z, ry, look] of [[0.25, -0.42, Math.PI, { kameez: '#c9a13a', headwear: 'dupatta', headColor: '#b03a5b', female: true, moustache: false }], [-0.25, -1.5, 0, { kameez: '#e9e4d6', headwear: 'pagri' }]]) {
    const p = makeHuman(look);
    p.setSitting(true, 0.9);
    p.update(0, 0);
    p.group.position.set(x, 0, z);
    p.group.rotation.y = ry;
    group.add(p.group);
  }
  group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group, length: 3.2, speed: 7.5 };
}

export class Traffic {
  constructor(scene) {
    this.items = [];
    const add = (v, dir, x, wait) => {
      const z = ROAD.z - dir * 1.75;
      const item = { ...v, dir, x, z, v: v.speed, wait, honk: 0, body: [addDynamic({ x, z, r: 1.3 }), addDynamic({ x, z, r: 1.3 })] };
      item.group.rotation.order = 'YXZ';
      item.group.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(item.group);
      this.items.push(item);
      return item;
    };
    this.truck = add(makeTruck(), 1, -180, 0);
    this.rickshaw = add(makeRickshaw(), -1, 140, 0);
    this.onHonk = null;
  }

  update(dt, obstacles) {
    for (const it of this.items) {
      if (it.wait > 0) { it.wait -= dt; if (it.wait <= 0) it.x = -it.dir * 420; else continue; }
      // Brake for anyone standing or driving on the road ahead.
      let target = it.speed;
      for (const o of obstacles) {
        const ahead = (o.x - it.x) * it.dir;
        if (ahead > 0 && ahead < 16 + it.length && Math.abs(o.z - it.z) < 2.4) {
          target = 0;
          if (it.honk <= 0 && this.onHonk) { this.onHonk(it); it.honk = 3.5; }
        }
      }
      it.honk -= dt;
      it.v += Math.sign(target - it.v) * Math.min(Math.abs(target - it.v), dt * (target < it.v ? 14 : 3));
      it.x += it.dir * it.v * dt;
      if (Math.abs(it.x) > 420) it.wait = 6 + Math.random() * 18;

      const half = it.length / 2 - 0.6;
      const yf = heightAt(it.x + it.dir * half, it.z), yb = heightAt(it.x - it.dir * half, it.z);
      it.group.position.set(it.x, (yf + yb) / 2, it.z);
      it.group.rotation.x = -Math.atan2(yf - yb, half * 2);
      it.body[0].x = it.x + it.dir * half; it.body[0].z = it.z;
      it.body[1].x = it.x - it.dir * half; it.body[1].z = it.z;
    }
  }
}
