import * as THREE from 'three';
import { wind } from './wind.js';
import { getTexture } from '../models/textures.js';

// Late-February weather on the Punjab plain: mostly clear, but once in a long while the
// clouds build up and a short shower blows through; the ground darkens and stays wet a
// while after. Early mornings come with a thick ground fog (dhund) that burns off by nine.

export const wet = { value: 0 }; // shared with the weathering shaders

export function makeWeather(scene, { force = null } = {}) {
  // rain streaks: short lines around the camera, falling and blown sideways
  const N = 4000, R = 30, H = 22;
  const pos = new Float32Array(N * 6);
  const seed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { seed[i * 3] = (Math.random() * 2 - 1) * R; seed[i * 3 + 1] = Math.random() * H; seed[i * 3 + 2] = (Math.random() * 2 - 1) * R; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xdfe3e6, transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.LineSegments(g, mat);
  rain.frustumCulled = false;
  rain.renderOrder = 10;
  scene.add(rain);

  // splashes where the drops land
  const SP = 500;
  const sp = new Float32Array(SP * 3), life = new Float32Array(SP);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const smat = new THREE.PointsMaterial({ color: 0xdfe4e8, size: 0.05, map: getTexture('stain'), transparent: true, opacity: 0, depthWrite: false });
  const splash = new THREE.Points(sg, smat);
  splash.frustumCulled = false;
  splash.renderOrder = 10;
  scene.add(splash);

  const st = {
    ground: null, // (x, z) => height, set by main
    cloud: 0.15, rain: 0, wet: 0, mist: 0,
    targetCloud: 0.2, timer: 40,
    force,
    update(dt, cam, hours) {
      // drift toward a target, and every so often pick a new one
      st.timer -= dt;
      if (st.timer < 0) {
        // Rain is rare and brief: about one change in twenty-five brings a shower, and it
        // passes in under a minute and a half. Otherwise clear spells and some cloud.
        const r = Math.random();
        if (st.targetCloud === 1) { st.targetCloud = 0.3; st.timer = 120 + Math.random() * 120; }
        else if (r < 0.04) { st.targetCloud = 1; st.timer = 45 + Math.random() * 40; }
        else { st.targetCloud = r < 0.65 ? 0.15 : 0.5; st.timer = 90 + Math.random() * 150; }
      }
      let tc = st.targetCloud;
      if (st.force === 'rain') tc = 1; else if (st.force === 'clear') tc = 0.1; else if (st.force === 'cloudy') tc = 0.6;
      st.cloud += (tc - st.cloud) * Math.min(1, dt * 0.05);
      const tr = Math.max(0, (st.cloud - 0.75) / 0.25);
      st.rain += (tr - st.rain) * Math.min(1, dt * 0.15);
      // ground soaks quickly and dries slowly
      st.wet += ((st.rain > 0.1 ? 1 : 0) - st.wet) * Math.min(1, dt * (st.rain > 0.1 ? 0.08 : 0.006));
      wet.value = st.wet;
      // dhund: thickest around dawn
      const h = hours;
      st.mist = st.force === 'fog' ? 1 : Math.max(0, 1 - Math.abs(h - 6.6) / 2.2) ** 1.5;
      // showers come with a stronger, gustier wind
      wind.boost = st.rain * 0.45 + st.cloud * 0.1;

      mat.opacity = st.rain * 0.7;
      rain.visible = splash.visible = st.rain > 0.01;
      if (!rain.visible) return;
      const fall = 14, sx = wind.dir.x * wind.strength * 5, sz = wind.dir.y * wind.strength * 5;
      const len = 0.06;
      const t = performance.now() / 1000;
      for (let i = 0; i < N; i++) {
        let y = (seed[i * 3 + 1] - t * fall) % H; if (y < 0) y += H;
        const drift = (H - y) / fall;
        // drops have fixed places in the world; wrap them into a box round the camera
        const ax = seed[i * 3] + sx * drift, az = seed[i * 3 + 2] + sz * drift;
        const x = ((((ax - cam.x + R) % (2 * R)) + 2 * R) % (2 * R)) - R;
        const z = ((((az - cam.z + R) % (2 * R)) + 2 * R) % (2 * R)) - R;
        const wx = cam.x + x, wz = cam.z + z, wy = cam.y - 4 + y;
        const k = i * 6;
        pos[k] = wx; pos[k + 1] = wy; pos[k + 2] = wz;
        pos[k + 3] = wx - sx * len; pos[k + 4] = wy + fall * len; pos[k + 5] = wz - sz * len;
      }
      g.attributes.position.needsUpdate = true;
      smat.opacity = st.rain * 0.55;
      for (let i = 0; i < SP; i++) {
        life[i] -= dt;
        if (life[i] > 0) { sp[i * 3 + 1] += dt * 0.6; continue; }
        if (Math.random() > st.rain) { sp[i * 3 + 1] = -100; continue; }
        const x = cam.x + (Math.random() * 2 - 1) * 14, z = cam.z + (Math.random() * 2 - 1) * 14;
        sp[i * 3] = x; sp[i * 3 + 1] = (st.ground ? st.ground(x, z) : 0) + 0.05; sp[i * 3 + 2] = z;
        life[i] = 0.08 + Math.random() * 0.12;
      }
      sg.attributes.position.needsUpdate = true;
    },
  };
  // A forced weather starts fully set in, so it can be looked at straight away.
  // null hands the weather back to chance.
  st.setForce = (f) => {
    st.force = f;
    if (f === 'rain') { st.cloud = 1; st.rain = 1; st.wet = 1; }
    if (f === 'cloudy') { st.cloud = 0.6; st.rain = 0; }
    if (f === 'clear' || f === 'fog') { st.cloud = 0.12; st.rain = 0; st.wet = 0; }
  };
  st.setForce(force);
  return st;
}
