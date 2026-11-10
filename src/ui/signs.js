import * as THREE from 'three';

// Urdu lettering painted on canvases: shop boards, wall chalking and truck art.
// Call loadUrduFont() first so the Nastaliq face is ready before anything is drawn.

export const URDU_FONT = '"Noto Nastaliq Urdu"';

export async function loadUrduFont() {
  const sample = 'گاؤں کی سیر ۴۷';
  await Promise.all([
    document.fonts.load(`400 40px ${URDU_FONT}`, sample),
    document.fonts.load(`700 40px ${URDU_FONT}`, sample),
  ]);
}

// Draws one line of Urdu centred on (cx, cy), shrinking it to fit maxW.
export function paintUrdu(ctx, text, cx, cy, maxW, size, color, { weight = 700, outline = null } = {}) {
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let px = size;
  ctx.font = `${weight} ${px}px ${URDU_FONT}`;
  const w = ctx.measureText(text).width;
  if (w > maxW) {
    px = Math.floor((px * maxW) / w);
    ctx.font = `${weight} ${px}px ${URDU_FONT}`;
  }
  // Nastaliq hangs well below its nominal middle, so nudge the line up a little.
  const y = cy - px * 0.12;
  if (outline) {
    ctx.lineWidth = Math.max(2, px * 0.12);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = outline;
    ctx.strokeText(text, cx, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, cx, y);
  ctx.restore();
}

function toTexture(c) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// A flat board with one or two lines of Urdu. w and h are metres.
// bg: null paints straight onto whatever is behind it (wall chalking).
export function signBoard(text, { w = 3, h = 0.8, bg = '#1d5b3a', fg = '#fff7d6', sub = null, subFg = null, border = '#f2c230', ppm = 170 } = {}) {
  const cw = Math.min(1024, Math.round(w * ppm)), ch = Math.round((cw * h) / w);
  const [c, ctx] = makeCanvas(cw, ch);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = Math.max(4, ch * 0.05);
      ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, cw - ctx.lineWidth * 2, ch - ctx.lineWidth * 2);
    }
  }
  const main = sub ? ch * 0.36 : ch * 0.5;
  paintUrdu(ctx, text, cw / 2, sub ? ch * 0.36 : ch * 0.5, cw * 0.86, main, fg);
  if (sub) paintUrdu(ctx, sub, cw / 2, ch * 0.77, cw * 0.8, ch * 0.2, subFg || fg, { weight: 400 });

  const map = toTexture(c);
  const mat = new THREE.MeshLambertMaterial({ map, transparent: !bg, alphaTest: bg ? 0 : 0.3, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: bg ? 0.16 : 0 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  return mesh;
}

// ---- Truck art -------------------------------------------------------------

const ART = ['#d81e2c', '#f7c81e', '#1f9d55', '#1f6fd0', '#ffffff', '#f08a1c', '#e8459a'];

function rosette(ctx, x, y, r, petals, colors) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = colors[0];
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < petals; i++) {
    ctx.rotate((Math.PI * 2) / petals);
    ctx.fillStyle = colors[1 + (i % 2)];
    ctx.beginPath(); ctx.ellipse(0, -r * 0.55, r * 0.2, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = colors[3];
  ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function zigzag(ctx, x, y, w, h, a, b) {
  ctx.fillStyle = a;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = b;
  const n = Math.round(w / h);
  const s = w / n;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * s, y + h); ctx.lineTo(x + i * s + s / 2, y); ctx.lineTo(x + (i + 1) * s, y + h);
    ctx.closePath(); ctx.fill();
  }
}

function diamonds(ctx, x, y, w, h) {
  const n = 3, s = w / n;
  for (let i = 0; i < n; i++) {
    for (let k = 3; k > 0; k--) {
      ctx.fillStyle = ART[(i + k) % ART.length];
      const r = (s / 2) * (k / 3) * 0.95, rh = (h / 2) * (k / 3) * 0.95;
      const cx = x + i * s + s / 2, cy = y + h / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - rh); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + rh); ctx.lineTo(cx - r, cy);
      ctx.closePath(); ctx.fill();
    }
  }
}

export function truckArt(kind, text, text2) {
  const sizes = { side: [1024, 320], back: [512, 512], crown: [768, 256], trolley: [768, 192] };
  const [w, h] = sizes[kind];
  const [c, ctx] = makeCanvas(w, h);
  const band = Math.round(h * 0.11);

  ctx.fillStyle = kind === 'trolley' ? '#1f6fd0' : '#d81e2c';
  ctx.fillRect(0, 0, w, h);
  zigzag(ctx, 0, 0, w, band, '#f7c81e', '#1f9d55');
  zigzag(ctx, 0, h - band, w, band, '#f7c81e', '#1f6fd0');

  if (kind === 'side' || kind === 'trolley') {
    const n = kind === 'side' ? 5 : 4;
    const pw = w / n, top = band + 6, ph = h - band * 2 - 12;
    for (let i = 0; i < n; i++) {
      const x = i * pw + 6;
      ctx.fillStyle = ['#1f6fd0', '#f7c81e', '#1f9d55', '#ffffff', '#f08a1c'][i % 5];
      ctx.fillRect(x, top, pw - 12, ph);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
      ctx.strokeRect(x + 5, top + 5, pw - 22, ph - 10);
      const cx = x + (pw - 12) / 2, cy = top + ph / 2;
      if (i === Math.floor(n / 2) && text) {
        ctx.fillStyle = '#fff8dc';
        ctx.fillRect(x + 10, top + 10, pw - 32, ph - 20);
        paintUrdu(ctx, text, cx, cy, pw - 50, ph * 0.38, '#b0101c');
      } else if (i % 2 === 0) {
        rosette(ctx, cx, cy, ph * 0.4, 10, ['#ffffff', '#d81e2c', '#e8459a', '#f7c81e']);
      } else {
        diamonds(ctx, x + 12, top + 12, pw - 36, ph - 24);
      }
    }
  } else if (kind === 'back') {
    ctx.fillStyle = '#f7c81e';
    ctx.fillRect(16, band + 10, w - 32, h * 0.2);
    paintUrdu(ctx, text, w / 2, band + 10 + h * 0.1, w - 60, h * 0.1, '#b0101c');
    rosette(ctx, w / 2, h * 0.53, h * 0.17, 12, ['#1f6fd0', '#ffffff', '#f7c81e', '#d81e2c']);
    rosette(ctx, w * 0.17, h * 0.53, h * 0.09, 8, ['#1f9d55', '#ffffff', '#f08a1c', '#d81e2c']);
    rosette(ctx, w * 0.83, h * 0.53, h * 0.09, 8, ['#1f9d55', '#ffffff', '#f08a1c', '#d81e2c']);
    ctx.fillStyle = '#1f9d55';
    ctx.fillRect(16, h * 0.73, w - 32, h * 0.14);
    if (text2) paintUrdu(ctx, text2, w / 2, h * 0.8, w - 60, h * 0.075, '#ffffff');
  } else if (kind === 'crown') {
    ctx.fillStyle = '#1f6fd0';
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.3, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f7c81e'; ctx.lineWidth = 6; ctx.stroke();
    paintUrdu(ctx, text, w / 2, h / 2, w * 0.5, h * 0.3, '#ffffff');
    for (const sx of [0.1, 0.9]) rosette(ctx, w * sx, h / 2, h * 0.26, 10, ['#f7c81e', '#d81e2c', '#1f9d55', '#ffffff']);
  }
  return toTexture(c);
}
