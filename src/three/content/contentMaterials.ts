"use client";
/** Builds three.js materials from content material presets (src/presets/materials.ts). */
import * as THREE from "three";
import { getMaterialPreset, type MaterialPreset } from "@/presets/materials";
import type { TypographyPreset } from "@/presets/typography";
import { getPbrTexture, getTexture } from "../materials";

const cache = new Map<string, THREE.Material>();

export function surfaceMaterial(preset: MaterialPreset, tint?: string): THREE.MeshPhysicalMaterial {
  const key = `surface|${preset.id}|${tint ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit as THREE.MeshPhysicalMaterial;
  const s = preset.surface;
  const m = new THREE.MeshPhysicalMaterial({
    color: tint ?? s.color,
    roughness: s.roughness,
    metalness: s.metalness,
    clearcoat: s.clearcoat ?? 0,
    transparent: (s.opacity ?? 1) < 1,
    opacity: s.opacity ?? 1,
    transmission: s.transmission ?? 0,
    thickness: s.transmission ? 0.4 : 0,
    envMapIntensity: s.metalness > 0.5 ? 1.4 : 1,
  });
  if (s.brightness) m.color.multiplyScalar(s.brightness);
  if (s.pbr) {
    const r = s.textureRepeat ?? 1;
    m.map = getPbrTexture(s.pbr, "color", r);
    m.normalMap = getPbrTexture(s.pbr, "normal", r);
    m.roughnessMap = getPbrTexture(s.pbr, "roughness", r);
    m.normalScale.setScalar(s.normalScale ?? 1);
  } else if (s.texture) {
    const n = getTexture(s.texture, "normal");
    const r = getTexture(s.texture, "roughness");
    if (n) {
      m.normalMap = n.clone();
      m.normalMap.repeat.setScalar(s.textureRepeat ?? 1);
      m.normalMap.wrapS = m.normalMap.wrapT = THREE.RepeatWrapping;
      m.normalScale.setScalar(s.normalScale ?? 1);
    }
    if (r) {
      m.roughnessMap = r.clone();
      m.roughnessMap.repeat.setScalar(s.textureRepeat ?? 1);
      m.roughnessMap.wrapS = m.roughnessMap.wrapT = THREE.RepeatWrapping;
    }
  }
  if (s.emissive) {
    m.emissive.set(s.emissive);
    m.emissiveIntensity = s.emissiveIntensity ?? 1;
  }
  if (m.transparent) m.depthWrite = false;
  m.name = key;
  cache.set(key, m);
  return m;
}

/** Material for the lettering, derived from the typography treatment. */
export function inkMaterial(surface: MaterialPreset, typo: TypographyPreset, tint?: string): THREE.Material {
  const key = `ink|${surface.id}|${typo.id}|${tint ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let m: THREE.Material;
  switch (typo.treatment) {
    case "embossed":
      // raised letters in the body material: legibility comes from light & shadow
      m = surfaceMaterial(surface, tint);
      break;
    case "inlay":
    case "grown":
      m = surfaceMaterial(getMaterialPreset(typo.inkMaterial ?? "brass"));
      break;
    case "etched": {
      const i = surface.ink;
      m = new THREE.MeshStandardMaterial({
        color: i.color,
        roughness: 0.85,
        transparent: true,
        opacity: i.opacity ?? 0.8,
        emissive: new THREE.Color(i.emissive ?? "#000"),
        emissiveIntensity: i.emissiveIntensity ?? 0,
      });
      break;
    }
    default: {
      if ((typo.treatment === "engraved" || typo.treatment === "painted") && typo.inkMaterial) {
        m = surfaceMaterial(getMaterialPreset(typo.inkMaterial));
        break;
      }
      const i = surface.ink;
      m = new THREE.MeshStandardMaterial({
        color: i.color,
        roughness: i.roughness,
        metalness: i.metalness,
        emissive: new THREE.Color(i.emissive ?? "#000"),
        emissiveIntensity: i.emissiveIntensity ?? 0,
      });
    }
  }
  cache.set(key, m);
  return m;
}

export const accentMaterial = new THREE.MeshStandardMaterial({
  color: "#DFFF00",
  emissive: new THREE.Color("#DFFF00"),
  emissiveIntensity: 1.4,
  toneMapped: false,
});

export function plinthMaterial() {
  return surfaceMaterial(getMaterialPreset("concrete"), "#8f8a83");
}
