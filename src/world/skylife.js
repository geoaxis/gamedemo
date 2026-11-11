import * as THREE from 'three';
import { makeHuman } from '../models/human.js';
import { CHOWK } from '../data/layout.js';
import { wind } from '../systems/wind.js';
import { makeRng } from '../util/rng.js';

// Life overhead. It is February, Basant season: boys fly paper kites (patang) from the
// rooftops, and now and then one gets cut and drifts away over the fields. Someone's pigeons
// wheel round the village, and green parakeets shoot past in screaming flocks.

const rng = makeRng(2525);
const KITE_COLORS = [['#e81e2c', '#f7c81e'], ['#1f9d55', '#ffffff'], ['#7a2fb0', '#f08a1c'], ['#f7c81e', '#1f6fd0'], ['#e8459a', '#ffffff'], ['#1f6fd0', '#e81e2c'], ['#ffffff', '#1f9d55']];

function kiteGeometry([a, b]) {
  // a paper diamond in two colours on a bamboo frame, with a small tail
  const pos = [0, 0.42, 0, -0.34, 0, 0, 0, -0.5, 0, 0, 0.42, 0, 0, -0.5, 0, 0.34, 0, 0, 0, -0.5, 0, -0.08, -0.68, 0, 0.08, -0.68, 0];
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  const col = [];
  for (const c of [ca, ca, ca, cb, cb, cb, cb, cb, cb]) col.push(c.r, c.g, c.b);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function birdGeometry(span, body) {
  // one wing; mirrored for the other side
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, body, span, 0, -0.05, 0, 0, -body * 0.6], 3));
  g.computeVertexNormals();
  return g;
}

