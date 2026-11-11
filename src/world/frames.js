// A compound's frame: centre (x, z), turn ry, half sizes hw (along its street) and hd (depth).
// Local x runs along the street, local z toward the gate.

export function toWorld(f, lx, lz) {
  const c = Math.cos(f.ry), s = Math.sin(f.ry);
  return [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
}

export function toFrame(f, x, z) {
  const c = Math.cos(f.ry), s = Math.sin(f.ry), dx = x - f.x, dz = z - f.z;
  return [dx * c - dz * s, dx * s + dz * c];
}

export function inFrame(f, x, z, pad = 0) {
  const [lx, lz] = toFrame(f, x, z);
  return Math.abs(lx) < f.hw + pad && Math.abs(lz) < f.hd + pad;
}

// A random point just inside (inOut > 0) or just outside (< 0) one of the four walls.
export function nearWall(f, rng, d, inOut) {
  const far = rng.chance(0.5) ? 1 : -1;
  if (rng() < f.hw / (f.hw + f.hd)) return toWorld(f, rng.range(-f.hw, f.hw), far * (f.hd - d * inOut));
  return toWorld(f, far * (f.hw - d * inOut), rng.range(-f.hd, f.hd));
}
