import { makeHuman, OUTFITS } from '../models/human.js';
import { heightAt, surfaceAt } from '../world/terrain.js';
import { resolve, blocked } from './collision.js';
import { angDiff } from '../util/rng.js';

// The young man the player walks around as. He can walk, run, sit on a charpai and
// drive the tractor.

const WALK = 2.9, RUN = 6.4, RADIUS = 0.35;

export class Player {
  constructor(scene, x, z, yaw) {
    this.scene = scene;
    this.human = makeHuman(OUTFITS.player);
    scene.add(this.human.group);
    this.x = x; this.z = z; this.yaw = yaw; this.y = heightAt(x, z);
    this.mode = 'walk'; // walk | sit | drive
    this.speed = 0;
    this.stride = 0;
    this.onStep = null; // (surface, running) => void
    this.onBlocked = null; // (what) => void
    this.tractor = null;
    this.seat = null;
  }

  sit(seat) {
    this.mode = 'sit';
    this.seat = seat;
    this.x = seat.x; this.z = seat.z;
    this.yaw = seat.ry + Math.PI / 2;
    this.human.setSitting(true, seat.h);
  }

  stand() {
    this.mode = 'walk';
    this.human.setSitting(false);
    // step off the side of the bed
    this.x += Math.sin(this.yaw) * 0.75;
    this.z += Math.cos(this.yaw) * 0.75;
    resolve(this, RADIUS);
    this.seat = null;
  }

  mount(tractor) {
    this.mode = 'drive';
    this.tractor = tractor;
    tractor.driven = true;
    const h = this.human;
    h.setSitting(true, tractor.model.seat.y);
    h.setDriving(true);
    tractor.model.group.add(h.group);
    h.group.position.set(0, 0, tractor.model.seat.z);
    h.group.rotation.set(0, 0, 0);
  }

  dismount() {
    const t = this.tractor;
    t.driven = false;
    const h = this.human;
    h.setSitting(false);
    h.setDriving(false);
    this.scene.add(h.group);
    // climb down on whichever side is clear
    for (const side of [1, -1]) {
      const x = t.x + Math.cos(t.yaw) * 1.9 * side, z = t.z - Math.sin(t.yaw) * 1.9 * side;
      this.x = x; this.z = z;
      if (!blocked(x, z, RADIUS)) break;
    }
    resolve(this, RADIUS);
    this.yaw = t.yaw;
    this.mode = 'walk';
    this.tractor = null;
  }

  update(dt, input, camYaw) {
    const h = this.human;
    if (this.mode === 'drive') {
      this.x = this.tractor.x; this.z = this.tractor.z; this.y = heightAt(this.x, this.z);
      this.yaw = this.tractor.yaw;
      h.armL.rotation.z = -0.07 - this.tractor.steer * 0.25;
      h.update(dt, 0);
      return;
    }
    if (this.mode === 'sit') {
      this.speed = 0;
      h.update(dt, 0);
    } else {
      const mx = input.moveX, mz = input.moveZ;
      if (mx || mz) {
        const len = Math.hypot(mx, mz);
        const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
        const dx = (fx * mz - fz * mx) / len, dz = (fz * mz + fx * mx) / len;
        const target = input.run ? RUN : WALK;
        this.speed += (target - this.speed) * Math.min(1, dt * 8);
        this.yaw += angDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 12);
        const px = this.x, pz = this.z;
        this.x += dx * this.speed * dt;
        this.z += dz * this.speed * dt;
        const hit = resolve(this, RADIUS);
        if (hit === 'canal' && this.onBlocked) this.onBlocked('canal');
        const moved = Math.hypot(this.x - px, this.z - pz);
        this.stride += moved;
        const gap = this.speed > 4 ? 1.25 : 0.78;
        if (this.stride > gap) { this.stride = 0; this.onStep?.(surfaceAt(this.x, this.z), this.speed > 4); }
        h.update(dt, moved / Math.max(dt, 1e-4));
      } else {
        this.speed = 0;
        h.update(dt, 0);
      }
    }
    const gy = heightAt(this.x, this.z);
    this.y += (gy - this.y) * Math.min(1, dt * 14);
    h.group.position.set(this.x, this.y, this.z);
    h.group.rotation.y = this.yaw;
  }
}
