import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, cyl, sph, cone, ico, capsule, getMat } from './build.js';
import { heightAt } from '../world/terrain.js';
import { resolve, blocked, addDynamic } from '../systems/collision.js';
import { angDiff, makeRng, clamp, lerp, smooth } from '../util/rng.js';

// Farm animals of a Punjab village. Every animal is ONE skinned mesh: each body part is
// modelled rigidly in the rest pose and tied to a single bone of a small skeleton, so a
// whole buffalo is one draw call. Four-legged animals have body, barrel (breathing), neck,
// head, jaw, two ears, two tail segments and an upper and lower bone per leg; the legs are
// placed by a two-bone IK so planted hooves stay put through a four-beat walk. They face +z.

// ---------------------------------------------------------------- rig building

class Rig {
  constructor() { this.bones = []; this.parts = []; }
  bone(parent, x, y, z) {
    const b = new THREE.Bone();
    b.userData.rest = new THREE.Vector3(x, y, z);
    if (parent) { b.position.set(x, y, z).sub(parent.userData.rest); parent.add(b); } else b.position.set(x, y, z);
    b.userData.idx = this.bones.length;
    this.bones.push(b);
    return b;
  }
  // geometry authored in model space, in the rest pose; `coat` parts take the coat pattern
  add(bone, g, coat = false) { this.parts.push([bone.userData.idx, g, coat]); }
  build({ coat, rnd, mud = 0, jitter = 0.08 }) {
    const c = new THREE.Color(), mudC = new THREE.Color('#4a3a2a');
    const geoms = this.parts.map(([i, g, isCoat]) => {
      const pos = g.attributes.position, col = g.attributes.color, n = pos.count;
      // per triangle: coat pattern, muddy feet and a little brightness jitter so flat
      // faces read like hair rather than plastic
      for (let v = 0; v < n; v += 3) {
        const cx = (pos.getX(v) + pos.getX(v + 1) + pos.getX(v + 2)) / 3;
        const cy = (pos.getY(v) + pos.getY(v + 1) + pos.getY(v + 2)) / 3;
        const cz = (pos.getZ(v) + pos.getZ(v + 1) + pos.getZ(v + 2)) / 3;
        c.setRGB(col.getX(v), col.getY(v), col.getZ(v));
        if (isCoat && coat) coat(c, cx, cy, cz);
        if (cy < mud) c.lerp(mudC, 0.45 * (1 - cy / mud));
        c.multiplyScalar(1 + (rnd() - 0.5) * jitter);
        for (let k = 0; k < 3; k++) col.setXYZ(v + k, c.r, c.g, c.b);
      }
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let v = 0; v < n; v++) { si[v * 4] = i; sw[v * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      return g;
    });
    const geo = mergeGeometries(geoms);
    const mesh = new THREE.SkinnedMesh(geo, getMat('flat'));
    const inv = this.bones.map((b) => new THREE.Matrix4().makeTranslation(-b.userData.rest.x, -b.userData.rest.y, -b.userData.rest.z));
    mesh.add(this.bones[0]);
    mesh.bind(new THREE.Skeleton(this.bones, inv), new THREE.Matrix4());
    // a fixed, generous bound: computing it from the bones every frame would be wasteful
    geo.computeBoundingBox();
    const bb = geo.boundingBox.clone();
    const sphere = bb.getBoundingSphere(new THREE.Sphere());
    sphere.radius *= 1.3;
    mesh.boundingSphere = sphere;
    mesh.boundingBox = bb.expandByScalar(sphere.radius * 0.25);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.tris = geo.attributes.position.count / 3;
    return mesh;
  }
}

// ---------------------------------------------------------------- shape helpers

const _up = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _q = new THREE.Quaternion();
// a tapered cylinder from point a (radius r1) to b (radius r2); `flat` squashes it sideways
function seg(a, b, r1, r2, color, n = 6, flat = 1) {
  _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _v.length();
  const g = cyl(r2, r1, len, color, n, flat !== 1 ? { sx: flat } : undefined);
  g.applyQuaternion(_q.setFromUnitVectors(_up, _v.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}
// an ellipsoid at p with radii r, optionally rotated
// (small animals are built with fewer segments: `detail` scales them)
let detail = 1;
const ell = (color, p, r, rot = {}, ws = 8, hs = 6) =>
  sph(1, color, { sx: r[0], sy: r[1], sz: r[2], x: p[0], y: p[1], z: p[2], rx: rot.rx, ry: rot.ry, rz: rot.rz },
    Math.max(5, Math.round(ws * detail)), Math.max(4, Math.round(hs * detail)));

const _c1 = new THREE.Color(), _c2 = new THREE.Color();
const shade = (hex, k) => '#' + _c1.set(hex).multiplyScalar(k).getHexString();
const mix = (a, b, t) => '#' + _c1.set(a).lerp(_c2.set(b), t).getHexString();
const frac = (x) => x - Math.floor(x);

// ---------------------------------------------------------------- breeds

// L body length, H body depth, W width, legH belly clearance, legR leg radius,
// knee/hock: joint heights as a fraction of legH, hockB: how far the hock sits behind the hip,
// neck [length, angle above horizontal, radius at the head], head [length, width, depth, droop].
const KINDS = {
  // Nili-Ravi buffalo: black, deep and wide, short legs, tight curled horns, wall eyes,
  // often a white blaze, white socks and a white tail switch.
  buffalo: {
    L: 1.72, H: 0.8, W: 0.8, legH: 0.54, legR: 0.068, knee: 0.42, hock: 0.52, hockB: 0.14,
    neck: [0.6, 0.3, 0.17], head: [0.58, 0.25, 0.27, 0.72], ear: 0.22, tail: 0.85, belly: 1.12,
    coats: ['#262324', '#2a2627', '#302826', '#232224'], hoof: '#141212', muzzle: '#2e2a2b', gH: 0.25,
  },
  // Sahiwal: red dun, a big hump, a long loose dewlap, short stubby horns.
  cow: {
    L: 1.5, H: 0.64, W: 0.58, legH: 0.62, legR: 0.054, knee: 0.42, hock: 0.52, hockB: 0.14,
    neck: [0.58, 0.32, 0.14], head: [0.5, 0.2, 0.22, 1.05], ear: 0.2, tail: 0.85, belly: 1.05,
    coats: ['#9a5530', '#7d4126', '#b06a3a', '#8a4a2c', '#a8623c'], hoof: '#1e1612', muzzle: '#2e2420', gH: 0.3,
  },
  // Beetal goat: tall, long pendulous ears, roman nose, black / brown / pied.
  goat: {
    L: 0.74, H: 0.36, W: 0.27, legH: 0.44, legR: 0.026, knee: 0.42, hock: 0.5, hockB: 0.15,
    neck: [0.36, 1.0, 0.06], head: [0.27, 0.1, 0.12, 0.95], ear: 0.24, tail: 0.12, belly: 1.0,
    coats: ['#211c1a', '#6e4228', '#211c1a', '#8a5a36', '#2a2220', '#e6dfd0'], hoof: '#1a1612', muzzle: null, gH: 0.35,
  },
  // Local fat-tailed sheep: white woolly body, often a dark or speckled head.
  sheep: {
    L: 0.8, H: 0.46, W: 0.46, legH: 0.3, legR: 0.028, knee: 0.42, hock: 0.5, hockB: 0.12,
    neck: [0.28, 0.7, 0.075], head: [0.24, 0.11, 0.12, 1.0], ear: 0.12, tail: 0.3, belly: 1.0,
    coats: ['#e6dfcd', '#ddd3bd', '#ece6d6', '#d6ccb4'], hoof: '#2a221c', muzzle: null, gH: 0.3,
  },
  // Grey donkey with a dark cross over the shoulders, pale belly and muzzle.
  donkey: {
    L: 1.02, H: 0.46, W: 0.36, legH: 0.56, legR: 0.038, knee: 0.42, hock: 0.52, hockB: 0.13,
    neck: [0.52, 0.85, 0.1], head: [0.48, 0.15, 0.18, 1.1], ear: 0.26, tail: 0.55, belly: 1.0,
    coats: ['#8f877c', '#7a7068', '#a39b90', '#6e6660'], hoof: '#2a2420', muzzle: '#ddd6c8', gH: 0.25,
  },
  // Pariah dog: lean tan, deep chest, tucked belly, sickle tail curled over the back.
  dog: {
    L: 0.6, H: 0.24, W: 0.19, legH: 0.3, legR: 0.024, knee: 0.32, hock: 0.42, hockB: 0.16,
    neck: [0.2, 0.95, 0.05], head: [0.22, 0.1, 0.1, 0.3], ear: 0.075, tail: 0.3, belly: 0.62,
    coats: ['#c49a62', '#a8743e', '#d6b98a', '#b88a52', '#8a6a48'], hoof: '#2a2018', muzzle: '#2a2320', gH: 0.55,
  },
};

const CUD = { buffalo: 1, cow: 1, goat: 1, sheep: 1 };

export function makeAnimal(kind, variant = 0, seed = 0) {
  if (kind === 'chicken') return makeChicken(variant, seed);
  const s = KINDS[kind];
  const rnd = makeRng(1000 + variant * 7919 + seed * 104729);
  const col = s.coats[(variant + seed) % s.coats.length];
  const dark = shade(col, 0.55);
  const { L, H, W, legH, legR } = s;
  const a = L / 2, bodyY = legH + H / 2, yT = legH + H * 0.3;
  const zs = L * 0.32, zh = -L * 0.32, lx = W * 0.27;
  detail = L < 1.2 ? 0.75 : 0.9;
  const R = new Rig();
  const T = (bone, g) => R.add(bone, g, true); // coat-coloured part
  const X = (bone, g) => R.add(bone, g, false); // horn, hoof, eye...
  const cattle = kind === 'cow' || kind === 'buffalo';

  // ---- skeleton ----
  const root = R.bone(null, 0, 0, 0);
  const body = R.bone(root, 0, bodyY, 0);
  const barrel = R.bone(body, 0, bodyY, 0);
  const N = [0, bodyY + H * 0.05, a * 0.72];
  const neck = R.bone(body, ...N);
  const [nl, na, nr] = s.neck;
  const P = [0, N[1] + Math.sin(na) * nl, N[2] + Math.cos(na) * nl];
  const head = R.bone(neck, ...P);
  const [hl, hw, hh, droop] = s.head;
  const dY = -Math.sin(droop), dZ = Math.cos(droop), uY = Math.cos(droop), uZ = Math.sin(droop);
  // a point in the head frame: t along the face, u up from its axis, x sideways
  const hp = (t, u, x = 0) => [x, P[1] + dY * t + uY * u, P[2] + dZ * t + uZ * u];
  const jaw = R.bone(head, ...hp(hl * 0.18, -hh * 0.32));
  const earBase = (sd) => hp(hl * 0.08, hh * 0.28, sd * hw * 0.42);
  const ears = [-1, 1].map((sd) => R.bone(head, ...earBase(sd)));

  // ---- torso ----
  const bk = s.belly;
  // a long barrel, then the belly, chest and hindquarters shaped onto it
  T(barrel, capsule(H * 0.48, L - H * 0.96, col, { rx: Math.PI / 2, sx: W / H, y: bodyY + H * 0.02, z: -a * 0.02 }, 3, 10));
  T(barrel, ell(col, [0, bodyY - H * 0.06 * bk + (1 - bk) * H * 0.2, -a * 0.06], [W * 0.52 * bk, H * 0.5 * bk, a * 0.6], {}, 10, 7)); // belly
  T(barrel, ell(col, [0, bodyY + H * 0.08, -a * 0.58], [W * 0.47, H * 0.44, a * 0.42], {}, 9, 6)); // hindquarters
  T(barrel, ell(col, [0, bodyY - H * 0.06, a * 0.78], [W * 0.36, H * 0.42, a * 0.3], {}, 8, 6)); // chest and brisket
  for (const sd of [-1, 1]) T(barrel, ell(col, [sd * W * 0.24, bodyY + H * 0.08, a * 0.56], [W * 0.18, H * 0.38, a * 0.22], { rx: -0.3 }, 7, 5)); // shoulder blades
  if (kind !== 'dog' && kind !== 'sheep') {
    // hip bones and the tail head stand out on thin-skinned cattle and goats
    for (const sd of [-1, 1]) T(barrel, ell(col, [sd * W * 0.3, bodyY + H * 0.33, -a * 0.5], [W * 0.12, H * 0.08, a * 0.12], {}, 6, 4));
    T(barrel, ell(col, [0, bodyY + H * 0.3, -a * 0.9], [W * 0.22, H * 0.14, a * 0.14], {}, 6, 4));
  }
  if (kind === 'sheep') {
    // lumpy wool
    T(barrel, ico(1, col, 1, { sx: W * 0.55, sy: H * 0.56, sz: a * 0.62, y: bodyY + H * 0.04, z: a * 0.28 }));
    T(barrel, ico(1, shade(col, 0.95), 1, { sx: W * 0.56, sy: H * 0.55, sz: a * 0.6, y: bodyY + H * 0.02, z: -a * 0.32 }));
  }
  if (kind === 'cow') {
    // hump over the withers, sheath / navel flap
    X(body, ell(shade(col, 0.72), [0, bodyY + H * 0.44, a * 0.62], [W * 0.2, H * 0.24, a * 0.22], { rx: -0.6 }, 7, 5));
    T(barrel, ell(col, [0, legH + H * 0.02, a * 0.15], [W * 0.1, H * 0.12, a * 0.18], {}, 6, 4));
  }
  if (cattle || kind === 'goat') {
    const ud = kind === 'buffalo' ? '#2e2828' : kind === 'cow' ? '#c79a86' : shade(col, 0.9);
    X(barrel, ell(ud, [0, legH + H * 0.04, -a * 0.5], [W * 0.17, H * 0.16, a * 0.16], {}, 7, 5));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) X(barrel, cone(legR * 0.35, H * 0.1, ud, 4, { x: sx * W * 0.07, y: legH - H * 0.06, z: -a * 0.5 + sz * a * 0.07, rx: Math.PI }));
  }

  // ---- neck ----
  const nb = kind === 'dog' ? H * 0.3 : H * 0.34;
  const N0 = [0, N[1], N[2] - a * 0.08];
  {
    // two overlapping ellipsoids along the neck: thick where it meets the shoulders, slim at the throat
    const dy = P[1] - N0[1], dz = P[2] - N0[2], len = Math.hypot(dy, dz), ang = Math.atan2(dy, dz);
    const at = (k) => [0, N0[1] + dy * k, N0[2] + dz * k];
    const fl = kind === 'buffalo' ? 0.85 : 0.72;
    T(neck, ell(col, at(0.38), [nb * fl, nb, len * 0.6], { rx: -ang }, 8, 6));
    T(neck, ell(col, at(0.8), [nr * 1.3 * fl, nr * 1.45, len * 0.32], { rx: -ang }, 7, 5));
  }
  if (kind === 'cow') {
    // the long loose dewlap of a Sahiwal, from the throat to between the forelegs
    const top = [0, (N[1] + P[1]) / 2 - nb * 0.5, (N[2] + P[2]) / 2];
    T(neck, ell(col, [0, top[1] - H * 0.22, top[2] - 0.02], [0.035, H * 0.32, nl * 0.55], { rx: -0.35 }, 6, 6));
  }
  if (kind === 'buffalo') T(neck, ell(col, [0, N[1] - H * 0.1, N[2] + nl * 0.3], [nb * 0.75, nb * 0.75, nl * 0.4], {}, 7, 5));
  if (kind === 'donkey') {
    // short upright mane along the crest, dark
    T(neck, seg([0, N[1] + nb * 0.75, N[2] - a * 0.05], [0, P[1] + nr * 1.0, P[2] - 0.04], 0.06, 0.045, shade(col, 0.42), 4, 0.25));
  }
  if (kind === 'sheep') T(neck, ico(1, col, 1, { sx: nb * 0.95, sy: nb * 1.0, sz: nl * 0.6, y: (N[1] + P[1]) / 2 - 0.02, z: (N[2] + P[2]) / 2 - 0.03 }));

  // ---- head ----
  const face = kind === 'sheep' ? ['#e6dfcd', '#2a2220', '#5a4030', '#2a2220'][(variant + seed) % 4] : col;
  const muz = s.muzzle || face;
  const H_ = (g) => R.add(head, g, kind !== 'sheep');
  H_(ell(face, hp(hl * 0.1, 0), [hw * 0.5, hh * 0.52, hl * 0.22], {}, 7, 5)); // cranium
  H_(seg(hp(hl * 0.08, hh * 0.02), hp(hl * 0.8, -hh * 0.06), hh * 0.5, hh * 0.36, face, 6, hw / hh));
  X(head, ell(muz, hp(hl * 0.86, -hh * 0.1), [hw * 0.4, hh * 0.34, hl * 0.16], {}, 7, 5));
  for (const sd of [-1, 1]) {
    X(head, ell('#0e0c0b', hp(hl * 0.97, -hh * 0.02, sd * hw * 0.16), [hw * 0.07, hh * 0.08, hl * 0.03], {}, 5, 3));
    const eye = hp(hl * 0.28, hh * 0.18, sd * hw * 0.46);
    if (kind === 'buffalo' && variant % 3 === 1) X(head, ell('#cfd6d8', eye, [hw * 0.06, hw * 0.11, hw * 0.11], {}, 5, 4)); // wall eye
    else if (kind === 'donkey') X(head, ell('#d9d2c2', [eye[0] * 0.98, eye[1], eye[2]], [hw * 0.05, hw * 0.16, hw * 0.16], {}, 5, 4));
    X(head, ell('#0c0a09', [eye[0] * 1.04, eye[1], eye[2]], [hw * 0.06, hw * 0.08, hw * 0.08], {}, 5, 4));
  }
  if (kind === 'goat' || kind === 'sheep') H_(ell(face, hp(hl * 0.5, hh * 0.3), [hw * 0.32, hh * 0.22, hl * 0.32], {}, 6, 4)); // roman nose
  if (kind === 'dog') {
    H_(ell(face, hp(hl * 0.05, -hh * 0.05), [hw * 0.62, hh * 0.55, hl * 0.2], {}, 7, 5)); // broad skull
    X(head, ell('#efe4cc', hp(hl * 0.62, -hh * 0.22), [hw * 0.32, hh * 0.22, hl * 0.25], {}, 6, 4));
  }
  if (kind === 'buffalo' && (variant + seed) % 2 === 0) X(head, ell('#ece6da', hp(hl * 0.3, hh * 0.46), [hw * 0.18, hh * 0.06, hl * 0.13], {}, 6, 4)); // blaze
  if (kind === 'cow' && variant % 2) X(head, ell(shade(col, 0.6), hp(hl * 0.22, hh * 0.4), [hw * 0.3, hh * 0.1, hl * 0.18], {}, 6, 4));
  // lower jaw
  R.add(jaw, seg(hp(hl * 0.16, -hh * 0.3), hp(hl * 0.84, -hh * 0.38), hh * 0.24, hh * 0.15, face, 5, (hw / hh) * 0.95), kind !== 'sheep');
  if (kind === 'goat' && variant % 3 !== 2) X(jaw, cone(hw * 0.18, hh * 0.9, shade(face, 0.7), 4, { x: 0, y: hp(hl * 0.66, -hh * 0.75)[1], z: hp(hl * 0.66, 0)[2], rx: Math.PI }));

  // ---- ears ----
  const el = s.ear;
  for (const [k, sd] of [[0, -1], [1, 1]]) {
    const e = earBase(sd), eb = ears[k];
    if (cattle || kind === 'sheep') {
      const dz = kind === 'sheep' ? 0.5 : 0.25;
      R.add(eb, ell(face, [e[0] + sd * el * 0.5, e[1] - el * dz * 0.5, e[2]], [el * 0.5, el * 0.06, el * 0.26], { rz: -sd * dz }, 6, 4), kind !== 'sheep');
    } else if (kind === 'goat') {
      T(eb, ell(col, [e[0] + sd * 0.035, e[1] - el * 0.42, e[2] + 0.015], [0.014, el * 0.5, el * 0.17], { rz: sd * 0.12, rx: 0.1 }, 6, 5));
    } else if (kind === 'donkey') {
      T(eb, ell(col, [e[0] + sd * 0.02, e[1] + el * 0.46, e[2] - 0.01], [el * 0.17, el * 0.5, 0.03], { rz: -sd * 0.18 }, 6, 5));
      X(eb, ell('#2a2420', [e[0] + sd * 0.06, e[1] + el * 0.9, e[2] - 0.01], [el * 0.08, el * 0.08, 0.032], {}, 5, 3));
    } else if (kind === 'dog') {
      T(eb, cone(el * 0.42, el, col, 4, { x: e[0] + sd * 0.008, y: e[1] + el * 0.45, z: e[2] - 0.01, rz: -sd * 0.22 }));
    }
  }

  // ---- horns ----
  const hornCol = kind === 'buffalo' ? '#2e2b2a' : kind === 'cow' ? '#b9ad94' : '#4a4038';
  const chain = (pts, r0, r1, color, bone = head) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1);
      X(bone, seg(pts[i], pts[i + 1], lerp(r0, r1, t0), lerp(r0, r1, t1), color, 5));
    }
  };
  if (kind === 'buffalo') {
    // Nili-Ravi: short, flat horns that sweep back and down, then curl up tight beside the poll
    for (const sd of [-1, 1]) {
      const b0 = hp(hl * 0.02, hh * 0.38, sd * hw * 0.38);
      const pts = [];
      for (let i = 0; i <= 7; i++) {
        const th = (i / 7) * Math.PI * 1.45, r = 0.13 * (1 - 0.35 * (i / 7));
        pts.push([b0[0] + sd * (0.05 + 0.025 * i), b0[1] - 0.13 + Math.cos(th) * r, b0[2] - 0.04 - Math.sin(th) * r * 0.9]);
      }
      pts[0] = b0;
      chain(pts, 0.05, 0.018, hornCol);
    }
  } else if (kind === 'cow') {
    for (const sd of [-1, 1]) {
      const b0 = hp(hl * 0.02, hh * 0.42, sd * hw * 0.4);
      chain([b0, [b0[0] + sd * 0.07, b0[1] + 0.04, b0[2] - 0.02], [b0[0] + sd * 0.1, b0[1] + 0.1, b0[2] - 0.03]], 0.03, 0.012, hornCol);
    }
  } else if (kind === 'goat' && variant % 4 !== 3) {
    for (const sd of [-1, 1]) {
      const b0 = hp(hl * 0.1, hh * 0.45, sd * hw * 0.22);
      chain([b0, [b0[0] + sd * 0.01, b0[1] + 0.06, b0[2] - 0.05], [b0[0] + sd * 0.03, b0[1] + 0.08, b0[2] - 0.13]], 0.014, 0.005, hornCol);
    }
  }

  // ---- legs ----
  const legs = [];
  const mudH = cattle || kind === 'donkey' ? legH * 0.32 : legH * 0.2;
  const sock = kind === 'buffalo' && variant % 2 === 1 ? '#d8d0c0' : null;
  for (const [sd, fore] of [[1, true], [-1, true], [1, false], [-1, false]]) {
    const x = sd * lx, z0 = fore ? zs : zh;
    const jy = legH * (fore ? s.knee : s.hock), jz = fore ? z0 + legH * 0.02 : z0 - legH * s.hockB;
    const up = R.bone(body, x, yT, z0), lo = R.bone(up, x, jy, jz);
    const xo = x * 1.06;
    if (fore) {
      T(up, ell(col, [xo * 0.95, legH + H * 0.12, z0], [W * 0.13, H * 0.4, legR * 2.6], { rx: 0.1 }, 7, 5)); // upper arm
      T(up, seg([x, legH + H * 0.05, z0], [x, jy, jz], legR * 1.55, legR * 0.95, col, 6)); // forearm
    } else {
      T(up, ell(col, [xo * 0.95, legH + H * 0.2, z0 - legH * 0.04], [W * 0.17, H * 0.46, legR * 3.4], { rx: -0.2 }, 8, 6)); // thigh
      T(up, seg([x, legH + H * 0.05, z0 - legH * 0.05], [x, jy, jz], legR * 1.75, legR * 0.95, col, 6)); // gaskin
    }
    const lc = sock || col;
    R.add(lo, ell(lc, [x, jy, jz + (fore ? legR * 0.15 : -legR * 0.35)], [legR * 1.05, legR * 1.35, legR * 1.25], {}, 6, 4), !sock);
    R.add(lo, seg([x, jy, jz], [x, legR * 2.4, jz], legR * 0.85, legR * 0.72, lc, 6), !sock);
    R.add(lo, ell(lc, [x, legR * 2.3, jz + legR * 0.1], [legR * 0.95, legR * 1.1, legR * 1.05], {}, 6, 4), !sock);
    if (kind === 'dog') X(lo, ell(shade(col, 0.85), [x, legR * 0.7, jz + legR * 0.7], [legR * 1.2, legR * 0.75, legR * 1.7], {}, 6, 4));
    else if (kind === 'donkey') X(lo, cyl(legR * 1.0, legR * 1.3, legR * 2.0, s.hoof, 7, { x, y: legR, z: jz + legR * 0.15 }));
    else for (const c of [-1, 1]) X(lo, box(legR * 0.85, legR * 1.6, legR * 1.9, s.hoof, { x: x + c * legR * 0.48, y: legR * 0.8, z: jz + legR * 0.35, rx: -0.2 }));
    legs.push({
      up, lo, fore, sd, z0, hipY: yT, footZ: jz,
      l1: Math.hypot(yT - jy, jz - z0), l2: jy, u0: Math.atan2(jz - z0, yT - jy),
      off: 0, from: 0, to: 0, step: 1,
    });
  }

  // ---- tail ----
  const tl = s.tail;
  const T0 = [0, bodyY + H * 0.32, -a * 0.98];
  let T1, T2;
  if (kind === 'dog') { T1 = [0, T0[1] + tl * 0.42, T0[2] - tl * 0.3]; T2 = [0.04, T0[1] + tl * 0.62, T0[2] + tl * 0.12]; }
  else if (kind === 'goat') { T1 = [0, T0[1] + tl * 0.5, T0[2] - tl * 0.35]; T2 = [0, T0[1] + tl * 0.9, T0[2] - tl * 0.45]; }
  else if (kind === 'sheep') { T1 = [0, T0[1] - tl * 0.45, T0[2] - 0.07]; T2 = [0, T0[1] - tl, T0[2] - 0.06]; }
  else { T1 = [0, T0[1] - tl * 0.5, T0[2] - 0.04]; T2 = [0, T0[1] - tl, T0[2] - 0.03]; }
  const tail1 = R.bone(body, ...T0), tail2 = R.bone(tail1, ...T1);
  const tr = kind === 'dog' ? 0.04 : kind === 'goat' ? 0.03 : kind === 'sheep' ? 0.05 : W * 0.04;
  if (kind === 'sheep') {
    // fat tail: two heavy lobes on the rump
    T(tail1, ico(1, col, 1, { sx: W * 0.32, sy: H * 0.3, sz: 0.09, y: T0[1] - tl * 0.35, z: T0[2] - 0.03 }));
  }
  T(tail1, seg(T0, T1, tr, tr * 0.8, col, 5));
  T(tail2, seg(T1, T2, tr * 0.8, kind === 'dog' ? tr * 0.5 : tr * 0.6, col, 5));
  if (kind === 'dog') T(tail2, ell(col, [(T1[0] + T2[0]) / 2, (T1[1] + T2[1]) / 2 + 0.01, (T1[2] + T2[2]) / 2], [0.045, 0.07, 0.06], {}, 6, 4)); // brush
  if (cattle || kind === 'donkey') {
    const tuft = kind === 'buffalo' ? ((variant + seed) % 3 ? '#e9e4d8' : '#1a1818') : kind === 'cow' ? '#1e1410' : '#2a2420';
    X(tail2, ell(tuft, [0, T2[1] - 0.08, T2[2]], [0.045, 0.14, 0.045], {}, 6, 4));
  }

  // ---- coat pattern ----
  const pale = { cow: '#d9b38c', donkey: '#ddd6c8', dog: '#efe4cc', goat: '#e6dfd0', buffalo: col, sheep: col }[kind];
  const pc = new THREE.Color(pale), dc = new THREE.Color(dark), wc = new THREE.Color('#ece6d8'), bc = new THREE.Color(variant % 2 ? '#7a4a2a' : '#1f1a18');
  const ph = rnd() * 10, pf = 4 + rnd() * 4;
  let coat = null;
  if (kind === 'cow') {
    // darker neck, hump and thighs; paler underneath
    coat = (c, x, y, z) => {
      if (y < bodyY - H * 0.3 && y > legH * 0.6) c.lerp(pc, 0.35);
      if (z > a * 0.7 || z < -a * 0.55) c.lerp(dc, 0.22);
    };
  } else if (kind === 'donkey') {
    coat = (c, x, y, z) => {
      if (y < bodyY - H * 0.25 && y > legH * 0.5) c.lerp(pc, 0.7);
      else if (y > bodyY + H * 0.3 && (Math.abs(x) < W * 0.08 || (Math.abs(z - a * 0.62) < 0.05 && z < a))) c.lerp(dc, 0.75);
      else if (y < legH * 0.45) c.lerp(dc, 0.25);
    };
  } else if (kind === 'dog') {
    coat = (c, x, y, z) => {
      if ((y < bodyY - H * 0.15 && y > legH * 0.6) || (z > a * 0.7 && y < bodyY + H * 0.2 && y > legH)) c.lerp(pc, 0.7);
      else if (y < legH * 0.35) c.lerp(pc, 0.5);
      else if (y > bodyY + H * 0.3 && z < a) c.lerp(dc, 0.15);
    };
  } else if (kind === 'goat' && variant % 2 === 0) {
    // pied Beetal: big irregular patches
    const patch = col === '#e6dfd0' ? bc : wc;
    coat = (c, x, y, z) => {
      const n = Math.sin(x * pf * 1.3 + ph) + Math.sin(z * pf + y * 3 + ph * 2) + Math.sin((x + z) * pf * 0.7 + y * pf - ph);
      if (n > 0.9) c.copy(patch).multiplyScalar(0.95);
    };
  } else if (kind === 'goat' && col === '#8a5a36') {
    coat = (c, x, y, z) => { if (y > bodyY + H * 0.3 && Math.abs(x) < W * 0.08) c.lerp(dc, 0.8); else if (y < legH * 0.7) c.lerp(dc, 0.6); };
  } else if (kind === 'sheep') {
    coat = (c, x, y, z) => { if (y < legH * 0.9) c.lerp(new THREE.Color(face), 0.3); };
  }

  const mesh = R.build({ coat, rnd, mud: mudH });
  const group = new THREE.Group();
  group.add(mesh);
  mesh.scale.setScalar(1 + (rnd() - 0.5) * 0.12);

  // ---- grazing reach: find the neck angle that puts the muzzle on the ground ----
  const tip = hp(hl * 0.95, -hh * 0.3);
  const reach = (al, be) => {
    const vy = P[1] - N[1], vz = P[2] - N[2], my = tip[1] - P[1], mz = tip[2] - P[2];
    const b = al + be;
    return N[1] - legH * 0.06 + vy * Math.cos(al) - vz * Math.sin(al) + my * Math.cos(b) - mz * Math.sin(b);
  };
  let gN = 0, gH = s.gH, best = 1e9;
  search: for (let be = s.gH; be < 1.3; be += 0.1) {
    for (let al = 0; al < 1.6; al += 0.02) {
      const y = reach(al, be);
      if (y < best) { best = y; gN = al; gH = be; }
      if (y < 0.05) { gN = al; gH = be; break search; }
    }
  }

  return quadAnim(kind, s, group, mesh, {
    body, barrel, neck, head, jaw, ears, tail1, tail2, legs, bodyY, zs, zh, gN, gH, rnd,
  });
}

