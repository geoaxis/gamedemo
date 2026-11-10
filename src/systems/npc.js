import { makeHuman, OUTFITS } from '../models/human.js';
import { heightAt } from '../world/terrain.js';
import { addDynamic } from './collision.js';
import { NPCS } from '../data/strings.js';
import { angDiff } from '../util/rng.js';

// Villagers. Most stay at their spot and turn to face you; a few stroll along a path.

export class Villager {
  constructor(scene, id, outfit, spot, { seat = null, path = null, lines = id } = {}) {
    this.id = id;
    this.def = NPCS[lines];
    this.human = makeHuman(typeof outfit === 'string' ? OUTFITS[outfit] : outfit);
    this.x = spot.x; this.z = spot.z;
    this.yaw = this.homeYaw = spot.yaw || 0;
    this.line = 0;
    this.path = path; this.leg = 0; this.pause = 0;
    this.speed = 0;
    this.talking = 0;
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

  place() {
    const g = this.human.group;
    g.position.set(this.x, heightAt(this.x, this.z), this.z);
    g.rotation.y = this.yaw;
    if (this.body) { this.body.x = this.x; this.body.z = this.z; }
  }

  update(dt, player) {
    const dx = player.x - this.x, dz = player.z - this.z;
    const dist = Math.hypot(dx, dz);
    const near = dist < 4.5;
    this.talking -= dt;
    this.speed = 0;

    if (this.path && !near && this.talking <= 0) {
      if (this.pause > 0) this.pause -= dt;
      else {
        const [tx, tz] = this.path[this.leg];
        const ddx = tx - this.x, ddz = tz - this.z, d = Math.hypot(ddx, ddz);
        if (d < 0.3) { this.leg = (this.leg + 1) % this.path.length; this.pause = 2 + Math.random() * 5; }
        else {
          this.speed = 1.25;
          this.yaw += angDiff(this.yaw, Math.atan2(ddx, ddz)) * Math.min(1, dt * 5);
          this.x += (ddx / d) * this.speed * dt;
          this.z += (ddz / d) * this.speed * dt;
        }
      }
    } else if (near) {
      const want = Math.atan2(dx, dz);
      if (this.seated) {
        // seated people only turn their head
        this.human.head.rotation.y += (Math.max(-1, Math.min(1, angDiff(this.yaw, want))) - this.human.head.rotation.y) * Math.min(1, dt * 4);
      } else this.yaw += angDiff(this.yaw, want) * Math.min(1, dt * 4);
    } else if (!this.path) {
      this.yaw += angDiff(this.yaw, this.homeYaw) * Math.min(1, dt * 2);
      this.human.head.rotation.y *= 1 - Math.min(1, dt * 3);
    }
    this.human.update(dt, this.speed);
    this.place();
  }
}
