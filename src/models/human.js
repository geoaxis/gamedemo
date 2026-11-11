import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, cyl, sph, dome, cone, torus, getMat } from './build.js';
import { wind } from '../systems/wind.js';

// A jointed low-poly person dressed the way people dress in a Punjab village: shalwar kameez
// with a pagri, topi, dupatta, chadar, shawl, waistcoat, sweater or tehmad as options.
//
// Every person is ONE skinned mesh: each body part is modelled rigidly and tied to a single
// bone, so it looks exactly like a puppet of separate pieces but costs one draw call. The
// bones are a small skeleton (pelvis, spine, head, shoulders, elbows, wrists, hips, knees,
// ankles, and a few cloth pivots that the wind and the legs push about).
//
// Walking is procedural: the feet follow a gait cycle (heel strike, flat stance, heel rise,
// swing with lift) and two-bone IK solves the hip and knee for them, so planted feet stay put
// and the pelvis rises and dips the way an inverted pendulum does.

const SKIN = ['#b98a62', '#a97b55', '#c49a70', '#9c6f4c', '#8e6446'];

const DEFAULTS = {
  kameez: '#8fb0c9',
  shalwar: null, // defaults to the kameez colour: suits are usually one cloth
  skin: SKIN[0],
  hair: '#1a1512',
  hairStyle: 'short', // short | parted | bald | long (women: hidden under the dupatta, braid)
  headwear: 'none', // none | topi | jinnah | pagri | turla | parna | beanie | dupatta | chadar
  headColor: '#f2efe6',
  beard: 'none', // none | stubble | short | full | long | white
  beardColor: null,
  moustache: true, // true | false | 'thin' | 'thick' | 'handlebar'
  brow: 0, // tilt of the eyebrows: + stern, - kindly
  nose: 1,
  glasses: false,
  shoulderCloth: null, // a parna / ajrak / chequered scarf over the left shoulder
  scarfStripe: null,
  waistcoat: null,
  sweater: null,
  shawl: null, // draped over the shoulders, one end flung back
  chadar: null, // a big blanket wrap (loi) over shoulders and arms; women: over the head too
  lower: 'shalwar', // shalwar | dhoti
  dhotiColor: '#d8d2c2',
  hem: null, // kameez hem height (auto)
  trim: null, // embroidered border on a woman's kameez
  sleeves: 'long', // long | rolled
  shoes: 'chappal', // chappal | peshawari | khussa | bare
  shoeColor: null,
  female: false,
  scale: 1,
  build: 1, // overall girth
  belly: 0, // 0..1
  shoulders: 1,
  stoop: null, // radians of forward bend (default from gait)
  gait: null, // normal | proud | elder | kid | woman
  pose: 'rest', // idle arms: rest | behind | clasp | hips | crossed | lathi
  habits: null, // idle actions to pick from
  watch: false,
  bangles: null, // colour
  prop: null, // lathi | can | bat | stick | tasbeeh
  carry: null, // gathri | fodder | bag | schoolbag
  carryColor: '#b8423a',
  grease: false,
};

const GAITS = {
  normal: { cadence: 1, swing: 1, sway: 1, roll: 1, bounce: 1, lean: 0.03, stoop: 0, elbow: 0.22, width: 0.1, stance: 0.12, lift: 1, toe: 0.08, speed: 1.25 },
  proud: { cadence: 0.94, swing: 1.15, sway: 1.15, roll: 0.8, bounce: 0.9, lean: -0.02, stoop: 0, elbow: 0.16, width: 0.13, stance: 0.15, lift: 0.9, toe: 0.16, speed: 1.15 },
  elder: { cadence: 1.1, swing: 0.45, sway: 1.5, roll: 0.6, bounce: 0.45, lean: 0.06, stoop: 0.2, elbow: 0.38, width: 0.15, stance: 0.14, lift: 0.5, toe: 0.17, speed: 0.85 },
  kid: { cadence: 1, swing: 1.3, sway: 0.8, roll: 0.8, bounce: 1.9, lean: 0.04, stoop: 0, elbow: 0.42, width: 0.08, stance: 0.1, lift: 1.4, toe: 0.04, speed: 1.3 },
  woman: { cadence: 1.08, swing: 0.7, sway: 0.65, roll: 1.6, bounce: 0.8, lean: 0.01, stoop: 0, elbow: 0.32, width: 0.04, stance: 0.08, lift: 0.85, toe: 0.03, speed: 1.15 },
};

// Rest-pose skeleton (model space, metres, before the person's scale).
const HIP_Y = 0.9, L1 = 0.43, L2 = 0.395, ANK = 0.075, LMAX = L1 + L2;
const SPINE_Y = 0.97, HEAD_Y = 1.52, SPLIT = 0.52;

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const frac = (x) => x - Math.floor(x);
const k = (rate, dt) => 1 - Math.exp(-rate * dt);
const rnd = (a, b) => a + Math.random() * (b - a);
const _c = new THREE.Color();
const shade = (hex, f) => '#' + _c.set(hex).multiplyScalar(f).getHexString();
const mix = (a, b, t) => '#' + _c.set(a).lerp(new THREE.Color(b), t).getHexString();

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
  // geometry authored relative to the bone's rest position
  add(bone, g) {
    const r = bone.userData.rest;
    g.translate(r.x, r.y, r.z);
    this.parts.push([bone.userData.idx, g]);
  }
  build() {
    const geoms = this.parts.map(([i, g]) => {
      const n = g.attributes.position.count;
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let v = 0; v < n; v++) { si[v * 4] = i; sw[v * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      return g;
    });
    const geo = mergeGeometries(geoms);
    const mesh = new THREE.SkinnedMesh(geo, getMat('flat'));
    const inv = this.bones.map((b) => new THREE.Matrix4().makeTranslation(-b.userData.rest.x, -b.userData.rest.y, -b.userData.rest.z));
    const skeleton = new THREE.Skeleton(this.bones, inv);
    mesh.add(this.bones[0]);
    mesh.bind(skeleton, new THREE.Matrix4());
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.85, 0), 1.6);
    mesh.boundingBox = new THREE.Box3(new THREE.Vector3(-1.2, -0.6, -1.2), new THREE.Vector3(1.2, 2.4, 1.2));
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    return mesh;
  }
}

// ---------------------------------------------------------------- poses
// An arm pose: shoulder x (forward swing is negative), z (out from the body = side * +),
// y (twist about the upper arm; with the elbow bent it decides where the forearm points),
// e (elbow, negative bends the forearm forward). `s` is -1 for armL (on -x), +1 for armR.

const POSES = {
  rest: (s) => ({ x: -0.04, z: s * 0.07, y: 0, e: -0.16 }),
  behind: (s) => ({ x: 0.42, z: s * 0.01, y: -s * 1.47, e: -0.66 }),
  clasp: (s) => ({ x: -0.01, z: 0, y: -s * 0.86, e: -0.93 }),
  hips: (s) => ({ x: 0.22, z: s * 0.67, y: -s * 1.23, e: -1.4 }),
  crossed: (s) => ({ x: -0.26, z: -s * 0.08 + (s < 0 ? 0.04 : 0), y: -s * 1.24, e: s < 0 ? -1.4 : -1.6 }),
  lathi: (s) => (s > 0 ? { x: -0.32, z: s * 0.14, y: s * 0.1, e: -0.55 } : { x: 0.42, z: s * 0.01, y: -s * 1.47, e: -0.66 }),
  sit: (s) => ({ x: -0.43, z: s * 0.02, y: -s * 0.7, e: -0.34 }),
  drive: (s) => ({ x: -1.12, z: s * 0.07, y: 0, e: -0.3 }),
  carry: (s) => ({ x: 0.02, z: s * 0.2, y: 0, e: -0.05 }),
  holdHead: (s) => ({ x: -0.04, z: s * 2.58, y: s * 1.51, e: -1.34 }),
};