// ---------------------------------------------------------------- quadruped motion

function quadAnim(kind, s, group, mesh, r) {
  const { body, barrel, neck, head, jaw, ears, tail1, tail2, legs, bodyY, zs, zh, gN, gH, rnd } = r;
  const legH = s.legH, LL = legs[0].hipY;
  const stride = LL * (kind === 'dog' ? 0.3 : 0.26);
  const tMax = kind === 'dog' ? 1.0 : 1.7, tMin = kind === 'dog' ? 0.32 : 0.45;
  const dropL = legH * (kind === 'dog' ? 0.82 : 0.86);
  const span = zs - zh;
  const anim = {
    t: rnd() * 30, cyc: rnd(), blend: 0, amp: 0, trot: false,
    graze: 0, grazeT: 0, lie: 0, lieT: 0, sit: 0, sitT: 0, rear: 0, rearT: 0,
    look: 0, lookT: 0, excite: 0, pant: 0, cud: CUD[kind] ? 1 : 0,
    earT: [rnd() * 4, rnd() * 4], earF: [0, 0], tailT: rnd() * 5, tailF: 0, shufT: 2 + rnd() * 4,
    scr: 0, scrCd: 3, nod: 0,
  };
  const WALK = [0.25, 0.75, 0, 0.5]; // LF RF LH RH: lateral sequence, a quarter apart
  const TROT = [0.5, 0, 0, 0.5]; // diagonal pairs

  function ik(L, dz, dy) {
    const { l1, l2 } = L;
    const d = clamp(Math.hypot(dz, dy), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999);
    const phi = Math.atan2(dz, -dy);
    const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    // fore knees (carpi) fold the hoof back; hind hocks point back and fold the hoof forward
    const u = L.fore ? phi + A : phi - A;
    const kz = Math.sin(u) * l1, ky = -Math.cos(u) * l1;
    const w = Math.atan2(Math.sin(phi) * d - kz, -(-Math.cos(phi) * d - ky));
    L.up.rotation.x = -(u - L.u0);
    L.lo.rotation.x = -w - L.up.rotation.x;
  }

  const self = {
    kind, group, radius: { buffalo: 0.85, cow: 0.75, goat: 0.38, sheep: 0.4, donkey: 0.6, dog: 0.35 }[kind], anim, mesh,
    setGraze(v) { anim.grazeT = v ? 1 : 0; if (v) anim.lieT = 0; },
    setPose(p) {
      anim.lieT = p === 'lie' ? 1 : 0; anim.sitT = p === 'sit' ? 1 : 0; anim.rearT = p === 'rear' ? 1 : 0;
      if (p !== 'stand') anim.grazeT = 0;
    },
    isDown() { return anim.lie > 0.02 || anim.sit > 0.02 || anim.rear > 0.02 || anim.lieT + anim.sitT + anim.rearT > 0; },
    update(dt, speed = 0) {
      anim.t += dt;
      const t = anim.t;
      const moving = speed > 0.05;
      if (moving) { anim.lieT = 0; anim.sitT = 0; anim.rearT = 0; }
      anim.blend += ((moving ? 1 : 0) - anim.blend) * Math.min(1, dt * 5);
      const blend = anim.blend;
      const trot = kind === 'dog' && speed > 1.0;
      const duty = (moving ? trot : anim.trot) ? 0.5 : 0.66;
      if (moving) {
        const T = clamp((2 * stride) / (duty * speed), tMin, tMax);
        anim.amp = (speed * duty * T) / 2;
        anim.cyc += dt / T;
        anim.trot = trot;
      }
      const amp = anim.amp * blend, cyc = anim.cyc;
      anim.lie += clamp(anim.lieT - anim.lie, -dt * 0.33, dt * 0.33);
      anim.sit += clamp(anim.sitT - anim.sit, -dt * 1.6, dt * 1.6);
      anim.rear += clamp(anim.rearT - anim.rear, -dt * 1.3, dt * 1.3);
      anim.graze += (anim.grazeT - anim.graze) * Math.min(1, dt * 2.2);
      anim.look += (anim.lookT * (1 - anim.graze * 0.7) - anim.look) * Math.min(1, dt * 2.5);
      anim.pant = clamp(anim.pant + (blend > 0.5 ? dt * 0.2 : -dt * 0.03), 0, 1);
      // lying: forequarters go down first (onto the knees), and when rising the hind end comes up first
      const lf = smooth(anim.lie * 1.7), lr = smooth(anim.lie * 1.7 - 0.7);
      const sit = smooth(anim.sit), rear = smooth(anim.rear), grz = anim.graze;

      // dog scratching an ear while sitting
      if (kind === 'dog' && sit > 0.9) {
        anim.scrCd -= dt;
        if (anim.scrCd <= 0) { anim.scr = 1.2 + rnd() * 1.5; anim.scrCd = 4 + rnd() * 9; }
      }
      anim.scr = Math.max(0, anim.scr - dt);
      const scr = Math.min(1, anim.scr * 4) * sit;

      // ---- body ----
      const bob = blend * legH * 0.03 * (0.5 + 0.5 * Math.cos(4 * Math.PI * (cyc - 0.1)));
      const df = -dropL * lf - bob + rear * s.L * 0.5 - sit * 0.02 - grz * legH * 0.05;
      const dr = -dropL * lr - bob - sit * legH * 0.95 - rear * legH * 0.08;
      const pitch = Math.atan2(df - dr, span);
      body.position.y = bodyY + (df + dr) / 2;
      body.rotation.x = -pitch;
      body.rotation.z = Math.sin(2 * Math.PI * (cyc - 0.15)) * 0.03 * blend + lr * 0.1 + Math.sin(t * 0.21) * 0.01 * (1 - blend);
      const br = Math.sin(t * (lf > 0.5 ? 1.5 : kind === 'dog' ? 2.6 + anim.pant * 6 : 1.9)) * (0.012 + anim.pant * 0.01);
      barrel.scale.set(1 + br, 1 + br * 1.2, 1);

      // ---- legs ----
      if (!moving && blend < 0.1 && lf < 0.01 && sit < 0.01 && rear < 0.01) {
        // weight shifts while standing: now and then one foot is picked up and set down a little elsewhere
        anim.shufT -= dt * (grz > 0.5 ? 1.6 : 1);
        if (anim.shufT <= 0) {
          const L = legs[Math.floor(rnd() * 4)];
          if (L.step >= 1) { L.from = L.off; L.to = (grz > 0.5 ? rnd() * 0.9 - 0.25 : rnd() * 2 - 1) * stride * 0.4; L.step = 0; }
          anim.shufT = 2.5 + rnd() * 6;
        }
      }
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const offs = anim.trot ? TROT : WALK;
      for (let i = 0; i < 4; i++) {
        const L = legs[i];
        let gz, gy = 0;
        const p = frac(cyc + offs[i]);
        if (p < duty) gz = amp * (1 - (2 * p) / duty);
        else { const q = (p - duty) / (1 - duty); gz = -amp * Math.cos(Math.PI * q); gy = LL * (L.fore ? 0.2 : 0.16) * Math.sin(Math.PI * q) * blend; }
        if (L.step < 1) {
          L.step = Math.min(1, L.step + dt / 0.5);
          L.off = lerp(L.from, L.to, smooth(L.step));
          gy += Math.sin(Math.PI * L.step) * LL * 0.1;
        }
        if (moving) L.off *= 1 - Math.min(1, dt * 4);
        let tz = L.footZ + gz + L.off, ty = gy;
        // folded legs when lying: forearms tucked under the chest, hind legs tucked forward
        const fw = L.fore ? lf : lr;
        if (fw > 0) {
          const lz = kind === 'dog' ? (L.fore ? L.z0 + LL * 0.75 : L.z0 + LL * 0.45) : L.z0 + (L.l1 - L.l2) * (L.fore ? 0.55 : 0.6);
          tz = lerp(tz, lz, fw); ty = lerp(ty, 0.03, fw);
        }
        if (!L.fore && sit > 0) tz = lerp(tz, L.footZ + L.l1 * 0.55, sit);
        const hy = L.hipY - bodyY, hz = L.z0;
        const hipY = body.position.y + hy * cp + hz * sp, hipZ = -hy * sp + hz * cp;
        const ry = ty - hipY, rz = tz - hipZ;
        let ly = ry * cp - rz * sp, lz = ry * sp + rz * cp;
        if (L.fore && rear > 0) { ly = lerp(ly, -(L.l1 + L.l2) * 0.62, rear); lz = lerp(lz, L.l1 * 0.35, rear); }
        if (!L.fore && L.sd > 0 && scr > 0) {
          ly = lerp(ly, -L.l2 * 0.5 + Math.sin(t * 38) * 0.035, scr);
          lz = lerp(lz, L.l1 * 0.95, scr);
        }
        ik(L, lz, ly);
        L.up.rotation.z = !L.fore && L.sd > 0 ? -lr * 0.3 - scr * 0.35 : 0;
      }

      // ---- neck, head, jaw ----
      anim.nod = blend * (kind === 'dog' ? 0.03 : 0.07) * Math.cos(4 * Math.PI * (cyc - 0.3));
      const crop = grz > 0.5 ? Math.max(0, Math.sin(t * 2.4)) ** 6 * 0.1 : 0; // a tug as the grass tears
      const idle = Math.sin(t * 0.43) * 0.04 + Math.sin(t * 0.17) * 0.05;
      neck.rotation.x = grz * gN + anim.nod + idle * (1 - grz) - rear * 0.55 - lf * 0.6 - sit * 0.15 + pitch * 0.4 * (sit + rear);
      head.rotation.x = grz * gH + crop - rear * 0.25 + lf * 0.3 + (kind === 'dog' ? grz * Math.sin(t * 15) * 0.05 : 0) + sit * 0.1;
      neck.rotation.y = anim.look * 0.55 + grz * Math.sin(t * 0.37) * 0.22 + scr * 0.4;
      head.rotation.y = anim.look * 0.45;
      head.rotation.z = scr * 0.45 + (kind === 'dog' ? Math.max(0, Math.sin(t * 0.3)) ** 8 * 0.3 * (1 - blend) : 0);
      let jx = 0, jy = 0;
      if (grz > 0.4) jx = Math.max(0, Math.sin(t * 2 * Math.PI * 1.5)) * 0.16 * grz;
      else if (anim.cud && blend < 0.3 && rear < 0.5 && t % 40 < 33) {
        const ch = t * 2 * Math.PI * 1.1; // chewing the cud: a sideways grinding chew
        jx = (0.5 + 0.5 * Math.sin(ch)) * 0.07; jy = Math.cos(ch) * 0.09;
      } else if (rear > 0.5) jx = Math.max(0, Math.sin(t * 9)) * 0.15;
      if (kind === 'dog' && anim.pant > 0.1) jx = Math.max(jx, anim.pant * (0.28 + Math.sin(t * 16) * 0.04));
      jaw.rotation.x = jx; jaw.rotation.y = jy;

      // ---- ears ----
      for (let k = 0; k < 2; k++) {
        anim.earT[k] -= dt;
        if (anim.earT[k] <= 0) { anim.earF[k] = 1; anim.earT[k] = 1.5 + rnd() * 7; if (rnd() < 0.4) { anim.earF[1 - k] = 1; } }
        anim.earF[k] = Math.max(0, anim.earF[k] - dt * 3.5);
        const f = anim.earF[k] * Math.sin(t * 34 + k) * 0.5, sd = k ? 1 : -1, e = ears[k];
        if (kind === 'goat') {
          e.rotation.x = Math.sin(t * 9) * 0.1 * blend - grz * 0.3 + f * 0.3;
          e.rotation.z = sd * (0.08 + f * 0.3 + Math.sin(4 * Math.PI * cyc) * 0.08 * blend);
        } else if (kind === 'donkey' || kind === 'dog') {
          const back = kind === 'dog' ? blend * 0.35 - anim.excite * 0.2 : Math.sin(t * 0.3 + k * 2) * 0.35;
          e.rotation.x = back + f * 0.4;
          e.rotation.y = -sd * anim.look * 0.3;
        } else {
          e.rotation.y = f; e.rotation.z = sd * f * 0.6 + sd * Math.sin(t * 0.25 + k) * 0.08;
        }
      }

      // ---- tail ----
      anim.tailT -= dt;
      if (anim.tailT <= 0) { anim.tailF = 1; anim.tailT = 2.5 + rnd() * 8; }
      anim.tailF = Math.max(0, anim.tailF - dt * 1.1);
      if (kind === 'dog') {
        const ex = Math.max(anim.excite, 0.15);
        const wag = ex * Math.sin(t * (6 + anim.excite * 8)) * 0.5;
        tail1.rotation.z = wag; tail2.rotation.z = wag * 0.6;
        tail1.rotation.x = sit * 0.9 + lf * 1.2 - anim.excite * 0.15;
      } else if (kind === 'goat') {
        tail1.rotation.z = anim.tailF * Math.sin(t * 28) * 0.5;
        tail1.rotation.x = rear * 0.4;
      } else if (kind === 'sheep') {
        tail1.rotation.x = blend * Math.sin(4 * Math.PI * cyc) * 0.06;
        tail1.rotation.z = blend * Math.sin(2 * Math.PI * cyc) * 0.05 + anim.tailF * Math.sin(t * 20) * 0.1;
      } else {
        const fl = anim.tailF * anim.tailF;
        tail1.rotation.z = Math.sin(t * 1.1) * 0.06 + fl * Math.sin(t * 6.5) * 0.7 + blend * Math.sin(2 * Math.PI * cyc) * 0.08;
        tail2.rotation.z = Math.sin(t * 1.1 - 0.9) * 0.1 + fl * Math.sin(t * 6.5 - 1.3) * 0.8;
        tail1.rotation.x = -fl * 0.25 + lr * 0.35;
      }
    },
  };
  return self;
}

