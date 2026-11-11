import { makeHuman, OUTFITS } from '../models/human.js';
import { heightAt } from '../world/terrain.js';
import { addDynamic } from './collision.js';
import { NPCS } from '../data/strings.js';
import { lanePath } from '../world/paths.js';
import { angDiff } from '../util/rng.js';

// Villagers. Most stay at their spot and turn to face you; a few stroll up and down a lane.
//
// path: [[x, z], ...] or a lane { lane: 'main', from: 80, to: 240 }. Walkers keep to the left
// of the centre line (offset metres), steer smoothly toward a point a little way ahead, and
// turn round at the ends instead of jumping back to the start.

const LOOKAHEAD = 1.8;

function makeRoute(path) {
  const pts = Array.isArray(path) ? path : lanePath(path.lane, path.from ?? 0, path.to ?? Infinity, path.every ?? 3);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}

export class Villager {
  constructor(scene, id, outfit, spot, { seat = null, path = null, lines = id, offset = 1, speed = null } = {}) {
    this.id = id;
    this.def = NPCS[lines];
    this.human = makeHuman(typeof outfit === 'string' ? OUTFITS[outfit] : outfit);
    this.x = spot.x ?? 0; this.z = spot.z ?? 0;
    this.yaw = this.homeYaw = spot.yaw || 0;
    this.line = 0;
    this.speed = 0;
    this.talking = 0;
    this.pause = 0;
    this.homeX = this.x; this.homeZ = this.z;
    // where to go when it rains: { x, z, hide } (hide: they have gone indoors), set by main
    this.shelter = null;
    this.sheltering = false; // heading to or waiting at the shelter
    this.returning = false; // walking back afterwards
    if (path) {
      this.route = makeRoute(path);
      this.offset = offset;
      this.cruise = speed ?? this.human.walkSpeed * (0.92 + Math.random() * 0.16);
      this.dir = Math.random() < 0.5 ? 1 : -1;
      // start where the spot projects onto the route (or somewhere along it)
      this.s = spot.x !== undefined ? this.project(this.x, this.z, 0, this.route.len) : Math.random() * this.route.len;
      [this.x, this.z] = this.at(this.s);
      const [ax, az] = this.at(this.s + this.dir * LOOKAHEAD);
      this.yaw = Math.atan2(ax - this.x, az - this.z);
    }
    if (seat) {
      this.seated = true;
      this.x = seat.x; this.z = seat.z;
      this.yaw = this.homeYaw = seat.ry + Math.PI / 2;
      this.human.setSitting(true, seat.h);
    } else {
      this.body = addDynamic({ x: this.x, z: this.z, r: 0.32 });
    }
    scene.add(this.human.group);
    this.place();
  }

  nextLine() {
    const l = this.def.lines[this.line % this.def.lines.length];
    this.line++;
    this.talking = 5;
    return { name: this.def.name, line: l };
  }

