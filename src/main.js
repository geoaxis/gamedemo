import * as THREE from 'three';
import '@fontsource/noto-nastaliq-urdu/400.css';
import '@fontsource/noto-nastaliq-urdu/700.css';
import './ui/styles.css';

import { START, AREAS, CANAL, POND, CHOWK, TUBEWELL, KILN } from './data/layout.js';
import { AREA_NAMES, PROMPTS, TOASTS, CLOCK, petToast } from './data/strings.js';
import { loadUrduFont } from './ui/signs.js';
import { Hud } from './ui/hud.js';
import { Builder } from './models/build.js';
import { buildTerrain } from './world/terrain.js';
import { buildCanal } from './world/canal.js';
import { buildFields } from './world/fields.js';
import { buildVillage } from './world/village.js';
import { buildShops } from './world/shops.js';
import { buildTubewell } from './world/tubewell.js';
import { scatterTrees, buildTrees } from './world/trees.js';
import { buildSky } from './world/sky.js';
import { spawnAnimal, updateAnimals, animals, egret } from './models/animals.js';
import { Traffic } from './models/truck.js';
import { Input } from './systems/input.js';
import { Player } from './systems/player.js';
import { FollowCam } from './systems/camera.js';
import { Tractor } from './systems/vehicle.js';
import { Villager } from './systems/npc.js';
import { Interactions } from './systems/interact.js';
import { Sound } from './systems/audio.js';
import { makeRng } from './util/rng.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.3, 3200);
const resize = () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
};
window.addEventListener('resize', resize);
resize();

const hud = new Hud();
const input = new Input(canvas);
const sound = new Sound();

