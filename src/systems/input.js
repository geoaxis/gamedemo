// Keyboard and mouse. Click the view to capture the mouse; Esc releases it.
// On a phone: a thumb stick on the left half of the screen, drag on the right half to look,
// pinch to zoom, and on-screen buttons that stand in for keys (see tap()).

export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export class Input {
  constructor(canvas) {
    this.down = new Set();
    this.hit = new Set(); // keys pressed since the last frame
    this.dx = 0; this.dy = 0; this.wheel = 0;
    this.stick = { x: 0, y: 0 }; // touch stick, -1..1, y up
    this.enabled = false;
    let dragging = false;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (!this.down.has(e.code)) this.hit.add(e.code);
      this.down.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); this.stick.x = this.stick.y = 0; });

    canvas.addEventListener('mousedown', () => {
      dragging = true;
      if (this.enabled && !isTouch && document.pointerLockElement !== canvas) canvas.requestPointerLock?.()?.catch?.(() => {});
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement === canvas || dragging) { this.dx += e.movementX; this.dy += e.movementY; }
    });
    canvas.addEventListener('wheel', (e) => { this.wheel += e.deltaY; e.preventDefault(); }, { passive: false });

    this.touchSetup(canvas);
  }

  touchSetup(canvas) {
    const base = document.getElementById('stick');
    const knob = base?.firstElementChild;
    const R = 56; // how far the knob travels, in CSS pixels
    let stickId = null, sx = 0, sy = 0;
    const looks = new Map(); // touch id -> last x, y
    let pinch = 0;

    const setKnob = (x, y) => { if (knob) knob.style.transform = `translate(${x}px, ${y}px)`; };
    const pinchDist = () => {
      const [a, b] = [...looks.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        if (stickId === null && t.clientX < window.innerWidth * 0.45) {
          stickId = t.identifier; sx = t.clientX; sy = t.clientY;
          if (base) { base.style.left = `${sx}px`; base.style.top = `${sy}px`; base.classList.add('on'); }
          setKnob(0, 0);
        } else {
          looks.set(t.identifier, { x: t.clientX, y: t.clientY });
          if (looks.size === 2) pinch = pinchDist();
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          let x = t.clientX - sx, y = t.clientY - sy;
          const len = Math.hypot(x, y);
          if (len > R) { x *= R / len; y *= R / len; }
          setKnob(x, y);
          // a small dead zone so a resting thumb does not creep
          const m = Math.max(0, Math.min(1, (Math.min(len, R) / R - 0.12) / 0.88));
          this.stick.x = len ? (x / Math.min(len, R)) * m : 0;
          this.stick.y = len ? (-y / Math.min(len, R)) * m : 0;
        } else if (looks.has(t.identifier)) {
          const p = looks.get(t.identifier);
          if (looks.size === 1) { this.dx += (t.clientX - p.x) * 1.6; this.dy += (t.clientY - p.y) * 1.6; }
          p.x = t.clientX; p.y = t.clientY;
        }
      }
      if (looks.size === 2) {
        const d = pinchDist();
        this.wheel -= (d - pinch) * 4;
        pinch = d;
      }
    }, { passive: false });

    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          stickId = null; this.stick.x = this.stick.y = 0;
          base?.classList.remove('on');
        }
        looks.delete(t.identifier);
      }
    };
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
  }

  // on-screen buttons press a key for one frame
  tap(code) { if (this.enabled) this.hit.add(code); }

  held(...codes) { return codes.some((c) => this.down.has(c)); }
  pressed(code) { return this.hit.has(code); }

  get moveX() { return (this.held('KeyD', 'ArrowRight') ? 1 : 0) - (this.held('KeyA', 'ArrowLeft') ? 1 : 0) || this.stick.x; }
  get moveZ() { return (this.held('KeyW', 'ArrowUp') ? 1 : 0) - (this.held('KeyS', 'ArrowDown') ? 1 : 0) || this.stick.y; }
  // pushing the stick all the way out runs
  get run() { return this.held('ShiftLeft', 'ShiftRight') || Math.hypot(this.stick.x, this.stick.y) > 0.92; }

  endFrame() { this.hit.clear(); this.dx = 0; this.dy = 0; this.wheel = 0; }
}