// Things people do while standing about. t is seconds into the action. Hand targets were
// solved for with a little FK search (hand on the head, at the chin, phone at chest, ...).
const wob = (t, f, a) => a * Math.sin(t * f);
const ACTS = {
  scratch: { arms: 'R', dur: [2.2, 3.5], pose: (t, s) => ({ x: 0.24, z: s * 2.58, y: s * 1.87, e: -1.63 + wob(t, 17, 0.12) }), head: () => ({ x: 0.15, y: 0, z: -0.12 }) },
  beard: { arms: 'R', dur: [2.5, 4.5], pose: (t, s) => ({ x: -1.12 + wob(t, 4.5, 0.08), z: -s * 0.27, y: -s * 0.71, e: -2.17 + wob(t, 4.5, 0.12) }), head: () => ({ x: -0.12, y: 0.1, z: 0 }) },
  moustache: { arms: 'R', dur: [2, 3], pose: (t, s) => ({ x: -1.5, z: s * 0.22, y: -s * 0.77, e: -2.15 + wob(t, 9, 0.06) }), head: () => ({ x: -0.12, y: 0.15, z: 0 }) },
  shawl: { arms: 'both', dur: [2.2, 3], pose: (t, s) => ({ x: -0.57 + 0.4 * sstep(0.7, 1.8, t), z: -s * 0.03 + s * 0.4 * sstep(0.7, 1.8, t), y: -s * 1.06, e: -2.13 + 1.2 * sstep(0.7, 1.8, t) }), head: () => ({ x: 0.2, y: 0, z: 0 }) },
  dupatta: { arms: 'R', dur: [2, 3], pose: (t, s) => ({ x: -2.47 + 0.15 * sstep(0.8, 1.6, t), z: s * 0.63, y: -s * 0.93, e: -1.75 }), head: () => ({ x: 0.05, y: -0.1, z: -0.08 }) },
  phone: { arms: 'R', dur: [5, 9], prop: 'phone', pose: (t, s) => ({ x: -0.33, z: s * 0.05, y: -s * 0.46, e: -1.96 + wob(t, 1.3, 0.04) }), head: () => ({ x: 0.45, y: 0.15, z: 0 }) },
  watch: { arms: 'L', dur: [2, 3], pose: (t, s) => ({ x: -0.44, z: s * 0.15, y: -s * 0.52, e: -2.0 }), head: () => ({ x: 0.4, y: -0.25, z: 0 }) },
  tasbeeh: { arms: 'L', dur: [6, 12], pose: (t, s) => ({ x: 0, z: s * 0.1, y: -s * 0.54, e: -1.67 + wob(t, 6, 0.03) }), head: () => ({ x: 0.15, y: 0, z: 0 }) },
  smoke: { arms: 'R', dur: [3, 4.5], pose: (t, s) => ({ x: -1.45, z: -s * 0.02, y: -s * 0.74, e: -2.09 }), head: () => ({ x: -0.1, y: 0.05, z: 0 }) },
  wipe: { arms: 'both', dur: [2.5, 3.5], pose: (t, s) => ({ x: -0.13, z: s * 0.14, y: -s * 0.96 + wob(t + s, 9, 0.15), e: -1.44 }), head: () => ({ x: 0.3, y: 0, z: 0 }) },
  swish: { arms: 'R', dur: [1.4, 2], pose: (t, s) => ({ x: -0.3 - 0.5 * Math.sin(t * 7), z: s * 0.3, y: 0, e: -0.5 }), head: () => ({ x: 0.1, y: 0.2, z: 0 }) },
  stretch: { arms: 'both', dur: [2.5, 3.2], pose: (t, s) => ({ x: 0.42, z: s * 0.1, y: -s * 1.47, e: -0.8 }), head: () => ({ x: -0.25, y: 0, z: 0 }), spine: -0.1 },
  bat: { arms: 'R', dur: [1.6, 2.2], pose: (t, s) => ({ x: -0.7 + 0.6 * Math.sin(t * 5), z: s * 0.3, y: 0, e: -0.4 }), head: () => ({ x: 0.1, y: 0, z: 0 }) },
};
// open-handed gestures while speaking, around a palm-up rest in front of the belly
const TALK = (t, s, side) => ({
  x: -0.07 - 0.3 * (0.5 + 0.5 * Math.sin(t * 2.1 + side)),
  z: s * (0.3 + 0.08 * Math.sin(t * 1.4)),
  y: -s * (0.15 + 0.25 * Math.sin(t * 1.7 + side)),
  e: -1.45 + 0.35 * Math.sin(t * 3.1 + side * 2),
});

const DEFAULT_HABITS = ['scratch', 'stretch'];

// ---------------------------------------------------------------- the person

