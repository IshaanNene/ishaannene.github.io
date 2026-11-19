"use client";
/**
 * Runtime material library for Blender-exported GLBs.
 *
 * GLB materials are named `M_<name>` (see scripts/blender/lib.py MATERIALS). At
 * load time every mesh's material is swapped for a shared, textured PBR
 * material from this library, keeping vertex-colour AO from the bake.
 */
import * as THREE from "three";
import type { SurfaceTexture } from "@/presets/materials";

type TexKey = Exclude<SurfaceTexture, null>;

const loader = typeof window !== "undefined" ? new THREE.TextureLoader() : null;
const texCache = new Map<string, THREE.Texture>();

export function getTexture(key: TexKey, kind: "normal" | "roughness"): THREE.Texture | null {
  if (!loader) return null;
  const id = `${key}/${kind}`;
  let t = texCache.get(id);
  if (!t) {
    t = loader.load(`/textures/${key}/${kind}.webp`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = 4;
    texCache.set(id, t);
  }
  return t;
}

interface Def {
  color: string;
  rough: number;
  metal: number;
  tex?: TexKey;
  normalScale?: number;
  emissive?: string;
  emissiveIntensity?: number;
  kind?: "glass" | "water" | "foliage";
  flat?: boolean;
}

export const ENV_MATERIALS: Record<string, Def> = {
  grass: { color: "#86ad6c", rough: 0.95, metal: 0, tex: "grass", normalScale: 0.9 },
  grass_dry: { color: "#b3b56c", rough: 0.95, metal: 0, tex: "grass", normalScale: 0.9 },
  soil: { color: "#6e503a", rough: 1, metal: 0, tex: "stone", normalScale: 1 },
  sand: { color: "#e8d8b5", rough: 0.95, metal: 0, tex: "sand", normalScale: 0.6 },
  stone_light: { color: "#d4c8b5", rough: 0.9, metal: 0, tex: "stone", normalScale: 1.2, flat: true },
  stone_mid: { color: "#a6917c", rough: 0.92, metal: 0, tex: "stone", normalScale: 1.3, flat: true },
  stone_dark: { color: "#655a50", rough: 0.95, metal: 0, tex: "stone", normalScale: 1.3, flat: true },
  stone_cool: { color: "#878781", rough: 0.9, metal: 0, tex: "stone", normalScale: 1.2, flat: true },
  concrete: { color: "#c2bcb1", rough: 0.86, metal: 0, tex: "concrete", normalScale: 0.9 },
  concrete_light: { color: "#ebe5da", rough: 0.82, metal: 0, tex: "concrete", normalScale: 0.7 },
  concrete_dark: { color: "#726e69", rough: 0.9, metal: 0, tex: "concrete", normalScale: 0.9 },
  paving: { color: "#dbd1c0", rough: 0.85, metal: 0, tex: "paving", normalScale: 0.8 },
  metal: { color: "#9aa0a7", rough: 0.36, metal: 0.9, tex: "metal", normalScale: 0.4 },
  metal_dark: { color: "#2a2a2e", rough: 0.45, metal: 0.8, tex: "metal", normalScale: 0.3 },
  chrome: { color: "#dde1e5", rough: 0.12, metal: 1 },
  wood: { color: "#a06e45", rough: 0.78, metal: 0, tex: "wood", normalScale: 0.7 },
  wood_dark: { color: "#5f3f29", rough: 0.85, metal: 0, tex: "wood", normalScale: 0.7 },
  glass: { color: "#b9d5ef", rough: 0.05, metal: 0.1, kind: "glass" },
  water: { color: "#3a7bb3", rough: 0.06, metal: 0, kind: "water" },
  lime: { color: "#DFFF00", rough: 0.55, metal: 0, tex: "concrete", normalScale: 0.3 },
  orange: { color: "#FF7043", rough: 0.55, metal: 0, tex: "concrete", normalScale: 0.3 },
  blue: { color: "#477BFF", rough: 0.5, metal: 0, tex: "concrete", normalScale: 0.3 },
  mint: { color: "#8BC9A5", rough: 0.6, metal: 0.2, tex: "concrete", normalScale: 0.4 },
  ink: { color: "#1c1c1e", rough: 0.6, metal: 0 },
  cream: { color: "#F4EFE6", rough: 0.8, metal: 0, tex: "concrete", normalScale: 0.4 },
  emit_lime: { color: "#DFFF00", rough: 0.4, metal: 0, emissive: "#DFFF00", emissiveIntensity: 2.2 },
  emit_warm: { color: "#FFC979", rough: 0.4, metal: 0, emissive: "#FFB45E", emissiveIntensity: 1.6 },
  bark: { color: "#5d4432", rough: 0.95, metal: 0, tex: "wood", normalScale: 1 },
  foliage: { color: "#5f9e6e", rough: 0.85, metal: 0, tex: "foliage", normalScale: 1, kind: "foliage", flat: true },
  foliage_dark: { color: "#3f7052", rough: 0.85, metal: 0, tex: "foliage", normalScale: 1, kind: "foliage", flat: true },
  foliage_warm: { color: "#bdb55e", rough: 0.85, metal: 0, tex: "foliage", normalScale: 1, kind: "foliage", flat: true },
  foliage_mint: { color: "#8BC9A5", rough: 0.85, metal: 0, tex: "foliage", normalScale: 1, kind: "foliage", flat: true },
};

export const windUniforms = { uTime: { value: 0 } };

function applyWind(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sway = max(transformed.y - 0.8, 0.0) * 0.045;
        transformed.x += sin(uTime * 1.3 + ip.x * 0.7 + ip.z * 0.3) * sway;
        transformed.z += cos(uTime * 1.1 + ip.z * 0.6) * sway * 0.7;`,
      );
  };
  mat.customProgramCacheKey = () => "wind";
}

export function createEnvMaterial(name: string, vertexColors: boolean): THREE.Material {
  const def = ENV_MATERIALS[name] ?? { color: "#ff00ff", rough: 0.8, metal: 0 };
  if (def.kind === "glass") {
    return new THREE.MeshPhysicalMaterial({
      color: def.color,
      roughness: 0.04,
      metalness: 0.05,
      transparent: true,
      opacity: 0.38,
      envMapIntensity: 1.6,
      clearcoat: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    color: def.color,
    roughness: def.rough,
    metalness: def.metal,
    vertexColors,
    flatShading: false,
  });
  if (def.tex) {
    mat.normalMap = getTexture(def.tex, "normal");
    mat.roughnessMap = getTexture(def.tex, "roughness");
    const s = def.normalScale ?? 1;
    mat.normalScale.set(s, s);
  }
  if (def.emissive) {
    mat.emissive = new THREE.Color(def.emissive);
    mat.emissiveIntensity = def.emissiveIntensity ?? 1;
    mat.toneMapped = false;
  }
  if (def.kind === "foliage") applyWind(mat);
  mat.name = name;
  return mat;
}

/** A set of materials keyed by GLB material name. Each island owns one set so hover tinting is local. */
export class MaterialSet {
  private cache = new Map<string, THREE.Material>();
  get(name: string, vertexColors: boolean) {
    const key = `${name}|${vertexColors}`;
    let m = this.cache.get(key);
    if (!m) {
      m = createEnvMaterial(name, vertexColors);
      this.cache.set(key, m);
    }
    return m;
  }
  setHighlight(amount: number) {
    for (const m of this.cache.values()) {
      if (m instanceof THREE.MeshStandardMaterial && !ENV_MATERIALS[m.name]?.emissive) {
        if (amount > 0.001) {
          m.emissive.setRGB(0.55 * amount, 0.42 * amount, 0.12 * amount);
        } else {
          m.emissive.setRGB(0, 0, 0);
        }
      }
    }
  }
  dispose() {
    this.cache.forEach((m) => m.dispose());
    this.cache.clear();
  }
}

export const sharedMaterials = new MaterialSet();

export function materialKey(m: THREE.Material) {
  return m.name.startsWith("M_") ? m.name.slice(2) : m.name;
}
