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

export type PbrKey = "rock" | "grass" | "planks" | "concrete" | "stone" | "plaster" | "marble" | "rock_wall" | "metal" | "roof_tiles" | "corrugated";

/** Scanned CC0 PBR sets (Poly Haven) in public/textures/pbr/<key>/{color,normal,roughness}.webp */
export function getPbrTexture(key: PbrKey, kind: "color" | "normal" | "roughness", repeat = 1): THREE.Texture | null {
  if (!loader) return null;
  const id = `pbr/${key}/${kind}@${repeat}`;
  let t = texCache.get(id);
  if (!t) {
    const base = texCache.get(`pbr/${key}/${kind}@1`) ?? loader.load(`/textures/pbr/${key}/${kind}.webp`);
    if (!texCache.has(`pbr/${key}/${kind}@1`)) {
      base.wrapS = base.wrapT = THREE.RepeatWrapping;
      base.colorSpace = kind === "color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      base.anisotropy = 8;
      texCache.set(`pbr/${key}/${kind}@1`, base);
    }
    t = repeat === 1 ? base : base.clone();
    if (repeat !== 1) {
      t.repeat.set(repeat, repeat);
      t.needsUpdate = true;
    }
    texCache.set(id, t);
  }
  return t;
}

interface Def {
  color: string;
  /** HDR multiplier on the albedo (photo textures are darker than the stylised palette) */
  boost?: [number, number, number];
  pbr?: PbrKey;
  /** the PBR colour map is a neutral grey detail map of this mean sRGB level: `color` is then the final albedo */
  pbrMean?: number;
  /** use only the PBR normal + roughness maps (keep `color` flat), e.g. for clean painted metal */
  pbrNoColor?: boolean;
  repeat?: number;
  rough: number;
  metal: number;
  tex?: TexKey;
  normalScale?: number;
  emissive?: string;
  emissiveIntensity?: number;
  kind?: "glass" | "water" | "foliage" | "lawn";
  flat?: boolean;
}

