import * as THREE from 'three';
import { Builder, box, tbox, cyl, torus } from '../models/build.js';
import { TUBEWELL } from '../data/layout.js';
import * as P from '../models/props.js';
import { getTexture } from '../models/textures.js';

// The tube well: a brick pump room, a single-cylinder diesel engine with a big flywheel,
// a fat delivery pipe and a brick tank that spills into a watercourse to the fields.

export function buildTubewell(scene) {
  const { x: X, z: Z } = TUBEWELL;
  const b = new Builder();
  b.push(X, 0, Z);

  // pump room
  b.add(tbox(3.4, 2.7, 3.4, 1, { x: -4.4, y: 1.35 }), 'brick');
  b.add(box(3.9, 0.2, 3.9, '#b9b4a8', { x: -4.4, y: 2.8 }));
  b.add(box(0.9, 1.9, 0.08, '#5a3f28', { x: -4.4, y: 0.95, z: 1.72 }));
  b.add(box(0.8, 0.9, 0.08, '#4e3520', { x: -2.68, y: 1.6, rz: 0, ry: Math.PI / 2 }));
  for (let i = 0; i < 5; i++) b.add(box(0.1, 0.05, 0.86, '#2a2018', { x: -2.64, y: 1.25 + i * 0.18 }));
  P.solidBox(b, 1.7, 1.7, -4.4, 0);

  // engine on a concrete pad under a tin roof
  b.add(box(3.0, 0.16, 2.4, '#aaa397', { x: -0.9, y: 0.08 }));
  b.add(box(1.0, 0.7, 0.6, '#2f5a3f', { x: -1.2, y: 0.55 }));
  b.add(box(0.5, 0.45, 0.5, '#2f5a3f', { x: -1.2, y: 1.1 }));
  b.add(cyl(0.16, 0.16, 0.3, '#3a3a3a', 8, { x: -1.2, y: 1.45 }));
  b.add(cyl(0.035, 0.035, 1.5, '#2a2a2a', 6, { x: -0.75, y: 1.6 }));
  b.add(cyl(0.09, 0.09, 0.3, '#5a5a5a', 8, { x: -0.75, y: 2.4 }));
  b.add(box(0.6, 0.5, 0.5, '#5d6164', { x: -0.1, y: 0.42 }));
  for (const [px, pz] of [[-2.3, -1.1], [0.5, -1.1], [-2.3, 1.1], [0.5, 1.1]]) b.add(cyl(0.04, 0.04, 2.6, '#6c6a64', 5, { x: px, y: 1.3, z: pz }));
  b.add(box(3.3, 0.05, 2.8, '#9aa3a6', { x: -0.9, y: 2.62, rz: 0.06 }));
  P.solidBox(b, 1.3, 0.6, -0.9, 0);

  // delivery pipe and tank
  b.add(cyl(0.15, 0.15, 2.2, '#8a8f93', 8, { x: 1.1, y: 1.02, rz: Math.PI / 2 }));
  b.add(cyl(0.15, 0.15, 0.7, '#8a8f93', 8, { x: 0.1, y: 0.7 }));
  const tx = 3.8;
  for (const [cx, cz, lx, lz] of [[tx, -1.3, 3.4, 0.25], [tx, 1.3, 3.4, 0.25], [tx - 1.58, 0, 0.25, 2.4], [tx + 1.58, 0, 0.25, 2.4]]) {
    b.add(tbox(lx, 0.95, lz, 1, { x: cx, y: 0.475, z: cz }), 'brick');
  }
  b.add(box(3.0, 0.1, 2.4, '#8a8375', { x: tx, y: 0.05 }));
  P.solidBox(b, 1.75, 1.42, tx, 0);

  // watercourse (khala) from the tank down to the field being irrigated
  const kx = tx + 2.3;
  b.add(box(1.0, 0.24, 0.9, '#b39a70', { x: tx + 1.95, y: 0.12, z: 0.9 }));
  for (const s of [-1, 1]) b.add(box(0.35, 0.26, 19.5, '#b39a70', { x: kx + s * 0.5, y: 0.13, z: 10.6 }));

  // fodder cutter (toka) and a spade
  b.add(box(0.5, 0.7, 0.9, '#4e3520', { x: -7.2, y: 0.35, z: 3.6 }));
  b.add(torus(0.42, 0.035, '#2f5a3f', Math.PI * 2, { x: -6.88, y: 0.85, z: 3.6, ry: Math.PI / 2 }, 4, 12));
  b.add(box(0.03, 0.8, 0.05, '#2f5a3f', { x: -6.88, y: 0.85, z: 3.6 }));
  b.add(box(0.03, 0.05, 0.8, '#2f5a3f', { x: -6.88, y: 0.85, z: 3.6 }));
  P.fodderHeap(b, -7.6, 5.0, 0.8);
  P.solidCircle(b, 0.6, -7.2, 3.6);
  b.add(cyl(0.02, 0.02, 1.3, '#7a5230', 4, { x: -2.5, y: 0.65, z: 1.95, rx: 0.2 }));
  b.add(box(0.22, 0.28, 0.02, '#6c6a64', { x: -2.5, y: 0.14, z: 1.82, rx: 0.2 }));

  const charpai = P.charpai(b, -8.6, -3.6, 1.2);
  P.khurli(b, -10.5, 5.5, 0.2, 2.0);
  b.pop();
  scene.add(b.build());

  // flywheel spins when the engine runs
  const fw = new Builder();
  fw.add(torus(0.42, 0.06, '#8a1a1a', Math.PI * 2, {}, 5, 14));
  for (let i = 0; i < 3; i++) fw.add(box(0.8, 0.06, 0.04, '#8a1a1a', { rz: (i * Math.PI) / 3 }));
  const flywheel = fw.build().children[0];
  flywheel.castShadow = true;
  flywheel.position.set(X - 1.2, 0.62, Z + 0.36);
  scene.add(flywheel);

  // water: tank, the gush from the pipe, and the watercourse
  const waterMat = new THREE.MeshLambertMaterial({ map: getTexture('water'), color: 0xbfd0c8 });
  const tank = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.35).rotateX(-Math.PI / 2), waterMat);
  tank.position.set(X + tx, 0.5, Z);
  const khala = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 19.5).rotateX(-Math.PI / 2), waterMat);
  khala.position.set(X + kx, 0.12, Z + 10.6);
  const gushMat = new THREE.MeshLambertMaterial({ color: 0xe9f4f6, transparent: true, opacity: 0.85 });
  const gush = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.75, 7), gushMat);
  gush.position.set(X + 2.45, 0.72, Z);
  gush.rotation.z = 0.5;
  const foam = new THREE.Mesh(new THREE.SphereGeometry(0.34, 7, 5), gushMat);
  foam.position.set(X + 2.72, 0.52, Z);
  foam.scale.y = 0.5;
  scene.add(tank, khala, gush, foam);

  // puffs of exhaust
  const puffs = [];
  const puffMat = new THREE.MeshBasicMaterial({ color: 0x3a3a3a, transparent: true, opacity: 0.5 });
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), puffMat.clone());
    p.visible = false;
    p.userData.t = i / 5;
    scene.add(p);
    puffs.push(p);
  }

  const state = {
    on: false, level: 0, t: 0,
    x: X - 0.9, z: Z + 1.5, // where to stand to work the engine
    engine: { x: X - 1.2, z: Z },
    charpai,
    aslam: { x: X + 1.6, z: Z - 3.6, yaw: 0.4 },
    cow: { x: X - 10.2, z: Z + 3.8, yaw: 0.2 },
    toggle() { state.on = !state.on; return state.on; },
    update(dt) {
      state.t += dt;
      state.level += ((state.on ? 1 : 0) - state.level) * Math.min(1, dt * 1.5);
      const k = state.level;
      flywheel.rotation.z -= dt * 22 * k;
      flywheel.position.y = 0.62 + (state.on ? Math.sin(state.t * 33) * 0.004 : 0);
      gush.visible = foam.visible = k > 0.05;
      gush.scale.set(k, 1, k * (1 + Math.sin(state.t * 30) * 0.08));
      foam.scale.set(k * (1 + Math.sin(state.t * 17) * 0.15), 0.5, k * (1 + Math.cos(state.t * 13) * 0.15));
      tank.position.y = 0.42 + k * 0.4;
      khala.visible = k > 0.02;
      waterMat.map.offset.y -= dt * 0.25 * k;
      for (const p of puffs) {
        p.visible = k > 0.3;
        p.userData.t = (p.userData.t + dt * 0.9) % 1;
        const u = p.userData.t;
        p.position.set(X - 0.75 + u * 0.8, 2.6 + u * 1.8, Z + u * 0.3);
        p.scale.setScalar(1 + u * 3);
        p.material.opacity = 0.45 * (1 - u) * k;
      }
    },
  };
  return state;
}
