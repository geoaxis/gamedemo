import * as THREE from 'three';
import { makeRng } from '../util/rng.js';

// All surface textures are painted on a canvas at start-up; nothing is downloaded.

function canvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function speckle(ctx, size, rng, amount, alpha = 0.03) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * 255 * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  // a few soft blotches so large areas do not look flat
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = rng() < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(rng() * size, rng() * size, 10 + rng() * 40, 8 + rng() * 30, rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function bricks(ctx, size, rng, { cols, rows, mortar, colors, gap = 2 }) {
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, size, size);
  const bw = size / cols, bh = size / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bw * 0.5;
    for (let c = -1; c < cols; c++) {
      ctx.fillStyle = rng.pick(colors);
      ctx.fillRect(c * bw + off + gap / 2, r * bh + gap / 2, bw - gap, bh - gap);
    }
  }
}

const painters = {
  // Hand-made red brick, 4 bricks by 12 courses to the metre.
  brick(ctx, s, rng) {
    bricks(ctx, s, rng, { cols: 4, rows: 12, mortar: '#b9a48a', colors: ['#9c5a3c', '#a86243', '#8f5136', '#b06a48', '#96573a'] });
    speckle(ctx, s, rng, 0.1);
  },
  // Brick paving (soling) in the lanes: worn and dusty.
  soling(ctx, s, rng) {
    bricks(ctx, s, rng, { cols: 4, rows: 8, mortar: '#b5a085', colors: ['#a8735a', '#b07c62', '#9d6c55', '#b48a70', '#a57b66'], gap: 3 });
    ctx.fillStyle = 'rgba(205,183,154,0.28)';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rng, 0.1);
  },
  // Mud plaster with chopped straw.
  mud(ctx, s, rng) {
    ctx.fillStyle = '#b8925a';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      ctx.strokeStyle = rng() < 0.5 ? 'rgba(232,205,150,0.5)' : 'rgba(120,88,50,0.35)';
      ctx.lineWidth = 1;
      const x = rng() * s, y = rng() * s, a = rng() * Math.PI, l = 2 + rng() * 5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    speckle(ctx, s, rng, 0.07);
  },
  // Lime whitewash over plaster.
  plaster(ctx, s, rng) {
    ctx.fillStyle = '#e9e2d0';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rng, 0.05, 0.05);
  },
  dirt(ctx, s, rng) {
    ctx.fillStyle = '#c9b190';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rng, 0.07, 0.025);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = 'rgba(120,135,70,0.10)';
      ctx.beginPath(); ctx.arc(rng() * s, rng() * s, 2 + rng() * 6, 0, Math.PI * 2); ctx.fill();
    }
  },
  track(ctx, s, rng) {
    ctx.fillStyle = '#bfa67f';
    ctx.fillRect(0, 0, s, s);
    // two wheel ruts
    ctx.fillStyle = 'rgba(96,74,48,0.28)';
    ctx.fillRect(s * 0.2, 0, s * 0.14, s);
    ctx.fillRect(s * 0.66, 0, s * 0.14, s);
    speckle(ctx, s, rng, 0.08, 0.025);
  },
  asphalt(ctx, s, rng) {
    ctx.fillStyle = '#55524e';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rng, 0.14, 0.02);
  },
  water(ctx, s, rng) {
    ctx.fillStyle = '#9a8566';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = rng() < 0.5 ? 'rgba(215,200,170,0.35)' : 'rgba(90,72,52,0.25)';
      ctx.lineWidth = 1 + rng() * 2;
      const x = rng() * s, y = rng() * s, l = 14 + rng() * 40;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4, y + l / 2, x, y + l); ctx.stroke();
    }
  },
  // Light and dark bands for ploughed rows; tinted by the plot colour.
  furrow(ctx, s, rng) {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#c9c2b6';
      ctx.fillRect((i * s) / 8, 0, s / 8, s);
    }
    speckle(ctx, s, rng, 0.1, 0.05);
  },
  // Woven charpai top: purple and white diamonds.
  weave(ctx, s) {
    ctx.fillStyle = '#efe6d6';
    ctx.fillRect(0, 0, s, s);
    const n = 8, c = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const k = (x + y) % 4;
      ctx.fillStyle = ['#6d3a8c', '#efe6d6', '#b03a5b', '#efe6d6'][k];
      ctx.beginPath();
      ctx.moveTo(x * c + c / 2, y * c); ctx.lineTo(x * c + c, y * c + c / 2);
      ctx.lineTo(x * c + c / 2, y * c + c); ctx.lineTo(x * c, y * c + c / 2);
      ctx.closePath(); ctx.fill();
    }
  },
  wood(ctx, s, rng) {
    ctx.fillStyle = '#6b4a2e';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.08 + rng() * 0.12})`;
      ctx.fillRect((i * s) / 6, 0, 3, s);
    }
    speckle(ctx, s, rng, 0.08, 0.04);
  },
  // Thatch / straw for stacks and roofs.
  straw(ctx, s, rng) {
    ctx.fillStyle = '#c9a85c';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) {
      ctx.strokeStyle = rng.pick(['rgba(240,214,140,0.6)', 'rgba(150,115,55,0.5)', 'rgba(205,170,90,0.6)']);
      const x = rng() * s, y = rng() * s;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rng() - 0.5) * 6, y + 6 + rng() * 12); ctx.stroke();
    }
  },
};

const cache = new Map();

export function getTexture(name) {
  if (cache.has(name)) return cache.get(name);
  const [c, ctx] = canvas(256);
  painters[name](ctx, 256, makeRng(name.length * 977 + name.charCodeAt(0)));
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(name, tex);
  return tex;
}

export const hasTexture = (name) => name in painters;
