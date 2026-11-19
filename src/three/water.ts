"use client";
import * as THREE from "three";
import { getTexture } from "./materials";

let water: THREE.MeshPhysicalMaterial | null = null;
export const waterUniforms = { uTime: { value: 0 } };
const falls = new Set<THREE.ShaderMaterial>();

/** Shared still-water surface: deep tint, env reflections, drifting normals. */
export function getWaterMaterial() {
  if (!water) {
    water = new THREE.MeshPhysicalMaterial({
      color: "#2f6fa6",
      roughness: 0.07,
      metalness: 0.0,
      transparent: true,
      opacity: 0.88,
      envMapIntensity: 1.6,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      side: THREE.DoubleSide,
    });
    const n = getTexture("water", "normal");
    if (n) {
      water.normalMap = n.clone();
      water.normalMap.wrapS = water.normalMap.wrapT = THREE.RepeatWrapping;
      water.normalMap.repeat.set(0.6, 0.6);
      water.normalScale.set(0.35, 0.35);
      water.clearcoatNormalMap = water.normalMap;
    }
  }
  return water;
}

export function tickWater(t: number) {
  waterUniforms.uTime.value = t;
  if (water?.normalMap) {
    water.normalMap.offset.set(t * 0.012, t * 0.008);
  }
  falls.forEach((m) => (m.uniforms.uTime.value = t));
}

/** Animated waterfall ribbon: streaks scroll downward and fade into mist. */
export function createWaterfallMaterial(height: number) {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uHeight: { value: height } },
    vertexShader: /* glsl */ `
      varying float vY;
      varying vec3 vW;
      void main() {
        vY = position.y;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uHeight;
      varying float vY;
      varying vec3 vW;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      void main() {
        float t = clamp(-vY / uHeight, 0.0, 1.0);
        float lane = (vW.x + vW.z) * 6.0;
        float streak = noise(vec2(lane, vY * 1.2 + uTime * 3.2));
        streak = smoothstep(0.35, 0.95, streak);
        float foam = smoothstep(0.12, 0.0, t) + streak * 0.6;
        vec3 deep = vec3(0.32, 0.6, 0.82);
        vec3 white = vec3(0.98, 0.97, 0.93);
        vec3 col = mix(deep, white, clamp(foam, 0.0, 1.0));
        col += vec3(0.25, 0.12, 0.0) * (1.0 - t) * 0.3; // sunset warmth
        float alpha = (0.55 + streak * 0.4) * (1.0 - smoothstep(0.45, 1.0, t));
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  falls.add(m);
  return m;
}

export function disposeWaterfall(m: THREE.Material) {
  falls.delete(m as THREE.ShaderMaterial);
  m.dispose();
}