export const ENV_MATERIALS: Record<string, Def> = {
  grass: { color: "#ffffff", boost: [0.82, 1.42, 0.55], rough: 1, metal: 0, pbr: "grass", repeat: 1.6, normalScale: 1.1, kind: "lawn" },
  grass_dry: { color: "#ffffff", boost: [1.35, 1.4, 0.7], rough: 1, metal: 0, pbr: "grass", repeat: 1.6, normalScale: 1.1, kind: "lawn" },
  soil: { color: "#6e503a", rough: 1, metal: 0, tex: "stone", normalScale: 1 },
  sand: { color: "#e8d8b5", rough: 0.95, metal: 0, tex: "sand", normalScale: 0.6 },
  stone_light: { color: "#ffffff", boost: [1.42, 1.5, 1.7], rough: 1, metal: 0, pbr: "marble", repeat: 0.7, normalScale: 0.9 },
  stone_mid: { color: "#a6917c", rough: 1, metal: 0, pbr: "rock_wall", pbrMean: 129, repeat: 0.6, normalScale: 1.2 },
  stone_dark: { color: "#655a50", rough: 1, metal: 0, pbr: "rock_wall", pbrMean: 129, repeat: 0.6, normalScale: 1.3 },
  stone_cool: { color: "#878781", rough: 1, metal: 0, pbr: "rock_wall", pbrMean: 129, repeat: 0.6, normalScale: 1.2 },
  concrete: { color: "#ffffff", boost: [1.3, 1.32, 1.36], rough: 1, metal: 0, pbr: "concrete", repeat: 0.8, normalScale: 0.8 },
  concrete_light: { color: "#ffffff", boost: [1.6, 1.6, 1.62], rough: 1, metal: 0, pbr: "concrete", repeat: 0.8, normalScale: 0.6 },
  concrete_dark: { color: "#ffffff", boost: [0.75, 0.76, 0.8], rough: 1, metal: 0, pbr: "concrete", repeat: 0.8, normalScale: 0.8 },
  paving: { color: "#dbd1c0", rough: 0.85, metal: 0, tex: "paving", normalScale: 0.8 },
  metal: { color: "#9aa0a7", rough: 0.7, metal: 0.85, pbr: "metal", pbrNoColor: true, repeat: 0.8, normalScale: 0.5 },
  metal_dark: { color: "#2a2a2e", rough: 0.75, metal: 0.8, pbr: "metal", pbrNoColor: true, repeat: 0.8, normalScale: 0.4 },
  chrome: { color: "#dde1e5", rough: 0.12, metal: 1 },
  asphalt: { color: "#ffffff", boost: [0.36, 0.36, 0.38], rough: 1, metal: 0, pbr: "concrete", repeat: 1.4, normalScale: 1.1 },
  roof_tile: { color: "#ffffff", boost: [3.4, 3.0, 3.0], rough: 1, metal: 0, pbr: "roof_tiles", repeat: 1.1, normalScale: 1.2 },
  corrugated: { color: "#aeb3b8", rough: 0.8, metal: 0.55, pbr: "corrugated", pbrMean: 182, repeat: 1, normalScale: 1.2 },
  gold: { color: "#f1b84b", rough: 0.2, metal: 1, emissive: "#5a3604", emissiveIntensity: 0.5 },
  wood: { color: "#f2c08c", rough: 1, metal: 0, pbr: "planks", repeat: 1.2, normalScale: 0.9 },
  wood_dark: { color: "#b48863", rough: 1, metal: 0, pbr: "planks", repeat: 1.2, normalScale: 0.9 },
  glass: { color: "#b9d5ef", rough: 0.05, metal: 0.1, kind: "glass" },
  water: { color: "#3a7bb3", rough: 0.06, metal: 0, kind: "water" },
  lime: { color: "#DFFF00", rough: 0.75, metal: 0, pbr: "plaster", pbrMean: 188, repeat: 0.8, normalScale: 0.5 },
  orange: { color: "#FF7043", rough: 0.75, metal: 0, pbr: "plaster", pbrMean: 188, repeat: 0.8, normalScale: 0.5 },
  blue: { color: "#477BFF", rough: 0.7, metal: 0, pbr: "plaster", pbrMean: 188, repeat: 0.8, normalScale: 0.5 },
  mint: { color: "#8BC9A5", rough: 0.75, metal: 0.1, pbr: "plaster", pbrMean: 188, repeat: 0.8, normalScale: 0.5 },
  ink: { color: "#1c1c1e", rough: 0.6, metal: 0 },
  cream: { color: "#F4EFE6", rough: 0.9, metal: 0, pbr: "plaster", pbrMean: 188, repeat: 0.8, normalScale: 0.7 },
  emit_lime: { color: "#DFFF00", rough: 0.4, metal: 0, emissive: "#DFFF00", emissiveIntensity: 2.2 },
  emit_warm: { color: "#FFC979", rough: 0.4, metal: 0, emissive: "#FFB45E", emissiveIntensity: 1.6 },
  bark: { color: "#5d4432", rough: 0.95, metal: 0, tex: "wood", normalScale: 1 },
  foliage: { color: "#5f9e6e", rough: 0.85, metal: 0, tex: "foliage", normalScale: 1, kind: "foliage", flat: true },
  foliage_dark: { color: "#3f7052", rough: 0.85, metal: 0, tex: "foliage", normalScale: 1, kind: "foliage", flat: true },
  foliage_warm: { color: "#8fb052", rough: 0.85, metal: 0, tex: "foliage", normalScale: 1, kind: "foliage", flat: true },
  foliage_mint: { color: "#8BC9A5", rough: 0.85, metal: 0, tex: "foliage", normalScale: 1, kind: "foliage", flat: true },
  // island undersides: scanned rock face, tinted per stratum so layers still read
  cliff_soil: { color: "#a77f5c", rough: 1, metal: 0, pbr: "rock", repeat: 0.45, normalScale: 1.4 },
  cliff_stone_light: { color: "#f3dcc0", rough: 1, metal: 0, pbr: "rock", repeat: 0.45, normalScale: 1.4 },
  cliff_stone_mid: { color: "#d3b192", rough: 1, metal: 0, pbr: "rock", repeat: 0.45, normalScale: 1.4 },
  cliff_stone_cool: { color: "#c4b4a6", rough: 1, metal: 0, pbr: "rock", repeat: 0.45, normalScale: 1.4 },
  cliff_stone_dark: { color: "#9a7c66", rough: 1, metal: 0, pbr: "rock", repeat: 0.45, normalScale: 1.5 },
};

export const windUniforms = { uTime: { value: 0 } };

