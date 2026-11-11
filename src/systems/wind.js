import * as THREE from 'three';

// One breeze for the whole world. Grass, crops, trees, cloth, dust and litter all read it,
// so a gust can be watched rolling across a field and then through the trees.

export const wind = {
  time: 0,
  strength: 0.5, // 0 = still, 1 = a strong gust
  dir: new THREE.Vector2(0.8, 0.6).normalize(), // the way the air is moving (x, z)
  // Shared by every shader that sways.
  uniforms: {
    uTime: { value: 0 },
    uWindDir: { value: new THREE.Vector2(0.8, 0.6).normalize() },
    uWindStr: { value: 0.5 },
    // whoever is walking through the grass: x, z, radius
    uPush: { value: new THREE.Vector3(0, 0, 0) },
  },
  update(dt) {
    this.time += dt;
    const t = this.time;
    // a slow swell with gusts riding on top of it
    const swell = 0.42 + 0.18 * Math.sin(t * 0.07) + 0.1 * Math.sin(t * 0.23 + 1.3);
    const gust = Math.max(0, Math.sin(t * 0.31) * Math.sin(t * 0.13 + 0.7)) * 0.55;
    this.strength = Math.max(0.12, swell + gust + (this.boost || 0));
    const a = 0.65 + 0.35 * Math.sin(t * 0.017) + 0.08 * Math.sin(t * 0.21);
    this.dir.set(Math.cos(a), Math.sin(a));
    this.uniforms.uTime.value = t;
    this.uniforms.uWindDir.value.copy(this.dir);
    this.uniforms.uWindStr.value = this.strength;
  },
  // Strength felt at a point: gusts travel downwind as bands of stronger air.
  // The grass leans away from this point (the player).
  pushFrom(x, z, r = 0.9) { this.uniforms.uPush.value.set(x, z, r); },
  at(x, z) {
    const along = x * this.dir.x + z * this.dir.y;
    return this.strength * (0.7 + 0.3 * Math.sin(this.time * 0.9 - along * 0.035));
  },
};

// GLSL that moves a vertex in world space. `h` is how far up the plant (0 at the root, 1 at
// the tip), `amt` how far the tip travels in a full gust, `flutter` small fast shimmer.
const WIND_GLSL = /* glsl */ `
uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStr;
uniform vec3 uPush;
vec3 pushOffset(vec3 wpos, float h, float amt) {
  vec2 d = wpos.xz - uPush.xy;
  float l = length(d);
  float k = (1.0 - smoothstep(uPush.z * 0.3, uPush.z, l)) * h;
  return vec3(d.x / max(l, 0.01) * k * amt, -k * amt * 0.5, d.y / max(l, 0.01) * k * amt);
}
vec3 windOffset(vec3 wpos, vec3 origin, float h, float amt, float flutter) {
  float along = dot(wpos.xz, uWindDir);
  float gust = uWindStr * (0.7 + 0.3 * sin(uTime * 0.9 - along * 0.035));
  float ph = dot(origin.xz, vec2(0.37, 0.21));
  float sway = gust * (0.75 + 0.25 * sin(uTime * 1.6 + ph)) + 0.12 * sin(uTime * 2.3 + ph * 1.7) * gust;
  vec3 o = vec3(uWindDir.x, 0.0, uWindDir.y) * sway * amt * h * h;
  o.y -= sway * amt * h * h * 0.25;
  o += flutter * gust * h * vec3(
    sin(uTime * 7.1 + wpos.y * 3.1 + wpos.x * 2.3),
    sin(uTime * 6.3 + wpos.z * 2.7) * 0.6,
    cos(uTime * 7.7 + wpos.x * 2.9 + wpos.y * 1.3));
  return o;
}
`;

// Patches a material so its vertices sway. Works for instanced and plain meshes. The mesh's
// own model matrix should be identity (true for everything built with Builder or instancing).
// opts: { height: local height of the tip, amt, flutter, base: height where bending starts,
//   hang: cloth hanging from a line at `height` down to `base`, swinging most at the bottom }
export function windify(material, { height = 1, amt = 0.3, flutter = 0, base = 0, hang = false, push = 0 } = {}) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    Object.assign(shader.uniforms, wind.uniforms);
    shader.vertexShader = WIND_GLSL + shader.vertexShader.replace(
      '#include <project_vertex>',
      `vec4 mvPosition = vec4( transformed, 1.0 );
      vec3 wOrigin = vec3(0.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
        wOrigin = instanceMatrix[3].xyz;
      #endif
      float wH = ${hang
        ? `clamp((${height.toFixed(3)} - transformed.y) / ${(height - base).toFixed(3)}, 0.0, 1.0)`
        : `clamp((transformed.y - ${base.toFixed(3)}) / ${(height - base).toFixed(3)}, 0.0, 1.4)`};
      mvPosition.xyz += windOffset(mvPosition.xyz, wOrigin, wH, ${amt.toFixed(3)}, ${flutter.toFixed(3)});
      ${push ? `mvPosition.xyz += pushOffset(mvPosition.xyz, wH, ${push.toFixed(3)});` : ''}
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`,
    );
  };
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (prevKey ? prevKey() : '') + `wind-${height}-${amt}-${flutter}-${base}-${hang}-${push}-${material.alphaTest}`;
  return material;
}

// A matching shadow-caster, so shadows sway with the leaves and keep their holes.
export function windDepth(opts, { map = null, alphaTest = 0 } = {}) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest });
  return windify(m, opts);
}
