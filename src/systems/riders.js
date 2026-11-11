import * as THREE from 'three';
import { Builder } from '../models/build.js';
import * as P from '../models/props.js';
import { makeHuman } from '../models/human.js';
import { lanePath } from '../world/paths.js';
import { heightAt } from '../world/terrain.js';
import { addDynamic, dynamic } from './collision.js';
import { angDiff } from '../util/rng.js';

// Two-wheelers on the village lanes: three men squeezed onto one motorcycle, a milkman on
// his bicycle, a boy on a bicycle too big for him. They keep to the left, ring or honk at
// whoever is in the way, and at the end of the lane wait a while and come back.

const KINDS = {
  motorcycle: { speed: 6.5, seat: 0.8, build: (b) => P.motorcycle(b, 0, 0, 0, false), riders: [0.08, -0.3, -0.66] },
  bicycle: { speed: 3.6, seat: 0.92, build: (b) => P.bicycle(b, 0, 0, 0, false), riders: [-0.3] },
};

class Rider {
  constructor(scene, kind, lane, looks, { from = 0, to = Infinity, milk = false } = {}) {
    this.def = KINDS[kind];
    this.kind = kind;
    this.pts = lanePath(lane, from, to, 3);
    // cumulative distances along the route
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.pts[i][0] - this.pts[i - 1][0], this.pts[i][1] - this.pts[i - 1][1]));
    this.len = this.cum[this.cum.length - 1];
    this.s = Math.random() * this.len;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.v = 0; this.wait = 0; this.honk = 0; this.t = Math.random() * 10;
    this.group = new THREE.Group();
    const b = new Builder();
    this.def.build(b);
    if (milk) for (const sx of [-0.3, 0.3]) P.ghara(b, sx, 0.55, -0.55, 0.7);
    this.group.add(b.build());
    this.people = looks.map((look, i) => {
      const h = makeHuman(look);
      h.setSitting(true, this.def.seat);
      if (i === 0) h.setDriving(true);
      h.group.position.z = this.def.riders[i];
      this.group.add(h.group);
      return h;
    });
    this.group.rotation.order = 'YXZ';
    scene.add(this.group);
    this.body = addDynamic({ x: 0, z: 0, r: 0.7 });
    this.yaw = 0;
    this.place(0);
  }

  // Position on the route at distance s, nudged to the left of the direction of travel.
  at(s) {
    const c = this.cum;
    let i = 1;
    while (i < c.length - 1 && c[i] < s) i++;
    const a = this.pts[i - 1], b = this.pts[i];
    const t = (s - c[i - 1]) / ((c[i] - c[i - 1]) || 1);
    const dx = (b[0] - a[0]) * this.dir, dz = (b[1] - a[1]) * this.dir, l = Math.hypot(dx, dz) || 1;
    // keep left: the left of travel direction (dx, dz) is (dz, -dx)
    return { x: a[0] + (b[0] - a[0]) * t + (dz / l) * 1.1, z: a[1] + (b[1] - a[1]) * t - (dx / l) * 1.1, yaw: Math.atan2(dx, dz) };
  }

  place(dt) {
    const p = this.at(this.s);
    this.x = p.x; this.z = p.z;
    this.yaw += angDiff(this.yaw, p.yaw) * Math.min(1, dt * 4 || 1);
    const y = heightAt(p.x, p.z);
    this.group.position.set(p.x, y, p.z);
    this.group.rotation.y = this.yaw;
    // lean into the bends and a little wobble at low speed
    this.group.rotation.z = angDiff(this.yaw, p.yaw) * -0.6 + Math.sin(this.t * 1.7) * 0.03 * (1 - Math.min(1, this.v / 3));
    this.body.x = p.x; this.body.z = p.z;
  }

  update(dt, player, onHonk) {
    this.t += dt;
    let target = this.def.speed;
    if (this.wait > 0) {
      this.wait -= dt; target = 0;
      if (this.wait <= 0) this.dir *= -1;
    } else {
      // brake for anyone in front
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      for (const o of [player, ...dynamic]) {
        if (o === this.body || o.off) continue;
        const dx = o.x - this.x, dz = o.z - this.z;
        const ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
        if (ahead > 0.5 && ahead < 7 && side < 1.6) {
          target = 0;
          if (this.honk <= 0 && o === player) { onHonk?.(this); this.honk = 4; }
        }
      }
      // slow down at the ends of the lane
      const left = this.dir > 0 ? this.len - this.s : this.s;
      target = Math.min(target, 0.8 + left * 0.6);
      if (left < 0.5) { this.wait = 3 + Math.random() * 8; target = 0; }
    }
    this.honk -= dt;
    this.v += (target - this.v) * Math.min(1, dt * (target < this.v ? 4 : 1.2));
    this.s = Math.max(0, Math.min(this.len, this.s + this.dir * this.v * dt));
    this.place(dt);
    // pedalling, and the passengers swaying along
    this.people.forEach((h, i) => {
      h.update(dt, 0);
      if (this.kind === 'bicycle' && i === 0) {
        const ph = this.s * 2.2;
        h.legL.rotation.x += Math.sin(ph) * 0.45;
        h.legR.rotation.x += Math.sin(ph + Math.PI) * 0.45;
      }
      h.group.rotation.z = Math.sin(this.t * 2.1 + i) * 0.02;
    });
  }
}

export function buildRiders(scene) {
  const riders = [
    new Rider(scene, 'motorcycle', 'link', [
      { kameez: '#4a5a6a', waistcoat: '#2a2a2a', beard: 'full' },
      { kameez: '#e9e4d6', headwear: 'topi' },
      { kameez: '#7a6a4a', shoulderCloth: '#c9463d' },
    ]),
    new Rider(scene, 'bicycle', 'main', [{ kameez: '#e9e4d6', headwear: 'pagri', headColor: '#f2efe6', beard: 'white' }], { from: 80, milk: true }),
    new Rider(scene, 'bicycle', 'back', [{ kameez: '#3d7ad9', scale: 0.8, moustache: false }]),
  ];
  return {
    riders,
    update(dt, player, onHonk) { for (const r of riders) r.update(dt, player, onHonk); },
  };
}
