"use client";
/**
 * Instanced vegetation. The Blender library (vegetation.glb) holds one node per
 * variant; island manifests hold transforms. One InstancedMesh per
 * (variant × material primitive) per island.
 */
import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { VEGETATION_MODEL, type VegInstance } from "@/config/world";
import { materialKey, sharedMaterials } from "./materials";

interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

function useVegetationLibrary() {
  const gltf = useGLTF(VEGETATION_MODEL, false, true);
  return useMemo(() => {
    const lib: Record<string, Part[]> = {};
    gltf.scene.updateMatrixWorld(true);
    for (const node of gltf.scene.children) {
      const variant = node.name.replace(/^veg_/, "");
      const parts: Part[] = [];
      node.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        // bake the node-local transform into the geometry so instances only need their own matrix
        const g = m.geometry.clone();
        const rel = new THREE.Matrix4().copy(node.matrixWorld).invert().multiply(m.matrixWorld);
        g.applyMatrix4(rel);
        parts.push({ geometry: g, material: sharedMaterials.get(materialKey(m.material as THREE.Material), !!g.attributes.color) });
      });
      lib[variant] = parts;
    }
    return lib;
  }, [gltf]);
}

function VariantInstances({ parts, items }: { parts: Part[]; items: VegInstance[] }) {
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    refs.current.forEach((mesh) => {
      if (!mesh) return;
      items.forEach((it, i) => {
        p.set(...it.p);
        q.setFromAxisAngle(up, it.r);
        s.setScalar(it.s);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
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
          castShadow
          receiveShadow
          raycast={() => null}
        />
      ))}
    </>
  );
}

export function Vegetation({ instances }: { instances: VegInstance[] }) {
  const lib = useVegetationLibrary();
  const byVariant = useMemo(() => {
    const groups: Record<string, VegInstance[]> = {};
    for (const it of instances) (groups[it.v] ??= []).push(it);
    return groups;
  }, [instances]);
  return (
    <group>
      {Object.entries(byVariant).map(([v, items]) =>
        lib[v] ? <VariantInstances key={v} parts={lib[v]} items={items} /> : null,
      )}
    </group>
  );
}

useGLTF.preload(VEGETATION_MODEL, false, true);
