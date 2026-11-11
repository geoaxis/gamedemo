import * as THREE from 'three';
import { getTexture } from '../models/textures.js';
import { heightAt } from './terrain.js';
import { makeRng } from '../util/rng.js';

// After dark: a bare bulb on each veranda with a pool of warm light under it, lamplight
// through shutters and the cracks of doors, a moon, and bats hunting round the lights.
// Households go to bed at different times; most are dark by midnight.

const rng = makeRng(919);

export function buildNightLights(scene, { windows = [], bulbs = [], extra = [] }) {
  const group = new THREE.Group();
  scene.add(group);
  const homes = [];

  // windows and door cracks: flat warm panes, brightness per household
  const pane = new THREE.PlaneGeometry(1, 1);
  const paneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true, toneMapped: false });
  const panes = new THREE.InstancedMesh(pane, paneMat, Math.max(1, windows.length));
  const d = new THREE.Object3D();
  windows.forEach((w, i) => {
    d.position.set(w.x, w.y, w.z); d.rotation.set(0, w.ry, 0); d.scale.set(w.w, w.h, 1); d.updateMatrix();
    panes.setMatrixAt(i, d.matrix);
    panes.setColorAt(i, new THREE.Color(0x201810));
  });
  group.add(panes);

  // bulbs: a hot dot, a soft halo and a pool of light on the ground
  const halo = getTexture('stain');
  const all = [...bulbs.map((b) => ({ ...b, home: true })), ...extra.map((b) => ({ ...b, home: false }))];
  for (const b of all) {
    const bed = rng.range(21, 24.5);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false }));
    dot.position.set(b.x, b.y, b.z);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xffb860, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    glow.position.copy(dot.position);
    glow.scale.setScalar(1.6);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(11, 11).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: halo, color: 0xffa850, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    pool.position.set(b.x, heightAt(b.x, b.z) + 0.06, b.z);
    pool.renderOrder = 5;
    group.add(dot, glow, pool);
    homes.push({ dot, glow, pool, bed: b.home ? bed : 30, flick: rng() * 10 });
  }
  const winBed = windows.map(() => rng.range(20.5, 24.5));

  // the moon
  const mc = document.createElement('canvas');
  mc.width = mc.height = 128;
  const ctx = mc.getContext('2d');
  const gr = ctx.createRadialGradient(64, 64, 20, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.45, 'rgba(250,245,230,1)'); gr.addColorStop(0.5, 'rgba(220,225,240,0.25)'); gr.addColorStop(1, 'rgba(200,210,240,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(180,175,165,0.35)';
  for (const [x, y, r] of [[52, 54, 9], [74, 70, 7], [60, 78, 5], [78, 50, 5]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); }
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(mc), fog: false, depthWrite: false, transparent: true }));
  moon.scale.setScalar(110);
  moon.renderOrder = -9;
  scene.add(moon);

  // bats
  const BATS = 10;
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.06, 0.2, 0.02, 0, 0, 0, -0.06], 3));
  wing.computeVertexNormals();
  const batMat = new THREE.MeshBasicMaterial({ color: 0x15120f, side: THREE.DoubleSide });
  const batL = new THREE.InstancedMesh(wing, batMat, BATS), batR = new THREE.InstancedMesh(wing, batMat, BATS);
  for (const m of [batL, batR]) { m.frustumCulled = false; group.add(m); }
  const bats = Array.from({ length: BATS }, (_, i) => ({ b: all[i % Math.max(1, all.length)] || { x: 0, y: 3, z: 0 }, a: rng() * 6, r: rng.range(2, 6), s: rng.range(1.5, 3), ph: rng() * 6, h: rng.range(1, 4) }));
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  const _c = new THREE.Color(), warm = new THREE.Color(0xffb35a), dark = new THREE.Color(0x201810);
  const _dir = new THREE.Vector3(0.35, 0.8, -0.45).normalize();

  return {
    update(dt, cam, sky) {
      const n = sky.night, h = sky.hours;
      const hour = h < 12 ? h + 24 : h; // hours after noon, so midnight counts as late
      moon.position.copy(cam).addScaledVector(_dir, 1300);
      moon.material.opacity = n * (1 - (sky.weather?.cloud ?? 0) * 0.8);
      moon.visible = n > 0.05;
      group.visible = n > 0.02;
      if (!group.visible) return;
      // flickering on a weak village supply; load-shedding in the late evening
      const shedding = h > 20.25 && h < 20.75;
      for (const L of homes) {
        L.flick += dt;
        const on = !shedding && hour < L.bed ? 1 : 0;
        const k = n * on * (0.92 + Math.sin(L.flick * 13) * 0.04 + Math.sin(L.flick * 2.3) * 0.04);
        L.dot.material.color.setRGB(1 * k + 0.1, 0.88 * k + 0.08, 0.66 * k + 0.06);
        L.glow.material.opacity = k * 0.9;
        L.pool.material.opacity = k * 0.85;
      }
      windows.forEach((w, i) => {
        const lamp = !shedding || i % 3 === 0; // a few houses have a lantern or a UPS
        const on = lamp && hour < winBed[i] ? n : 0;
        panes.setColorAt(i, _c.copy(dark).lerp(warm, on * (w.crack ? 0.9 : 0.75)));
      });
      if (panes.instanceColor) panes.instanceColor.needsUpdate = true;
      bats.forEach((bt, i) => {
        bt.a += dt * bt.s / bt.r * (i % 2 ? 1 : -1);
        bt.ph += dt * 22;
        const wob = Math.sin(bt.a * 3.1) * 0.8;
        _p.set(bt.b.x + Math.cos(bt.a) * bt.r + wob, bt.b.y + bt.h * 0.5 + Math.sin(bt.a * 2.3) * 0.8, bt.b.z + Math.sin(bt.a) * bt.r);
        const yaw = bt.a + (i % 2 ? 0 : Math.PI);
        const fl = Math.sin(bt.ph) * 0.9;
        _e.set(0, yaw, fl); _q.setFromEuler(_e); batL.setMatrixAt(i, _m.compose(_p, _q, _s.set(-1, 1, 1)));
        _e.set(0, yaw, -fl); _q.setFromEuler(_e); batR.setMatrixAt(i, _m.compose(_p, _q, _s.set(1, 1, 1)));
      });
      batL.instanceMatrix.needsUpdate = batR.instanceMatrix.needsUpdate = true;
      batL.visible = batR.visible = n > 0.4 && h > 17 && h < 23;
    },
  };
}