export function applyWind(mat: THREE.MeshStandardMaterial) {
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

/**
 * Lawns: break up the tiling grass scan and give the ground natural variety. A second, rotated
 * and rescaled sample of the texture is blended in by noise (no visible repeat), and world-space
 * noise paints lush darker patches, sun-dried yellow patches and fine clumpy brightness.
 */
function applyLawn(mat: THREE.MeshStandardMaterial, dryPatches: number) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLawnW;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvLawnW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vLawnW;
        float lawnHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float lawnNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(lawnHash(i), lawnHash(i + vec2(1, 0)), u.x), mix(lawnHash(i + vec2(0, 1)), lawnHash(i + vec2(1, 1)), u.x), u.y);
        }
        float lawnFbm(vec2 p) { return lawnNoise(p) * 0.6 + lawnNoise(p * 2.13 + 4.1) * 0.28 + lawnNoise(p * 4.7 + 9.7) * 0.12; }`,
      )
      .replace(
        "#include <map_fragment>",
        `vec2 lw = vLawnW.xz;
        #ifdef USE_MAP
          vec4 lawnA = texture2D(map, vMapUv);
          vec4 lawnB = texture2D(map, mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.61 + vec2(0.27, 0.61));
          diffuseColor *= mix(lawnA, lawnB, smoothstep(0.3, 0.7, lawnNoise(lw * 0.75)));
        #endif
        float lawnBig = lawnFbm(lw * 0.38);
        float lawnDry = lawnFbm(lw * 0.7 + 7.3);
        diffuseColor.rgb *= mix(vec3(1.06, 1.04, 1.0), vec3(0.55, 0.82, 0.48), smoothstep(0.38, 0.72, lawnBig));
        diffuseColor.rgb *= mix(vec3(1.0), vec3(1.3, 1.08, 0.62), smoothstep(0.58, 0.8, lawnDry) * ${dryPatches.toFixed(2)});
        diffuseColor.rgb *= 0.72 + 0.5 * lawnFbm(lw * 2.6 + 1.7);`,
      );
  };
  mat.customProgramCacheKey = () => `lawn-${dryPatches}`;
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
  if (def.boost) mat.color.setRGB(...def.boost);
  if (def.pbr) {
    const r = def.repeat ?? 1;
    mat.map = def.pbrNoColor ? null : getPbrTexture(def.pbr, "color", r);
    if (def.pbrMean) mat.color.multiplyScalar(1 / Math.pow(def.pbrMean / 255, 2.2));
    mat.normalMap = getPbrTexture(def.pbr, "normal", r);
    mat.roughnessMap = getPbrTexture(def.pbr, "roughness", r);
    const s = def.normalScale ?? 1;
    mat.normalScale.set(s, s);
  } else if (def.tex) {
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
  if (def.kind === "lawn") applyLawn(mat, name === "grass_dry" ? 0.3 : 0.6);
  mat.name = name;
  return mat;
}

const scannedCache = new Map<string, THREE.Material>();

/**
 * Scanned (Poly Haven, `PH_*`) vegetation keeps its own textures instead of the stylised library.
 * Leaf/needle cards (`*_cards`) are alpha-tested, double-sided and sway in the wind.
 */
export function scannedMaterial(src: THREE.Material, vertexColors: boolean): THREE.Material {
  const key = `${src.name}|${vertexColors}`;
  let m = scannedCache.get(key);
  if (m) return m;
  const s = src as THREE.MeshStandardMaterial;
  const cards = src.name.endsWith("_cards");
  const mat = new THREE.MeshStandardMaterial({
    map: s.map ?? null,
    normalMap: cards ? null : (s.normalMap ?? null),
    roughnessMap: cards ? null : (s.roughnessMap ?? null),
    roughness: cards ? 0.78 : s.roughnessMap ? 1 : s.roughness,
    metalness: 0,
    vertexColors,
  });
  mat.name = src.name;
  if (src.name.startsWith("PH_prop_")) {
    // scanned props keep their glTF metal/rough maps; glass is see-through, and lamp glass and bulbs glow
    mat.metalnessMap = s.metalnessMap ?? null;
    mat.metalness = s.metalnessMap ? 1 : s.metalness;
    mat.roughness = s.roughnessMap ? 1 : s.roughness;
    if (/glass|bulb/.test(src.name)) {
      const bulb = src.name.includes("bulb");
      mat.transparent = !bulb;
      mat.opacity = bulb ? 1 : 0.55;
      mat.depthWrite = bulb;
      mat.roughness = 0.08;
      mat.metalness = 0;
      mat.metalnessMap = null;
      mat.roughnessMap = null;
      mat.emissive.set("#ffc477");
      mat.emissiveIntensity = bulb ? 2.2 : 0.9;
    }
  }
  if (cards) {
    mat.alphaTest = 0.42;
    mat.side = THREE.DoubleSide;
    applyWind(mat);
    const wind = mat.onBeforeCompile;
    // Instanced crowns are recoloured per tree (seasonal palette in instanceColor): the scan's leaf
    // texture supplies light/shadow detail as luminance, the instance supplies the hue. A little of
    // the final albedo is added back as emission, so backlit leaves glow in their own colour.
    mat.onBeforeCompile = (shader, renderer) => {
      wind(shader, renderer);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          #ifdef USE_INSTANCING_COLOR
            float leafLum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
            diffuseColor.rgb = vec3(0.35 + leafLum * 5.5);
          #endif`,
        )
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 0.24;");
    };
    mat.customProgramCacheKey = () => "wind-leaf";
  }
  scannedCache.set(key, mat);
  return mat;
}

export function isScanned(m: THREE.Material) {
  return m.name.startsWith("PH_");
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
