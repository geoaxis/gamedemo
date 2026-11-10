import * as THREE from 'three';
import { Builder, cyl, ico, sph, box, cone, getMat } from '../models/build.js';
import { CANAL, BRIDGES, ROAD, POND, TUBEWELL, HALF } from '../data/layout.js';
import { heightAt } from './terrain.js';
import { addCircle } from '../systems/collision.js';
import { makeRng } from '../util/rng.js';

// Trees of the Punjab plain, each modelled once and drawn many times with instancing.

const BARK = '#6a5440';

const makers = {
  // Sheesham (tahli): tall, airy, yellow-green; the classic shade tree of the canal colonies.
  sheesham(b) {
    b.add(cyl(0.2, 0.3, 3.2, BARK, 6, { y: 1.6 }));
    b.add(cyl(0.13, 0.2, 2.6, BARK, 5, { x: 0.45, y: 4.2, rz: -0.38 }));
    b.add(cyl(0.11, 0.18, 2.4, BARK, 5, { x: -0.45, y: 4.1, rz: 0.42 }));
    const g = ['#6fa043', '#5f8f3a', '#7dad4b'];
    b.add(ico(2.3, g[0], 1, { x: 0.9, y: 6.4, z: 0.2, sy: 0.85 }));
    b.add(ico(2.1, g[1], 1, { x: -1.3, y: 6.0, z: -0.4, sy: 0.85 }));
    b.add(ico(1.9, g[2], 1, { x: 0, y: 7.6, z: 0.6 }));
    b.add(ico(1.6, g[1], 0, { x: 0.3, y: 5.6, z: -1.6 }));
    b.add(ico(1.5, g[0], 0, { x: -0.4, y: 5.8, z: 1.7 }));
  },
  // Kikar (acacia): dark leaning trunk and a flat, sparse, grey-green crown.
  kikar(b) {
    b.add(cyl(0.16, 0.24, 3.0, '#4a3b30', 6, { x: 0.3, y: 1.45, rz: -0.2 }));
    b.add(cyl(0.1, 0.15, 1.8, '#4a3b30', 5, { x: 1.0, y: 3.5, rz: -0.75 }));
    b.add(cyl(0.1, 0.15, 1.8, '#4a3b30', 5, { x: 0.1, y: 3.6, rz: 0.5 }));
    b.add(ico(2.2, '#7d9156', 1, { x: 1.6, y: 4.5, sy: 0.38 }));
    b.add(ico(2.0, '#6f854b', 1, { x: -0.6, y: 4.7, z: 0.5, sy: 0.4 }));
    b.add(ico(1.6, '#869a5e', 0, { x: 0.6, y: 5.2, z: -0.9, sy: 0.4 }));
  },
  // Mango: short thick trunk, dense dark dome.
  mango(b) {
    b.add(cyl(0.3, 0.42, 2.4, '#5a4636', 7, { y: 1.2 }));
    b.add(ico(3.3, '#3f6b2c', 1, { y: 4.6, sy: 0.82 }));
    b.add(ico(2.2, '#497833', 1, { x: 2.0, y: 3.9, z: 0.6, sy: 0.8 }));
    b.add(ico(2.2, '#38622a', 1, { x: -1.9, y: 4.0, z: -0.8, sy: 0.8 }));
  },
  // Safeda (eucalyptus): planted in rows along roads.
  safeda(b) {
    b.add(cyl(0.12, 0.24, 11, '#cfc6b4', 6, { y: 5.5 }));
    b.add(ico(1.5, '#6f9160', 1, { y: 8.2, sy: 1.9 }));
    b.add(ico(1.2, '#7b9c6a', 0, { x: 0.5, y: 11.2, sy: 1.7 }));
    b.add(ico(1.0, '#64875a', 0, { x: -0.6, y: 6.2, z: 0.4, sy: 1.5 }));
  },
  // Khajoor (date palm).
  khajoor(b) {
    for (let i = 0; i < 6; i++) b.add(cyl(0.2 - i * 0.012, 0.22 - i * 0.012, 1.25, i % 2 ? '#7a6248' : '#6d573f', 6, { y: 0.62 + i * 1.22 }));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const g = box(0.5, 0.05, 3.0, i % 2 ? '#4f7a2f' : '#5c8a36', { z: 1.5, rx: 0.45 });
      g.rotateY(a); g.translate(0, 7.5, 0);
      b.add(g);
    }
    b.add(sph(0.45, '#4f7a2f', { y: 7.5 }));
    b.add(sph(0.22, '#d98a2b', { x: 0.35, y: 7.0 }));
    b.add(sph(0.22, '#d98a2b', { x: -0.3, y: 7.0, z: 0.25 }));
  },
  // Kinnow orange tree, heavy with fruit in February.
  kinnow(b) {
    b.add(cyl(0.09, 0.13, 1.0, '#5a4636', 5, { y: 0.5 }));
    b.add(ico(1.5, '#2f6a2c', 1, { y: 2.0, sy: 0.9 }));
    const rng = makeRng(11);
    for (let i = 0; i < 16; i++) {
      const a = rng() * Math.PI * 2, e = rng.range(-0.5, 0.9);
      b.add(ico(0.11, '#f08a1c', 0, { x: Math.cos(a) * Math.cos(e) * 1.45, y: 2.0 + Math.sin(e) * 1.3, z: Math.sin(a) * Math.cos(e) * 1.45 }));
    }
  },
  // Sarkanda: tall reed grass with feathery plumes on canal banks.
  sarkanda(b) {
    const rng = makeRng(5);
    for (let i = 0; i < 9; i++) {
      const a = rng() * Math.PI * 2, lean = rng.range(0.1, 0.45), h = rng.range(1.6, 2.6);
      const g = cone(0.07, h, i % 2 ? '#9aa45a' : '#b3a865', 4, { y: h / 2, rz: lean });
      g.rotateY(a);
      b.add(g);
      if (i % 3 === 0) {
        const p = cone(0.12, 0.7, '#e9dfc2', 4, { y: h + 0.3, rz: lean });
        p.rotateY(a);
        b.add(p);
      }
    }
  },
};

