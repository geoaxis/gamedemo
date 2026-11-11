import * as THREE from 'three';
import { getTexture } from '../models/textures.js';
import { heightAt } from './terrain.js';
import { treeSpots } from './trees.js';
import { wind } from '../systems/wind.js';
import { makeRng, angDiff } from '../util/rng.js';

// Things the wind moves around the player: motes of dust in the sunlight, leaves coming
// down from the trees, plastic bags skittering along the ground, dust lifted by the gusts,
// and smoke from the rubbish heaps that are always smouldering somewhere.

const rng = makeRng(4242);

// All the soft puffs (smoke, dust, exhaust) are drawn as one cloud of points: one draw call
// instead of one per puff. Each puff is a small stand-in with the same fields a Sprite has
// (position, scale, material.color/opacity, visible), copied into the buffers every frame.
function makePuffs(scene, max) {
  const pos = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max), col = new Float32Array(max * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: 500 }, uMap: { value: getTexture('stain') } }]);
  const mat = new THREE.ShaderMaterial({
    uniforms, fog: true, transparent: true, depthWrite: false, vertexColors: true,
    vertexShader: /* glsl */ `
      attribute float size; attribute float alpha;
      varying float vA; varying vec3 vC;
      uniform float uScale;
      #include <fog_pars_vertex>
      void main() {
        vA = alpha; vC = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = min(size * uScale / max(0.1, -mvPosition.z), 256.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying float vA; varying vec3 vC;
      #include <fog_pars_fragment>
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a * vA;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vC, a);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 10;
  scene.add(points);
  const list = [];
  return {
    sprite(color) {
      const p = { position: new THREE.Vector3(), scale: new THREE.Vector3(1, 1, 1), material: { color: new THREE.Color(color), opacity: 0 }, visible: true };
      if (list.length < max) list.push(p);
      return p;
    },
    flush(camera, height) {
      // pixels per world unit at distance 1
      mat.uniforms.uScale.value = height / (2 * Math.tan((camera.fov * Math.PI) / 360));
      let n = 0;
      for (const p of list) {
        if (!p.visible || p.material.opacity < 0.003) continue;
        pos[n * 3] = p.position.x; pos[n * 3 + 1] = p.position.y; pos[n * 3 + 2] = p.position.z;
        size[n] = (p.scale.x + p.scale.y) * 0.5;
        alpha[n] = p.material.opacity;
        col[n * 3] = p.material.color.r; col[n * 3 + 1] = p.material.color.g; col[n * 3 + 2] = p.material.color.b;
        n++;
      }
      g.setDrawRange(0, n);
      for (const k of ['position', 'size', 'alpha', 'color']) g.attributes[k].needsUpdate = true;
    },
  };
}

export function buildAmbient(scene, { dumps = [], chulhas = [], renderer = null } = {}) {
  const puffs = makePuffs(scene, 512);
  const _sz = new THREE.Vector2();
  // ---- dust motes ----
  const MOTES = 500, R = 26;
  const mp = new Float32Array(MOTES * 3), mv = [];
  for (let i = 0; i < MOTES; i++) {
    mp[i * 3] = rng.range(-R, R); mp[i * 3 + 1] = rng.range(0.2, 6); mp[i * 3 + 2] = rng.range(-R, R);
    mv.push(rng() * 6.28);
  }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const moteMat = new THREE.PointsMaterial({ color: 0xf2e2c0, size: 0.06, map: getTexture('stain'), transparent: true, opacity: 0.6, depthWrite: false });
  const motes = new THREE.Points(mg, moteMat);
  motes.frustumCulled = false;
  motes.renderOrder = 10;
  scene.add(motes);

  // ---- falling leaves ----
  const trees = treeSpots(['sheesham', 'kikar', 'mango']);
  const LEAVES = 70;
  const leafGeo = new THREE.PlaneGeometry(0.07, 0.11);
  const leafMesh = new THREE.InstancedMesh(leafGeo, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), LEAVES);
  leafMesh.frustumCulled = false;
  const leaves = [];
  const leafCol = new THREE.Color();
  for (let i = 0; i < LEAVES; i++) {
    leaves.push({ x: 0, y: -10, z: 0, vy: 0, spin: 0, a: 0, rest: rng() * 6, life: 0 });
    leafMesh.setColorAt(i, leafCol.set(rng.pick(['#b89a4a', '#9a7a3a', '#c4a860', '#8a9a4a', '#a88a3a', '#7a8a3a'])));
  }
  scene.add(leafMesh);

  // ---- plastic bags blown along ----
  const bagGeo = new THREE.IcosahedronGeometry(0.16, 0).scale(1, 0.55, 0.8);
  const bags = ['#f2f2ee', '#d6409a', '#2f5fb0', '#f2f2ee', '#1c1c1c'].map((c) => {
    const m = new THREE.Mesh(bagGeo, new THREE.MeshLambertMaterial({ color: c, flatShading: true, transparent: true, opacity: 0.92 }));
    m.castShadow = true;
    scene.add(m);
    return { m, x: 0, z: 0, y: 0, vy: 0, life: 0, hop: 0, seed: rng() * 10 };
  });

  // ---- butterflies over the grass and the mustard ----
  const BF = 18;
  const wingGeo = (s) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.03, s * 0.07, 0, 0.05, s * 0.06, 0, -0.04, 0, 0, 0.03, s * 0.06, 0, -0.04, 0, 0, -0.03], 3));
    g.computeVertexNormals();
    return g;
  };
  const bfMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  const bfL = new THREE.InstancedMesh(wingGeo(-1), bfMat, BF), bfR = new THREE.InstancedMesh(wingGeo(1), bfMat, BF);
  const bfs = [];
  for (let i = 0; i < BF; i++) {
    const c = leafCol.set(rng.pick(['#f2d21e', '#f4f2ec', '#f08a1c', '#f2e8a0', '#e8e4f0']));
    bfL.setColorAt(i, c); bfR.setColorAt(i, c);
    bfs.push({ x: 1e5, z: 0, y: 0, tx: 0, tz: 0, ph: rng() * 6, yaw: 0, life: 0 });
  }
  for (const m of [bfL, bfR]) { m.frustumCulled = false; scene.add(m); }

  // ---- dust lifted by gusts ----
  const dust = [];
  for (let i = 0; i < 14; i++) {
    const s = puffs.sprite(0xc9b08a);
    s.visible = false;
    dust.push({ s, life: 0, max: 1 });
  }

  // ---- little clouds kicked up by feet and wheels ----
  const kicks = [];
  for (let i = 0; i < 40; i++) {
    const s = puffs.sprite(0xc4ab84);
    s.visible = false;
    kicks.push({ s, life: 0, max: 1, big: 1 });
  }
  let nextKick = 0;

  // ---- a dust devil (bagola) crossing the fields on a hot windy afternoon ----
  const devil = { on: false, x: 0, z: 0, t: 0, life: 0, parts: [] };
  for (let i = 0; i < 36; i++) {
    const s = puffs.sprite(0xc8ae86);
    s.visible = false;
    devil.parts.push({ s, h: i / 36, a: rng() * 6.28 });
  }

  // ---- smoke from the rubbish heaps ----
  const smoke = [];
  const sources = [
    ...dumps.map((d) => ({ x: d.x, z: d.z, y: 0.6, n: 9, color: 0xa8a49c, size: 1, meal: false })),
    // cooking fires in the yards: wood and dung smoke, thickest at breakfast and dinner
    ...chulhas.map(([x, z]) => ({ x, z, y: 0.7, n: 6, color: 0xc8c4bc, size: 0.6, meal: true })),
  ];
  for (const d of sources) {
    for (let i = 0; i < d.n; i++) {
      const s = puffs.sprite(d.color);
      smoke.push({ s, d, t: i / d.n });
    }
  }

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);

  function respawnLeaf(L, cam) {
    const near = [];
    for (let k = 0; k < 12; k++) {
      const t = trees[Math.floor(rng() * trees.length)];
      if ((t.x - cam.x) ** 2 + (t.z - cam.z) ** 2 < 45 * 45) near.push(t);
    }
    if (!near.length) { L.y = -10; L.rest = 1 + rng() * 2; return; }
    const t = rng.pick(near);
    const r = 2.5 * t.s;
    L.x = t.x + rng.range(-r, r); L.z = t.z + rng.range(-r, r);
    L.y = heightAt(L.x, L.z) + (t.type === 'kikar' ? 4.5 : 6) * t.s * rng.range(0.8, 1.1);
    L.vy = 0; L.spin = rng.range(2, 6); L.a = rng() * 6.28; L.life = 0; L.rest = rng.range(4, 12);
  }

  function respawnBag(b, cam) {
    // come in from upwind, out of sight
    const a = rng.range(-1.2, 1.2), d = rng.range(28, 38);
    const ux = -wind.dir.x, uz = -wind.dir.y;
    const ca = Math.cos(a), sa = Math.sin(a);
    b.x = cam.x + (ux * ca - uz * sa) * d;
    b.z = cam.z + (ux * sa + uz * ca) * d;
    b.y = 0; b.vy = 0; b.life = 0; b.hop = rng() * 3;
  }
  for (const b of bags) { b.x = 9999; }

  return {
    devil,
    // A puff of dust at a footstep or under a wheel; size 1 for a footstep.
    kick(x, z, size = 1) {
      const k = kicks[nextKick++ % kicks.length];
      k.s.position.set(x, heightAt(x, z) + 0.12 * size, z);
      k.s.material.color.set(0xc4ab84);
      k.max = k.life = 0.9 + size * 0.5;
      k.big = size; k.rise = 0.15;
      k.s.visible = true;
    },
    // a puff of exhaust or smoke in the air
    puff(x, y, z, size = 1, color = 0x3a3632) {
      const k = kicks[nextKick++ % kicks.length];
      k.s.position.set(x, y, z);
      k.s.material.color.set(color);
      k.max = k.life = 1.4 + size * 0.4;
      k.big = size; k.rise = 0.9;
      k.s.visible = true;
    },
    update(dt, cam, sky, camera) {
      const day = 1 - sky.night;
      const W = wind.strength;
      const wx = wind.dir.x, wz = wind.dir.y;

      // motes drift with the breeze; any that fall too far behind the camera wrap round
      for (let i = 0; i < MOTES; i++) {
        mv[i] += dt * 0.7;
        let x = mp[i * 3] + (wx * W * 1.4 + Math.sin(mv[i]) * 0.15) * dt;
        let y = mp[i * 3 + 1] + Math.sin(mv[i] * 1.3) * 0.12 * dt;
        let z = mp[i * 3 + 2] + (wz * W * 1.4 + Math.cos(mv[i] * 0.8) * 0.15) * dt;
        if (x - cam.x > R) x -= 2 * R; else if (x - cam.x < -R) x += 2 * R;
        if (z - cam.z > R) z -= 2 * R; else if (z - cam.z < -R) z += 2 * R;
        const g = heightAt(x, z);
        if (y > g + 6) y = g + 0.2; else if (y < g + 0.2) y = g + 6;
        mp[i * 3] = x; mp[i * 3 + 1] = y; mp[i * 3 + 2] = z;
      }
      mg.attributes.position.needsUpdate = true;
      moteMat.opacity = 0.55 * day * (0.5 + W * 0.6);

      // leaves
      leaves.forEach((L, i) => {
        if (L.y < -5) {
          L.rest -= dt;
          if (L.rest < 0) respawnLeaf(L, cam);
        } else {
          const g = heightAt(L.x, L.z) + 0.02;
          if (L.y > g) {
            L.life += dt;
            L.vy = Math.min(0.9, L.vy + dt * 2);
            const flutter = Math.sin(L.life * L.spin) * 0.6;
            L.x += (wx * W * 2.2 + Math.cos(L.life * 2.1) * flutter) * dt;
            L.z += (wz * W * 2.2 + Math.sin(L.life * 1.7) * flutter) * dt;
            L.y -= L.vy * (0.6 + 0.4 * Math.abs(Math.sin(L.life * L.spin))) * dt;
            L.a += dt * L.spin;
          } else {
            L.y = g; L.rest -= dt * 0.25;
            if (L.rest < 0) { L.y = -10; L.rest = rng() * 3; }
          }
        }
        _e.set(L.y > -5 && L.life > 0 ? Math.sin(L.a) * 1.2 : -Math.PI / 2, L.a, Math.cos(L.a * 0.7) * 0.8);
        _q.setFromEuler(_e);
        _p.set(L.x, L.y, L.z);
        leafMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      });
      leafMesh.instanceMatrix.needsUpdate = true;

      // bags: tumble downwind, hop in gusts, settle when the air goes still
      for (const b of bags) {
        const far = (b.x - cam.x) ** 2 + (b.z - cam.z) ** 2 > 45 * 45;
        if (far) { respawnBag(b, cam); continue; }
        b.life += dt;
        const local = wind.at(b.x, b.z);
        const push = Math.max(0, local - 0.35) * 4.5;
        b.x += wx * push * dt + Math.sin(b.life * 1.3 + b.seed) * 0.3 * push * dt;
        b.z += wz * push * dt + Math.cos(b.life * 1.1 + b.seed) * 0.3 * push * dt;
        b.hop -= dt;
        if (b.hop < 0 && b.y <= 0.001 && push > 0.6) { b.vy = rng.range(1, 2.5) * Math.min(1.5, push / 2); b.hop = rng.range(0.6, 3); }
        b.vy -= dt * 3.2;
        b.y = Math.max(0, b.y + b.vy * dt);
        if (b.y === 0) b.vy = 0;
        const g = heightAt(b.x, b.z);
        b.m.position.set(b.x, g + 0.06 + b.y, b.z);
        b.m.rotation.set(b.life * push * 1.7 + b.seed, b.life * 0.5, Math.sin(b.life * 2 + b.seed) * push * 0.5);
        b.m.scale.set(1, 0.8 + Math.sin(b.life * 7) * 0.2 * Math.min(1, push), 1);
      }

      // butterflies: jerky flight from point to point, wings beating fast; they keep near
      // the player in the day and are gone at night
      bfs.forEach((b, i) => {
        if ((b.x - cam.x) ** 2 + (b.z - cam.z) ** 2 > 22 * 22) {
          const a = rng() * 6.28, r = rng.range(4, 16);
          b.x = cam.x + Math.cos(a) * r; b.z = cam.z + Math.sin(a) * r; b.y = heightAt(b.x, b.z) + 0.6;
          b.tx = b.x; b.tz = b.z;
        }
        b.life -= dt;
        if (b.life < 0) { b.tx = b.x + rng.range(-3, 3); b.tz = b.z + rng.range(-3, 3); b.life = rng.range(0.6, 2.5); }
        const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz) || 1;
        const sp = 1.4 + W * 0.8;
        b.x += (dx / d) * sp * dt + wx * W * 0.6 * dt + Math.sin(b.ph * 0.37) * 0.6 * dt;
        b.z += (dz / d) * sp * dt + wz * W * 0.6 * dt + Math.cos(b.ph * 0.41) * 0.6 * dt;
        b.ph += dt * 26;
        const g = heightAt(b.x, b.z);
        b.y += (g + 0.5 + Math.sin(b.ph * 0.09) * 0.35 - b.y) * Math.min(1, dt * 3);
        b.yaw += angDiff(b.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 4);
        const flap = Math.sin(b.ph) * 1.1;
        _p.set(b.x, day > 0.3 ? b.y + Math.abs(Math.sin(b.ph * 0.5)) * 0.04 : -50, b.z);
        _e.set(0, b.yaw, flap); _q.setFromEuler(_e); bfL.setMatrixAt(i, _m.compose(_p, _q, _s));
        _e.set(0, b.yaw, -flap); _q.setFromEuler(_e); bfR.setMatrixAt(i, _m.compose(_p, _q, _s));
      });
      bfL.instanceMatrix.needsUpdate = bfR.instanceMatrix.needsUpdate = true;

      // dust lifts off the ground when a gust comes through
      for (const d of dust) {
        if (d.life > 0) {
          d.life -= dt;
          const u = 1 - d.life / d.max;
          d.s.position.x += wx * (2 + W * 4) * dt;
          d.s.position.z += wz * (2 + W * 4) * dt;
          d.s.position.y += dt * 0.25;
          const sc = 1.2 + u * 5;
          d.s.scale.set(sc * 1.4, sc * 0.7, 1);
          d.s.material.opacity = Math.sin(u * Math.PI) * 0.22 * day;
          d.s.visible = d.s.material.opacity > 0.005;
          if (d.life <= 0) d.s.visible = false;
        } else if (W > 0.72 && rng() < dt * 1.5 * (W - 0.6)) {
          const a = rng() * 6.28, r = rng.range(8, 30);
          const x = cam.x + Math.cos(a) * r, z = cam.z + Math.sin(a) * r;
          d.s.position.set(x, heightAt(x, z) + 0.5, z);
          d.max = d.life = rng.range(2.5, 4.5);
          d.s.visible = true;
        }
      }

      // dust devil
      if (!devil.on) {
        const h = sky.hours ?? 12;
        if (h > 12 && h < 17.5 && W > 0.55 && rng() < dt * 0.02) {
          const a = rng() * 6.28, r = rng.range(50, 110);
          devil.x = cam.x + Math.cos(a) * r; devil.z = cam.z + Math.sin(a) * r;
          devil.on = true; devil.t = 0; devil.life = rng.range(18, 30);
        }
      }
      for (const p of devil.parts) p.s.visible = devil.on;
      if (devil.on) {
        devil.t += dt;
        devil.x += (wx * 3 + Math.sin(devil.t * 0.4) * 1.5) * dt;
        devil.z += (wz * 3 + Math.cos(devil.t * 0.3) * 1.5) * dt;
        const fade = Math.min(1, devil.t / 4, (devil.life - devil.t) / 4);
        const g = heightAt(devil.x, devil.z);
        for (const p of devil.parts) {
          p.a += dt * (4 - p.h * 2.5);
          const r = 0.4 + p.h * p.h * 5;
          const lean = p.h * 4;
          p.s.position.set(devil.x + Math.cos(p.a) * r + wx * lean, g + p.h * 22 + 0.5, devil.z + Math.sin(p.a) * r + wz * lean);
          const sc = 1.5 + p.h * 6;
          p.s.scale.set(sc, sc * 0.8, 1);
          p.s.material.opacity = fade * (0.38 - p.h * 0.3) * day;
        }
        if (devil.t > devil.life) devil.on = false;
      }

      for (const k of kicks) {
        if (k.life <= 0) continue;
        k.life -= dt;
        const u = 1 - k.life / k.max;
        k.s.position.x += wx * W * 0.8 * dt;
        k.s.position.z += wz * W * 0.8 * dt;
        k.s.position.y += dt * (k.rise ?? 0.15);
        const sc = (0.25 + u * 0.9) * k.big;
        k.s.scale.set(sc * 1.3, sc * 0.8, 1);
        k.s.material.opacity = (1 - u) * 0.3 * (0.4 + 0.6 * day);
        if (k.life <= 0) k.s.visible = false;
      }

      // smoke: rises, thins and leans over with the wind
      const h = sky.hours ?? 12;
      const meal = Math.max(0.15, Math.exp(-((h - 7.5) ** 2) / 2), Math.exp(-((h - 18.5) ** 2) / 2), Math.exp(-((h - 12.8) ** 2) / 1.2) * 0.6);
      for (const p of smoke) {
        const d = p.d;
        const far = (d.x - cam.x) ** 2 + (d.z - cam.z) ** 2 > 160 * 160;
        p.s.visible = !far;
        if (far) continue;
        p.t = (p.t + dt * 0.09) % 1;
        const u = p.t;
        const lean = (0.6 + W * 2.4) * u * 7 * d.size;
        p.s.position.set(d.x + wx * lean, d.y + u * 7 * d.size * (1.2 - W * 0.5), d.z + wz * lean);
        const sc = (0.6 + u * 3.2) * d.size;
        p.s.scale.set(sc, sc, 1);
        p.s.material.opacity = (1 - u) * Math.min(1, u * 6) * (d.meal ? 0.32 * meal : 0.45) * (1 - sky.night * 0.6);
        p.s.visible = p.s.material.opacity > 0.01; // every sprite is a draw call
      }

      if (camera) puffs.flush(camera, renderer ? renderer.getDrawingBufferSize(_sz).y : window.innerHeight);
    },
  };
}