// ---------------------------------------------------------------- chickens

function makeChicken(variant, seed = 0) {
  const v = variant % 4;
  const cols = [['#8a4a22', '#5a2f18', '#b8743a'], ['#efe9dc', '#d9d2c2', '#efe9dc'], ['#2a2422', '#8a2a1a', '#d08a2a'], ['#b8743a', '#7a4a22', '#d0a060']][v];
  const rooster = v === 2;
  detail = 0.75;
  const rnd = makeRng(500 + variant * 31 + seed * 7);
  const R = new Rig();
  const root = R.bone(null, 0, 0, 0);
  const body = R.bone(root, 0, 0.24, -0.02);
  const neck = R.bone(body, 0, 0.31, 0.08);
  const head = R.bone(neck, 0, 0.45, 0.13);
  const tail = R.bone(body, 0, 0.32, -0.14);
  const [c0, c1, hack] = cols;
  const yel = '#d9a83a', red = '#c81e1e';
  R.add(body, ell(c0, [0, 0.27, -0.01], [0.11, 0.11, 0.16], { rx: -0.15 }));
  R.add(body, ell(c0, [0, 0.25, 0.07], [0.095, 0.1, 0.09], {}, 7, 5));
  for (const sd of [-1, 1]) R.add(body, ell(c1, [sd * 0.092, 0.28, -0.02], [0.03, 0.075, 0.125], { rx: -0.15 }, 6, 4));
  if (rooster) {
    for (const x of [-0.012, 0.012]) {
      const pts = [[x, 0.33, -0.13], [x, 0.47, -0.2], [x, 0.5, -0.28], [x * 2, 0.42, -0.35]];
      for (let i = 0; i < 3; i++) R.add(tail, seg(pts[i], pts[i + 1], 0.03 - i * 0.007, 0.023 - i * 0.007, '#1f3a2a', 4, 0.35));
    }
  } else R.add(tail, box(0.025, 0.13, 0.11, c1, { y: 0.37, z: -0.17, rx: -0.5 }));
  R.add(neck, seg([0, 0.29, 0.07], [0, 0.45, 0.13], 0.055, 0.035, hack, 6));
  R.add(head, ell(hack, [0, 0.465, 0.145], [0.036, 0.042, 0.05], {}, 6, 5));
  R.add(head, cone(0.015, 0.045, yel, 4, { y: 0.46, z: 0.205, rx: Math.PI / 2 + 0.3 }));
  R.add(head, box(0.012, rooster ? 0.06 : 0.03, rooster ? 0.08 : 0.05, red, { y: rooster ? 0.52 : 0.505, z: 0.15 }));
  R.add(head, box(0.012, rooster ? 0.045 : 0.025, 0.02, red, { y: 0.425, z: 0.18 }));
  for (const sd of [-1, 1]) R.add(head, ell('#140f0c', [sd * 0.033, 0.472, 0.165], [0.008, 0.01, 0.01], {}, 4, 3));
  const legs = [-1, 1].map((sd) => {
    const x = sd * 0.045;
    const up = R.bone(root, x, 0.2, 0), lo = R.bone(up, x, 0.1, -0.01);
    R.add(up, ell(c0, [x, 0.18, 0], [0.035, 0.05, 0.045], {}, 6, 4));
    R.add(up, seg([x, 0.17, 0], [x, 0.1, -0.01], 0.013, 0.011, yel, 4));
    R.add(lo, seg([x, 0.1, -0.01], [x, 0.012, 0.0], 0.011, 0.01, yel, 4));
    for (const k of [-1, 0, 1]) R.add(lo, box(0.008, 0.008, 0.055, yel, { x: x + k * 0.012, y: 0.005, z: 0.027, ry: k * 0.45 }));
    R.add(lo, box(0.008, 0.008, 0.03, yel, { x, y: 0.005, z: -0.015 }));
    return { up, lo };
  });
  const mesh = R.build({ rnd, jitter: 0.06 });
  const group = new THREE.Group();
  group.add(mesh);
  if (rooster) mesh.scale.setScalar(1.2);

  const anim = { t: rnd() * 10, cyc: 0, blend: 0, grazeT: 0, peck: 1, peckT: rnd() * 2, look: 0, lookT: 0, lookC: 0.5, tilt: 0, tiltT: 0, scratch: 1, scratchT: 4 + rnd() * 6 };
  return {
    kind: 'chicken', group, radius: 0.15, anim, mesh,
    setGraze(v) { anim.grazeT = v ? 1 : 0; },
    setPose() {}, isDown() { return false; },
    update(dt, speed = 0) {
      anim.t += dt;
      const t = anim.t, moving = speed > 0.05;
      anim.blend += ((moving ? 1 : 0) - anim.blend) * Math.min(1, dt * 10);
      const blend = anim.blend;
      if (moving) anim.cyc += (dt * speed) / 0.26;
      const cyc = anim.cyc;
      // legs: alternate, foot folds up during the swing
      for (let k = 0; k < 2; k++) {
        const p = frac(cyc + k * 0.5), L = legs[k];
        let ux, lx = 0;
        if (p < 0.55) ux = -0.4 * (1 - (2 * p) / 0.55);
        else { const q = (p - 0.55) / 0.45; ux = 0.4 * Math.cos(Math.PI * q); lx = Math.sin(Math.PI * q) * 1.1; }
        L.up.rotation.x = ux * blend; L.lo.rotation.x = lx * blend;
      }
      // scratching the ground: a couple of backward rakes with one foot, then a step back
      if (anim.grazeT && !moving) {
        anim.scratchT -= dt;
        if (anim.scratchT <= 0) { anim.scratch = 0; anim.scratchT = 5 + rnd() * 10; anim.sLeg = rnd() < 0.5 ? 0 : 1; }
      }
      if (anim.scratch < 1) {
        anim.scratch = Math.min(1, anim.scratch + dt / 0.9);
        const r = Math.sin(anim.scratch * Math.PI * 3);
        const L = legs[anim.sLeg];
        L.up.rotation.x = -0.2 + Math.max(0, r) * 0.7; L.lo.rotation.x = Math.max(0, -r) * 0.9;
      }
      // head stays still in space while the body walks under it, then darts forward
      const h = frac(cyc * 2);
      const hold = h < 0.7 ? 0.5 - h / 0.7 : -0.5 + (h - 0.7) / 0.3;
      let nx = hold * 0.7 * blend, hx = 0, bx = 0;
      body.position.y = 0.24 - Math.abs(Math.sin(2 * Math.PI * cyc)) * 0.012 * blend;
      body.rotation.z = Math.sin(2 * Math.PI * cyc) * 0.09 * blend;
      // pecking
      if (anim.grazeT && !moving && anim.scratch >= 1) {
        anim.peckT -= dt;
        if (anim.peckT <= 0) { anim.peck = 0; anim.peckT = rnd() < 0.35 ? 0.35 : 0.5 + rnd() * 2.2; }
      }
      if (anim.peck < 1) {
        anim.peck = Math.min(1, anim.peck + dt / 0.32);
        const k = Math.sin(Math.PI * anim.peck) ** 0.7;
        bx += k * 0.45; nx += k * 1.0; hx += k * 0.35;
      }
      // looking about in quick saccades, often with one eye turned up
      anim.lookT -= dt;
      if (anim.lookT <= 0) {
        anim.lookC = (rnd() * 2 - 1) * (anim.grazeT ? 0.5 : 1.1);
        anim.tiltT = rnd() < 0.3 ? (rnd() < 0.5 ? -0.45 : 0.45) : 0;
        anim.lookT = 0.3 + rnd() * 1.6;
      }
      anim.look += (anim.lookC * (1 - blend * 0.8) - anim.look) * Math.min(1, dt * 22);
      anim.tilt += (anim.tiltT * (1 - blend) - anim.tilt) * Math.min(1, dt * 15);
      body.rotation.x = bx + blend * 0.1;
      neck.rotation.x = nx;
      head.rotation.x = hx - nx * 0.9 - blend * 0.1;
      head.rotation.y = anim.look;
      head.rotation.z = anim.tilt;
      tail.rotation.x = Math.sin(t * 3) * 0.04 + Math.sin(2 * Math.PI * cyc) * 0.1 * blend;
    },
  };
}

