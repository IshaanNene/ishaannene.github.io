"use client";
/**
 * Instanced vegetation. The Blender library (vegetation.glb) holds one node per
 * variant; island manifests hold transforms. One InstancedMesh per
 * (variant × material primitive) per island.
 */
import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PROP_MODEL, VEGETATION_MODEL, type CliffInstance, type VegInstance } from "@/config/world";
import { isScanned, materialKey, scannedMaterial, sharedMaterials } from "./materials";
import { useWorld } from "./store";

interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

/** Float copy of a (possibly int16-quantised) geometry, so transforms can be baked into it. */
export function dequantise(src: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(src.attributes)) {
    const attr = a as THREE.BufferAttribute;
    const arr = new Float32Array(attr.count * attr.itemSize);
    for (let i = 0; i < attr.count; i++) for (let k = 0; k < attr.itemSize; k++) arr[i * attr.itemSize + k] = attr.getComponent(i, k);
    g.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize));
  }
  if (src.index) g.setIndex(src.index.clone());
  return g;
}

function useInstanceLibrary(url: string) {
  const gltf = useGLTF(url, false, true);
  return useMemo(() => {
    const lib: Record<string, Part[]> = {};
    gltf.scene.updateMatrixWorld(true);
    for (const node of gltf.scene.children) {
      const variant = node.name.replace(/^(veg|prop)_/, "");
      const parts: Part[] = [];
      node.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        // bake the full library transform into the geometry so instances only need their own matrix.
        // Variant nodes sit at the origin, but meshopt quantisation stores a dequantising scale and
        // offset on them, so the node's own matrix must be kept (not just the child offset).
        const g = dequantise(m.geometry);
        g.applyMatrix4(m.matrixWorld);
        const src = m.material as THREE.Material;
        const hasColor = !!g.attributes.color;
        parts.push({ geometry: g, material: isScanned(src) ? scannedMaterial(src, hasColor) : sharedMaterials.get(materialKey(src), hasColor) });
      });
      lib[variant] = parts;
    }
    return lib;
  }, [gltf]);
}

/** Seasonal foliage: mostly summer greens, with golden, amber, orange and russet trees mixed in. */
const SEASONS: Record<string, [string, number][]> = {
  broad: [["#4f9a2c", 20], ["#62ab34", 18], ["#7fb83a", 12], ["#3d8a30", 10], ["#e2b93b", 9], ["#f0c84a", 5], ["#ec8a2a", 9], ["#e0632a", 6], ["#c43d24", 5], ["#a7c94a", 6]],
  conifer: [["#2f6e34", 4], ["#3a7d3c", 4], ["#4a8a40", 2], ["#5a8e3e", 1]],
  bush: [["#4f9530", 10], ["#68a83a", 8], ["#a9b83e", 3], ["#e09a32", 2], ["#c9522a", 2]],
};
const swatch = new THREE.Color();
function foliageColour(it: VegInstance) {
  const set = it.v.startsWith("broad") || it.v === "palm" ? SEASONS.broad : it.v === "bush" ? SEASONS.bush : SEASONS.conifer;
  const h = Math.abs(Math.sin(it.p[0] * 12.9898 + it.p[2] * 78.233 + it.p[1] * 3.1) * 43758.5453) % 1;
  const total = set.reduce((a, [, w]) => a + w, 0);
  let acc = 0;
  for (const [c, w] of set) {
    acc += w / total;
    if (h <= acc) return swatch.set(c);
  }
  return swatch.set(set[0][0]);
}

function VariantInstances({ parts, items, shadows }: { parts: Part[]; items: VegInstance[]; shadows: boolean }) {
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    refs.current.forEach((mesh) => {
      if (!mesh) return;
      const cards = (mesh.material as THREE.Material).name.endsWith("_cards");
      items.forEach((it, i) => {
        p.set(...it.p);
        q.setFromAxisAngle(up, it.r);
        s.setScalar(it.s);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
        if (cards) mesh.setColorAt(i, foliageColour(it));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  }, [items]);
  return (
    <>
      {parts.map((part, k) => (
        <instancedMesh
          key={k}
          ref={(r) => {
            refs.current[k] = r;
          }}
          args={[part.geometry, part.material, items.length]}
          castShadow={shadows}
          receiveShadow
          raycast={() => null}
        />
      ))}
    </>
  );
}

/** Instanced library models: vegetation by default, or the scanned prop library (`model="props"`). */
export function Vegetation({ instances, model = "vegetation" }: { instances: VegInstance[]; model?: "vegetation" | "props" }) {
  const lib = useInstanceLibrary(model === "props" ? PROP_MODEL : VEGETATION_MODEL);
  const byVariant = useMemo(() => {
    const groups: Record<string, VegInstance[]> = {};
    for (const it of instances) (groups[it.v] ??= []).push(it);
    return groups;
  }, [instances]);
  return (
    <group>
      {Object.entries(byVariant).map(([v, items]) =>
        lib[v] ? <VariantInstances key={v} parts={lib[v]} items={items} shadows={model !== "props"} /> : null,
      )}
    </group>
  );
}

const DRAPE_TINTS = ["#62a834", "#74b83c", "#56982f", "#8cc448", "#9bbd44", "#6c9e36"].map((c) => new THREE.Color(c));

/** Greenery hanging over the island rims: library parts placed with full matrices (tilted, flipped). */
export function Drapes({ instances: all }: { instances: CliffInstance[] }) {
  const lib = useInstanceLibrary(VEGETATION_MODEL);
  const low = useWorld((s) => s.quality === "low");
  const instances = useMemo(() => (low ? all.filter((_, i) => i % 2 === 0) : all), [all, low]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const parts = lib.bush ?? [];
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    refs.current.forEach((mesh) => {
      if (!mesh) return;
      instances.forEach((it, i) => {
        mesh.setMatrixAt(i, m.fromArray(it.m));
        const h = Math.abs(Math.sin(it.m[12] * 12.9898 + it.m[14] * 78.233) * 43758.5453) % 1;
        mesh.setColorAt(i, DRAPE_TINTS[Math.floor(h * DRAPE_TINTS.length)]);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  }, [instances, parts]);
  if (!instances.length) return null;
  return (
    <>
      {parts.map((part, k) => (
        <instancedMesh
          key={k}
          ref={(r) => {
            refs.current[k] = r;
          }}
          args={[part.geometry, part.material, instances.length]}
          receiveShadow
          raycast={() => null}
        />
      ))}
    </>
  );
}

useGLTF.preload(VEGETATION_MODEL, false, true);
useGLTF.preload(PROP_MODEL, false, true);
