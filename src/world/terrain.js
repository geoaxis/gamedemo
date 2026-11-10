import * as THREE from 'three';
import { CANAL, BRIDGES, ROAD, LANES } from '../data/layout.js';
import { getTexture } from '../models/textures.js';
import { smooth } from '../util/rng.js';

// The land is flat (it is the Punjab plain) apart from the canal banks and bridge ramps.
export function heightAt(x, z) {
  const d = Math.abs(x - CANAL.x);
  let h = 0;
  if (d < CANAL.toe) {
    h = d >= CANAL.bankOut ? CANAL.h * (1 - (d - CANAL.bankOut) / (CANAL.toe - CANAL.bankOut)) : CANAL.h;
  }
  for (const b of BRIDGES) {
    if (Math.abs(z - b.z) <= b.half && d < b.approach) {
      const hb = d <= b.span ? b.deck : b.deck * (1 - smooth((d - b.span) / (b.approach - b.span)));
      if (hb > h) h = hb;
    }
  }
  return h;
}

// What is underfoot: decides the footstep sound.
export function surfaceAt(x, z) {
  if (Math.abs(z - ROAD.z) < ROAD.half) return 'asphalt';
  for (const l of LANES) {
    if (l.kind !== 'brick') continue;
    const [[ax, az], [bx, bz]] = l.pts;
    const hw = l.w / 2;
    if (x >= Math.min(ax, bx) - hw && x <= Math.max(ax, bx) + hw && z >= Math.min(az, bz) - hw && z <= Math.max(az, bz) + hw) {
      return 'brick';
    }
  }
  return 'dirt';
}

// A flat strip laid along a straight line that follows the ground height.
export function ribbon([ax, az], [bx, bz], width, tile, yOff = 0.03, step = 2) {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(len / step));
  const dx = (bx - ax) / len, dz = (bz - az) / len;
  const px = -dz * (width / 2), pz = dx * (width / 2);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * len;
    const cx = ax + dx * t, cz = az + dz * t;
    const y = heightAt(cx, cz) + yOff;
    pos.push(cx + px, y, cz + pz, cx - px, y, cz - pz);
    uv.push(0, t / tile, width / tile, t / tile);
    if (i < n) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Earth ramp that carries a lane or the road up to bridge height on one side of the canal.
function embankment(b, side) {
  const pos = [], idx = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const d = b.span - 1 + ((b.approach - b.span + 1) * i) / n;
    const x = CANAL.x + side * d;
    const h = Math.max(0.001, heightAt(x, b.z));
    const out = b.half + h * 1.4;
    pos.push(x, 0, b.z - out, x, h - 0.02, b.z - b.half, x, h - 0.02, b.z + b.half, x, 0, b.z + out);
    if (i < n) {
      const k = i * 4;
      for (let j = 0; j < 3; j++) {
        const a = k + j, c = k + j + 4;
        if (side > 0) idx.push(a, a + 1, c, a + 1, c + 1, c);
        else idx.push(a, c, a + 1, a + 1, c, c + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildTerrain(scene) {
  const group = new THREE.Group();

  const dirt = getTexture('dirt').clone();
  dirt.repeat.set(200, 200);
  dirt.needsUpdate = true;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ map: dirt }),
  );
  ground.receiveShadow = true;
  group.add(ground);

  const mat = (name, color = 0xffffff) => new THREE.MeshLambertMaterial({ map: getTexture(name), color });
  const lay = (g, m) => { const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; group.add(mesh); };

  const earth = new THREE.MeshLambertMaterial({ color: 0xb59f78 });
  for (const b of BRIDGES) for (const side of [-1, 1]) lay(embankment(b, side), earth);

  const brick = mat('soling'), track = mat('track'), asphalt = mat('asphalt');
  for (const l of LANES) {
    lay(ribbon(l.pts[0], l.pts[1], l.w, l.kind === 'brick' ? 1 : l.w), l.kind === 'brick' ? brick : track);
  }

  // Paved road with packed-earth shoulders on both sides.
  lay(ribbon([-420, ROAD.z], [420, ROAD.z], ROAD.half * 2 + 3.2, 4, 0.02), new THREE.MeshLambertMaterial({ color: 0xb7a27c }));
  lay(ribbon([-420, ROAD.z], [420, ROAD.z], ROAD.half * 2, 4, 0.05), asphalt);

  scene.add(group);
  return group;
}