// ---------------------------------------------------------------- behaviour

const SPEEDS = { buffalo: 0.7, cow: 0.8, goat: 1.1, sheep: 0.9, donkey: 0.9, dog: 1.6, chicken: 0.9 };

export const animals = [];

// tether: stays where it is (tied at a manger or wallowing in the pond).
export function spawnAnimal(scene, kind, x, z, { variant = 0, tether = false, roam = 8, yaw = 0, sunk = 0, graze = false } = {}) {
  const seed = Math.abs(Math.floor(x * 7.3 + z * 13.1)) % 97;
  const a = makeAnimal(kind, variant, seed);
  a.x = x; a.z = z; a.yaw = yaw; a.sunk = sunk;
  a.home = { x, z }; a.roam = roam; a.tether = tether;
  a.mode = 'idle'; a.timer = Math.random() * 4; a.speed = 0; a.target = null; a.scare = 0; a.slow = false;
  a.group.position.set(x, heightAt(x, z) - sunk, z);
  a.group.rotation.y = yaw;
  if (graze) a.setGraze(true);
  // some tethered cattle are already lying down, chewing the cud
  if (tether && !sunk && (kind === 'cow' || kind === 'buffalo') && Math.random() < 0.35) {
    a.setPose('lie'); a.anim.lie = 1; a.timer = 20 + Math.random() * 40;
  }
  if (kind !== 'chicken') a.body = addDynamic({ x, z, r: a.radius, off: sunk > 0 });
  a.update(0.016, 0);
  scene.add(a.group);
  animals.push(a);
  return a;
}

