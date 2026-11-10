import { makeTractor, makeTrolley } from '../models/tractor.js';
import { heightAt } from '../world/terrain.js';
import { resolve, addDynamic } from './collision.js';
import { clamp } from '../util/rng.js';

// The drivable tractor with its trolley trailing behind on a simple hitch.

const WHEELBASE = 1.95, HITCH = 1.5, MAX_FWD = 9.5, MAX_REV = 3.2;

export class Tractor {
  constructor(scene, x, z, yaw) {
    this.model = makeTractor();
    this.trolley = makeTrolley();
    this.model.group.rotation.order = 'YXZ';
    this.trolley.group.rotation.order = 'YXZ';
    scene.add(this.model.group, this.trolley.group);

    this.x = x; this.z = z; this.yaw = yaw;
    this.speed = 0; this.steer = 0;
    this.driven = false;
    this.trolleyYaw = yaw;
    this.axle = { x: x - Math.sin(yaw) * (HITCH + this.trolley.axle), z: z - Math.cos(yaw) * (HITCH + this.trolley.axle) };
    // obstacles other things bump into: tractor front and back, trolley front and back
    this.bodies = [0, 1, 2, 3].map(() => addDynamic({ x, z, r: 1.05 }));
    this.place();
  }

  get seatWorld() { return { x: this.x - Math.sin(this.yaw) * 0.8, z: this.z - Math.cos(this.yaw) * 0.8 }; }

  update(dt, input) {
    const throttle = this.driven ? input.throttle : 0;
    const steerIn = this.driven ? input.steer : 0;

    if (throttle > 0) this.speed += (this.speed < 0 ? 9 : 3.2) * dt * throttle;
    else if (throttle < 0) this.speed += (this.speed > 0 ? 9 : 2.4) * dt * throttle;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 2.2 * dt);
    this.speed = clamp(this.speed, -MAX_REV, MAX_FWD);

    // steer less sharply at speed so it does not flip about
    const maxSteer = 0.6 - 0.28 * Math.min(1, Math.abs(this.speed) / MAX_FWD);
    this.steer += (steerIn * maxSteer - this.steer) * Math.min(1, dt * 5);

    if (Math.abs(this.speed) > 0.01) {
      this.yaw += (this.speed / WHEELBASE) * Math.tan(this.steer) * dt;
      this.x += Math.sin(this.yaw) * this.speed * dt;
      this.z += Math.cos(this.yaw) * this.speed * dt;

      // collide with two circles, front and back, and carry the push over to the body
      let bumped = false;
      const [fb, rb] = this.bodies;
      fb.off = rb.off = true;
      for (const off of [1.0, -0.75]) {
        const p = { x: this.x + Math.sin(this.yaw) * off, z: this.z + Math.cos(this.yaw) * off };
        const bx = p.x, bz = p.z;
        if (resolve(p, 0.95)) { this.x += p.x - bx; this.z += p.z - bz; bumped = true; }
      }
      fb.off = rb.off = false;
      if (bumped) this.speed *= 0.82;

      // the trolley axle is dragged towards the hitch pin
      const hx = this.x - Math.sin(this.yaw) * HITCH, hz = this.z - Math.cos(this.yaw) * HITCH;
      const dx = hx - this.axle.x, dz = hz - this.axle.z;
      const d = Math.hypot(dx, dz) || 1;
      this.trolleyYaw = Math.atan2(dx, dz);
      this.axle.x = hx - (dx / d) * this.trolley.axle;
      this.axle.z = hz - (dz / d) * this.trolley.axle;

      const roll = this.speed * dt;
      for (const w of this.model.wheels) w.mesh.rotation.x += roll / w.r;
      for (const w of this.trolley.wheels) w.mesh.rotation.x += roll / w.r;
    }
    for (const p of this.model.frontPivots) p.rotation.y = this.steer;
    this.place();
  }

  place() {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const yf = heightAt(this.x + s * 1.2, this.z + c * 1.2), yr = heightAt(this.x - s * 0.75, this.z - c * 0.75);
    const g = this.model.group;
    g.position.set(this.x, yr + (yf - yr) * (0.75 / WHEELBASE), this.z);
    g.rotation.y = this.yaw;
    g.rotation.x = -Math.atan2(yf - yr, WHEELBASE);

    const hx = this.x - s * HITCH, hz = this.z - c * HITCH;
    const yh = heightAt(hx, hz), ya = heightAt(this.axle.x, this.axle.z);
    const t = this.trolley.group;
    t.position.set(hx, yh, hz);
    t.rotation.y = this.trolleyYaw;
    t.rotation.x = -Math.atan2(yh - ya, this.trolley.axle);

    const [fb, rb, t1, t2] = this.bodies;
    fb.x = this.x + s * 0.9; fb.z = this.z + c * 0.9;
    rb.x = this.x - s * 0.8; rb.z = this.z - c * 0.8;
    const ts = Math.sin(this.trolleyYaw), tc = Math.cos(this.trolleyYaw);
    t1.x = hx - ts * 2.3; t1.z = hz - tc * 2.3;
    t2.x = hx - ts * 4.2; t2.z = hz - tc * 4.2;
  }
}
