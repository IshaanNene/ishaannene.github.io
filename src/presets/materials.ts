/**
 * Content material presets — pure data, shared by the 3D renderer and the
 * editorial page renderer. To add a material: add an entry here. Nothing else
 * needs to change; the 3D content renderer and article pages read these tokens.
 */
export type SurfaceTexture = "stone" | "wood" | "metal" | "concrete" | "grass" | "paving" | "sand" | "foliage" | "water" | null;

export interface MaterialPreset {
  id: string;
  label: string;
  /** physical surface of the object body */
  surface: {
    color: string;
    roughness: number;
    metalness: number;
    texture: SurfaceTexture;
    /** scanned PBR set (public/textures/pbr/<key>) — overrides `texture` with colour + normal + roughness maps */
    pbr?: "rock" | "grass" | "planks" | "concrete" | "stone";
    /** albedo multiplier for scanned textures (they are darker than the stylised palette) */
    brightness?: number;
    textureRepeat?: number;
    normalScale?: number;
    transmission?: number;
    opacity?: number;
    clearcoat?: number;
    emissive?: string;
    emissiveIntensity?: number;
  };
  /** default material for typography placed on this surface */
  ink: { color: string; roughness: number; metalness: number; emissive?: string; emissiveIntensity?: number; opacity?: number };
  /** editorial identity for article pages */
  editorial: {
    bg: string;
    fg: string;
    muted: string;
    accent: string;
    rule: string;
    /** CSS background pattern key, see globals.css `.surface-*` */
    pattern: string;
  };
}