function tetherThink(a, dt) {
  a.timer -= dt;
  if (a.timer > 0) return;
  const big = a.kind === 'cow' || a.kind === 'buffalo';
  const r = Math.random();
  if (a.sunk) { a.anim.cud = r < 0.75 ? 1 : 0; a.timer = 6 + Math.random() * 12; return; }
  if (a.isDown()) {
    if (r < 0.45) { a.setPose('stand'); a.timer = 6; } else a.timer = 15 + Math.random() * 25;
    return;
  }
  if (big && r < 0.18) { a.setPose('lie'); a.timer = 40 + Math.random() * 60; }
  else if (a.kind === 'goat' && r < 0.15) { a.setPose('rear'); a.timer = 2.5 + Math.random() * 3; }
  else if (r < 0.68) { a.setGraze(true); a.timer = 8 + Math.random() * 20; }
  else { a.setGraze(false); a.anim.cud = CUD[a.kind] || 0; a.timer = 6 + Math.random() * 14; }
}

// Places to get out of the rain: { x, z, r, roof } (roof: a veranda, else a tree canopy).
let shelters = [];
export function setShelters(list) { shelters = list; }

// Free-roaming animals that can make for cover do so when it rains, and wander back after.
// Tethered cattle have no choice, and the buffalo in the pond are happy where they are.
function rainThink(a, rain) {
  if (a.tether || a.sunk) return;
  if (!a.sheltered && rain > 0.25) {
    if (a.shelter === undefined) {
      // chickens only go as far as their own yard's veranda; the rest to any cover nearby
      const reach = a.kind === 'chicken' ? 14 : 35;
      let best = null, bd = reach * reach;
      for (const s of shelters) {
        if (a.kind === 'chicken' && !s.roof) continue;
        const d = (s.x - a.home.x) ** 2 + (s.z - a.home.z) ** 2;
        if (d < bd) { bd = d; best = s; }
      }
      a.shelter = best;
    }
    if (!a.shelter) return;
    a.sheltered = true;
    a.dryHome = a.home; a.dryRoam = a.roam;
    a.home = { x: a.shelter.x, z: a.shelter.z }; a.roam = a.shelter.r;
    a.hurry = true;
    if (a.isDown()) a.setPose('stand');
    a.setGraze(false);
    a.mode = 'idle'; a.timer = Math.random() * 0.8;
  } else if (a.sheltered && rain < 0.05) {
    a.sheltered = false;
    a.home = a.dryHome; a.roam = a.dryRoam;
    a.mode = 'idle'; a.timer = Math.random() * 6;
  }
  if (a.sheltered && a.mode === 'idle' && Math.hypot(a.x - a.home.x, a.z - a.home.z) < a.roam + 0.5) a.hurry = false;
}

