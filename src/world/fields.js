import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder, box, tbox, tintGradient, tint } from '../models/build.js';
import { FIELD_BLOCKS } from '../data/layout.js';
import { addTree } from './trees.js';
import { makeRng } from '../util/rng.js';

// Late-February crops: young green wheat, mustard in flower, standing sugarcane,
// berseem fodder, a few ploughed plots and one being flooded from the tube well.

const CROPS = {
  wheat: { soil: '#5e9a35', spacing: 1.05, weight: 46 },
  mustard: { soil: '#9aa832', spacing: 1.1, weight: 16 },
  sugarcane: { soil: '#6f6a3c', spacing: 1.25, weight: 14 },
  berseem: { soil: '#3f8a2f', spacing: 0.95, weight: 12 },
  ploughed: { soil: '#9b7d58', spacing: 0, weight: 9 },
  flooded: { soil: '#7f8672', spacing: 2.2, weight: 0 },
};

function strip(g) {
  const out = g.index ? g.toNonIndexed() : g;
  out.deleteAttribute('uv');
  return out;
}

function tuftGeometry(crop) {
  const parts = [];
  const lean = (g, a, tilt) => { g.rotateZ(tilt); g.rotateY(a); return g; };
  if (crop === 'wheat') {
    for (let i = 0; i < 3; i++) {
      const g = new THREE.ConeGeometry(0.34, 0.8, 4, 1, true).translate(0, 0.4, 0);
      parts.push(tintGradient(strip(lean(g, i * 2.1, 0.22)), '#3f7f26', '#93c957'));
    }
  } else if (crop === 'mustard') {
    for (let i = 0; i < 3; i++) {
      const g = new THREE.CylinderGeometry(0.34, 0.08, 1.15, 5, 1, false).translate(0, 0.575, 0);
      parts.push(tintGradient(strip(lean(g, i * 2.1, 0.2)), '#3f7f26', '#f6cf12'));
    }
  } else if (crop === 'sugarcane') {
    for (let i = 0; i < 3; i++) {
      const s = new THREE.CylinderGeometry(0.035, 0.045, 2.3, 3).translate(0, 1.15, 0);
      parts.push(tint(strip(lean(s, i * 2.1, 0.08)), '#a7a852'));
      const l = new THREE.ConeGeometry(0.42, 1.9, 4, 1, true).rotateX(Math.PI).translate(0, 2.4, 0);
      parts.push(tintGradient(strip(lean(l, i * 2.1 + 0.7, 0.16)), '#4c8a2e', '#7fb64a'));
    }
  } else if (crop === 'berseem') {
    parts.push(tintGradient(strip(new THREE.SphereGeometry(0.6, 5, 2, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1)), '#2f7526', '#58a83a'));
  } else if (crop === 'flooded') {
    const g = new THREE.ConeGeometry(0.1, 0.4, 3, 1, true).translate(0, 0.25, 0);
    parts.push(tintGradient(strip(g), '#4c8a2e', '#8cc152'));
  }
  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  return merged;
}

export function buildFields(scene) {
  const rng = makeRng(4747);
  const group = new THREE.Group();
  const land = new Builder();
  const plots = [];

  const names = Object.keys(CROPS).filter((k) => CROPS[k].weight > 0);
  const total = names.reduce((s, k) => s + CROPS[k].weight, 0);
  const pickCrop = () => {
    let r = rng() * total;
    for (const k of names) { r -= CROPS[k].weight; if (r <= 0) return k; }
    return 'wheat';
  };

  const BUND = 1.3;
  for (const blk of FIELD_BLOCKS) {
    const cw = (blk.x1 - blk.x0) / blk.nx, cd = (blk.z1 - blk.z0) / blk.nz;
    for (let i = 0; i < blk.nx; i++) for (let j = 0; j < blk.nz; j++) {
      const x0 = blk.x0 + i * cw + BUND / 2, x1 = blk.x0 + (i + 1) * cw - BUND / 2;
      const z0 = blk.z0 + j * cd + BUND / 2, z1 = blk.z0 + (j + 1) * cd - BUND / 2;
      const crop = i === 0 && j === 0 && blk.first ? blk.first : pickCrop();
      plots.push({ x0, x1, z0, z1, crop });
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
      land.add(tbox(w, 0.08, d, 1.5, { x: cx, y: 0.02, z: cz }, CROPS[crop].soil), 'furrow');
      // raised mud bunds on all four sides
      const mud = '#b39a70';
      land.add(box(w + BUND * 2, 0.3, BUND * 0.8, mud, { x: cx, y: 0.13, z: z0 - BUND / 2 }));
      land.add(box(w + BUND * 2, 0.3, BUND * 0.8, mud, { x: cx, y: 0.13, z: z1 + BUND / 2 }));
      land.add(box(BUND * 0.8, 0.3, d, mud, { x: x0 - BUND / 2, y: 0.13, z: cz }));
      land.add(box(BUND * 0.8, 0.3, d, mud, { x: x1 + BUND / 2, y: 0.13, z: cz }));
      if (rng.chance(0.3)) addTree(rng.pick(['sheesham', 'kikar', 'kikar', 'khajoor', 'sheesham']), x0 - BUND / 2, z0 - BUND / 2, rng.range(0.85, 1.2));
    }
  }
  const landMesh = land.build({ cast: false });
  group.add(landMesh);

  // Crop material: flat-shaded vertex colours, bending gently in the breeze.
  const wind = { value: 0 };
  const cropMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  cropMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23;
        float bend = transformed.y * transformed.y;
        transformed.x += sin(uTime * 1.7 + ph) * 0.07 * bend;
        transformed.z += cos(uTime * 1.3 + ph * 1.3) * 0.05 * bend;
      #endif`,
    );
  };

  const geos = {};
  const dummy = new THREE.Object3D();
  for (const p of plots) {
    const def = CROPS[p.crop];
    if (!def.spacing) continue;
    geos[p.crop] ||= tuftGeometry(p.crop);
    const sp = def.spacing;
    const nx = Math.floor((p.x1 - p.x0 - 0.6) / sp), nz = Math.floor((p.z1 - p.z0 - 0.6) / sp);
    const mesh = new THREE.InstancedMesh(geos[p.crop], cropMat, nx * nz);
    let k = 0;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      dummy.position.set(p.x0 + 0.3 + (i + 0.5) * sp + rng.range(-0.12, 0.12), 0.05, p.z0 + 0.3 + (j + 0.5 + rng.range(-0.3, 0.3)) * sp);
      dummy.rotation.set(0, rng() * 6.28, 0);
      const s = rng.range(0.85, 1.2);
      dummy.scale.set(s, rng.range(0.85, 1.15), s);
      dummy.updateMatrix();
      mesh.setMatrixAt(k++, dummy.matrix);
    }
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Standing water on the plot being irrigated.
  for (const p of plots.filter((q) => q.crop === 'flooded')) {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(p.x1 - p.x0, p.z1 - p.z0).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x9aa59a, transparent: true, opacity: 0.78 }),
    );
    water.position.set((p.x0 + p.x1) / 2, 0.1, (p.z0 + p.z1) / 2);
    group.add(water);
  }

  scene.add(group);
  return { group, plots, update(time) { wind.value = time; } };
}
