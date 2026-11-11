import * as THREE from 'three';
import { CANAL, BRIDGES, POND } from '../data/layout.js';
import { Builder, box, tbox, raw } from '../models/build.js';
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

// Water that reflects the sky, ripples, glints in the sun and is the colour of the silt it
// carries. `flow` is the direction and speed of the current (0 for the still pond).
function waterMaterial({ base, deep, flow, scale, foam = 0, refl = 0.6 }) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: { value: 0 }, uFlow: { value: new THREE.Vector2(...flow) }, uScale: { value: scale },
    uBase: { value: new THREE.Color(base) }, uDeep: { value: new THREE.Color(deep) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) },
    uHorizon: { value: new THREE.Color() }, uTop: { value: new THREE.Color() }, uNight: { value: 0 }, uFoam: { value: foam }, uRefl: { value: refl },
  }]);
  return new THREE.ShaderMaterial({
    uniforms, fog: true, transparent: true,
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uScale, uNight, uFoam, uRefl; uniform vec2 uFlow;
      uniform vec3 uBase, uDeep, uSunDir, uSunCol, uHorizon, uTop;
      varying vec3 vW; varying vec2 vUv;
      #include <fog_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float waves(vec2 p) {
        vec2 q = p * uScale;
        return noise(q + uFlow * uTime) * 0.35 + noise(q * 2.3 - uFlow.yx * uTime * 1.3 + 4.0) * 0.3
             + noise(q * 5.1 + vec2(uTime * 0.4, -uTime * 0.3)) * 0.2 + noise(q * 11.0 + uFlow * uTime * 2.0) * 0.15;
      }
      void main() {
        vec2 p = vW.xz;
        float e = 0.08, h = waves(p);
        vec3 n = normalize(vec3((h - waves(p + vec2(e, 0.0))) * 1.1, 1.0, (h - waves(p + vec2(0.0, e))) * 1.1));
        vec3 v = normalize(cameraPosition - vW);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 r = reflect(-v, n);
        vec3 sky = mix(uHorizon, uTop, pow(clamp(r.y, 0.0, 1.0), 0.5)) * 0.85;
        float sunUp = clamp(uSunDir.y * 3.0, 0.0, 1.0);
        vec3 lit = uSunCol * (0.35 + 0.65 * sunUp) * (1.0 - uNight * 0.85) + uHorizon * 0.35;
        vec3 body = mix(uBase, uDeep, h) * lit;
        vec3 col = mix(body, sky, clamp(fres * uRefl, 0.0, 1.0));
        col += uSunCol * pow(max(dot(r, uSunDir), 0.0), 220.0) * 2.5 * sunUp;
        // scum and foam along the edges, drawn out by the current
        float edge = 1.0 - smoothstep(0.0, 0.12, min(vUv.x, 1.0 - vUv.x));
        float f = edge * smoothstep(0.45, 0.75, noise(vec2(vUv.x * 30.0, p.y * 0.8 + uTime * 0.6))) * uFoam;
        col = mix(col, vec3(0.78, 0.74, 0.64) * lit, f * 0.6);
        gl_FragColor = vec4(col, 0.94);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
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

  // Slow, silty water, flowing south.
  const canalMat = waterMaterial({ base: '#8a7458', deep: '#5e4c38', flow: [0, 0.55], scale: 0.9, foam: 1, refl: 0.5 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(CANAL.water * 2, 840, 1, 1).rotateX(-Math.PI / 2), canalMat);
  water.position.set(CANAL.x, CANAL.waterY, 0);
  group.add(water);

  // The village pond: still, greenish water with a muddy rim.
  const rim = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 2.2, 28).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8c7a58 }));
  rim.position.set(POND.x, 0.02, POND.z);
  rim.scale.set(1.15, 1, 0.9);
  rim.receiveShadow = true;
  const pondMat = waterMaterial({ base: '#5f6a3a', deep: '#36402a', flow: [0.05, 0.03], scale: 1.4, refl: 0.38 });
  const pond = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 40).rotateX(-Math.PI / 2), pondMat);
  pond.position.set(POND.x, 0.05, POND.z);
  pond.scale.set(1.15, 1, 0.9);
  group.add(rim, pond);

  scene.add(group);
  return {
    group,
    update(dt, sky) {
      for (const m of [canalMat, pondMat]) {
        const u = m.uniforms;
        u.uTime.value += dt;
        if (!sky) continue;
        u.uSunDir.value.copy(sky.sunDir);
        u.uSunCol.value.copy(sky.sun.color);
        u.uHorizon.value.copy(sky.uniforms.horizon.value);
        u.uTop.value.copy(sky.uniforms.top.value);
        u.uNight.value = sky.night;
      }
    },
  };
}