export function updateAnimals(dt, player, camPos, rain = 0) {
  for (const a of animals) {
    rainThink(a, rain);
    // Skip the thinking for animals that are far away; keep them posed.
    const d2 = (a.x - camPos.x) ** 2 + (a.z - camPos.z) ** 2;
    // beyond the haze they are not drawn at all; a little nearer they just stand
    a.group.visible = d2 < 190 * 190;
    // only animals near the camera cast shadows
    const cast = d2 < 45 * 45 && a.kind !== 'chicken';
    if (cast !== a.casting) { a.casting = cast; a.group.traverse((m) => { if (m.isMesh) m.castShadow = cast; }); }
    if (d2 > 110 * 110) continue;

    const pdx = a.x - player.x, pdz = a.z - player.z;
    const pd = Math.hypot(pdx, pdz);
    if (a.kind !== 'chicken') {
      // turn the head toward someone who comes close in front
      let look = 0;
      if (pd < 7) { const rel = angDiff(a.yaw, Math.atan2(-pdx, -pdz)); if (Math.abs(rel) < 2.2) look = clamp(rel, -1.1, 1.1); }
      a.anim.lookT = look;
      if (a.kind === 'dog') a.anim.excite = pd < 5 ? 1 : 0;
    }

    if (a.tether) {
      tetherThink(a, dt);
      a.update(dt, 0);
      continue;
    }

    // Chickens scatter when someone comes close; the dog comes to say hello.
    if (a.kind === 'chicken' && pd < 2.2 && a.scare <= 0) {
      a.scare = 1.2;
      a.target = { x: a.x + (pdx / (pd || 1)) * 4, z: a.z + (pdz / (pd || 1)) * 4 };
      a.mode = 'walk'; a.slow = false;
      a.setGraze(false);
    }
    a.scare -= dt;

    if (a.mode === 'walk' && a.target) {
      const dx = a.target.x - a.x, dz = a.target.z - a.z;
      const d = Math.hypot(dx, dz);
      const sniff = a.kind === 'dog' && a.anim.grazeT;
      const sp = SPEEDS[a.kind] * (a.scare > 0 ? 3.2 : a.hurry ? 2.2 : 1) * (a.slow ? 0.3 : sniff ? 0.5 : 1);
      if (d < (a.slow ? 0.12 : 0.4)) {
        a.mode = 'idle'; a.speed = 0;
        a.timer = a.slow ? 2 + Math.random() * 5 : 2 + Math.random() * 7;
        if (!a.slow) a.setGraze(!a.sheltered && a.kind !== 'dog' && Math.random() < 0.7);
        else if (a.kind === 'dog') a.setGraze(false);
      } else {
        const want = Math.atan2(dx, dz);
        a.yaw += angDiff(a.yaw, want) * Math.min(1, dt * (a.slow ? 1.5 : 3));
        a.speed = sp;
        const px = a.x, pz = a.z;
        a.x += Math.sin(a.yaw) * sp * dt;
        a.z += Math.cos(a.yaw) * sp * dt;
        if (a.kind !== 'chicken' && resolve(a, a.radius, a.body)) {
          if (Math.hypot(a.x - px, a.z - pz) < sp * dt * 0.4) { a.mode = 'idle'; a.timer = 1 + Math.random() * 2; }
        }
      }
    } else {
      a.speed = 0;
      a.timer -= dt;
      if (a.kind === 'dog' && pd < 7 && !a.isDown()) {
        a.yaw += angDiff(a.yaw, Math.atan2(-pdx, -pdz)) * Math.min(1, dt * 4);
      }
      if (a.timer <= 0) {
        const r = Math.random();
        if (a.isDown()) { a.setPose('stand'); a.timer = 1.2; }
        else if (a.kind === 'dog' && r < 0.4) { a.setPose(r < 0.15 ? 'lie' : 'sit'); a.timer = 6 + Math.random() * 18; }
        else if (a.kind === 'goat' && a.anim.grazeT && r < 0.18) { a.setPose('rear'); a.timer = 2.5 + Math.random() * 3; }
        else if (!a.sheltered && (a.kind === 'goat' || a.kind === 'sheep' || a.kind === 'donkey') && a.anim.grazeT && r < 0.65) {
          // graze on: a slow step or two to the next mouthful
          const ang = a.yaw + (Math.random() - 0.5) * 1.2, st = 0.35 + Math.random() * 0.6;
          const tx = a.x + Math.sin(ang) * st, tz = a.z + Math.cos(ang) * st;
          if (Math.hypot(tx - a.home.x, tz - a.home.z) < a.roam && !blocked(tx, tz, a.radius + 0.1)) { a.target = { x: tx, z: tz }; a.mode = 'walk'; a.slow = true; }
          else a.timer = 1;
        } else {
          for (let tries = 0; tries < 6; tries++) {
            const ang = Math.random() * Math.PI * 2, rr = Math.random() * a.roam;
            const tx = a.home.x + Math.cos(ang) * rr, tz = a.home.z + Math.sin(ang) * rr;
            if (!blocked(tx, tz, a.radius + 0.2)) {
              a.target = { x: tx, z: tz }; a.mode = 'walk'; a.slow = false;
              a.setGraze(a.kind === 'dog' && Math.random() < 0.3); // a dog sometimes follows its nose
              break;
            }
          }
          if (a.mode !== 'walk') a.timer = 2;
        }
      }
    }

    if (a.body) { a.body.x = a.x; a.body.z = a.z; }
    a.group.position.set(a.x, heightAt(a.x, a.z), a.z);
    a.group.rotation.y = a.yaw;
    a.update(dt, a.speed);
  }
}