export const MATERIAL_PRESETS: Record<string, MaterialPreset> = {
  bronze: {
    id: "bronze",
    label: "Aged bronze",
    surface: { color: "#b5713f", roughness: 0.4, metalness: 1, texture: "metal", normalScale: 0.3 },
    ink: { color: "#3b2414", roughness: 0.8, metalness: 0.2 },
    editorial: { bg: "#6b3f22", fg: "#f6e6d4", muted: "#d8b496", accent: "#dfff00", rule: "#8f5a35", pattern: "corten" },
  },
  paint: {
    id: "paint",
    label: "Hand-painted enamel",
    surface: { color: "#e0321f", roughness: 0.6, metalness: 0, texture: null, emissive: "#5a0800", emissiveIntensity: 0.6 },
    ink: { color: "#b8241c", roughness: 0.7, metalness: 0 },
    editorial: { bg: "#b8241c", fg: "#fff4e6", muted: "#f4c7b8", accent: "#dfff00", rule: "#d4554a", pattern: "paper" },
  },
  stone: {
    id: "stone",
    label: "Weathered stone",
    surface: { color: "#d2ccc1", brightness: 1.15, roughness: 0.95, metalness: 0, texture: "stone", pbr: "stone", textureRepeat: 0.7, normalScale: 1.6 },
    ink: { color: "#5b5047", roughness: 1, metalness: 0 },
    editorial: { bg: "#d9cfbf", fg: "#2b2520", muted: "#6d6157", accent: "#ff7043", rule: "#b3a693", pattern: "stone" },
  },
  granite: {
    id: "granite",
    label: "Dark granite",
    surface: { color: "#4b4743", roughness: 0.55, metalness: 0, texture: "stone", textureRepeat: 2, normalScale: 0.6 },
    ink: { color: "#e9dfcf", roughness: 0.8, metalness: 0 },
    editorial: { bg: "#2a2826", fg: "#f1e9dc", muted: "#a59c90", accent: "#dfff00", rule: "#4d4842", pattern: "granite" },
  },
  wood: {
    id: "wood",
    label: "Weathered timber",
    surface: { color: "#f6c792", brightness: 2.1, roughness: 0.85, metalness: 0, texture: "wood", pbr: "planks", textureRepeat: 0.9, normalScale: 1.2 },
    ink: { color: "#f4efe6", roughness: 0.7, metalness: 0 },
    editorial: { bg: "#c49a6c", fg: "#2a1a0e", muted: "#5e4128", accent: "#171717", rule: "#9b7048", pattern: "wood" },
  },
  steel: {
    id: "steel",
    label: "Brushed steel",
    surface: { color: "#d5d9dd", brightness: 1.25, roughness: 0.42, metalness: 0.45, texture: "metal", textureRepeat: 1, normalScale: 0.4 },
    ink: { color: "#16171a", roughness: 0.6, metalness: 0.2 },
    editorial: { bg: "#c9cdd1", fg: "#141517", muted: "#4f555c", accent: "#477bff", rule: "#9da3a9", pattern: "metal" },
  },
  metal: {
    id: "metal",
    label: "Brushed steel",
    surface: { color: "#a9aeb4", roughness: 0.34, metalness: 1, texture: "metal", textureRepeat: 1, normalScale: 0.5 },
    ink: { color: "#1b1b1d", roughness: 0.5, metalness: 0.6 },
    editorial: { bg: "#c9cdd1", fg: "#141517", muted: "#4f555c", accent: "#477bff", rule: "#9da3a9", pattern: "metal" },
  },
  brass: {
    id: "brass",
    label: "Brass",
    surface: { color: "#c9a256", roughness: 0.3, metalness: 1, texture: "metal", normalScale: 0.4 },
    ink: { color: "#2b2111", roughness: 0.6, metalness: 0.4 },
    editorial: { bg: "#e4cf9f", fg: "#2b2111", muted: "#6b5631", accent: "#171717", rule: "#c9a256", pattern: "metal" },
  },
  corten: {
    id: "corten",
    label: "Weathering steel",
    surface: { color: "#9c4f2c", roughness: 0.85, metalness: 0.4, texture: "concrete", normalScale: 1.2 },
    ink: { color: "#f4efe6", roughness: 0.8, metalness: 0 },
    editorial: { bg: "#8f4a2b", fg: "#f7ebe0", muted: "#e0b9a0", accent: "#dfff00", rule: "#b8673f", pattern: "corten" },
  },
  concrete: {
    id: "concrete",
    label: "Board-formed concrete",
    surface: { color: "#e9edf0", brightness: 1.45, roughness: 0.95, metalness: 0, texture: "concrete", pbr: "concrete", textureRepeat: 0.8, normalScale: 1.3 },
    ink: { color: "#bcb6ac", roughness: 0.88, metalness: 0 },
    editorial: { bg: "#c8c2b8", fg: "#171717", muted: "#57534e", accent: "#ff7043", rule: "#9e988e", pattern: "concrete" },
  },
  paper: {
    id: "paper",
    label: "Archival paper",
    surface: { color: "#f4efe6", roughness: 0.95, metalness: 0, texture: "sand", textureRepeat: 2, normalScale: 0.25 },
    ink: { color: "#1d1d1f", roughness: 0.9, metalness: 0 },
    editorial: { bg: "#f4efe6", fg: "#1d1d1f", muted: "#6b665f", accent: "#477bff", rule: "#d9d1c3", pattern: "paper" },
  },
  glass: {
    id: "glass",
    label: "Etched glass",
    surface: { color: "#cfe3f2", roughness: 0.06, metalness: 0, texture: null, transmission: 0.9, opacity: 0.55, clearcoat: 1 },
    ink: { color: "#ffffff", roughness: 0.6, metalness: 0, opacity: 0.85, emissive: "#cfe8ff", emissiveIntensity: 0.25 },
    editorial: { bg: "#e7f0f6", fg: "#0f1b26", muted: "#4f6577", accent: "#477bff", rule: "#b9cfdf", pattern: "glass" },
  },
  grass: {
    id: "grass",
    label: "Living grass",
    surface: { color: "#8fc25a", brightness: 1.5, roughness: 1, metalness: 0, texture: "grass", pbr: "grass", textureRepeat: 0.8, normalScale: 1.4 },
    ink: { color: "#8bc9a5", roughness: 0.9, metalness: 0 },
    editorial: { bg: "#cfe3c5", fg: "#18301f", muted: "#47664f", accent: "#ff7043", rule: "#9cc39a", pattern: "grass" },
  },
  water: {
    id: "water",
    label: "Still water",
    surface: { color: "#3b7cb4", roughness: 0.05, metalness: 0.1, texture: "water", normalScale: 0.6, opacity: 0.85, clearcoat: 1 },
    ink: { color: "#f4efe6", roughness: 0.3, metalness: 0 },
    editorial: { bg: "#d8e6f1", fg: "#0d2236", muted: "#476585", accent: "#ff7043", rule: "#a8c3db", pattern: "water" },
  },
  lacquer: {
    id: "lacquer",
    label: "Ink lacquer",
    surface: { color: "#1b1b1d", roughness: 0.35, metalness: 0.1, texture: null, clearcoat: 1 },
    ink: { color: "#dfff00", roughness: 0.4, metalness: 0, emissive: "#dfff00", emissiveIntensity: 0.6 },
    editorial: { bg: "#171717", fg: "#f4efe6", muted: "#9b958c", accent: "#dfff00", rule: "#333", pattern: "ink" },
  },
  clay: {
    id: "clay",
    label: "Painted clay",
    surface: { color: "#ff7043", roughness: 0.7, metalness: 0, texture: "concrete", normalScale: 0.4 },
    ink: { color: "#171717", roughness: 0.6, metalness: 0 },
    editorial: { bg: "#ffb59c", fg: "#2b1208", muted: "#7a3a24", accent: "#171717", rule: "#ff8a63", pattern: "clay" },
  },
};

export const DEFAULT_MATERIAL = "stone";

export function getMaterialPreset(id: string | undefined): MaterialPreset {
  return MATERIAL_PRESETS[id ?? ""] ?? MATERIAL_PRESETS[DEFAULT_MATERIAL];
}
