import * as THREE from 'three';
import { KILN } from '../data/layout.js';
import { smooth } from '../util/rng.js';
import { wind } from '../systems/wind.js';

// Sky, sun, moon, haze and the passage of the day. A full day takes about twelve minutes;
// the night goes by faster than the day.

const KEY = {
  day: { top: '#6aa0d8', horizon: '#d9dcd6', sun: '#ffeccc', sunI: 3.1, hemi: '#cfdcec', ground: '#a8946e', hemiI: 0.82, fog: 0.0028 },
  gold: { top: '#55749f', horizon: '#f0b67a', sun: '#ffa45c', sunI: 2.2, hemi: '#c8b4a8', ground: '#7a6448', hemiI: 0.6, fog: 0.0048 },
  night: { top: '#081028', horizon: '#18223a', sun: '#9ab0e0', sunI: 0.5, hemi: '#46548a', ground: '#262a3a', hemiI: 0.42, fog: 0.0034 },
};

const mixC = (out, a, b, t) => out.set(a).lerp(_tmp.set(b), t);
const _tmp = new THREE.Color();
const _grey = new THREE.Color();

export function buildSky(scene, nightLights = []) {
  const uniforms = {
    top: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunCol: { value: new THREE.Color() },
    glow: { value: 1 },
    cloudOff: { value: new THREE.Vector2() },
    cloudLight: { value: new THREE.Color() },
    cloudShade: { value: new THREE.Color() },
    night: { value: 0 },
    cover: { value: 0.15 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; uniform float glow;
        uniform vec2 cloudOff; uniform vec3 cloudLight; uniform vec3 cloudShade; uniform float night; uniform float cover;
        varying vec3 vDir;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 1.7; a *= 0.5; } return v; }
        void main(){
          vec3 d = normalize(vDir);
          float h = pow(clamp(d.y, 0.0, 1.0), 0.45);
          vec3 c = mix(horizon, top, h);
          float s = max(dot(d, sunDir), 0.0);
          c += sunCol * (pow(s, 900.0) * 1.6 + pow(s, 24.0) * 0.22 * glow);
          // fair-weather cumulus and a high haze of cirrus, drifting with the wind
          if (d.y > 0.0) {
            vec2 p = d.xz / (d.y + 0.12);
            float cu = fbm(p * 1.6 + cloudOff);
            float cov = smoothstep(0.56 - cover * 0.5, 0.8 - cover * 0.3, cu) * smoothstep(0.0, 0.18, d.y);
            float ci = fbm(vec2(p.x * 0.6, p.y * 2.4) * 1.2 + cloudOff * 1.6 + 9.0);
            float cir = smoothstep(0.55, 0.85, ci) * 0.35 * smoothstep(0.02, 0.3, d.y);
            float lit = clamp(0.55 + (fbm(p * 1.6 + cloudOff + sunDir.xz * 0.15) - cu) * 3.0, 0.0, 1.0);
            vec3 cc = mix(cloudShade, cloudLight, lit) + sunCol * pow(s, 8.0) * 0.4 * glow;
            c = mix(c, cc, max(cov, cir) * (1.0 - night * 0.7));
          }
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  scene.add(dome);

  // stars
  const sp = [];
  for (let i = 0; i < 700; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.acos(Math.random() * 0.96);
    sp.push(Math.sin(e) * Math.cos(a) * 1400, Math.cos(e) * 1400, Math.sin(e) * Math.sin(a) * 1400);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  stars.frustumCulled = false;
  scene.add(stars);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xb8a888, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 10; sc.far = 320;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.06;
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.FogExp2(0xd6dde0, 0.0026);

  const lamps = nightLights.slice(0, 5).map((l) => {
    const p = new THREE.PointLight(l.color, 0, 34, 1.4);
    p.position.set(l.x, l.y, l.z);
    scene.add(p);
    return p;
  });

  // kiln smoke and black kites wheeling overhead
  const puffMat = new THREE.MeshBasicMaterial({ color: 0x4a4642, transparent: true, opacity: 0.4 });
  const puffs = [];
  for (let i = 0; i < 9; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(1.4, 6, 5), puffMat.clone());
    p.userData.t = i / 9;
    scene.add(p);
    puffs.push(p);
  }
  const kiteGeo = new THREE.BufferGeometry();
  kiteGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.5, -1.6, 0, -0.4, 0, 0, -0.1, 0, 0, 0.5, 0, 0, -0.1, 1.6, 0, -0.4], 3));
  const kiteMat = new THREE.MeshBasicMaterial({ color: 0x2a2420, side: THREE.DoubleSide });
  const kites = [];
  for (let i = 0; i < 5; i++) {
    const k = new THREE.Mesh(kiteGeo, kiteMat);
    k.userData = { cx: -40 + i * 45, cz: -30 + (i % 3) * 60, r: 28 + i * 9, h: 38 + i * 7, a: i * 1.7, w: 0.09 + (i % 2) * 0.03 };
    scene.add(k);
    kites.push(k);
  }

  const dir = new THREE.Vector3();
  const state = {
    hours: 7.6, night: 0, elevation: 0, sunDir: dir, clock: 0, uniforms, sun,
    skip() { state.hours = (state.hours + 3) % 24; },
    phase() {
      const h = state.hours;
      if (h < 5.3 || h >= 19.3) return 'night';
      if (h < 6.9) return 'fajr';
      if (h < 11) return 'morning';
      if (h < 14) return 'noon';
      if (h < 17) return 'afternoon';
      return 'evening';
    },
    update(dt, focus, camera) {
      state.clock += dt;
      const h0 = state.hours;
      state.hours = (h0 + dt * (h0 > 5.5 && h0 < 19 ? 0.025 : 0.07)) % 24;
      const h = state.hours;

      let e, a;
      if (h >= 6.25 && h <= 18) { a = ((h - 6.25) / 11.75) * Math.PI; e = Math.sin(a); }
      else { const u = ((h < 6.25 ? h + 24 : h) - 18) / 12.25; a = Math.PI + u * Math.PI; e = -Math.sin(u * Math.PI) * 0.6; }
      state.elevation = e;
      const d = smooth((e + 0.05) / 0.4), n = smooth((0.1 - e) / 0.28);
      state.night = n;

      const k = (name) => {
        const g = KEY.gold[name], dd = KEY.day[name], nn = KEY.night[name];
        return typeof g === 'number' ? (g + (dd - g) * d) * (1 - n) + nn * n : null;
      };
      const col = (out, name) => { mixC(out, KEY.gold[name], KEY.day[name], d); return out.lerp(_tmp.set(KEY.night[name]), n); };

      const w = state.weather || { cloud: 0.15, rain: 0, mist: 0 };
      const over = smooth((w.cloud - 0.3) / 0.6); // how overcast
      col(uniforms.top.value, 'top');
      col(uniforms.horizon.value, 'horizon');
      const grey = _grey.set('#a4a8ac').multiplyScalar(1 - n * 0.85);
      uniforms.top.value.lerp(grey, over * 0.75);
      uniforms.horizon.value.lerp(grey, over * 0.55);
      uniforms.cover.value = w.cloud;
      scene.fog.color.copy(uniforms.horizon.value);
      // dhund at dawn is milky white and close
      scene.fog.color.lerp(_grey.set('#d8d8d2').multiplyScalar(0.35 + 0.65 * d), w.mist * 0.8);
      scene.fog.density = k('fog') * (1 + over * 0.8) + w.rain * 0.006 + w.mist * 0.028;
      col(hemi.color, 'hemi');
      col(hemi.groundColor, 'ground');
      hemi.intensity = k('hemiI');

      const up = e > 0.03;
      if (up) dir.set(Math.cos(a), 0.78 * Math.sin(a) + 0.03, 0.5 * Math.sin(a) + 0.18).normalize();
      else dir.set(0.35, 0.8, -0.45).normalize();
      // fade the light out as the sun meets the horizon so the swap to moonlight is not seen
      const fade = up ? smooth((e - 0.03) / 0.12) : n;
      mixC(sun.color, KEY.gold.sun, KEY.day.sun, d);
      if (!up) sun.color.set(KEY.night.sun);
      sun.intensity = (up ? KEY.gold.sunI + (KEY.day.sunI - KEY.gold.sunI) * d : KEY.night.sunI) * fade * (1 - over * 0.75) * (1 - w.mist * 0.5);
      hemi.intensity *= 1 + over * 0.25;
      sun.position.set(focus.x + dir.x * 150, dir.y * 150, focus.z + dir.z * 150);
      sun.target.position.set(focus.x, 0, focus.z);

      uniforms.sunDir.value.copy(dir);
      uniforms.sunCol.value.copy(sun.color).multiplyScalar(up ? 1 : 0.8);
      uniforms.glow.value = up ? 1 : 0.25;
      // clouds move with the breeze below them
      // (the shader samples at p + offset, so the offset runs against the wind)
      uniforms.cloudOff.value.x -= wind.dir.x * (0.004 + wind.strength * 0.006) * dt;
      uniforms.cloudOff.value.y -= wind.dir.y * (0.004 + wind.strength * 0.006) * dt;
      uniforms.cloudLight.value.copy(sun.color).lerp(_tmp.set('#ffffff'), 0.5).multiplyScalar(up ? 1.0 : 0.25);
      uniforms.cloudShade.value.copy(uniforms.horizon.value).lerp(_tmp.set('#8a8f9a'), 0.5);
      uniforms.night.value = n;
      dome.position.copy(camera.position);
      stars.position.copy(camera.position);
      stars.material.opacity = n * 0.9;
      for (const p of lamps) p.intensity = n * 26;

      for (const p of puffs) {
        p.userData.t = (p.userData.t + dt * 0.035) % 1;
        const u = p.userData.t;
        p.position.set(KILN.x + u * 46, 25 + u * 26, KILN.z + u * 12);
        p.scale.setScalar(1 + u * 5);
        p.material.opacity = 0.42 * (1 - u) * (1 - n * 0.7);
      }
      for (const kt of kites) {
        const q = kt.userData;
        q.a += dt * q.w;
        kt.position.set(q.cx + Math.cos(q.a) * q.r, q.h, q.cz + Math.sin(q.a) * q.r);
        kt.rotation.set(0, -q.a, 0.25);
        kt.visible = n < 0.6;
      }
    },
  };
  return state;
}
