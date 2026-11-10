// Keyboard and mouse. Click the view to capture the mouse; Esc releases it.

export class Input {
  constructor(canvas) {
    this.down = new Set();
    this.hit = new Set(); // keys pressed since the last frame
    this.dx = 0; this.dy = 0; this.wheel = 0;
    this.enabled = false;
    let dragging = false;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (!this.down.has(e.code)) this.hit.add(e.code);
      this.down.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());

    canvas.addEventListener('mousedown', () => {
      dragging = true;
      if (this.enabled && document.pointerLockElement !== canvas) canvas.requestPointerLock?.()?.catch?.(() => {});
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement === canvas || dragging) { this.dx += e.movementX; this.dy += e.movementY; }
    });
    canvas.addEventListener('wheel', (e) => { this.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
  }

  held(...codes) { return codes.some((c) => this.down.has(c)); }
  pressed(code) { return this.hit.has(code); }

  get moveX() { return (this.held('KeyD', 'ArrowRight') ? 1 : 0) - (this.held('KeyA', 'ArrowLeft') ? 1 : 0); }
  get moveZ() { return (this.held('KeyW', 'ArrowUp') ? 1 : 0) - (this.held('KeyS', 'ArrowDown') ? 1 : 0); }
  get run() { return this.held('ShiftLeft', 'ShiftRight'); }

  endFrame() { this.hit.clear(); this.dx = 0; this.dy = 0; this.wheel = 0; }
}
