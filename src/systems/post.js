import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// The look: filmic tone mapping, a little bloom on the sun and lamps, and a warm grade
// with a gentle vignette.
// Phones get tone mapping only.

const Grade = {
  uniforms: { tDiffuse: { value: null }, warmth: { value: 0.5 }, night: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float warmth; uniform float night;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // lift the shadows toward a cool blue, push the light toward warm gold
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      vec3 shadowTint = mix(vec3(0.92, 0.97, 1.08), vec3(0.85, 0.92, 1.15), night);
      vec3 lightTint = mix(vec3(1.0), vec3(1.06, 1.01, 0.92), warmth);
      c.rgb *= mix(shadowTint, lightTint, smoothstep(0.05, 0.6, l));
      // a touch more colour
      c.rgb = mix(vec3(l), c.rgb, 1.12);
      // vignette
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - dot(d, d) * 0.55;
      gl_FragColor = c;
    }`,
};

export function makePost(renderer, scene, camera, { full = true } = {}) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  if (!full) {
    return { render() { renderer.render(scene, camera); }, setSize() {}, update() {} };
  }
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.22, 0.6, 0.92);
  composer.addPass(bloom);
  const grade = new ShaderPass(Grade);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  return {
    composer, bloom,
    render() { composer.render(); },
    setSize(w, h) { composer.setSize(w, h); },
    update(sky) {
      grade.uniforms.night.value = sky.night;
      grade.uniforms.warmth.value = 0.35 + 0.5 * (1 - Math.min(1, Math.max(0, sky.elevation * 2)));
      bloom.strength = 0.18 + sky.night * 0.25;
    },
  };
}
