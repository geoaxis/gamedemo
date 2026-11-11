import * as THREE from 'three';
import { heightAt } from '../world/terrain.js';
import { insideBox } from './collision.js';
import { angDiff, clamp } from '../util/rng.js';

// Third-person camera that orbits the player with the mouse.
// With yaw = 0 the camera looks along +z; moving the mouse right turns the view right.

export class FollowCam {
  constructor(camera, yaw = 0) {
    this.camera = camera;
    this.yaw = yaw;
    this.pitch = 0.3;
    this.dist = 6.5;
    this.idle = 0;
    this.target = new THREE.Vector3();
    this.ready = false;
    this.baseFov = camera.fov;
    this.kick = 0;
    this.shoulder = 0;
    this.time = 0;
  }

  update(dt, input, focus, { driving = false, driveYaw = 0, speed = 0 } = {}) {
    this.time += dt;
    if (input.dx || input.dy) this.idle = 0; else this.idle += dt;
    this.yaw -= input.dx * 0.0032;
    this.pitch = clamp(this.pitch + input.dy * 0.0026, -0.12, 1.25);
    this.dist = clamp(this.dist + input.wheel * 0.006, 2.5, 16);

    // swing back behind the tractor when the mouse is left alone
    if (driving && this.idle > 1.2) this.yaw += angDiff(this.yaw, driveYaw) * Math.min(1, dt * 1.8);

    const want = driving ? Math.max(this.dist, 9) : this.dist;
    const lift = driving ? 2.3 : 1.45;
    const t = this.ready ? Math.min(1, dt * 10) : 1;
    this.target.x += (focus.x - this.target.x) * t;
    this.target.y += (focus.y + lift - this.target.y) * t;
    this.target.z += (focus.z - this.target.z) * t;
    this.ready = true;

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const ox = -Math.sin(this.yaw) * cp, oz = -Math.cos(this.yaw) * cp;

    // pull the camera in when a wall or building would come between it and the player
    let reach = want;
    for (let d = 0.6; d <= want; d += 0.3) {
      if (this.target.y + sp * d < 3.6 && insideBox(this.target.x + ox * d, this.target.z + oz * d)) { reach = Math.max(0.8, d - 0.45); break; }
    }
    this.reach = this.reach === undefined || reach < this.reach ? reach : this.reach + (reach - this.reach) * Math.min(1, dt * 4);

    const cam = this.camera;
    // over the right shoulder on foot, centred behind the tractor
    this.shoulder += ((driving ? 0 : 0.42 * Math.min(1, this.reach / 4)) - this.shoulder) * Math.min(1, dt * 3);
    let rx = -Math.cos(this.yaw) * this.shoulder, rz = Math.sin(this.yaw) * this.shoulder;
    // the shoulder offset must not put the camera inside a wall in a narrow lane
    if (insideBox(this.target.x + ox * this.reach + rx, this.target.z + oz * this.reach + rz, 0.15)) {
      this.shoulder *= 0.5; rx *= 0.3; rz *= 0.3;
    }
    // a faint drift, as if the camera were held
    const sway = 0.025 + Math.min(1, speed / 6) * 0.03;
    const hx = Math.sin(this.time * 0.9) * sway, hy = Math.sin(this.time * 1.3 + 1) * sway * 0.6;
    cam.position.set(this.target.x + ox * this.reach + rx, this.target.y + sp * this.reach + hy, this.target.z + oz * this.reach + rz);
    const floor = heightAt(cam.position.x, cam.position.z) + 0.35;
    if (cam.position.y < floor) cam.position.y = floor;
    cam.lookAt(this.target.x + rx + hx * 0.3, this.target.y, this.target.z + rz);
    // widen the view a touch when running or driving fast
    const kick = clamp((speed - 3.2) / 3, 0, 1) * 6;
    this.kick += (kick - this.kick) * Math.min(1, dt * 2.5);
    const fov = this.baseFov + this.kick;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }
}