  // centre-line point and direction at distance s
  centre(s) {
    const { pts, cum, len } = this.route;
    s = Math.max(0, Math.min(len, s));
    let i = 1;
    while (i < pts.length - 1 && cum[i] < s) i++;
    const a = pts[i - 1], b = pts[i];
    const seg = cum[i] - cum[i - 1] || 1;
    const t = (s - cum[i - 1]) / seg;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / seg, (b[1] - a[1]) / seg];
  }

  // where a walker going in this.dir wants to be: left of the centre line, as seen walking
  at(s) {
    const [x, z, dx, dz] = this.centre(s);
    const o = this.offset * this.dir;
    return [x + dz * o, z - dx * o];
  }

  project(x, z, s0, s1) {
    let best = s0, bd = Infinity;
    const n = Math.max(8, Math.ceil((s1 - s0) / 0.5));
    for (let i = 0; i <= n; i++) {
      const s = s0 + ((s1 - s0) * i) / n;
      const [cx, cz] = this.centre(s);
      const d = (cx - x) ** 2 + (cz - z) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  place() {
    const g = this.human.group;
    g.position.set(this.x, heightAt(this.x, this.z), this.z);
    g.rotation.y = this.yaw;
    if (this.body) { this.body.x = this.x; this.body.z = this.z; }
  }

  turnTo(want, rate, dt) {
    const d = angDiff(this.yaw, want);
    const step = d * Math.min(1, dt * rate);
    this.yaw += step;
    return Math.abs(step) / Math.max(dt, 1e-4);
  }

  // Walk straight toward a point. Returns true on arrival.
  goTo(tx, tz, speed, dt) {
    const ddx = tx - this.x, ddz = tz - this.z, d = Math.hypot(ddx, ddz);
    if (d < 0.35) { this.speed *= 1 - Math.min(1, dt * 6); return true; }
    this.speed += (Math.min(speed, 0.6 + d) - this.speed) * Math.min(1, dt * 2.5);
    this.turnTo(Math.atan2(ddx, ddz), 5, dt);
    const facing = Math.max(0, Math.cos(angDiff(this.yaw, Math.atan2(ddx, ddz))));
    this.x += Math.sin(this.yaw) * this.speed * facing * dt;
    this.z += Math.cos(this.yaw) * this.speed * facing * dt;
    return false;
  }

  // Rain: hurry to shelter, wait it out (indoors or under a roof or tree), then come back.
  // Returns true while this has taken over from the usual behaviour.
  weather(dt, rain) {
    const h = this.human;
    if (!this.shelter || this.seated) return false;
    if (!this.sheltering && rain > 0.25) { this.sheltering = true; this.returning = false; }
    if (this.sheltering && rain < 0.05) {
      this.sheltering = false; this.returning = true;
      if (!h.group.visible) { h.group.visible = true; if (this.body) this.body.off = false; }
    }
    if (this.sheltering) {
      if (!h.group.visible) return true;
      const S = this.shelter;
      if (this.goTo(S.x, S.z, h.walkSpeed * 2.1, dt)) {
        if (S.hide) { h.group.visible = false; if (this.body) this.body.off = true; return true; }
        this.turnTo(S.face ?? this.yaw, 2, dt);
      }
      h.update(dt, this.speed);
      this.place();
      return true;
    }
    if (this.returning) {
      const [tx, tz] = this.route ? this.at(this.s) : [this.homeX, this.homeZ];
      if (this.goTo(tx, tz, h.walkSpeed, dt)) this.returning = false;
      h.update(dt, this.speed);
      this.place();
      return this.returning;
    }
    return false;
  }

  update(dt, player, rain = 0) {
    if (this.weather(dt, rain)) return;
    const dx = player.x - this.x, dz = player.z - this.z;
    const dist = Math.hypot(dx, dz);
    const near = dist < 4.5;
    const h = this.human;
    this.talking -= dt;
    h.state.talking = this.talking > 0;
    h.state.attend = near;
    let turnRate = 0;

    if (this.route) {
      const R = this.route;
      let target = 0;
      if (near || this.talking > 0) target = 0;
      else if (this.pause > 0) this.pause -= dt;
      else {
        const end = this.dir > 0 ? R.len - 0.6 : 0.6;
        if ((this.s - end) * this.dir >= 0) {
          // reached the end: stand a while, then head back the other way
          this.pause = 3 + Math.random() * 6;
          this.dir = -this.dir;
        } else {
          target = this.cruise;
          if (Math.random() < dt * 0.012) this.pause = 2 + Math.random() * 4; // stop to look about
        }
      }
      this.speed += (target - this.speed) * Math.min(1, dt * (target > this.speed ? 1.6 : 3));
      if (near && this.speed < 0.3) turnRate = this.turnTo(Math.atan2(dx, dz), 3, dt);
      else if (this.speed > 0.05 || target > 0) {
        const [cx, cz] = this.at(this.s + this.dir * LOOKAHEAD);
        turnRate = this.turnTo(Math.atan2(cx - this.x, cz - this.z), this.speed > 0.3 ? 2.6 : 2.4, dt);
        // walk where we face; a slow turn round at the end becomes a little arc
        const facing = Math.cos(angDiff(this.yaw, Math.atan2(cx - this.x, cz - this.z)));
        const v = this.speed * Math.max(0, facing);
        this.x += Math.sin(this.yaw) * v * dt;
        this.z += Math.cos(this.yaw) * v * dt;
        this.s = this.project(this.x, this.z, this.s - 1.5, this.s + 1.5);
      }
      h.update(dt, this.speed, this.speed < 0.3 && turnRate > 0.8 ? 1 : 0);
    } else {
      if (near) {
        const want = Math.atan2(dx, dz);
        if (this.seated) {
          // seated people only turn their head
          h.head.rotation.y += (Math.max(-1, Math.min(1, angDiff(this.yaw, want))) - h.head.rotation.y) * Math.min(1, dt * 4);
        } else turnRate = this.turnTo(want, 4, dt);
      } else {
        turnRate = this.turnTo(this.homeYaw, 2, dt);
        h.head.rotation.y *= 1 - Math.min(1, dt * 3);
      }
      // a quick turn on the spot is a couple of small shuffling steps
      h.update(dt, 0, turnRate > 0.8 ? 1 : 0);
    }
    this.place();
  }
}