// ---- Birds that just stand about -------------------------------------------

// Cattle egret: the white bird that follows buffalo and tractors.
export function egret(b, x, z, ry = 0) {
  b.push(x, 0, z, ry);
  b.add(sph(0.12, '#f4f2ec', { y: 0.42, sz: 1.6 }));
  b.add(cyl(0.03, 0.04, 0.3, '#f4f2ec', 5, { y: 0.6, z: 0.14, rx: 0.4 }));
  b.add(sph(0.045, '#f4f2ec', { y: 0.75, z: 0.2 }));
  b.add(cone(0.015, 0.12, '#e2a83a', 4, { y: 0.74, z: 0.3, rx: Math.PI / 2 }));
  for (const s of [-1, 1]) b.add(cyl(0.008, 0.008, 0.34, '#3a3a34', 4, { x: s * 0.03, y: 0.17 }));
  b.pop();
}

export function crow(b, x, y, z, ry = 0) {
  b.push(x, y, z, ry);
  b.add(sph(0.07, '#17171a', { y: 0.08, sz: 1.7 }));
  b.add(sph(0.045, '#4a4a50', { y: 0.15, z: 0.09 }));
  b.add(cone(0.014, 0.07, '#17171a', 4, { y: 0.15, z: 0.16, rx: Math.PI / 2 }));
  b.add(box(0.05, 0.012, 0.14, '#17171a', { y: 0.07, z: -0.16, rx: 0.2 }));
  b.pop();
}