export function makeHuman(options = {}) {
  const o = { ...DEFAULTS, ...options };
  const female = o.female;
  const kid = o.scale < 0.85;
  const gaitName = o.gait || (kid ? 'kid' : female ? 'woman' : 'normal');
  const G = { ...GAITS.normal, ...GAITS[gaitName] };
  // men run square: arms pumping fore and aft, steady hips, wider track; women keep their own
  const M = gaitName === 'woman' ? 0 : 1;
  const stoop = o.stoop ?? G.stoop;
  const shalwar = o.shalwar || o.kameez;
  const bw = o.build * (female ? 0.94 : 1);
  const belly = o.belly;
  const SX = (female ? 0.19 : 0.215) * o.shoulders * (0.9 + 0.1 * bw);
  const SY = 1.385, EY = SY - 0.285, WY = EY - 0.255;
  const HX = female ? 0.1 : 0.095;
  const hem = o.hem ?? (o.lower === 'dhoti' ? 0.6 : female ? 0.43 : 0.49);
  const beardCol = o.beardColor || (o.beard === 'white' ? '#e6e2da' : o.hair);
  const browCol = o.beard === 'white' || o.hair === '#e6e2da' ? '#d8d4cc' : o.hair;
  const skinD = shade(o.skin, 0.82);
  const R = new Rig();
  const add = (bone, ...gs) => gs.forEach((g) => R.add(bone, g));

  // ---- skeleton ----
  const root = R.bone(null, 0, 0, 0);
  const pelvis = R.bone(root, 0, HIP_Y, 0);
  const spine = R.bone(pelvis, 0, SPINE_Y, 0);
  const head = R.bone(spine, 0, HEAD_Y, 0);
  const headIn = R.bone(head, 0, HEAD_Y, 0);
  const mkArm = (s) => {
    const a = R.bone(spine, s * SX, SY, 0); a.rotation.order = 'XZY';
    const e = R.bone(a, s * SX, EY, 0);
    const h = R.bone(e, s * SX, WY, 0);
    return [a, e, h];
  };
  const [armL, elbowL, handL] = mkArm(-1);
  const [armR, elbowR, handR] = mkArm(1);
  const mkLeg = (s) => {
    const h = R.bone(pelvis, s * HX, HIP_Y, 0); h.rotation.order = 'YXZ';
    const kn = R.bone(h, s * HX, HIP_Y - L1, 0);
    const an = R.bone(kn, s * HX, ANK, 0); an.rotation.order = 'ZXY';
    return [h, kn, an];
  };
  const [legL, kneeL, ankleL] = mkLeg(-1);
  const [legR, kneeR, ankleR] = mkLeg(1);
  const flapF = R.bone(pelvis, 0, SPINE_Y, 0);
  const flapF2 = R.bone(flapF, 0, SPLIT, 0.0);
  const flapB = R.bone(pelvis, 0, SPINE_Y, 0);
  const flapB2 = R.bone(flapB, 0, SPLIT, 0.0);
  const phone = R.bone(handR, SX, WY, 0);

  const cloth = []; // { bone, bx, bz, gain, dir: 1 back / -1 front / 0 free, ph }
  const tail = (parent, x, y, z, gain, dir, bx = 0) => {
    const b = R.bone(parent, x, y, z);
    cloth.push({ bone: b, bx, bz: 0, gain, dir, ph: Math.random() * 10, cx: bx, cz: 0 });
    return b;
  };

  // ---- body colours ----
  const top = o.sweater || o.kameez;
  const wrap = o.chadar && !female ? o.chadar : null; // a man's loi covers the arms
  const upperCol = wrap || o.shawl || o.sweater || o.kameez;
  const foreCol = wrap || o.sweater || o.kameez;
  const rc = 0.19 * bw, dz = 0.64;

  // ---- torso (spine) ----
  const T = (g) => add(spine, g.translate(0, -SPINE_Y, 0));
  T(cyl(rc * 1.0, rc * 1.0 + belly * 0.035, 0.2, top, 8, { y: 0.98, sz: dz + belly * 0.14 }));
  T(cyl(rc * 1.07, rc * 1.0, 0.36, top, 8, { y: 1.22, sz: dz }));
  T(cyl(0.072 * (0.9 + 0.1 * bw), 0.072 * (0.9 + 0.1 * bw), 2 * SX, top, 6, { sz: 1.4, rz: Math.PI / 2, y: SY - 0.005 }));
  T(box(2 * SX * 0.62, 0.06, 0.17, top, { y: SY + 0.055 }));
  if (belly > 0.05) T(sph(0.16 * bw, top, { y: 1.04, z: 0.015 + belly * 0.03, sx: 1.1, sy: 1.15, sz: 0.5 + belly * 0.38 }, 8, 5));
  T(cyl(0.047, 0.054, 0.12, o.skin, 6, { y: 1.5 }));
  T(cyl(0.058, 0.066, 0.045, o.kameez, 7, { y: 1.45 }));
  const front = rc * 1.04 * dz;
  if (!o.sweater && !wrap) {
    if (!female) {
      T(box(0.034, 0.24, 0.012, shade(o.kameez, 0.9), { y: 1.31, z: front }));
      for (const y of [1.38, 1.31, 1.24]) T(box(0.012, 0.012, 0.01, shade(o.kameez, 0.7), { y, z: front + 0.008 }));
    } else if (o.trim) {
      T(box(0.1, 0.07, 0.012, o.trim, { y: 1.39, z: front - 0.004 }));
    }
  }
  if (o.grease) {
    T(box(0.06, 0.05, 0.01, shade(top, 0.55), { x: 0.06, y: 1.08, z: front + 0.01 }));
    T(box(0.04, 0.07, 0.01, shade(top, 0.6), { x: -0.08, y: 1.18, z: front + 0.004 }));
  }
  if (o.sweater) {
    T(cone(0.055, 0.11, o.kameez, 3, { rx: Math.PI, y: 1.385, z: front + 0.004, sz: 0.15 }));
    T(cyl(rc * 1.05, rc * 1.06 + belly * 0.035, 0.05, shade(o.sweater, 0.82), 8, { y: 0.9, sz: dz + 0.03 + belly * 0.14 }));
  }
  if (o.waistcoat) {
    const w = o.waistcoat;
    T(cyl(rc * 1.11, rc * 1.08 + belly * 0.04, 0.43, w, 8, { y: 1.2, sz: dz + 0.04 + belly * 0.08 }));
    T(box(2 * SX * 0.7, 0.045, 0.19, w, { y: SY + 0.065 }));
    const fz = rc * 1.11 * (dz + 0.04) + 0.002;
    T(box(0.05, 0.36, 0.012, o.sweater || o.kameez, { y: 1.24, z: fz }));
    T(cone(0.04, 0.12, o.sweater || o.kameez, 3, { rx: Math.PI, y: 1.4, z: fz - 0.004, sz: 0.15 }));
    for (const y of [1.3, 1.2, 1.1]) T(box(0.014, 0.014, 0.012, '#c9b27a', { x: 0.03, y, z: fz + 0.003 }));
    T(box(0.06, 0.01, 0.01, shade(w, 0.7), { x: -0.09, y: 1.3, z: fz - 0.02 }));
  }
  if (o.shawl) {
    T(cyl(rc * 1.28, rc * 1.34 + belly * 0.03, 0.4, o.shawl, 8, { y: 1.25, sz: 0.74 }));
    T(cyl(rc * 1.34, rc * 1.34, 0.035, shade(o.shawl, 0.72), 8, { y: 1.05, sz: 0.75 }));
    T(box(2 * SX * 0.82, 0.07, 0.24, o.shawl, { y: SY + 0.05 }));
    const st = tail(spine, -0.08, 1.44, -0.15, 0.55, 1, 0.06);
    add(st, box(0.24, 0.52, 0.025, o.shawl, { y: -0.26 }), box(0.24, 0.035, 0.028, shade(o.shawl, 0.72), { y: -0.51 }));
  }
  if (wrap) {
    T(cyl(rc * 1.42, rc * 1.62 + belly * 0.04, 0.62, wrap, 9, { y: 1.12, sz: 0.7 }));
    T(sph(rc * 1.42, wrap, { y: 1.4, sy: 0.4, sz: 0.72 }, 9, 4));
    T(box(0.05, 0.5, 0.02, shade(wrap, 0.75), { x: 0.07, y: 1.15, z: rc * 1.5 * 0.7, rz: 0.12 }));
    const st = tail(spine, -0.1, 1.42, -0.17, 0.45, 1, 0.08);
    add(st, box(0.3, 0.6, 0.025, wrap, { y: -0.3 }), box(0.3, 0.04, 0.028, shade(wrap, 0.75), { y: -0.59 }));
  }
  if (o.shoulderCloth) {
    const c = o.shoulderCloth, st2 = o.scarfStripe || shade(c, 0.6);
    const x = -SX * 0.72;
    T(box(0.13, 0.035, 0.27, c, { x, y: SY + 0.07 }));
    T(box(0.13, 0.42, 0.02, c, { x, y: SY - 0.14, z: 0.14 }));
    for (const y of [SY - 0.06, SY - 0.2, SY - 0.33]) T(box(0.133, 0.025, 0.022, st2, { x, y, z: 0.14 }));
    const sc = tail(spine, x, SY + 0.06, -0.14, 0.7, 1, 0.04);
    add(sc, box(0.13, 0.36, 0.02, c, { y: -0.18 }), box(0.133, 0.025, 0.022, st2, { y: -0.12 }), box(0.133, 0.025, 0.022, st2, { y: -0.3 }));
  }
  if (o.headwear === 'dupatta' || (female && o.chadar)) {
    const dc = female && o.chadar ? o.chadar : o.headColor;
    const big = !!(female && o.chadar);
    // around the neck and over the shoulders
    T(cyl(0.16 + (big ? 0.06 : 0), SX + 0.04 + (big ? 0.05 : 0), big ? 0.22 : 0.12, dc, 8, { y: big ? 1.36 : 1.42, sz: 0.74 }));
    if (big) T(cyl(rc * 1.32, rc * 1.5, 0.42, dc, 9, { y: 1.12, sz: 0.72 }));
    else T(box(0.42, 0.09, 0.025, dc, { y: 1.3, z: front + 0.01, rz: 0.4 }));
    const bt = tail(spine, 0, 1.42, -0.135, 0.7, 1, 0.1);
    add(bt, box(big ? 0.44 : 0.34, big ? 0.62 : 0.68, 0.02, dc, { y: big ? -0.31 : -0.34 }));
    if (o.trim) add(bt, box(0.345, 0.04, 0.022, o.trim, { y: -0.67 }));
    if (!big) {
      const ft = tail(spine, 0.11, 1.42, front + 0.02, 0.6, -1, -0.12);
      add(ft, box(0.16, 0.5, 0.018, dc, { y: -0.25 }));
      if (o.trim) add(ft, box(0.165, 0.035, 0.02, o.trim, { y: -0.49 }));
    }
  }
  if (o.carry === 'bag') {
    T(box(0.04, 0.62, 0.012, '#2a2622', { x: 0.0, y: 1.17, z: front + 0.012, rz: 0.62 }));
    T(box(0.04, 0.62, 0.012, '#2a2622', { x: 0.0, y: 1.17, z: -front - 0.012, rz: -0.62 }));
  }
  if (o.carry === 'schoolbag') {
    T(box(0.26, 0.3, 0.11, '#2a5aa0', { y: 1.16, z: -rc * dz - 0.06 }));
    T(box(0.2, 0.1, 0.03, '#d9b84a', { y: 1.08, z: -rc * dz - 0.12 }));
    for (const s of [-1, 1]) T(box(0.035, 0.32, 0.012, '#1a3a70', { x: s * 0.09, y: 1.22, z: front + 0.005 }));
  }

  // ---- pelvis and the kameez skirt (front and back panels, open at the sides) ----
  const lowerCol = o.lower === 'dhoti' ? o.dhotiColor : shalwar;
  add(pelvis, cyl(0.17 * bw, 0.19 * bw, 0.16, lowerCol, 8, { y: -0.03, sz: 0.78 }));
  if (o.carry === 'bag') add(pelvis, box(0.08, 0.22, 0.24, '#3a3632', { x: 0.24, y: 0.02, z: -0.02 }), box(0.082, 0.06, 0.245, '#2a2622', { x: 0.24, y: 0.1, z: -0.02 }));
  const skirt = (bone, bone2, color, yTop, yBot, rTop, rBot, zc, sz, seg = 8) => {
    const rAt = (y) => lerp(rTop, rBot, (yTop - y) / (yTop - yBot));
    const ys = Math.max(yBot, SPLIT);
    add(bone, cyl(rAt(yTop), rAt(ys), yTop - ys, color, seg, { y: (yTop + ys) / 2 - SPINE_Y, z: zc, sz }));
    if (yBot < SPLIT) add(bone2, cyl(rAt(SPLIT), rAt(yBot), SPLIT - yBot, color, seg, { y: (SPLIT + yBot) / 2 - SPLIT, z: zc, sz }));
  };
  const flare = female ? 1.38 : 1.24;
  if (o.lower === 'dhoti') {
    skirt(flapF, flapF2, o.dhotiColor, 0.95, 0.12, 0.19 * bw, 0.25, 0.05, 0.44);
    skirt(flapB, flapB2, o.dhotiColor, 0.95, 0.12, 0.19 * bw, 0.25, -0.05, 0.44);
    add(flapF2, box(0.3, 0.03, 0.012, shade(o.dhotiColor, 0.7), { y: -0.3, z: 0.09 }));
  }
  const kTop = rc * 1.02 + belly * 0.03;
  skirt(flapF, flapF2, o.kameez, 0.98, hem, kTop, rc * flare, 0.062 + belly * 0.02, 0.4 + belly * 0.06);
  skirt(flapB, flapB2, o.kameez, 0.98, hem, kTop, rc * flare, -0.062, 0.4);
  if (o.trim) {
    const r = rc * flare;
    const tb = hem < SPLIT ? flapF2 : flapF, tb2 = hem < SPLIT ? flapB2 : flapB;
    const oy = hem < SPLIT ? SPLIT : SPINE_Y;
    add(tb, cyl(r + 0.004, r + 0.004, 0.04, o.trim, 8, { y: hem + 0.02 - oy, z: 0.062, sz: 0.41 }));
    add(tb2, cyl(r + 0.004, r + 0.004, 0.04, o.trim, 8, { y: hem + 0.02 - oy, z: -0.062, sz: 0.41 }));
  }
  if (o.grease) add(flapF, box(0.07, 0.05, 0.01, shade(o.kameez, 0.55), { x: -0.08, y: 0.72 - SPINE_Y, z: 0.13 }));

  // ---- legs ----
  const bare = o.lower === 'dhoti';
  const lw = female ? 0.9 : 1;
  const shoeCol = o.shoeColor || { chappal: '#5a3a22', peshawari: '#6a3f22', khussa: '#7a2a2a', bare: o.skin }[o.shoes];
  for (const [s, hip, kn, an] of [[-1, legL, kneeL, ankleL], [1, legR, kneeR, ankleR]]) {
    if (bare) {
      add(hip, cyl(0.07, 0.058, 0.44, o.skin, 6, { y: -0.21 }));
      add(kn, cyl(0.055, 0.04, 0.38, o.skin, 6, { y: -0.19 }), sph(0.052, o.skin, { y: -0.12, z: -0.012, sy: 1.9 }, 6, 4));
    } else {
      add(hip, cyl(0.122 * lw * (0.92 + 0.08 * bw), 0.108 * lw, 0.46, shalwar, 7, { y: -0.215 }));
      add(kn, cyl(0.106 * lw, 0.066, 0.33, shalwar, 7, { y: -0.165 }),
        cyl(0.066, 0.068, 0.035, shade(shalwar, 0.85), 7, { y: -0.34 }),
        cyl(0.036, 0.04, 0.05, o.skin, 6, { y: -0.37 }));
    }
    const sole = o.shoes === 'bare' ? skinD : '#2a1d14';
    if (o.shoes !== 'khussa') add(an, box(0.068, 0.045, 0.17, o.skin, { y: -0.045, z: 0.045 }), box(0.074, 0.024, 0.06, o.skin, { y: -0.058, z: 0.145 }));
    if (o.shoes === 'bare') add(an, box(0.072, 0.012, 0.22, sole, { y: -0.07, z: 0.06 }));
    else if (o.shoes === 'chappal') add(an, box(0.088, 0.018, 0.25, sole, { y: -0.066, z: 0.055 }), box(0.082, 0.022, 0.055, shoeCol, { y: -0.042, z: 0.105 }));
    else if (o.shoes === 'peshawari') {
      add(an, box(0.094, 0.022, 0.26, sole, { y: -0.064, z: 0.055 }),
        box(0.086, 0.04, 0.11, shoeCol, { y: -0.04, z: 0.12 }),
        box(0.09, 0.024, 0.028, shade(shoeCol, 0.75), { y: -0.026, z: 0.05 }),
        box(0.09, 0.03, 0.026, shoeCol, { y: -0.045, z: -0.055 }));
    } else if (o.shoes === 'khussa') {
      add(an, box(0.082, 0.05, 0.22, shoeCol, { y: -0.05, z: 0.05 }),
        cone(0.036, 0.1, shoeCol, 4, { rx: Math.PI / 2 - 0.25, y: -0.045, z: 0.2 }),
        box(0.084, 0.012, 0.1, '#d9b04a', { y: -0.028, z: 0.08 }));
    }
  }

  // ---- arms ----
  const aw = 0.9 + 0.1 * bw;
  for (const [s, a, e, h] of [[-1, armL, elbowL, handL], [1, armR, elbowR, handR]]) {
    add(a, sph(0.068 * aw, upperCol, { y: -0.02 }, 6, 4), cyl(0.062 * aw, 0.052 * aw, 0.29, upperCol, 7, { y: -0.145 }));
    if (o.sleeves === 'rolled' && !wrap) {
      add(e, cyl(0.058, 0.058, 0.05, shade(foreCol, 0.92), 7, { y: -0.02 }), cyl(0.042, 0.032, 0.235, o.skin, 6, { y: -0.13 }));
    } else {
      add(e, cyl(0.053 * aw, 0.047, 0.232, foreCol, 7, { y: -0.115 }),
        cyl(0.049, 0.049, 0.024, shade(foreCol, 0.86), 7, { y: -0.222 }),
        cyl(0.03, 0.032, 0.04, o.skin, 6, { y: -0.245 }));
    }
    // hand: palm faces the thigh, thumb forward
    add(h, box(0.04, 0.08, 0.074, o.skin, { y: -0.048, z: 0.004 }),
      box(0.036, 0.04, 0.066, o.skin, { y: -0.098, z: 0.0, x: -s * 0.004, rx: 0.12 }),
      box(0.022, 0.048, 0.024, o.skin, { x: -s * 0.01, y: -0.04, z: 0.046, rx: -0.35 }));
    if (o.watch && s < 0) add(e, cyl(0.036, 0.036, 0.022, '#2a2622', 7, { y: -0.232 }), box(0.022, 0.026, 0.026, '#c8c8c8', { x: s * 0.03, y: -0.232 }));
    if (o.bangles) {
      const cols = Array.isArray(o.bangles) ? o.bangles : [o.bangles, '#d9b04a', o.bangles];
      cols.forEach((c, i) => add(e, cyl(0.041, 0.041, 0.009, c, 8, { y: -0.215 - i * 0.012 })));
    }
  }
  // props in the right hand
  if (o.prop === 'lathi') add(handR, cyl(0.016, 0.019, 1.48, '#5e4026', 5, { y: -0.12, z: 0.03 }), cyl(0.021, 0.021, 0.05, '#a8843a', 5, { y: -0.84, z: 0.03 }), cyl(0.02, 0.02, 0.03, '#a8843a', 5, { y: 0.6, z: 0.03 }));
  if (o.prop === 'can') add(handR, cyl(0.095, 0.112, 0.32, '#c3c8cc', 8, { y: -0.27, x: 0.02 }), cyl(0.06, 0.075, 0.06, '#aab0b4', 8, { y: -0.085, x: 0.02 }), box(0.012, 0.05, 0.05, '#7a7f84', { y: -0.04, x: 0.02 }));
  if (o.prop === 'bat') add(handR, cyl(0.014, 0.014, 0.18, '#2a2a2a', 5, { y: -0.06, z: 0.02 }), box(0.03, 0.4, 0.09, '#d8b880', { y: -0.34, z: 0.02 }));
  if (o.prop === 'stick') add(handR, cyl(0.007, 0.012, 1.0, '#7a5a3a', 4, { y: -0.36, z: 0.22, rx: 0.45 }));
  if (o.prop === 'tasbeeh' || (o.habits || []).includes('tasbeeh')) add(handL, torus(0.032, 0.007, '#5a2e1e', TAU, { y: -0.1, z: 0.03, ry: Math.PI / 2 }, 3, 9), box(0.01, 0.04, 0.01, '#3a7a5a', { y: -0.15, z: 0.03 }));
  add(phone, box(0.012, 0.1, 0.05, '#15151a', { x: 0.02, y: -0.07, z: 0.02 }), box(0.004, 0.085, 0.042, '#5a7a9a', { x: 0.008, y: -0.07, z: 0.02 }));
  phone.scale.setScalar(0.001);
  if (kid) headIn.scale.setScalar(1.16); // children's heads are big for their bodies

  // ---- head ----
  const Hd = (g) => add(headIn, g);
  const hairCol = o.hair;
  Hd(sph(0.104, o.skin, { y: 0.115, sy: 1.12, sz: 1.04 }, 8, 6));
  Hd(sph(0.08, o.skin, { y: 0.058, z: 0.024, sy: 0.82, sx: 0.96 }, 7, 4));
  for (const s of [-1, 1]) {
    Hd(sph(0.026, skinD, { x: s * 0.104, y: 0.11, sx: 0.45, sy: 1.15 }, 5, 4));
    Hd(box(0.028, 0.012, 0.008, '#e9e1d2', { x: s * 0.038, y: 0.127, z: 0.096 }));
    Hd(box(0.013, 0.013, 0.006, '#1a1410', { x: s * 0.037, y: 0.127, z: 0.1 }));
    Hd(box(0.036, 0.011, 0.014, browCol, { x: s * 0.04, y: 0.148, z: 0.097, rz: s * o.brow }));
  }
  const nz = o.nose;
  Hd(box(0.024 * nz, 0.05 * nz, 0.03 * nz, o.skin, { y: 0.1, z: 0.1 + 0.006 * nz, rx: -0.22 }));
  Hd(box(0.032 * nz, 0.016, 0.02 * nz, skinD, { y: 0.08, z: 0.108 + 0.004 * nz }));
  Hd(box(0.034, 0.008, 0.01, '#6a3a30', { y: 0.054, z: 0.1 }));
  if (stoop > 0.12 || o.beard === 'white') {
    Hd(box(0.06, 0.006, 0.006, skinD, { y: 0.168, z: 0.1 }));
    Hd(box(0.05, 0.006, 0.006, skinD, { y: 0.18, z: 0.095 }));
  }
  // hair
  const covered = ['dupatta', 'chadar', 'beanie'].includes(o.headwear) || (female && o.chadar);
  if (!covered) {
    if (o.hairStyle !== 'bald') Hd(dome(0.112, hairCol, { y: 0.155, rx: -0.2, sy: 0.74 }, 8, 3));
    Hd(box(0.2, 0.11, 0.08, hairCol, { y: 0.125, z: -0.066 }));
    for (const s of [-1, 1]) Hd(box(0.02, 0.06, 0.05, hairCol, { x: s * 0.1, y: 0.15, z: -0.01 }));
    if (o.hairStyle === 'parted') Hd(box(0.12, 0.04, 0.05, hairCol, { x: 0.02, y: 0.205, z: 0.05, rz: -0.15, rx: -0.3 }));
  }
  if (female) {
    Hd(box(0.1, 0.018, 0.03, hairCol, { y: 0.192, z: 0.07, rx: -0.6 }));
    if (!o.chadar) Hd(box(0.06, 0.3, 0.04, hairCol, { y: -0.14, z: -0.1 }), box(0.04, 0.12, 0.04, '#b8323a', { y: -0.34, z: -0.1 }));
  }
  // moustache and beard
  const mst = o.moustache === true ? (o.beard === 'long' ? 'none' : 'thin') : o.moustache || 'none';
  if (!female && mst !== 'none') {
    const mc = o.beard === 'white' ? '#e6e2da' : hairCol;
    if (mst === 'thin') Hd(box(0.06, 0.013, 0.014, mc, { y: 0.07, z: 0.103 }));
    if (mst === 'thick' || mst === 'handlebar') {
      Hd(box(0.078, 0.022, 0.022, mc, { y: 0.07, z: 0.102 }));
      for (const s of [-1, 1]) {
        if (mst === 'thick') Hd(box(0.016, 0.03, 0.016, mc, { x: s * 0.038, y: 0.058, z: 0.1 }));
        else Hd(box(0.036, 0.014, 0.016, mc, { x: s * 0.052, y: 0.082, z: 0.094, rz: s * 0.65, ry: -s * 0.4 }));
      }
    }
  }
  if (o.beard === 'stubble') Hd(sph(0.083, mix(hairCol, o.skin, 0.55), { y: 0.052, z: 0.022, sy: 0.82, sx: 0.98 }, 7, 4));
  if (o.beard === 'short') Hd(sph(0.088, beardCol, { y: 0.048, z: 0.02, sy: 0.85, sz: 0.92 }, 7, 4));
  if (o.beard === 'full' || o.beard === 'white' || o.beard === 'long') {
    Hd(sph(0.088, beardCol, { y: 0.035, z: 0.03, sy: 1.05, sz: 0.86 }, 7, 5));
    for (const s of [-1, 1]) Hd(box(0.02, 0.07, 0.05, beardCol, { x: s * 0.093, y: 0.085, z: 0.0 }));
  }
  if (o.beard === 'long' || o.beard === 'white') Hd(cone(0.058, o.beard === 'long' ? 0.14 : 0.09, beardCol, 6, { rx: Math.PI + 0.25, y: -0.04, z: 0.06 }));
  if (o.glasses) {
    for (const s of [-1, 1]) {
      Hd(box(0.034, 0.024, 0.004, '#3a4248', { x: s * 0.04, y: 0.128, z: 0.106 }));
      Hd(box(0.004, 0.006, 0.1, '#2a2420', { x: s * 0.104, y: 0.132, z: 0.055 }));
    }
    Hd(box(0.09, 0.006, 0.006, '#2a2420', { y: 0.142, z: 0.107 }));
  }
  // headwear
  const hc = o.headColor;
  if (o.headwear === 'topi') {
    Hd(cyl(0.1, 0.108, 0.07, hc, 9, { y: 0.205 }));
    Hd(cyl(0.09, 0.1, 0.012, shade(hc, 0.88), 9, { y: 0.245 }));
  }
  if (o.headwear === 'jinnah') Hd(cyl(0.098, 0.108, 0.09, hc, 9, { y: 0.215, sx: 0.88, sz: 1.14 }), box(0.012, 0.012, 0.2, shade(hc, 0.7), { y: 0.262 }));
  if (o.headwear === 'beanie') Hd(dome(0.118, hc, { y: 0.135, sy: 1.05 }, 8, 4), cyl(0.12, 0.12, 0.05, shade(hc, 0.82), 8, { y: 0.15 }));
  if (o.headwear === 'pagri' || o.headwear === 'turla' || o.headwear === 'parna') {
    const big = o.headwear !== 'parna';
    Hd(sph(big ? 0.152 : 0.138, hc, { y: 0.2, sy: 0.6 }, 8, 4));
    Hd(sph(big ? 0.125 : 0.11, hc, { y: 0.255, sy: 0.58, x: 0.015, rz: 0.2 }, 7, 4));
    Hd(box(0.2, 0.035, 0.02, shade(hc, 0.86), { y: 0.215, z: 0.13, rz: -0.35 }));
    if (o.headwear === 'turla') Hd(cyl(0.085, 0.085, 0.02, hc, 9, { rz: Math.PI / 2, y: 0.305, x: 0.045, z: -0.02 }), cyl(0.06, 0.06, 0.024, shade(hc, 0.9), 9, { rz: Math.PI / 2, y: 0.29, x: 0.045, z: -0.02 }));
    const pt = tail(headIn, 0.04, HEAD_Y + 0.22, -0.13, 0.8, 1, 0.05);
    add(pt, box(0.075, big ? 0.36 : 0.26, 0.016, hc, { y: big ? -0.18 : -0.13 }));
    if (o.headwear === 'parna') add(pt, box(0.077, 0.02, 0.018, shade(hc, 0.6), { y: -0.2 }));
  }
  if (covered && o.headwear !== 'beanie') {
    const dc = female && o.chadar ? o.chadar : hc;
    Hd(dome(0.127, dc, { y: 0.112, rx: -0.35, sy: 1.12, sz: 1.05 }, 9, 4));
    Hd(box(0.25, 0.25, 0.05, dc, { y: 0.01, z: -0.09 }));
    for (const s of [-1, 1]) Hd(box(0.03, 0.2, 0.1, dc, { x: s * 0.108, y: 0.05, z: -0.02 }));
  }
  if (o.carry === 'gathri') {
    Hd(torus(0.07, 0.025, '#8a6a4a', TAU, { rx: Math.PI / 2, y: 0.232 }, 4, 8));
    Hd(sph(0.2, o.carryColor, { y: 0.33, sx: 1.15, sy: 0.52 }, 8, 5));
    Hd(box(0.42, 0.018, 0.03, shade(o.carryColor, 0.6), { y: 0.36 }), box(0.03, 0.018, 0.38, shade(o.carryColor, 0.6), { y: 0.37 }));
    Hd(sph(0.05, shade(o.carryColor, 0.8), { y: 0.43, sy: 0.8 }, 6, 4));
  }
  if (o.carry === 'fodder') {
    Hd(torus(0.07, 0.025, '#8a6a4a', TAU, { rx: Math.PI / 2, y: 0.232 }, 4, 8));
    Hd(sph(0.2, '#5f7d34', { y: 0.33, sx: 2.3, sy: 0.55, sz: 0.95 }, 8, 5));
    for (const [x, z, r] of [[-0.42, 0.04, 0.3], [0.44, -0.05, -0.3], [-0.3, -0.12, 0.6], [0.32, 0.1, -0.5]]) Hd(box(0.18, 0.012, 0.03, '#86a548', { x, y: 0.34, z, rz: r * 0.3, ry: r }));
    Hd(box(0.025, 0.12, 0.22, '#9a8a5a', { x: 0.1, y: 0.34 }));
  }

  const mesh = R.build();
  const group = new THREE.Group();
  group.add(mesh);
  group.scale.setScalar(o.scale);

  // ---------------------------------------------------------------- animation state
  const pose = o.pose;
  const habits = o.habits || DEFAULT_HABITS;
  const legs = [[-1, legL, kneeL, ankleL], [1, legR, kneeR, ankleR]];
  const arms = [[-1, armL, elbowL, handL], [1, armR, elbowR, handR]];
  const footZ = [rnd(-0.03, 0.06), rnd(-0.05, 0.03)];
  const holdR = o.carry === 'gathri' || o.carry === 'fodder' ? 'holdHead' : o.prop === 'can' ? 'carry' : null;
  const lathi = o.prop === 'lathi';

  const state = {
    phase: Math.random(), sitting: false, driving: false, idle: Math.random() * 10, blend: 0,
    t: Math.random() * 100, sp: 0, run: 0, acc: 0, seat: 0,
    ws: 0, wsT: rnd(1, 5), wsGoal: 0,
    look: { x: 0, y: 0, tx: 0, ty: 0, timer: rnd(1, 4) },
    act: null, actT: rnd(2, 8), talk: 0, talking: false, attend: false,
    breath: rnd(0.22, 0.3),
  };
  const P = { x: 0, z: 0, y: 0, e: 0 };
  const tmp = { x: 0, z: 0, y: 0, e: 0 };
  const blendPose = (out, p, w) => { out.x += (p.x - out.x) * w; out.z += (p.z - out.z) * w; out.y += (p.y - out.y) * w; out.e += (p.e - out.e) * w; };

  // two-bone leg IK in the body's sagittal plane, plus a little roll to reach the foot sideways
  function solveLeg(s, hip, kn, an, fx, fy, fz, pitch, pH, pX, roll, yaw) {
    const hy = pH + s * HX * Math.sin(roll);
    const hz = -s * HX * Math.sin(yaw);
    const hx = pX + s * HX;
    const ddz = fz - hz, ddy = hy - fy, ddx = fx - hx;
    const d = clamp(Math.hypot(ddz, ddy), 0.2, LMAX - 1e-4);
    const a = Math.atan2(ddz, ddy);
    const b = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const kb = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
    hip.rotation.x = -(a + b);
    kn.rotation.x = kb;
    hip.rotation.z = Math.atan2(ddx, ddy) - roll;
    hip.rotation.y = -yaw + s * G.toe;
    an.rotation.x = pitch - (hip.rotation.x + kb);
    an.rotation.z = -(hip.rotation.z + roll);
  }

  function pickAct() {
    const name = habits[Math.floor(Math.random() * habits.length)];
    const def = ACTS[name];
    if (!def) return;
    state.act = { def, t: 0, dur: rnd(def.dur[0], def.dur[1]) };
  }

  // per-frame wind in the person's own frame
  let wlx = 0, wlz = 0, wstr = 0;
  function readWind() {
    const e = group.matrixWorld.elements;
    const yaw = Math.atan2(e[8], e[10]);
    wstr = wind.at ? wind.at(e[12], e[14]) : wind.strength;
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    wlx = (wind.dir.x * c - wind.dir.y * sn) * wstr;
    wlz = (wind.dir.x * sn + wind.dir.y * c) * wstr;
  }

  function updateCloth(dt, v, legFwd, legBack) {
    const t = state.t, kk = dt > 0 ? k(7, dt) : 1;
    const flut = (ph, f) => wstr * (Math.sin(t * f + ph) * 0.6 + Math.sin(t * f * 2.3 + ph * 1.7) * 0.4);
    // kameez panels: pushed by the thighs, lifted a little by the breeze and by walking
    const dragZ = -v * 0.09;
    let fF = -legFwd * 0.85 - (wlz + dragZ) * 0.12 + flut(1, 3.1) * 0.03;
    let fB = legBack * 0.75 + Math.max(0, -(wlz + dragZ)) * 0.18 + flut(2, 2.7) * 0.04;
    if (state.sitting) { fF = -1.3; fB = 0.25; }
    flapF.rotation.x += (Math.min(0.12, fF) - flapF.rotation.x) * kk;
    flapB.rotation.x += (Math.max(-0.12, fB) - flapB.rotation.x) * kk;
    flapF.rotation.z += (wlx * 0.06 - flapF.rotation.z) * kk;
    flapB.rotation.z += (wlx * 0.08 - flapB.rotation.z) * kk;
    flapF2.rotation.x += ((state.sitting ? 1.3 : legFwd * 0.5) - flapF2.rotation.x) * kk;
    flapB2.rotation.x += ((state.sitting ? -0.2 : legBack * 0.2) - flapB2.rotation.x) * kk;
    for (const c of cloth) {
      const lz = wlz - v * 0.16, lx = wlx;
      let rx = -lz * c.gain + flut(c.ph, 2.2 + c.gain) * 0.12 * c.gain;
      let rz = lx * c.gain * 0.45 + flut(c.ph + 3, 2.6) * 0.08 * c.gain;
      rx += c.bx + (c.dir > 0 ? Math.abs(rz) * 0.3 : 0);
      if (c.dir > 0) rx = Math.max(c.bx, rx); // can't swing into the back
      if (c.dir < 0) rx = Math.min(c.bx, rx); // nor into the chest
      if (c.dir > 0) rx += legBack * 0.15;
      c.bone.rotation.x += (clamp(rx, -1.2, 1.2) - c.bone.rotation.x) * kk;
      c.bone.rotation.z += (clamp(rz, -0.45, 0.45) - c.bone.rotation.z) * kk;
    }
  }

  function setArm(s, a, e, h, p, keepZ) {
    a.rotation.x = p.x; a.rotation.y = p.y; e.rotation.x = p.e;
    if (!keepZ) a.rotation.z = p.z;
    // a lathi stays roughly upright in the fist; other hands hang relaxed
    if (lathi && s > 0) h.rotation.x = -(p.x + p.e + spine.rotation.x) * 0.85;
    else if (s > 0 && o.prop === 'can') h.rotation.x = -(p.x + p.e) * 0.9;
    else h.rotation.x = -0.08;
    h.rotation.z = s > 0 && phone.scale.x > 0.5 ? -1.2 : 0; // palm up to read the phone
  }

  function animateIdleUpper(dt, moveW) {
    const S = state, t = S.t;
    // look about
    const L = S.look;
    L.timer -= dt;
    if (L.timer <= 0) {
      L.timer = rnd(1.5, 6);
      if (S.attend || Math.random() < 0.4) { L.tx = 0; L.ty = 0; } else {
        const range = moveW > 0.5 ? 0.45 : 0.95;
        L.ty = rnd(-range, range); L.tx = rnd(-0.12, 0.15);
      }
    }
    if (S.attend) { L.tx = 0; L.ty = 0; }
    L.x += (L.tx - L.x) * k(3, dt);
    L.y += (L.ty - L.y) * k(2.6, dt);
    // pick idle actions now and then
    if (S.act) {
      S.act.t += dt;
      if (moveW > 0.3 || S.talking) S.act.t = Math.max(S.act.t, S.act.dur - 0.5);
      if (S.act.t >= S.act.dur) { S.act = null; S.actT = rnd(4, 14); }
    } else if (moveW < 0.1 && !S.talking && !S.driving) {
      S.actT -= dt;
      if (S.actT <= 0) pickAct();
    }
    S.talk += ((S.talking ? 1 : 0) - S.talk) * k(4, dt);
  }

  function upperBody(dt, moveW, swingPhase, amp, elbowBase, run, lean) {
    const S = state, t = S.t;
    const act = S.act;
    const aw = act ? sstep(0, 0.5, act.t) * (1 - sstep(act.dur - 0.5, act.dur, act.t)) : 0;
    const base = S.sitting ? (S.driving ? 'drive' : 'sit') : pose;
    const breath = Math.sin(t * TAU * S.breath);
    let hx = 0, hy = 0, hz = 0;
    for (const [s, a, e, h] of arms) {
      const keepZ = S.driving && s < 0;
      // idle
      const ip = POSES[base](s);
      P.x = ip.x; P.y = ip.y; P.z = ip.z + s * (0.04 * belly + 0.03 * (bw - 1)); P.e = ip.e;
      P.x += 0.012 * breath; P.z += s * 0.008 * breath;
      if (!S.sitting && moveW > 0.001) {
        // walking swing, opposite to the leg on the same side
        const ph = TAU * (swingPhase + (s < 0 ? 0.5 : 0) - 0.04);
        const sw = Math.cos(ph);
        const hold = s > 0 ? holdR : null;
        if (hold) Object.assign(tmp, POSES[hold](s));
        else if (lathi && s > 0) { tmp.x = -0.2 - sw * amp * 0.55; tmp.z = s * 0.14; tmp.y = 0; tmp.e = -0.5 - 0.15 * Math.max(0, sw); }
        else {
          tmp.x = -sw * amp - 0.05 - run * (0.1 + 0.06 * M);
          tmp.z = s * (0.08 + 0.05 * belly + 0.03 * (bw - 1) + run * (0.06 + 0.07 * M));
          tmp.y = s * run * lerp(0.35, 0.04, M); // a twist here swings the forearms across the chest
          const fwd = Math.max(0, sw);
          tmp.e = lerp(-(elbowBase + 0.3 * fwd * amp), -(1.45 + 0.25 * fwd), run);
        }
        if (hold === 'holdHead') { tmp.x += 0.03 * Math.sin(ph * 2); }
        if (hold === 'carry') { tmp.x += -sw * 0.05; }
        blendPose(P, tmp, moveW);
      } else if (!S.sitting && holdR && s > 0) blendPose(P, POSES[holdR](s), 1);
      // idle action
      if (act && aw > 0 && (act.def.arms === 'both' || (act.def.arms === 'R') === (s > 0)) && !(holdR && s > 0)) blendPose(P, act.def.pose(act.t, s), aw);
      // talking
      if (S.talk > 0.01 && (s > 0 || Math.sin(t * 0.4) > 0.2) && !(holdR && s > 0)) blendPose(P, TALK(t, s, s), S.talk * (s > 0 ? 1 : 0.7));
      setArm(s, a, e, h, P, keepZ);
    }
    if (act && aw > 0) {
      const hh = act.def.head(act.t);
      hx += hh.x * aw; hy += hh.y * aw; hz += hh.z * aw;
      if (act.def.prop === 'phone') phone.scale.setScalar(aw > 0.3 ? 1 : 0.001);
    } else phone.scale.setScalar(0.001);
    if (S.talk > 0.01) { hx += Math.sin(t * 4.3) * 0.05 * S.talk - 0.03 * S.talk; hz += Math.sin(t * 1.3) * 0.05 * S.talk; }
    spine.rotation.x += 0.01 * breath + (act?.def.spine || 0) * aw;
    // head: look around, and steady against the body's lean and twist
    const L = S.look;
    headIn.rotation.x = L.x + hx - (spine.rotation.x + lean * 0) * 0.8;
    headIn.rotation.y = L.y + hy - (spine.rotation.y + pelvis.rotation.y) * 0.9;
    headIn.rotation.z = hz - spine.rotation.z * 0.6 - pelvis.rotation.z * 0.5;
  }

  return {
    group, root, head, armL, armR, legL, legR, mesh, state,
    gait: G, walkSpeed: G.speed,
    setSitting(v, seat = 0.46) {
      state.sitting = v;
      state.seat = seat;
      root.position.y = v ? seat + 0.1 - HIP_Y : 0;
      pelvis.position.set(0, HIP_Y, 0);
      pelvis.rotation.set(0, 0, 0);
    },
    setDriving(v) { state.driving = v; },
    // start an idle action by name (scratch, beard, phone, watch, ...); used for testing too
    act(name, dur) { const def = ACTS[name]; if (def) state.act = { def, t: 0, dur: dur ?? rnd(def.dur[0], def.dur[1]) }; },
    // speed is metres per second along the ground; 0 means standing.
    // shuffle (0..1) makes small steps on the spot, for turning round without sliding.
    update(dt, speed = 0, shuffle = 0) {
      const S = state;
      dt = Math.min(dt, 0.1);
      S.t += dt; S.idle += dt;
      readWind();
      if (S.sitting) {
        const t = S.t;
        pelvis.position.set(0, HIP_Y, 0);
        pelvis.rotation.set(0, 0, 0);
        for (const [s, hip, kn, an] of legs) {
          hip.rotation.set(-1.45, s * 0.06, 0);
          kn.rotation.x = 1.45 + (S.driving ? -0.25 : 0);
          an.rotation.set(S.driving ? 0.25 : 0, 0, 0);
        }
        spine.rotation.set(0.08 + stoop * 0.6 + 0.01 * Math.sin(t * 1.3), 0, 0);
        animateIdleUpper(dt, 0);
        upperBody(dt, 0, 0, 0, 0, 0, 0);
        updateCloth(dt, 0, 1.45, 0);
        return;
      }

      // ---- gait parameters ----
      const sc = o.scale;
      const prevSp = S.sp;
      S.sp += (speed - S.sp) * k(10, dt);
      if (dt > 0) S.acc += ((S.sp - prevSp) / dt - S.acc) * k(4, dt);
      const v = S.sp / sc; // speed in the model's own units
      const va = Math.max(v, shuffle * 0.9);
      const moving = speed > 0.12 || S.sp > 0.25 || shuffle > 0.1;
      S.blend += ((moving ? 1 : 0) - S.blend) * k(moving ? 6 : 4, dt);
      const moveW = sstep(0, 1, S.blend);
      S.run += (sstep(3.4, 5.2, v) - S.run) * k(5, dt);
      const run = S.run;
      const rate = (va < 3 ? 1.15 + 0.6 * va : 2.95 + 0.13 * (va - 3)) * G.cadence; // steps per second
      S.phase = frac(S.phase + (rate / 2) * dt * (moving || S.blend > 0.02 ? 1 : 0));
      const ph = S.phase;
      const beta = lerp(0.61, 0.37, run); // share of the cycle each foot is on the ground
      const D = Math.min((v * 2 * beta) / rate, lerp(0.95, 1.05, run)); // ground swept under a planted foot
      const pScale = clamp(D / 0.6, 0, 1);
      const liftH = lerp(0.07 + 0.04 * Math.min(1, v / 2.9), 0.3 + 0.06 * M, run) * G.lift * sstep(0.05, 0.5, va);

      // ---- feet ----
      const feet = [];
      for (const [s] of legs) {
        const p = frac(ph + (s > 0 ? 0.5 : 0));
        let z, lift, pitch, stance;
        if (p < beta) {
          const u = p / beta;
          z = (D / 2) * (1 - 2 * u);
          lift = 0.05 * sstep(0.65, 1, u) * pScale * (1 - run * 0.5);
          pitch = (-0.25 * (1 - sstep(0, 0.18, u)) + 0.55 * sstep(0.62, 1, u)) * pScale;
          stance = true;
        } else {
          const w = (p - beta) / (1 - beta);
          z = -D / 2 + D * sstep(0, 1, w);
          lift = liftH * Math.sin(Math.PI * Math.pow(w, 0.75)) + 0.05 * pScale * (1 - run * 0.5) * (1 - sstep(0, 0.35, w));
          pitch = lerp(0.55, -0.25, sstep(0.1, 0.95, w)) * pScale;
          if (run > 0) z -= run * 0.12 * Math.sin(Math.PI * w) * (1 - w);
          stance = false;
        }
        feet.push({ s, z, lift, pitch, stance, p });
      }

      // ---- pelvis ----
      // weight shifting from foot to foot while standing
      S.wsT -= dt;
      if (S.wsT <= 0) { S.wsT = rnd(3, 10); S.wsGoal = Math.random() < 0.3 ? 0 : (Math.random() < 0.5 ? -1 : 1) * rnd(0.5, 1); }
      S.ws += (S.wsGoal - S.ws) * k(1.1, dt);
      const ws = S.ws * (1 - moveW);
      const c1 = Math.cos(TAU * (ph - beta / 2));
      const stepPh = frac(ph * 2);
      const Hw = HIP_Y - 0.012 - 0.02 * Math.min(1, v / 2.9) - 0.06 * run;
      const bobA = 0.022 * pScale * G.bounce;
      let Hwalk = Hw - bobA * (0.5 - 0.5 * Math.cos(TAU * (stepPh - beta)));
      for (const f of feet) if (f.stance) Hwalk = Math.min(Hwalk, ANK + f.lift + Math.sqrt(Math.max(0, LMAX * LMAX * 0.999 - f.z * f.z)));
      Hwalk = Math.max(Hwalk, Hw - 0.07);
      const Hrun = Hw - 0.035 * G.bounce * Math.cos(TAU * (stepPh - beta));
      const Hmove = lerp(Hwalk, Hrun, run);
      const Hidle = HIP_Y - 0.01 - Math.abs(ws) * 0.012;
      const H = lerp(Hidle, Hmove, moveW);
      const pX = lerp(ws * 0.04, -0.022 * G.sway * (1 - run * (0.6 + 0.3 * M)) * c1 * pScale, moveW);
      const roll = lerp(ws * 0.045, -0.045 * G.roll * c1 * pScale * (1 - run * (0.5 + 0.35 * M)), moveW);
      const yaw = moveW * (0.07 + run * lerp(0.08, -0.02, M)) * Math.min(1, v / 1.5) * Math.cos(TAU * ph);
      pelvis.position.set(pX, H, lerp(0.006 * Math.sin(S.t * 0.37), 0, moveW));
      pelvis.rotation.set(0, yaw, roll);

      // ---- legs ----
      let legFwd = 0, legBack = 0;
      for (let i = 0; i < 2; i++) {
        const [s, hip, kn, an] = legs[i];
        const f = feet[i];
        const loaded = ws * s > 0 ? Math.abs(ws) : 0; // the other foot rests
        const fz = lerp(footZ[i] + (ws * s < 0 ? Math.abs(ws) * 0.04 : 0), f.z, moveW);
        const fy = ANK + f.lift * moveW + (1 - moveW) * (ws * s < 0 ? Math.abs(ws) * 0.012 : 0);
        const fx = s * lerp(G.stance, G.width / 2 + 0.02 + run * 0.035 * M, moveW);
        const pitch = f.pitch * moveW + (1 - moveW) * (ws * s < 0 ? Math.abs(ws) * 0.12 : 0);
        solveLeg(s, hip, kn, an, fx, fy, fz, pitch, H, pX, roll, yaw);
        legFwd = Math.max(legFwd, -hip.rotation.x);
        legBack = Math.max(legBack, hip.rotation.x);
      }

      // ---- spine, arms and head ----
      const lean = G.lean * Math.min(1, v / 1.2) * moveW + 0.025 * Math.min(v, 3) * moveW + run * (0.17 + 0.05 * M) + stoop + clamp(S.acc * 0.025, -0.08, 0.08);
      spine.rotation.set(lean + run * 0.03 * Math.cos(TAU * stepPh * 1), -yaw * lerp(1.8, 1.2, run * M), -roll * 0.75 - pX * 0.6);
      const amp = (0.16 + 0.24 * Math.min(1, v / 2.9)) * G.swing * lerp(1, 1.6, run) * Math.min(1, v / 0.6 + 0.2);
      animateIdleUpper(dt, moveW);
      upperBody(dt, moveW, ph, amp, G.elbow, run, lean);
      updateCloth(dt, v * moveW, legFwd, legBack);
    },
  };
}

