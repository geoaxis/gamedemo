import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getTexture, hasTexture } from './textures.js';
import { grime } from './grime.js';

// Low-poly modelling kit. Every shape gets a per-vertex colour, and a Builder merges
// many shapes into one mesh per material so a whole house costs a couple of draw calls.

const mats = new Map();
const extraTextures = new Map(); // textures registered at run time (signs, truck art)

export function registerTexture(key, texture) {
  extraTextures.set(key, texture);
}

export function getMat(key) {
  if (mats.has(key)) return mats.get(key);
  let m;
  if (key === 'flat') m = grime(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 0.5);
  else if (key === 'glow') m = new THREE.MeshBasicMaterial({ vertexColors: true });
  else {
    const map = extraTextures.get(key) || (hasTexture(key) ? getTexture(key) : null);
    if (!map) throw new Error(`Unknown material: ${key}`);
    m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map });
    if (hasTexture(key)) grime(m, 1);
  }
  mats.set(key, m);
  return m;
}

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _e = new THREE.Euler();

export function tint(g, color) {
  _c.set(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// Colour the geometry with a vertical gradient between two colours (used for crops).
export function tintGradient(g, bottom, top) {
  g.computeBoundingBox();
  const { min, max } = g.boundingBox;
  const a = new THREE.Color(bottom), b = new THREE.Color(top);
  const pos = g.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = (pos.getY(i) - min.y) / Math.max(1e-6, max.y - min.y);
    _c.copy(a).lerp(b, k);
    arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// p: { x, y, z, rx, ry, rz, sx, sy, sz }
function place(g, p = {}) {
  if (p.sx || p.sy || p.sz) g.scale(p.sx || 1, p.sy || 1, p.sz || 1);
  if (p.rx || p.ry || p.rz) g.applyMatrix4(_m.makeRotationFromEuler(_e.set(p.rx || 0, p.ry || 0, p.rz || 0)));
  if (p.x || p.y || p.z) g.translate(p.x || 0, p.y || 0, p.z || 0);
  return g;
}

function norm(g) {
  const out = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(out.attributes)) {
    if (!['position', 'normal', 'uv', 'color'].includes(name)) out.deleteAttribute(name);
  }
  if (!out.attributes.uv) {
    out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
  }
  if (!out.attributes.normal) out.computeVertexNormals();
  return out;
}

export const box = (w, h, d, color, p) => place(tint(norm(new THREE.BoxGeometry(w, h, d)), color), p);
export const cyl = (rTop, rBot, h, color, seg = 8, p) =>
  place(tint(norm(new THREE.CylinderGeometry(rTop, rBot, h, seg)), color), p);
export const cone = (r, h, color, seg = 6, p) => place(tint(norm(new THREE.ConeGeometry(r, h, seg)), color), p);
export const sph = (r, color, p, ws = 7, hs = 5) =>
  place(tint(norm(new THREE.SphereGeometry(r, ws, hs)), color), p);
export const ico = (r, color, detail = 0, p) => place(tint(norm(new THREE.IcosahedronGeometry(r, detail)), color), p);
export const dome = (r, color, p, ws = 10, hs = 5) =>
  place(tint(norm(new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, Math.PI / 2)), color), p);
export const torus = (r, tube, color, arc = Math.PI * 2, p, rs = 5, ts = 10) =>
  place(tint(norm(new THREE.TorusGeometry(r, tube, rs, ts, arc)), color), p);
export const capsule = (r, len, color, p, cs = 3, rs = 7) =>
  place(tint(norm(new THREE.CapsuleGeometry(r, len, cs, rs)), color), p);

// A box whose texture repeats every `tile` metres on every face, so brick courses line up.
export function tbox(w, h, d, tile, p, color = '#ffffff') {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / tile);
    }
  }
  return place(tint(norm(g), color), p);
}

// Any geometry made elsewhere (extrusions, custom strips) can join a Builder through this.
export const raw = (g, color = '#ffffff', p) => place(tint(norm(g), color), p);

export class Builder {
  constructor() {
    this.parts = new Map();
    this.stack = [new THREE.Matrix4()];
  }
  get matrix() { return this.stack[this.stack.length - 1]; }
  // Enter a local frame: translate then rotate about the vertical axis.
  push(x = 0, y = 0, z = 0, ry = 0) {
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    this.stack.push(this.matrix.clone().multiply(m));
    return this;
  }
  pop() { this.stack.pop(); return this; }
  add(g, mat = 'flat') {
    if (this.stack.length > 1) g.applyMatrix4(this.matrix);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    return this;
  }
  // Local point to the current frame's parent space (used to register colliders).
  point(x, z) {
    const v = new THREE.Vector3(x, 0, z).applyMatrix4(this.matrix);
    return [v.x, v.z];
  }
  geometry(mat = 'flat') {
    return mergeGeometries(this.parts.get(mat));
  }
  build({ cast = true, receive = true } = {}) {
    const group = new THREE.Group();
    for (const [key, geoms] of this.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(geoms), getMat(key));
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      group.add(mesh);
    }
    return group;
  }
}
