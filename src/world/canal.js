import * as THREE from 'three';
import { CANAL, BRIDGES, POND } from '../data/layout.js';
import { Builder, box, tbox, raw } from '../models/build.js';
import { getTexture } from '../models/textures.js';
import { addBox } from '../systems/collision.js';

// One sloped strip of the bank cross-section, running the whole length of the canal.
function bankStrip(d0, y0, d1, y1, side, color) {
  const L = 420;
  const x0 = CANAL.x + side * d0, x1 = CANAL.x + side * d1;
  const pts = side > 0
    ? [x0, y0, -L, x0, y0, L, x1, y1, L, x1, y1, -L]
    : [x0, y0, -L, x1, y1, -L, x1, y1, L, x0, y0, L];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return raw(g, color);
}

function brickBridge(b, br) {
  const len = 10.5, top = b.deck + 0.65;
  const s = new THREE.Shape();
  s.moveTo(-len, 0.2);
  for (const [a, c] of [[-5.6, -0.5], [0.5, 5.6]]) {
    s.lineTo(a, 0.2); s.lineTo(a, 0.7);
    s.quadraticCurveTo((a + c) / 2, 2.0, c, 0.7);
    s.lineTo(c, 0.2);
  }
  s.lineTo(len, 0.2); s.lineTo(len, top); s.lineTo(-len, top); s.closePath();

  br.push(CANAL.x, 0, b.z);
  for (const side of [-1, 1]) {
    const wall = new THREE.ExtrudeGeometry(s, { depth: 0.36, bevelEnabled: false, curveSegments: 8 });
    wall.translate(0, 0, side > 0 ? b.half : -b.half - 0.36);
    br.add(raw(wall), 'brick');
    // coping stones along the top and the white plaque seen on canal bridges
    br.add(box(len * 2, 0.08, 0.46, '#c9bda6', { y: top + 0.04, z: side * (b.half + 0.18) }));
    br.add(box(0.5, 0.36, 0.04, '#efe9da', { y: 1.75, z: side * (b.half + 0.38) }));
  }
  br.add(tbox(len * 2, 0.3, b.half * 2, 1, { y: b.deck - 0.15 }), 'brick');
  br.add(tbox(1.0, 1.5, b.half * 2, 1, { y: 0.75 }), 'brick');
  for (const side of [-1, 1]) br.add(tbox(4.9, 1.5, b.half * 2, 1, { x: side * 8.05, y: 0.75 }), 'brick');
  br.pop();
}

function roadBridge(b, br) {
  const len = 10.5;
  br.push(CANAL.x, 0, b.z);
  br.add(box(len * 2, 0.4, b.half * 2 + 0.6, '#a9a59c', { y: b.deck - 0.2 }));
  for (const x of [-3.2, 3.2]) br.add(box(0.8, 1.5, b.half * 2 - 1, '#98948b', { x, y: 0.75 }));
  for (const side of [-1, 1]) {
    const z = side * (b.half + 0.1);
    // black and yellow kerb blocks, then a white post-and-rail parapet
    for (let i = 0; i < 21; i++) {
      br.add(box(1, 0.18, 0.3, i % 2 ? '#f2c230' : '#2a2a2a', { x: -len + 0.5 + i, y: b.deck + 0.09, z }));
    }
    for (let i = 0; i <= 10; i++) br.add(box(0.16, 0.8, 0.16, '#e8e4da', { x: -len + 0.25 + i * 2.05, y: b.deck + 0.58, z }));
    for (const y of [0.55, 0.9]) br.add(box(len * 2, 0.08, 0.1, '#e8e4da', { y: b.deck + y, z }));
  }
  br.pop();
}

export function buildCanal(scene) {
  const group = new THREE.Group();
  const b = new Builder();

  for (const side of [-1, 1]) {
    b.add(bankStrip(5.6, 0.1, CANAL.bankIn, CANAL.h, side, '#8f7f56'));
    b.add(bankStrip(CANAL.bankIn, CANAL.h, CANAL.bankOut, CANAL.h, side, '#c2ab84'));
    b.add(bankStrip(CANAL.bankOut, CANAL.h, CANAL.toe, 0.0, side, '#a7a468'));
  }
  for (const br of BRIDGES) {
    if (br.kind === 'brick') brickBridge(br, b); else roadBridge(br, b);
    for (const side of [-1, 1]) {
      const z = br.z + side * (br.half + 0.18);
      addBox(CANAL.x - 10.5, z - 0.18, CANAL.x + 10.5, z + 0.18);
    }
  }
  group.add(b.build());

  // Slow, silty water.
  const tex = getTexture('water').clone();
  tex.repeat.set(2, 140);
  tex.needsUpdate = true;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(CANAL.water * 2, 840).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ map: tex, emissive: 0x2a2218 }),
  );
  water.position.set(CANAL.x, CANAL.waterY, 0);
  water.receiveShadow = true;
  group.add(water);

  // The village pond: still, greenish water with a muddy rim.
  const pondTex = getTexture('water').clone();
  pondTex.repeat.set(5, 5);
  pondTex.needsUpdate = true;
  const rim = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 2.2, 28).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8c7a58 }));
  rim.position.set(POND.x, 0.02, POND.z);
  rim.scale.set(1.15, 1, 0.9);
  rim.receiveShadow = true;
  const pond = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 28).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: pondTex, color: 0xc4d0a0, emissive: 0x1c2214 }));
  pond.position.set(POND.x, 0.05, POND.z);
  pond.scale.set(1.15, 1, 0.9);
  pond.receiveShadow = true;
  group.add(rim, pond);

  scene.add(group);
  return {
    group,
    update(dt) {
      tex.offset.y -= dt * 0.02;
      pondTex.offset.x += dt * 0.002;
    },
  };
}