// Ready-made outfits for the people of the village. Each has a look, a build, a way of
// walking, an idle stance and a few habits.
export const OUTFITS = {
  player: {
    kameez: '#8fb0c9', shoulderCloth: '#b8382f', scarfStripe: '#1f2a4a', moustache: 'thin', beard: 'stubble', hairStyle: 'parted',
    shoes: 'peshawari', watch: true, habits: ['phone', 'watch', 'scratch', 'stretch'],
  },
  bashir: {
    kameez: '#ece7da', lower: 'dhoti', dhotiColor: '#4f6584', headwear: 'pagri', headColor: '#f4f1e8', beard: 'white', moustache: true,
    chadar: '#7a5a40', skin: SKIN[1], belly: 0.35, stoop: 0.14, glasses: true, nose: 1.25, brow: -0.15, gait: 'elder',
    shoes: 'khussa', shoeColor: '#5a3020', habits: ['smoke', 'beard', 'smoke', 'scratch'],
  },
  aslam: {
    kameez: '#c7b994', headwear: 'turla', headColor: '#efeadd', waistcoat: '#3a342c', moustache: 'handlebar', skin: SKIN[3],
    shoulderCloth: '#5f7d4a', scarfStripe: '#e9e0c0', build: 1.15, belly: 0.55, shoulders: 1.08, brow: 0.2, nose: 1.15,
    gait: 'proud', pose: 'hips', shoes: 'peshawari', habits: ['moustache', 'scratch', 'stretch'],
  },
  haji: {
    kameez: '#f1eee6', headwear: 'topi', beard: 'white', waistcoat: '#2f3a4a', skin: SKIN[2], belly: 0.85, build: 1.12,
    glasses: true, brow: -0.1, gait: 'elder', stoop: 0.05, pose: 'clasp', shoes: 'chappal', habits: ['tasbeeh', 'beard', 'tasbeeh'],
  },
  billu: {
    kameez: '#6c7d5a', sweater: '#5a4a44', skin: SKIN[0], shoulderCloth: '#d9c9a0', scarfStripe: '#8a3a2a', build: 0.86,
    moustache: 'thin', hairStyle: 'parted', sleeves: 'rolled', pose: 'rest', habits: ['wipe', 'scratch', 'phone'],
  },
  sughran: {
    kameez: '#8c3550', headwear: 'dupatta', headColor: '#d9a83a', trim: '#e8c86a', female: true, skin: SKIN[1], moustache: false,
    build: 1.12, belly: 0.4, sleeves: 'rolled', bangles: '#c0303a', pose: 'clasp', shoes: 'chappal', habits: ['dupatta', 'wipe'],
  },
  nasreen: {
    kameez: '#2f8a7a', headwear: 'dupatta', headColor: '#e86a8a', trim: '#f2d06a', female: true, skin: SKIN[2], moustache: false,
    build: 0.92, bangles: ['#c8302a', '#2a8a3a', '#d9b04a', '#c8302a'], shoes: 'khussa', shoeColor: '#8a2a3a', pose: 'clasp',
    habits: ['dupatta', 'look'],
  },
  ammi: {
    kameez: '#5a4a8a', headwear: 'chadar', chadar: '#e7dcc4', female: true, skin: SKIN[0], moustache: false, build: 1.05,
    belly: 0.25, bangles: '#d9b04a', pose: 'clasp', stoop: 0.04, habits: ['dupatta', 'wipe'],
  },
  imam: {
    kameez: '#f4f2ec', headwear: 'topi', beard: 'long', moustache: false, waistcoat: '#4a4038', skin: SKIN[0], hem: 0.36,
    build: 0.92, shoulders: 0.96, brow: -0.1, pose: 'behind', shawl: '#8a7a64', habits: ['tasbeeh', 'beard', 'tasbeeh'],
  },
  jeeda: {
    kameez: '#a8643c', sweater: '#7a2a2a', scale: 0.8, moustache: false, headwear: 'beanie', headColor: '#c8a040', skin: SKIN[3],
    shoes: 'bare', prop: 'stick', habits: ['swish', 'scratch', 'swish'], pose: 'rest',
  },
  musafir: {
    kameez: '#4a5a6a', waistcoat: '#232323', skin: SKIN[1], beard: 'short', moustache: 'thick', headwear: 'jinnah', headColor: '#5a5450',
    carry: 'bag', watch: true, shoes: 'peshawari', shoeColor: '#2a1a12', habits: ['watch', 'phone', 'watch', 'stretch'], pose: 'rest',
  },
  ustad: {
    kameez: '#5e5e5a', skin: SKIN[3], moustache: 'thick', beard: 'stubble', headwear: 'beanie', headColor: '#2a3448', build: 1.15,
    belly: 0.6, sleeves: 'rolled', grease: true, pose: 'hips', habits: ['wipe', 'scratch', 'stretch'], shoes: 'chappal',
  },
  kid1: { kameez: '#d9463d', shalwar: '#e9e4d6', scale: 0.62, moustache: false, skin: SKIN[2], prop: 'bat', shoes: 'bare', habits: ['bat', 'scratch'] },
  kid2: { kameez: '#3d7ad9', sweater: '#3a6a3a', scale: 0.58, moustache: false, skin: SKIN[0], habits: ['scratch', 'stretch'], shoes: 'chappal' },
  kid3: { kameez: '#e2b84a', shalwar: '#e9e4d6', scale: 0.66, moustache: false, skin: SKIN[1], headwear: 'topi', habits: ['scratch'], pose: 'hips' },
  // people out on the lanes
  rahiElder: {
    kameez: '#e2ddd0', chadar: '#6a5038', headwear: 'pagri', headColor: '#f0ece2', beard: 'white', skin: SKIN[4], stoop: 0.22,
    gait: 'elder', prop: 'lathi', pose: 'lathi', nose: 1.3, shoes: 'khussa', shoeColor: '#4a2a1a', habits: ['beard', 'scratch'],
  },
  rahiFarmer: {
    kameez: '#7a8a6a', headwear: 'parna', headColor: '#d8cfb8', shoulderCloth: '#b8463a', scarfStripe: '#e9e0c0', moustache: 'thick',
    skin: SKIN[3], build: 1.05, sleeves: 'rolled', shoes: 'chappal', carry: 'fodder', habits: ['scratch'],
  },
  rahiWoman: {
    kameez: '#b0603a', headwear: 'dupatta', headColor: '#3a5a8a', trim: '#e0b850', female: true, skin: SKIN[1], moustache: false,
    carry: 'gathri', carryColor: '#c8a040', bangles: '#2a8a3a', shoes: 'chappal', habits: ['dupatta'],
  },
  rahiWoman2: {
    kameez: '#5a7a3a', headwear: 'dupatta', headColor: '#d8c8a8', female: true, skin: SKIN[3], moustache: false, build: 1.05,
    stoop: 0.04, carry: 'fodder', bangles: '#c0303a', shoes: 'bare', habits: ['dupatta', 'wipe'],
  },
  rahiMilk: {
    kameez: '#c9c2b0', headwear: 'topi', beard: 'full', waistcoat: '#4a3a2a', skin: SKIN[0], prop: 'can', build: 1.05,
    shoes: 'chappal', habits: ['beard', 'scratch'],
  },
  rahiBoy: {
    kameez: '#f0eee8', shalwar: '#f0eee8', sweater: '#2a4a8a', scale: 0.72, moustache: false, skin: SKIN[2], carry: 'schoolbag',
    hairStyle: 'parted', shoes: 'chappal', shoeColor: '#2a2a2a', habits: ['scratch', 'stretch'],
  },
  rahiYoung: {
    kameez: '#2e3a48', sweater: '#6a6058', moustache: 'thin', beard: 'stubble', hairStyle: 'parted', skin: SKIN[2], build: 0.95,
    shoes: 'peshawari', watch: true, habits: ['phone', 'phone', 'watch'], pose: 'rest',
  },
};