export function buildSkyLife(scene, { roofs = [] } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  const kiteMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const stringMat = new THREE.LineBasicMaterial({ color: 0xe8e2d0, transparent: true, opacity: 0.55 });

  // ---- kite flyers on the roofs ----
  const flyers = [];
  const picks = roofs.filter((r) => ['A', 'D', 'H', 'M', 'O', 'E'].includes(r.id));
  const looks = [
    { kameez: '#d9463d', shalwar: '#e9e4d6', scale: 0.7, moustache: false },
    { kameez: '#3d7ad9', scale: 0.75, moustache: false, waistcoat: '#2a2a2a' },
    { kameez: '#e2b84a', scale: 0.8, moustache: false, headwear: 'topi' },
    { kameez: '#6c7d5a', scale: 0.92, moustache: true },
    { kameez: '#8a3a5a', scale: 0.72, moustache: false },
    { kameez: '#e9e4d6', scale: 0.85, moustache: false, shoulderCloth: '#c9463d' },
  ];
  picks.forEach((r, i) => {
    const h = makeHuman(looks[i % looks.length]);
    const x = r.x + rng.range(-1.5, 1.5), z = r.z + rng.range(-1, 1);
    h.group.position.set(x, r.y, z);
    group.add(h.group);
    const L = rng.range(45, 80);
    const mesh = new THREE.Mesh(kiteGeometry(KITE_COLORS[i % KITE_COLORS.length]), kiteMat);
    mesh.scale.setScalar(2.2);
    group.add(mesh);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(17 * 3), 3));
    const line = new THREE.Line(sg, stringMat);
    line.frustumCulled = false;
    group.add(line);
    flyers.push({ h, x, z, y: r.y, L, mesh, line, t: rng() * 50, dive: 0, side: rng.range(-1, 1) });
  });

  // ---- a cut kite drifting downwind ----
  const loose = { mesh: new THREE.Mesh(kiteGeometry(['#f08a1c', '#ffffff']), kiteMat), x: 0, y: 0, z: 0, t: 0 };
  loose.mesh.scale.setScalar(2.2);
  group.add(loose.mesh);
  const resetLoose = () => {
    loose.x = CHOWK.x - wind.dir.x * 140 + rng.range(-60, 60);
    loose.z = CHOWK.z - wind.dir.y * 140 + rng.range(-60, 60);
    loose.y = rng.range(35, 55); loose.t = 0;
  };
  resetLoose();

  // ---- flocks ----
  const flocks = [];
  const flock = ({ n, color, span, body, cx, cz, r, h, speed, flap, wander }) => {
    const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
    const wingL = new THREE.InstancedMesh(birdGeometry(-span, body), mat, n);
    const wingR = new THREE.InstancedMesh(birdGeometry(span, body), mat, n);
    for (const m of [wingL, wingR]) { m.frustumCulled = false; group.add(m); }
    const birds = [];
    for (let i = 0; i < n; i++) birds.push({ ox: rng.range(-4, 4), oy: rng.range(-2, 2), oz: rng.range(-4, 4), ph: rng() * 6.28, lag: rng.range(0, 0.6) });
    flocks.push({ wingL, wingR, birds, cx, cz, r, h, speed, flap, wander, a: rng() * 6.28 });
  };
  // the pigeon fancier's flock over the middle of the village
  flock({ n: 28, color: 0x8a8d94, span: 0.32, body: 0.18, cx: 60, cz: 20, r: 55, h: 30, speed: 0.22, flap: 13, wander: 0.4 });
  flock({ n: 16, color: 0xd9d6cf, span: 0.32, body: 0.18, cx: 20, cz: -10, r: 35, h: 24, speed: -0.28, flap: 14, wander: 0.6 });
  // parakeets: fast, low, sweeping wide over the fields
  flock({ n: 14, color: 0x3aa04a, span: 0.2, body: 0.16, cx: -20, cz: 60, r: 140, h: 14, speed: 0.12, flap: 20, wander: 1 });

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  const hand = new THREE.Vector3(), kite = new THREE.Vector3();
  let reel = 1;

  return {
    update(dt, night, rain = 0) {
      group.visible = night < 0.7;
      if (!group.visible) return;
      // at the first drops the kites are hauled in and everyone goes downstairs; the
      // pigeons go home. When it clears up the boys come back up and fly again.
      const wantUp = rain < 0.08 ? 1 : 0;
      reel += (wantUp - reel) * Math.min(1, dt * (wantUp ? 0.12 : 0.35));
      const W = wind.strength, wx = wind.dir.x, wz = wind.dir.y;

      for (const f of flyers) {
        f.t += dt;
        // the kite rides high downwind of the flyer, swinging side to side; now and then
        // the boy tugs and it dives and climbs again
        if (f.dive <= 0 && rng() < dt * 0.05) f.dive = 2.5;
        f.dive -= dt;
        const dive = f.dive > 0 ? Math.sin((f.dive / 2.5) * Math.PI) * 0.45 : 0;
        const elev = 0.55 + W * 0.35 + Math.sin(f.t * 0.37) * 0.08 - dive;
        const swing = Math.sin(f.t * 0.23 + f.side * 3) * 0.5 + Math.sin(f.t * 1.1) * 0.08 + f.side * 0.3;
        const ca = Math.cos(swing), sa = Math.sin(swing);
        const dx = wx * ca - wz * sa, dz = wx * sa + wz * ca;
        const L = f.L * (0.95 + W * 0.1) * reel;
        const up = reel > 0.06;
        f.mesh.visible = f.line.visible = f.h.group.visible = up;
        if (!up) continue;
        kite.set(f.x + dx * Math.cos(elev) * L, f.y + 1.4 + Math.sin(elev) * L, f.z + dz * Math.cos(elev) * L);
        f.mesh.position.copy(kite);
        f.mesh.lookAt(f.x, f.y + 1.4, f.z);
        f.mesh.rotateZ(Math.sin(f.t * 2.3) * 0.25 + dive * 1.5);
        f.mesh.rotateX(-0.5);
        // the flyer faces the kite, arm up holding the string
        const hu = f.h;
        hu.group.rotation.y = Math.atan2(kite.x - f.x, kite.z - f.z);
        hu.update(dt, 0);
        hu.armR.rotation.x = -2.2 + Math.sin(f.t * 3) * 0.12 - (f.dive > 0 ? 0.4 : 0);
        hu.armL.rotation.x = -1.0;
        hu.head.rotation.x = -0.5;
        hand.set(0.25, 1.85, 0.3).applyMatrix4(hu.group.matrixWorld);
        // the string sags in a long curve
        const p = f.line.geometry.attributes.position;
        for (let i = 0; i <= 16; i++) {
          const t = i / 16;
          const sag = Math.sin(t * Math.PI) * L * 0.08;
          p.setXYZ(i, hand.x + (kite.x - hand.x) * t, hand.y + (kite.y - hand.y) * t - sag, hand.z + (kite.z - hand.z) * t);
        }
        p.needsUpdate = true;
      }

      // the cut kite: drifts downwind, rocking, slowly losing height
      loose.t += dt;
      loose.x += wx * (2 + W * 3) * dt;
      loose.z += wz * (2 + W * 3) * dt;
      loose.y -= dt * 0.6;
      loose.mesh.position.set(loose.x + Math.sin(loose.t * 0.7) * 3, loose.y + Math.sin(loose.t * 1.3) * 1.5, loose.z);
      loose.mesh.rotation.set(Math.sin(loose.t * 1.1) * 0.8, loose.t * 0.4, Math.sin(loose.t * 1.7) * 1.2);
      if (loose.y < 2 || Math.hypot(loose.x - CHOWK.x, loose.z - CHOWK.z) > 320) resetLoose();
      loose.mesh.visible = reel > 0.5;

      for (const fl of flocks) {
        fl.wingL.visible = fl.wingR.visible = reel > 0.3;
        fl.a += dt * fl.speed;
        const r = fl.r * (1 + Math.sin(fl.a * 0.7) * 0.25 * fl.wander);
        fl.birds.forEach((b, i) => {
          const a = fl.a - b.lag * fl.speed * 2;
          const bx = fl.cx + Math.cos(a) * r + b.ox, bz = fl.cz + Math.sin(a * (1 + fl.wander * 0.3)) * r * 0.7 + b.oz;
          const by = fl.h + b.oy + Math.sin(fl.a * 3 + b.ph) * 2;
          b.ph += dt * fl.flap;
          // flap, with the odd glide
          const glide = Math.sin(b.ph * 0.07) > 0.6;
          const flap = glide ? 0.1 : Math.sin(b.ph) * 0.7;
          // face the way the bird actually moved since last frame
          if (b.px !== undefined && (bx - b.px) ** 2 + (bz - b.pz) ** 2 > 1e-6) b.head = Math.atan2(bx - b.px, bz - b.pz);
          b.px = bx; b.pz = bz;
          const head = b.head || 0;
          _p.set(bx, by, bz);
          _e.set(0, head, flap); _q.setFromEuler(_e);
          fl.wingL.setMatrixAt(i, _m.compose(_p, _q, _s));
          _e.set(0, head, -flap); _q.setFromEuler(_e);
          fl.wingR.setMatrixAt(i, _m.compose(_p, _q, _s));
        });
        fl.wingL.instanceMatrix.needsUpdate = fl.wingR.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
