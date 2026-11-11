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

// A soft round stain that fades out at its edge.
function blob(ctx, x, y, r, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// Branching hairline cracks.
function cracks(ctx, size, rng, n, color, step = 3) {
  ctx.strokeStyle = color;
  for (let i = 0; i < n; i++) {
    let x = rng() * size, y = rng() * size, a = rng() * Math.PI * 2;
    ctx.lineWidth = 0.5 + rng() * 0.6;
    ctx.beginPath(); ctx.moveTo(x, y);
    const len = 6 + rng() * 14;
    for (let k = 0; k < len; k++) {
      a += (rng() - 0.5) * 0.9;
      x += Math.cos(a) * step; y += Math.sin(a) * step;
      ctx.lineTo(x, y);
      if (rng() < 0.08) { ctx.moveTo(x, y); a += (rng() < 0.5 ? 1 : -1) * 0.9; }
    }
    ctx.stroke();
  }
}

// Twigs with leaves on a transparent background, kept inside a rough circle so the cards
// do not show square corners.
function leafSpray(ctx, s, rng, { n, lw, lh, twigs, droop = false }) {
  ctx.clearRect(0, 0, s, s);
  const c = s / 2;
  ctx.strokeStyle = 'rgba(95,80,60,1)';
  for (let i = 0; i < twigs; i++) {
    const a = rng() * Math.PI * 2;
    ctx.lineWidth = 1 + rng() * 1.5;
    ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * 10, c + Math.sin(a) * 10);
    ctx.lineTo(c + Math.cos(a) * s * 0.42, c + Math.sin(a) * s * 0.42); ctx.stroke();
  }
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * s * 0.44;
    const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
    const v = 150 + rng() * 105;
    ctx.fillStyle = `rgb(${v * 0.92 | 0},${v | 0},${v * 0.8 | 0})`;
    ctx.beginPath();
    const ang = droop ? Math.PI / 2 + (rng() - 0.5) * 0.8 : rng() * Math.PI;
    ctx.ellipse(x, y, lw * (0.7 + rng() * 0.6), lh * (0.7 + rng() * 0.6), ang, 0, Math.PI * 2);
    ctx.fill();
  }
}

