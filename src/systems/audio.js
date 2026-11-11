// Sound. Engines, water, wind, footsteps, horns and crickets are synthesised here;
// animal and bird calls are short recordings (see CREDITS.md). Everything is placed
// in space by hand: volume falls off with distance and pans left or right of the camera.

const FILES = ['rooster', 'hens', 'crow', 'koel', 'sparrow', 'cow', 'goats', 'sheep', 'dog', 'donkey'];

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.buffers = {};
    this.loops = [];
    this.listener = { x: 0, z: 0, yaw: 0 };
    this.timer = 2;
  }

  // Must be called from a click or key press (browsers require it).
  async start() {
    if (this.ctx) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    this.noise = this.makeNoise();
    this.buildLoops();
    await Promise.all(FILES.map(async (name) => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}audio/${name}.mp3`);
        this.buffers[name] = await ctx.decodeAudioData(await res.arrayBuffer());
      } catch (err) {
        console.warn('Could not load sound', name, err);
      }
    }));
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  // ---- building blocks ----

  makeNoise() {
    const sr = this.ctx.sampleRate, buf = this.ctx.createBuffer(1, sr * 2, sr), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // A buffer of evenly spaced thumps: the basis of every engine here.
  makeEngine(period, pulses, tone, hiss) {
    const sr = this.ctx.sampleRate, n = Math.floor(sr * period * pulses);
    const buf = this.ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    for (let p = 0; p < pulses; p++) {
      const start = Math.floor(p * period * sr), amp = 0.8 + ((p * 7) % 3) * 0.1;
      for (let i = 0; i < period * sr && start + i < n; i++) {
        const t = i / sr;
        const thump = Math.sin(2 * Math.PI * tone * t * (1 + 0.6 * Math.exp(-t * 50))) * Math.exp((-t * 5) / period);
        const puff = (Math.random() * 2 - 1) * Math.exp(-t * 70) * hiss;
        d[start + i] = (thump * 0.8 + puff) * amp;
      }
    }
    return buf;
  }

  makeCrickets() {
    const sr = this.ctx.sampleRate, buf = this.ctx.createBuffer(1, sr * 3, sr), d = buf.getChannelData(0);
    for (const [f, rate, off, vol] of [[4300, 0.42, 0, 0.5], [4900, 0.55, 0.2, 0.35], [3800, 0.75, 0.33, 0.3]]) {
      for (let t0 = off; t0 < 3 - 0.2; t0 += rate) {
        for (let k = 0; k < 3; k++) {
          const s = Math.floor((t0 + k * 0.045) * sr);
          for (let i = 0; i < 0.03 * sr; i++) d[s + i] += Math.sin((2 * Math.PI * f * i) / sr) * Math.sin((Math.PI * i) / (0.03 * sr)) * vol * 0.4;
        }
      }
    }
    return buf;
  }

  // A looping source with its own gain, pan and optional filter. Position is optional.
  loop(buffer, { filter = null, freq = 800, q = 0.7, range = 60, vol = 1, rate = 1 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer; src.loop = true; src.playbackRate.value = rate;
    const gain = ctx.createGain(); gain.gain.value = 0;
    const pan = ctx.createStereoPanner();
    let node = src;
    let filt = null;
    if (filter) { filt = ctx.createBiquadFilter(); filt.type = filter; filt.frequency.value = freq; filt.Q.value = q; node.connect(filt); node = filt; }
    node.connect(gain); gain.connect(pan); pan.connect(this.master);
    src.start(0, Math.random() * buffer.duration);
    const l = { src, gain, pan, filt, range, vol, level: 0, x: null, z: null };
    this.loops.push(l);
    return l;
  }

  buildLoops() {
    const peter = this.makeEngine(0.19, 4, 82, 0.5);
    const diesel = this.makeEngine(0.055, 6, 70, 0.35);
    const two = this.makeEngine(0.03, 5, 120, 0.7);
    this.tubewell = this.loop(peter, { filter: 'lowpass', freq: 1400, range: 110, vol: 0.9 });
    this.gush = this.loop(this.noise, { filter: 'bandpass', freq: 1100, q: 0.5, range: 28, vol: 0.5 });
    this.tractor = this.loop(diesel, { filter: 'lowpass', freq: 1100, range: 70, vol: 0.55 });
    this.truck = this.loop(diesel, { filter: 'lowpass', freq: 600, range: 90, vol: 0.7, rate: 0.75 });
    this.rickshaw = this.loop(two, { filter: 'bandpass', freq: 900, q: 0.8, range: 60, vol: 0.4, rate: 1.1 });
    this.canal = this.loop(this.noise, { filter: 'lowpass', freq: 520, range: 26, vol: 0.28 });
    this.wind = this.loop(this.noise, { filter: 'lowpass', freq: 320, vol: 0.1 });
    this.crickets = this.loop(this.makeCrickets(), { vol: 0.22 });
    this.rustle = this.loop(this.noise, { filter: 'highpass', freq: 3200, vol: 0.05 });
    this.rain = this.loop(this.noise, { filter: 'bandpass', freq: 2400, q: 0.4, vol: 0.32 });
  }

  // Volume and pan for a point in the world, as heard from the camera.
  spatial(x, z, range) {
    const dx = x - this.listener.x, dz = z - this.listener.z;
    const d = Math.hypot(dx, dz);
    const g = Math.max(0, 1 - d / range);
    // right of the camera is (-cos yaw, sin yaw)
    const side = (-Math.cos(this.listener.yaw) * dx + Math.sin(this.listener.yaw) * dz) / (d || 1);
    return [g * g, side * Math.min(1, d / 5) * 0.8];
  }

  setLoop(l, level, x = null, z = null) {
    if (!this.ctx) return;
    let g = level * l.vol, p = 0;
    if (x !== null) { const [sg, sp] = this.spatial(x, z, l.range); g *= sg; p = sp; }
    const t = this.ctx.currentTime;
    l.gain.gain.setTargetAtTime(g, t, 0.08);
    l.pan.pan.setTargetAtTime(p, t, 0.08);
  }

  // One-shot recording at a place in the world.
  play(name, x, z, { range = 70, vol = 1, rate = 1 } = {}) {
    const buf = this.buffers[name];
    if (!this.ctx || !buf) return;
    const [g, p] = x === null ? [1, 0] : this.spatial(x, z, range);
    if (g < 0.004) return;
    const ctx = this.ctx, src = ctx.createBufferSource();
    src.buffer = buf; src.playbackRate.value = rate;
    const gain = ctx.createGain(); gain.gain.value = g * vol;
    const pan = ctx.createStereoPanner(); pan.pan.value = p;
    src.connect(gain); gain.connect(pan); pan.connect(this.master);
    src.start();
  }

  burst({ dur = 0.08, filter = 'lowpass', freq = 800, q = 1, vol = 0.3, x = null, z = null, range = 30 }) {
    if (!this.ctx) return;
    const [g, p] = x === null ? [1, 0] : this.spatial(x, z, range);
    const ctx = this.ctx, t = ctx.currentTime, src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = filter; f.frequency.value = freq; f.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol * g, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const pan = ctx.createStereoPanner(); pan.pan.value = p;
    src.connect(f); f.connect(gain); gain.connect(pan); pan.connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur + 0.02);
  }

  tone(freq, { dur = 0.3, type = 'sine', vol = 0.2, when = 0, to = null, x = null, z = null, range = 60, lp = null }) {
    if (!this.ctx) return;
    const [g, p] = x === null ? [1, 0] : this.spatial(x, z, range);
    const ctx = this.ctx, t = ctx.currentTime + when, o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol * g + 0.0001, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const pan = ctx.createStereoPanner(); pan.pan.value = p;
    let node = o;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
    node.connect(gain); gain.connect(pan); pan.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ---- named effects ----

  step(surface, running) {
    const v = running ? 0.2 : 0.13;
    if (surface === 'brick') this.burst({ dur: 0.07, filter: 'bandpass', freq: 1700, q: 1.2, vol: v });
    else if (surface === 'asphalt') this.burst({ dur: 0.05, filter: 'bandpass', freq: 1200, q: 1.5, vol: v * 0.9 });
    else this.burst({ dur: 0.1, filter: 'lowpass', freq: 650, vol: v * 1.5 });
  }
  tractorHorn(x, z) {
    this.tone(330, { dur: 0.55, type: 'square', vol: 0.12, lp: 1500, x, z, range: 120 });
    this.tone(415, { dur: 0.55, type: 'square', vol: 0.1, lp: 1500, x, z, range: 120 });
  }
  // Pakistani trucks carry pressure horns that play a little tune.
  truckHorn(x, z) {
    [392, 494, 587, 494, 392, 587, 587].forEach((f, i) => this.tone(f, { dur: i === 6 ? 0.4 : 0.13, type: 'sawtooth', vol: 0.16, when: i * 0.14, lp: 2200, x, z, range: 160 }));
  }
  rickshawHorn(x, z) {
    for (let i = 0; i < 2; i++) this.tone(620, { dur: 0.16, type: 'square', vol: 0.1, when: i * 0.22, lp: 2500, x, z, range: 90 });
  }
  bell() {
    for (let i = 0; i < 2; i++) { this.tone(2350, { dur: 0.5, vol: 0.14, when: i * 0.22 }); this.tone(3520, { dur: 0.35, vol: 0.07, when: i * 0.22 }); }
  }
  pump() {
    for (let i = 0; i < 3; i++) {
      this.tone(520, { dur: 0.22, to: 880, vol: 0.05, when: i * 0.5, type: 'triangle' });
      setTimeout(() => this.burst({ dur: 0.35, filter: 'bandpass', freq: 1500, q: 0.6, vol: 0.22 }), i * 500 + 220);
    }
  }
  sip() {
    this.tone(2900, { dur: 0.25, vol: 0.06 });
    setTimeout(() => this.burst({ dur: 0.3, filter: 'bandpass', freq: 2600, q: 2, vol: 0.06 }), 350);
  }
  engineStart(x, z) {
    for (let i = 0; i < 5; i++) this.tone(60 + i * 8, { dur: 0.12, type: 'sawtooth', vol: 0.2, when: i * 0.13, lp: 500, x, z, range: 80 });
  }

  // ---- per-frame mix ----
  // s: { cam, camYaw, night, dawn, tubewell:{on,x,z,level}, tractor:{x,z,speed,driven}, truck, rickshaw, canalX, wind }
  update(dt, s, emitters) {
    if (!this.ctx) return;
    this.listener.x = s.cam.x; this.listener.z = s.cam.z; this.listener.yaw = s.camYaw;

    this.setLoop(this.tubewell, s.tubewell.level, s.tubewell.x, s.tubewell.z);
    this.setLoop(this.gush, s.tubewell.level, s.tubewell.x + 3, s.tubewell.z);
    const tr = s.tractor;
    this.setLoop(this.tractor, tr.driven ? 1 : 0, tr.x, tr.z);
    this.tractor.src.playbackRate.setTargetAtTime(0.85 + Math.abs(tr.speed) * 0.13, this.ctx.currentTime, 0.1);
    this.setLoop(this.truck, 1, s.truck.x, s.truck.z);
    this.truck.src.playbackRate.setTargetAtTime(0.55 + s.truck.v * 0.03, this.ctx.currentTime, 0.2);
    this.setLoop(this.rickshaw, 1, s.rickshaw.x, s.rickshaw.z);
    this.rickshaw.src.playbackRate.setTargetAtTime(0.7 + s.rickshaw.v * 0.06, this.ctx.currentTime, 0.2);
    this.setLoop(this.canal, 1, s.canalX, s.cam.z);
    // the breeze you hear is the breeze you see bending the grass
    const gust = 0.2 + s.wind * 0.9;
    this.setLoop(this.wind, gust);
    this.setLoop(this.rustle, gust * s.inFields);
    this.setLoop(this.crickets, s.night * (1 - (s.rain || 0)));
    this.setLoop(this.rain, s.rain || 0);

    // Now and then, something nearby calls out.
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 1.1 + Math.random() * 2.2;
    const near = emitters.filter((e) => (e.x - s.cam.x) ** 2 + (e.z - s.cam.z) ** 2 < 85 * 85);
    if (!near.length) return;
    const e = near[Math.floor(Math.random() * near.length)];
    const day = 1 - s.night;
    const r = Math.random();
    switch (e.kind) {
      case 'buffalo': if (r < 0.35) this.play('cow', e.x, e.z, { rate: 0.68, vol: 0.8 }); break;
      case 'cow': if (r < 0.35) this.play('cow', e.x, e.z, { rate: 0.95 + Math.random() * 0.15, vol: 0.7 }); break;
      case 'goat': if (r < 0.4 * day) this.play('goats', e.x, e.z, { vol: 0.5, range: 55 }); break;
      case 'sheep': if (r < 0.4 * day) this.play('sheep', e.x, e.z, { vol: 0.5, range: 55 }); break;
      case 'donkey': if (r < 0.12 * day) this.play('donkey', e.x, e.z, { vol: 0.5, range: 110 }); break;
      case 'dog': if (r < 0.25 + s.night * 0.3) this.play('dog', e.x, e.z, { vol: 0.5, range: 90 }); break;
      case 'chicken': if (r < 0.5 * day) this.play(s.dawn > 0.3 && r < 0.3 ? 'rooster' : 'hens', e.x, e.z, { vol: 0.45, range: 60 }); break;
      case 'rooster': if (r < 0.15 + s.dawn * 0.8) this.play('rooster', e.x, e.z, { vol: 0.6, range: 130 }); break;
      case 'crow': if (r < 0.5 * day) this.play('crow', e.x, e.z, { vol: 0.4, range: 90, rate: 0.95 + Math.random() * 0.1 }); break;
      case 'koel': if (r < 0.3 * day) this.play('koel', e.x, e.z, { vol: 0.4, range: 120 }); break;
      case 'sparrow': if (r < 0.6 * day) this.play('sparrow', e.x, e.z, { vol: 0.35, range: 60 }); break;
      default: break;
    }
  }
}