async function boot() {
  await loadUrduFont();
  const rng = makeRng(31);

  // ---- the world ----
  buildTerrain(scene);
  const canal = buildCanal(scene);
  const fields = buildFields(scene);
  const village = buildVillage(scene);
  const shops = buildShops(scene);
  const tubewell = buildTubewell(scene);
  scatterTrees();
  buildTrees(scene);
  const sky = buildSky(scene, [...shops.lights, ...village.lights]);
  if (params.has('hour')) sky.hours = parseFloat(params.get('hour'));

  // ---- animals ----
  for (const a of village.animals) spawnAnimal(scene, a.kind, a.x, a.z, { yaw: a.yaw, variant: a.variant, tether: true, graze: true });
  for (const h of village.hens) {
    for (let i = 0; i < h.n; i++) spawnAnimal(scene, 'chicken', h.x + rng.range(-1.5, 1.5), h.z + rng.range(-1.5, 1.5), { variant: rng.int(0, 3), roam: 3.5, yaw: rng() * 6 });
  }
  for (let i = 0; i < 4; i++) spawnAnimal(scene, 'chicken', CHOWK.x - 8 + rng.range(-3, 3), CHOWK.z + 8 + rng.range(-2, 2), { variant: i, roam: 6 });
  for (const [dx, dz, yaw, sunk] of [[-3, 1, 0.6, 0.78], [2.5, -2, 2.4, 0.72], [5, 3, 4.0, 0.8], [-6, -3, 5.2, 0.7], [0.5, 5, 1.4, 0.76]]) {
    spawnAnimal(scene, 'buffalo', POND.x + dx, POND.z + dz, { yaw, sunk, tether: true });
  }
  for (let i = 0; i < 7; i++) spawnAnimal(scene, 'goat', -45 + rng.range(-3, 3), -8 + rng.range(-5, 5), { variant: i, roam: 7, yaw: rng() * 6 });
  for (let i = 0; i < 6; i++) spawnAnimal(scene, 'sheep', 134 + rng.range(-4, 4), 76 + rng.range(-5, 5), { roam: 7, yaw: rng() * 6 });
  spawnAnimal(scene, 'donkey', shops.donkey.x, shops.donkey.z, { yaw: shops.donkey.yaw, tether: true });
  spawnAnimal(scene, 'donkey', KILN.x - 14, KILN.z + 30, { yaw: 1, tether: true, graze: true });
  spawnAnimal(scene, 'donkey', KILN.x - 10, KILN.z + 32, { yaw: 2.2, tether: true });
  spawnAnimal(scene, 'dog', CHOWK.x - 6, CHOWK.z + 11, { roam: 12 });
  spawnAnimal(scene, 'dog', 88, 163, { variant: 1, roam: 9 });
  spawnAnimal(scene, 'cow', tubewell.cow.x, tubewell.cow.z, { yaw: tubewell.cow.yaw + Math.PI, variant: 2, tether: true, graze: true });

  const birds = new Builder();
  for (let i = 0; i < 9; i++) {
    const a = rng() * 6.28, r = POND.r + rng.range(0.5, 3.5);
    egret(birds, POND.x + Math.cos(a) * r * 1.15, POND.z + Math.sin(a) * r * 0.9, rng() * 6);
  }
  for (const [x, z] of [[-150, 60], [-152, 63], [-147, 64], [-120, 84], [-126, 92], [-131, 80], [20, 110], [24, 113], [140, 120]]) egret(birds, x, z, rng() * 6);
  scene.add(birds.build());

  // ---- people ----
  const P = (id, outfit, spot, opts) => new Villager(scene, id, outfit, spot, opts);
  const people = [
    P('bashir', 'bashir', {}, { seat: village.bashirCharpai }),
    P('aslam', 'aslam', tubewell.aslam),
    P('haji', 'haji', shops.haji),
    P('billu', 'billu', shops.billu),
    P('sughran', 'sughran', village.sughran),
    P('nasreen', 'nasreen', { x: village.chowkPump.x + 1.0, z: village.chowkPump.z + 1.2, yaw: -2.4 }),
    P('imam', 'imam', village.imam),
    P('jeeda', 'jeeda', { x: -44.5, z: -17, yaw: 0.4 }),
    P('musafir', 'musafir', shops.musafir),
    P('ammi', 'ammi', village.ammi),
    P('ustad', 'ustad', shops.ustad),
    P('kids', 'kid1', { x: 35.3, z: -20, yaw: Math.PI / 2 }),
    P('kids', 'kid2', { x: 43.5, z: -20.2, yaw: -Math.PI / 2 }),
    P('kids', 'kid3', { x: 39.6, z: -18.4, yaw: 2.6 }),
    P('rahi', { kameez: '#c9c2b0', headwear: 'topi', beard: 'full', waistcoat: '#4a3a2a' }, { x: 8, z: 20.9 }, { path: [[4, 20.9], [112, 20.9]] }),
    P('rahi', { kameez: '#7a8a6a', headwear: 'pagri', headColor: '#e9e4d6', shoulderCloth: '#c9463d' }, { x: 61, z: 60 }, { path: [[61, 30], [61, 150]] }),
  ];

  // ---- player, tractor, traffic ----
  const player = new Player(scene, START.x, START.z, START.yaw);
  const cam = new FollowCam(camera, START.yaw);
  const tractor = new Tractor(scene, CHOWK.x + 12, CHOWK.z + 10, -Math.PI / 2);
  const traffic = new Traffic(scene);
  traffic.onHonk = (it) => (it === traffic.truck ? sound.truckHorn(it.x, it.z) : sound.rickshawHorn(it.x, it.z));

  let lastCanalToast = 0;
  player.onStep = (surface, running) => sound.step(surface, running);
  player.onBlocked = () => {
    if (performance.now() - lastCanalToast > 5000) { lastCanalToast = performance.now(); hud.toast(TOASTS.canalBlock); }
  };

  // ---- things to do ----
  const acts = new Interactions();
  const walking = () => player.mode === 'walk';
  for (const v of people) {
    acts.add({ at: () => v, r: 2.7, priority: 0.5, prompt: () => (walking() ? PROMPTS.talk : null), act: () => { const s = v.nextLine(); hud.say(s.name, s.line); } });
  }
  acts.add({
    at: () => tractor.seatWorld, r: 3, prompt: () => (walking() ? PROMPTS.mount : null),
    act: () => { player.mount(tractor); sound.engineStart(tractor.x, tractor.z); hud.hush(); },
  });
  acts.add({
    at: () => tubewell, r: 2.4, priority: 1, prompt: () => (walking() ? (tubewell.on ? PROMPTS.twOff : PROMPTS.twOn) : null),
    act: () => { const on = tubewell.toggle(); if (on) sound.engineStart(tubewell.engine.x, tubewell.engine.z); hud.toast(on ? TOASTS.twOn : TOASTS.twOff); },
  });
  const beds = [...village.charpais, tubewell.charpai, shops.chaiCharpai];
  for (const c of beds) {
    acts.add({ at: () => c, r: 1.7, prompt: () => (walking() ? PROMPTS.sit : null), act: () => { player.sit(c); hud.toast(TOASTS.sit); } });
  }
  acts.add({ at: () => shops.chaiSpot, r: 1.6, priority: 1.2, prompt: () => (walking() ? PROMPTS.chai : null), act: () => { sound.sip(); hud.toast(TOASTS.chai); } });
  for (const p of [...village.pumps, village.chowkPump]) {
    acts.add({ at: () => p, r: 1.7, prompt: () => (walking() ? PROMPTS.pump : null), act: () => { sound.pump(); hud.toast(TOASTS.pump); } });
  }
  acts.add({ at: () => shops.bike, r: 1.6, prompt: () => (walking() ? PROMPTS.bell : null), act: () => sound.bell() });
  const voice = { buffalo: ['cow', 0.68], cow: ['cow', 1], goat: ['goats', 1], sheep: ['sheep', 1], donkey: ['donkey', 1], dog: ['dog', 1] };
  for (const a of animals) {
    if (a.kind === 'chicken' || a.sunk) continue;
    acts.add({
      at: () => a, r: a.radius + 1.3, priority: -0.4, prompt: () => (walking() ? PROMPTS.pet : null),
      act: () => { hud.toast(petToast(a.kind)); const [n, rate] = voice[a.kind]; sound.play(n, a.x, a.z, { rate, vol: 0.7 }); },
    });
  }

  // fixed places that birds call from
  const emitters = [
    ...animals,
    { kind: 'rooster', x: 20, z: 40 }, { kind: 'rooster', x: 90, z: -34 }, { kind: 'rooster', x: 140, z: 6 },
    { kind: 'crow', x: 34, z: 23 }, { kind: 'crow', x: 92, z: 23 }, { kind: 'crow', x: 80, z: 158 }, { kind: 'crow', x: -60, z: 30 },
    { kind: 'koel', x: CHOWK.x, z: CHOWK.z }, { kind: 'koel', x: TUBEWELL.x - 11, z: TUBEWELL.z - 5 }, { kind: 'koel', x: -30, z: -20 },
    { kind: 'sparrow', x: CHOWK.x + 4, z: CHOWK.z }, { kind: 'sparrow', x: 46, z: 38 }, { kind: 'sparrow', x: 97, z: 158 }, { kind: 'sparrow', x: TUBEWELL.x, z: TUBEWELL.z }, { kind: 'sparrow', x: 100, z: 40 },
  ];

  // ---- frame loop ----
  let areaId = null, started = false, last = performance.now(), time = 0;
  const focus = { x: 0, y: 0, z: 0 };
  const drive = { throttle: 0, steer: 0 };

  function useKey() {
    if (player.mode === 'drive') {
      if (Math.abs(tractor.speed) < 1.5) { tractor.speed = 0; player.dismount(); }
      return;
    }
    if (player.mode === 'sit') { player.stand(); return; }
    const found = acts.find(player);
    if (found) found.item.act();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;

    if (started) {
      if (input.pressed('KeyE')) useKey();
      if (input.pressed('KeyN')) sky.skip();
      if (input.pressed('KeyT')) hud.toast(hud.toggleSubs() ? TOASTS.subsOn : TOASTS.subsOff);
      if (input.pressed('KeyM')) hud.toast(sound.toggleMute() ? TOASTS.muted : TOASTS.unmuted);
      if (input.pressed('KeyH') && player.mode === 'drive') sound.tractorHorn(tractor.x, tractor.z);
    }

    drive.throttle = input.moveZ;
    drive.steer = -input.moveX; // a positive steer angle turns left
    tractor.update(dt, drive);
    player.update(dt, input, cam.yaw);
    for (const v of people) v.update(dt, player);
    updateAnimals(dt, player, camera.position);
    traffic.update(dt, [player, tractor]);
    tubewell.update(dt);
    canal.update(dt);
    fields.update(time);

    focus.x = player.x; focus.y = player.y; focus.z = player.z;
    cam.update(dt, input, focus, { driving: player.mode === 'drive', driveYaw: tractor.yaw });
    sky.update(dt, focus, camera);
    tractor.model.lamp.intensity = player.mode === 'drive' ? sky.night * 120 : 0;

    // HUD
    if (started) {
      const found = player.mode === 'walk' ? acts.find(player) : null;
      hud.prompt(player.mode === 'drive' ? PROMPTS.dismount : player.mode === 'sit' ? PROMPTS.stand : found ? found.prompt : null);
      const a = AREAS.find((r) => player.x >= r.x0 && player.x <= r.x1 && player.z >= r.z0 && player.z <= r.z1);
      if (a && a.id !== areaId) { areaId = a.id; hud.area(AREA_NAMES[a.id]); }
      hud.clock(CLOCK[sky.phase()]);
    }

    const dawn = Math.max(0, 1 - Math.abs(sky.hours - 6.3) / 1.6);
    sound.update(dt, {
      cam: camera.position, camYaw: cam.yaw, night: sky.night, dawn,
      tubewell: { level: tubewell.level, x: tubewell.engine.x, z: tubewell.engine.z },
      tractor: { x: tractor.x, z: tractor.z, speed: tractor.speed, driven: tractor.driven },
      truck: traffic.truck, rickshaw: traffic.rickshaw,
      canalX: CANAL.x, inFields: areaId === 'fields' ? 1 : 0.3,
    }, emitters);

    renderer.render(scene, camera);
    input.endFrame();
  }

  const start = () => { started = true; input.enabled = true; sound.start(); };
  hud.ready(start);
  if (params.has('auto')) document.getElementById('start').click();

  // handy for screenshots and debugging
  window.__game = {
    player, tractor, cam, sky, tubewell, renderer, traffic, sound,
    look(x, z, yaw = 0, pitch = 0.3, dist = 6.5) { player.x = x; player.z = z; player.yaw = yaw + Math.PI; cam.yaw = yaw; cam.pitch = pitch; cam.dist = dist; cam.ready = false; },
    hour(h) { sky.hours = h; },
  };
  requestAnimationFrame(frame);
}

boot();