// A lobed blob drawn as alpha on white. soft = width of the fade at the edge (0..1).
function alphaBlob(ctx, s, rng, r0, a0, soft) {
  ctx.clearRect(0, 0, s, s);
  const img = ctx.createImageData(s, s), d = img.data;
  const k = [rng() * 6, rng() * 6, rng() * 6], c = s / 2;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = (x - c) / s, dy = (y - c) / s, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
    const edge = r0 * (1 + 0.18 * Math.sin(a * 3 + k[0]) + 0.1 * Math.sin(a * 5 + k[1]) + 0.06 * Math.sin(a * 9 + k[2]));
    const t = Math.max(0, Math.min(1, (edge - r) / (soft * r0 + 0.01)));
    const i = (y * s + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = t * a0 * (0.85 + rng() * 0.15) * 255;
  }
  ctx.putImageData(img, 0, 0);
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
  // Hand-made red brick, 4 bricks by 12 courses to the metre: uneven firing, chipped faces,
  // mortar washed out of some joints.
  brick(ctx, s, rng) {
    bricks(ctx, s, rng, { cols: 4, rows: 12, mortar: '#b9a48a', colors: ['#9c5a3c', '#a86243', '#8f5136', '#b06a48', '#96573a', '#7d4a33', '#b8754f'] });
    const bw = s / 4, bh = s / 12;
    for (let i = 0; i < 26; i++) {
      const r = rng.int(0, 11), c = rng.int(0, 4), off = (r % 2) * bw * 0.5;
      ctx.fillStyle = rng.pick(['rgba(40,25,18,0.35)', 'rgba(230,200,170,0.25)', 'rgba(70,60,50,0.3)']);
      ctx.fillRect(c * bw + off + 1 + rng() * bw * 0.5, r * bh + 1, bw * rng.range(0.15, 0.5), bh - 2);
    }
    cracks(ctx, s, rng, 5, 'rgba(40,28,20,0.45)');
    speckle(ctx, s, rng, 0.12);
  },
  // Brick paving (soling) in the lanes: worn, dusty, bricks sunk or missing here and there.
  soling(ctx, s, rng) {
    bricks(ctx, s, rng, { cols: 4, rows: 8, mortar: '#b5a085', colors: ['#a8735a', '#b07c62', '#9d6c55', '#b48a70', '#a57b66', '#8f604c', '#bb9278'], gap: 3 });
    const bw = s / 4, bh = s / 8;
    for (let i = 0; i < 4; i++) {
      // a missing brick: a hole of packed dust
      const r = rng.int(0, 7), c = rng.int(0, 3), off = (r % 2) * bw * 0.5;
      ctx.fillStyle = rng.pick(['#9d8768', '#8a7558', '#a8916f']);
      ctx.fillRect(c * bw + off + 1, r * bh + 1, bw - 2, bh - 2);
    }
    for (let i = 0; i < 10; i++) {
      const r = rng.int(0, 7), c = rng.int(0, 3), off = (r % 2) * bw * 0.5;
      ctx.fillStyle = 'rgba(50,35,25,0.22)';
      ctx.fillRect(c * bw + off + 2, r * bh + 2, bw * rng.range(0.3, 0.9), bh - 4);
    }
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = `rgba(205,183,154,${0.15 + rng() * 0.3})`;
      ctx.beginPath(); ctx.ellipse(rng() * s, rng() * s, 8 + rng() * 40, 6 + rng() * 22, rng() * 3, 0, Math.PI * 2); ctx.fill();
    }
    cracks(ctx, s, rng, 6, 'rgba(60,40,30,0.4)');
    speckle(ctx, s, rng, 0.12);
  },
  // Mud plaster with chopped straw, cracked, patched with fresher mud in places.
  mud(ctx, s, rng) {
    ctx.fillStyle = '#b8925a';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 12; i++) blob(ctx, rng() * s, rng() * s, 20 + rng() * 50, rng.pick(['150,112,64', '205,172,118', '120,90,55']), 0.35);
    for (let i = 0; i < 900; i++) {
      ctx.strokeStyle = rng() < 0.5 ? 'rgba(232,205,150,0.5)' : 'rgba(120,88,50,0.35)';
      ctx.lineWidth = 1;
      const x = rng() * s, y = rng() * s, a = rng() * Math.PI, l = 2 + rng() * 5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    cracks(ctx, s, rng, 5, 'rgba(90,62,35,0.3)', 1.6);
    speckle(ctx, s, rng, 0.08);
  },
  // Lime whitewash over plaster: streaked, flaking, with brick showing where it has fallen.
  plaster(ctx, s, rng) {
    ctx.fillStyle = '#e9e2d0';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = `rgba(150,135,110,${0.06 + rng() * 0.1})`;
      const x = rng() * s;
      ctx.fillRect(x, 0, 4 + rng() * 18, s * rng.range(0.3, 1));
    }
    // a couple of places where the whitewash has flaked off, ragged at the edge
    for (let i = 0; i < 2; i++) {
      const cx = 30 + rng() * (s - 60), cy = 30 + rng() * (s - 60);
      ctx.fillStyle = 'rgba(165,130,105,0.4)';
      ctx.beginPath();
      // a smooth wandering outline, wider than tall
      const k1 = rng() * 6, k2 = rng() * 6, base = 7 + rng() * 9;
      for (let k = 0; k <= 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const r = base * (1 + 0.3 * Math.sin(a * 2 + k1) + 0.15 * Math.sin(a * 5 + k2));
        ctx.lineTo(cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r);
      }
      ctx.fill();
    }
    cracks(ctx, s, rng, 4, 'rgba(90,80,65,0.35)', 1.5);
    speckle(ctx, s, rng, 0.06, 0.06);
  },
  // Bare earth: dust, pebbles, straw, the odd tuft and hoof-trodden dark patches.
  dirt(ctx, s, rng) {
    ctx.fillStyle = '#c9b190';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rng, 0.08, 0.04);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = 'rgba(120,135,70,0.10)';
      ctx.beginPath(); ctx.arc(rng() * s, rng() * s, 2 + rng() * 6, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = rng.pick(['rgba(90,72,52,0.5)', 'rgba(235,220,195,0.6)', 'rgba(140,120,95,0.6)']);
      ctx.beginPath(); ctx.arc(rng() * s, rng() * s, 0.6 + rng() * 1.6, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = 'rgba(225,195,120,0.45)';
      const x = rng() * s, y = rng() * s, a = rng() * Math.PI;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); ctx.stroke();
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
  // Old tarmac: patched, cracked, edges crumbling into gravel.
  asphalt(ctx, s, rng) {
    ctx.fillStyle = '#55524e';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 6; i++) blob(ctx, 30 + rng() * (s - 60), 30 + rng() * (s - 60), 20 + rng() * 40, rng.pick(['40,38,36', '110,105,98']), 0.35);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = rng.pick(['rgba(160,150,140,0.5)', 'rgba(30,28,26,0.5)']);
      ctx.fillRect(rng() * s, rng() * s, 1 + rng() * 1.5, 1 + rng() * 1.5);
    }
    cracks(ctx, s, rng, 8, 'rgba(25,22,20,0.7)');
    ctx.fillStyle = 'rgba(190,170,140,0.18)';
    ctx.fillRect(0, 0, s * 0.12, s);
    ctx.fillRect(s * 0.88, 0, s * 0.12, s);
    speckle(ctx, s, rng, 0.14, 0.03);
  },
  // Dusty verge along a lane: dust in the middle fading to nothing at the edges, unevenly.
  verge(ctx, s, rng) {
    const img = ctx.createImageData(s, s);
    const d = img.data;
    for (let y = 0; y < s; y++) {
      const wob = Math.sin(y * 0.11) * 0.05 + Math.sin(y * 0.37 + 1) * 0.03;
      for (let x = 0; x < s; x++) {
        const u = x / (s - 1);
        const e = Math.min(u, 1 - u) * 2 + wob; // 0 at the edges, 1 in the middle
        const a = Math.max(0, Math.min(1, (e - 0.08) / 0.5)) * (0.75 + rng() * 0.25);
        const i = (y * s + x) * 4, n = (rng() - 0.5) * 30;
        d[i] = 196 + n; d[i + 1] = 172 + n; d[i + 2] = 136 + n; d[i + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
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
  // Soft irregular blotch (white, with alpha): tinted per use for stains, wet ground, dung.
  stain(ctx, s, rng) { alphaBlob(ctx, s, rng, 0.42, 0.9, 0.35); },
  // Puddle outline: sharper edged, lobed.
  puddle(ctx, s, rng) { alphaBlob(ctx, s, rng, 0.36, 0.95, 0.06); },
  // Leaf sprays for tree crowns, painted pale so each tree can tint them its own green.
  leavesFine(ctx, s, rng) { leafSpray(ctx, s, rng, { n: 1100, lw: 3.6, lh: 1.9, twigs: 10 }); },
  leavesBroad(ctx, s, rng) { leafSpray(ctx, s, rng, { n: 260, lw: 11, lh: 4.4, twigs: 6 }); },
  leavesLong(ctx, s, rng) { leafSpray(ctx, s, rng, { n: 420, lw: 13, lh: 2.2, twigs: 8, droop: true }); },
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

// Smaller copies of a leaf texture whose alpha is pushed back up at each step, so cut-out
// leaves keep their coverage in the distance instead of thinning away to nothing.
function leafMips(src) {
  const out = [src];
  let prev = src;
  for (let size = src.width / 2; size >= 1; size /= 2) {
    const [c, ctx] = canvas(size);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(prev, 0, 0, size, size);
    const img = ctx.getImageData(0, 0, size, size), d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = Math.min(255, Math.max(0, (d[i] - 40) * 1.6));
    ctx.putImageData(img, 0, 0);
    out.push(c);
    prev = c;
  }
  return out;
}

const cache = new Map();

export function getTexture(name) {
  if (cache.has(name)) return cache.get(name);
  const [c, ctx] = canvas(256);
  painters[name](ctx, 256, makeRng(name.length * 977 + name.charCodeAt(0)));
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (name === 'stain' || name === 'puddle') tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  if (name.startsWith('leaves')) {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.mipmaps = leafMips(c);
    tex.generateMipmaps = false;
  }
  cache.set(name, tex);
  return tex;
}

export const hasTexture = (name) => name in painters;
