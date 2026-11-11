import { HELP, HELP_TOUCH, UI } from '../data/strings.js';
import { isTouch } from '../systems/input.js';

// On-screen text: place names, the "press E" prompt, speech, short notices and the clock.
// Everything is Urdu with an English line beneath that the T key hides.

const $ = (sel) => document.querySelector(sel);

export class Hud {
  constructor() {
    this.el = {
      hud: $('#hud'), area: $('#area'), prompt: $('#prompt'), dialogue: $('#dialogue'),
      toast: $('#toast'), clock: $('#clock'), keys: $('#keys'), title: $('#title'), start: $('#start'), help: $('#help'),
    };
    this.timers = {};
    this.promptKey = null;
    this.subs = true;

    if (isTouch) document.body.classList.add('touch');
    this.set($('#rotate'), UI.rotate);
    this.el.help.innerHTML = (isTouch ? HELP_TOUCH : HELP).map(([k, ur, en]) => `<tr><td><kbd>${k}</kbd></td><td class="ur">${ur}</td><td class="en">${en}</td></tr>`).join('');
    this.el.keys.innerHTML = HELP.slice(3).map(([k, , en]) => `<span><kbd>${k}</kbd> ${en.split(' (')[0]}</span>`).join('');
  }

  ready(onStart) {
    const b = this.el.start;
    b.disabled = false;
    b.innerHTML = `<span class="ur">${UI.start.ur}</span><span class="en">${UI.start.en}</span>`;
    b.addEventListener('click', () => {
      this.el.title.classList.add('gone');
      this.el.hud.classList.remove('hidden');
      onStart();
    }, { once: true });
  }

  // on-screen buttons (phones) press keys through the input
  bindButtons(input) {
    const press = (code) => (e) => { e.preventDefault(); input.tap(code); };
    for (const b of document.querySelectorAll('[data-key]')) b.addEventListener('pointerdown', press(b.dataset.key));
    this.el.prompt.addEventListener('pointerdown', press('KeyE'));
  }

  set(el, t) {
    el.querySelector('.ur').textContent = t.ur;
    el.querySelector('.en').textContent = t.en;
  }

  flash(name, t, seconds) {
    const el = this.el[name];
    this.set(el, t);
    el.classList.add('show');
    clearTimeout(this.timers[name]);
    this.timers[name] = setTimeout(() => el.classList.remove('show'), seconds * 1000);
  }

  area(t) { this.flash('area', t, 3.5); }
  toast(t) { this.flash('toast', t, 2.6); }

  say(name, line) {
    const el = this.el.dialogue;
    el.querySelector('.name').textContent = name.ur;
    el.querySelector('.line').textContent = line.ur;
    el.querySelector('.en').textContent = `${name.en}: ${line.en}`;
    el.classList.add('show');
    clearTimeout(this.timers.dialogue);
    this.timers.dialogue = setTimeout(() => el.classList.remove('show'), 6500);
  }
  hush() { this.el.dialogue.classList.remove('show'); }

  prompt(t) {
    const key = t ? t.ur : null;
    if (key === this.promptKey) return;
    this.promptKey = key;
    if (t) this.set(this.el.prompt, t);
    this.el.prompt.classList.toggle('show', !!t);
  }

  clock(t) {
    if (this.clockKey === t.ur) return;
    this.clockKey = t.ur;
    this.set(this.el.clock, t);
  }

  toggleSubs() {
    this.subs = !this.subs;
    document.body.classList.toggle('no-en', !this.subs);
    return this.subs;
  }
}