const trunkRadius = { sheesham: 0.38, kikar: 0.34, mango: 0.5, safeda: 0.3, khajoor: 0.3, kinnow: 0.25, sarkanda: 0 };
const pending = Object.fromEntries(Object.keys(makers).map((k) => [k, []]));
const spin = makeRng(77);

export function addTree(type, x, z, s = 1, solid = true) {
  pending[type].push({ x, z, s, rot: spin() * Math.PI * 2 });
  if (solid && trunkRadius[type] > 0) addCircle(x, z, trunkRadius[type] * s);
}

// The old banyan (bohr) in the square: one of a kind, so built as its own mesh.
export function banyan(scene, x, z) {
  const b = new Builder();
  const rng = makeRng(3);
  b.push(x, 0, z);
  b.add(cyl(0.9, 1.4, 4.2, '#6b5a4a', 9, { y: 2.1 }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    b.add(cyl(0.3, 0.42, 4.0, '#665545', 6, { x: Math.cos(a) * 1.0, y: 2.0, z: Math.sin(a) * 1.0 }));
    const limb = cyl(0.22, 0.4, 6.5, '#665545', 6, { x: 2.8, y: 1.6, rz: -1.05 });
    limb.rotateY(a); limb.translate(0, 3.6, 0);
    b.add(limb);
    // aerial roots hanging from the limbs
    for (let k = 0; k < 2; k++) {
      const r = 3.6 + k * 2.0 + rng() * 0.8, h = 4.2 + rng() * 1.2;
      b.add(cyl(0.035, 0.05, h, '#7a6957', 4, { x: Math.cos(a + 0.1) * r, y: 6.3 - h / 2, z: -Math.sin(a + 0.1) * r }));
    }
  }
  const greens = ['#3d6a2e', '#467536', '#35602a', '#4f7f3a'];
  for (let i = 0; i < 20; i++) {
    const a = rng() * Math.PI * 2, r = rng.range(1.5, 8.2);
    b.add(ico(rng.range(2.4, 3.6), rng.pick(greens), 1, { x: Math.cos(a) * r, y: rng.range(7.0, 9.6) - r * 0.12, z: Math.sin(a) * r, sy: 0.72 }));
  }
  b.add(ico(4.2, greens[0], 1, { y: 10.2, sy: 0.7 }));
  b.pop();
  scene.add(b.build());
  addCircle(x, z, 1.5);
}

export function scatterTrees() {
  const rng = makeRng(2024);
  const nearBridge = (z) => BRIDGES.some((b) => Math.abs(z - b.z) < b.half + 9);

  // Along the canal: trees at the foot of the banks, reeds at the water's edge.
  for (const side of [-1, 1]) {
    for (let z = -HALF + 6; z < HALF; z += rng.range(11, 24)) {
      if (nearBridge(z)) continue;
      addTree(rng.chance(0.55) ? 'kikar' : 'sheesham', CANAL.x + side * rng.range(14.5, 17), z, rng.range(0.85, 1.25));
    }
    for (let z = -HALF + 3; z < HALF; z += rng.range(5, 13)) {
      if (nearBridge(z)) continue;
      addTree('sarkanda', CANAL.x + side * rng.range(7.7, 8.3), z, rng.range(0.8, 1.3));
    }
  }

  // Eucalyptus rows along the paved road.
  for (const side of [-1, 1]) {
    for (let x = -HALF - 150; x < HALF + 150; x += 12) {
      if (Math.abs(x - CANAL.x) < 44) continue;
      if (side < 0 && x > 22 && x < 116) continue;
      addTree('safeda', x + rng.range(-1, 1), ROAD.z + side * rng.range(7.6, 8.6), rng.range(0.85, 1.15));
    }
  }

  // Sheesham shading the lane from the road to the village.
  for (let z = 84; z < 146; z += 15) {
    addTree('sheesham', 55.6, z + rng.range(-2, 2), rng.range(0.9, 1.1));
    addTree('sheesham', 64.4, z + 7 + rng.range(-2, 2), rng.range(0.9, 1.1));
  }

  // Kinnow orchard between the village and the canal.
  for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 10; iz++) {
    addTree('kinnow', -35 + ix * 6.5 + rng.range(-0.4, 0.4), -50 + iz * 6.2 + rng.range(-0.4, 0.4), rng.range(0.85, 1.15));
  }

  // Round the pond.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const r = POND.r + rng.range(4.5, 7);
    addTree(rng.pick(['kikar', 'sheesham', 'khajoor', 'kikar']), POND.x + Math.cos(a) * r * 1.15, POND.z + Math.sin(a) * r * 0.9, rng.range(0.9, 1.2));
  }
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2;
    addTree('sarkanda', POND.x + Math.cos(a) * (POND.r + 1.2) * 1.15, POND.z + Math.sin(a) * (POND.r + 1.2) * 0.9, rng.range(0.7, 1.1));
  }

  // Shade at the tube well.
  addTree('mango', TUBEWELL.x - 11, TUBEWELL.z - 5.5, 1.15);
  addTree('sheesham', TUBEWELL.x + 8, TUBEWELL.z + 9, 1.1);
  addTree('sheesham', TUBEWELL.x - 5, TUBEWELL.z + 13, 1.0);
  addTree('khajoor', TUBEWELL.x + 10, TUBEWELL.z - 9, 1.0);
  addTree('khajoor', TUBEWELL.x + 12.5, TUBEWELL.z - 6, 0.85);

  // Far tree line so the horizon is never bare.
  for (let i = 0; i < 260; i++) {
    const a = rng() * Math.PI * 2, r = rng.range(HALF + 25, HALF + 260);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x - CANAL.x) < 20 || Math.abs(z - ROAD.z) < 9) continue;
    addTree(rng.pick(['sheesham', 'kikar', 'sheesham', 'safeda', 'mango']), x, z, rng.range(0.9, 1.5), false);
  }
}

export function buildTrees(scene) {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  for (const [type, list] of Object.entries(pending)) {
    if (!list.length) continue;
    const b = new Builder();
    makers[type](b);
    const mesh = new THREE.InstancedMesh(b.geometry(), getMat('flat'), list.length);
    list.forEach((t, i) => {
      dummy.position.set(t.x, heightAt(t.x, t.z) - 0.05, t.z);
      dummy.rotation.set(0, t.rot, 0);
      dummy.scale.setScalar(t.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  scene.add(group);
  return group;
}
