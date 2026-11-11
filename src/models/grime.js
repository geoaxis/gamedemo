import { wet } from '../systems/weather.js';

// Weathering done in the shader from world position, so it costs nothing per object:
// rising damp and splashed mud along the foot of every wall, blotchy stains higher up,
// and on the open ground large patches of darker, paler and greener earth.

const NOISE = /* glsl */ `
varying vec3 vWorldP;
uniform float uWet;
float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1, 0)), u.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), u.x), u.y);
}
float gFbm(vec2 p) { return gNoise(p) * 0.55 + gNoise(p * 2.13 + 7.1) * 0.3 + gNoise(p * 4.7 + 3.3) * 0.15; }
`;

function addWorldPos(shader) {
  shader.vertexShader = 'varying vec3 vWorldP;\n' + shader.vertexShader.replace(
    '#include <worldpos_vertex>',
    `#include <worldpos_vertex>
    {
      vec4 wp4 = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wp4 = instanceMatrix * wp4;
      #endif
      vWorldP = (modelMatrix * wp4).xyz;
    }`,
  );
  shader.fragmentShader = NOISE + shader.fragmentShader;
  shader.uniforms.uWet = wet;
}

function chain(material, fn, key) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => { prev?.call(material, shader, r); fn(shader); };
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (prevKey ? prevKey() : '') + key;
  return material;
}

// Walls and anything standing on the ground. strength 0..1.
export function grime(material, strength = 1) {
  return chain(material, (shader) => {
    addWorldPos(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      {
        float wy = vWorldP.y;
        vec2 wq = vWorldP.xz + vec2(vWorldP.y * 0.3);
        float n = gFbm(wq * 0.9);
        // damp rises unevenly, higher in some places
        float damp = 1.0 - smoothstep(0.05, 0.25 + n * 0.55, wy);
        float splash = 1.0 - smoothstep(0.0, 0.18 + n * 0.12, wy);
        vec3 c = diffuseColor.rgb;
        c = mix(c, c * vec3(0.62, 0.58, 0.52), damp * 0.6 * ${strength.toFixed(2)});
        c = mix(c, vec3(0.55, 0.47, 0.36), splash * 0.35 * ${strength.toFixed(2)});
        // soot and rain stains, mostly faint
        float st = smoothstep(0.55, 0.85, gFbm(vec2(vWorldP.x + vWorldP.z, wy * 0.6) * 0.35));
        c *= 1.0 - st * 0.18 * ${strength.toFixed(2)};
        // rain darkens everything out in the open, walls streak from the top
        c *= 1.0 - uWet * (0.22 + 0.12 * n);
        diffuseColor.rgb = c;
      }`,
    );
  }, `-grime${strength}`);
}

// The bare earth: break up the tiling and add big patches of colour.
export function groundVariation(material) {
  return chain(material, (shader) => {
    addWorldPos(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        vec4 t1 = texture2D(map, vMapUv);
        vec4 t2 = texture2D(map, vMapUv * 0.231 + vec2(0.37, 0.11));
        vec2 wp = vWorldP.xz;
        float big = gFbm(wp * 0.012);
        float mid = gFbm(wp * 0.07 + 13.0);
        float fine = gNoise(wp * 0.6);
        vec3 tex = mix(t1.rgb, t2.rgb, 0.45 + 0.3 * (mid - 0.5));
        vec3 dark = vec3(0.66, 0.58, 0.47), pale = vec3(1.08, 1.04, 0.97), green = vec3(0.78, 0.86, 0.56);
        vec3 tintC = mix(dark, pale, smoothstep(0.25, 0.75, big));
        tintC = mix(tintC, green, smoothstep(0.58, 0.8, mid) * 0.55);
        tintC *= 0.93 + fine * 0.12;
        // wet earth goes dark, wettest in the low patches
        tintC *= 1.0 - uWet * (0.3 + 0.15 * smoothstep(0.3, 0.7, mid));
        diffuseColor.rgb *= tex * tintC;
      #endif`,
    );
  }, '-ground');
}

// Only the rain: for paving and roads, which have no walls to be damp at the foot of.
export function wetOnly(material, amount = 0.35) {
  return chain(material, (shader) => {
    addWorldPos(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      diffuseColor.rgb *= 1.0 - uWet * ${amount.toFixed(2)} * (0.8 + 0.4 * gNoise(vWorldP.xz * 0.3));`,
    );
  }, `-wet${amount}`);
}
