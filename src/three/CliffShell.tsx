"use client";
/**
 * Scanned rock cliffs wrapped around each island's underside (CC0 Poly Haven scans, see
 * scripts/blender/build_cliffs.py; placements from generate_islands.place_cliffs). One instanced
 * draw per piece variant per island. The shader brings every scan to one warm sandstone tone
 * (normalised by the albedo mean stored on each material), grows moss on up-facing ledges and
 * keeps the scan's own detail.
 */
import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CLIFF_MODEL, type CliffInstance } from "@/config/world";
import { dequantise } from "./Vegetation";

const SANDSTONE = new THREE.Color("#a27a55"); // target albedo (sRGB) for every scan
const MOSS = new THREE.Color("#58782a");

const matCache = new Map<string, THREE.MeshStandardMaterial>();

function cliffMaterial(src: THREE.MeshStandardMaterial) {
  let m = matCache.get(src.name);
  if (m) return m;
  const mean = (src.userData?.meanRGB as number[] | undefined) ?? [0.12, 0.09, 0.06];
  m = new THREE.MeshStandardMaterial({
    map: src.map,
    normalMap: src.normalMap,
    roughnessMap: src.roughnessMap,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  m.normalScale.set(1.4, 1.4);
  m.name = src.name;
  const uMean = { value: new THREE.Vector3(...mean) };
  const uTarget = { value: new THREE.Vector3(SANDSTONE.r, SANDSTONE.g, SANDSTONE.b) };
  const uMoss = { value: new THREE.Vector3(MOSS.r, MOSS.g, MOSS.b) };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uMean = uMean;
    shader.uniforms.uTarget = uTarget;
    shader.uniforms.uMoss = uMoss;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uMean; uniform vec3 uTarget; uniform vec3 uMoss;\nfloat rockLum;")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec3 rn = diffuseColor.rgb / max(uMean, vec3(0.005));
        rockLum = dot(rn, vec3(0.2126, 0.7152, 0.0722));
        // a little extra contrast so strata and cracks read at island scale
        rn = pow(max(rn, vec3(0.0)), vec3(1.35));
        diffuseColor.rgb = mix(rn, vec3(dot(rn, vec3(0.2126, 0.7152, 0.0722))), 0.5) * uTarget;`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        vec3 wN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
        float moss = smoothstep(0.22, 0.7, wN.y) * smoothstep(0.35, 0.95, rockLum);
        diffuseColor.rgb = mix(diffuseColor.rgb, uMoss * (0.6 + 0.5 * rockLum), clamp(moss * 1.2, 0.0, 0.9));
        diffuseColor.rgb *= mix(0.5, 1.0, smoothstep(-0.7, 0.2, wN.y));`,
      );
  };
  m.customProgramCacheKey = () => "cliff-scan";
  matCache.set(src.name, m);
  return m;
}

function useCliffLibrary() {
  const gltf = useGLTF(CLIFF_MODEL, false, true);
  return useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    const lib: Record<string, { geometry: THREE.BufferGeometry; material: THREE.Material }> = {};
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const g = dequantise(mesh.geometry).applyMatrix4(mesh.matrixWorld);
      g.computeBoundingSphere();
      lib[mesh.name] = { geometry: g, material: cliffMaterial(mesh.material as THREE.MeshStandardMaterial) };
    });
    return lib;
  }, [gltf]);
}

function Pieces({ part, items }: { part: { geometry: THREE.BufferGeometry; material: THREE.Material }; items: CliffInstance[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    items.forEach((it, i) => mesh.setMatrixAt(i, m.fromArray(it.m)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[part.geometry, part.material, items.length]} receiveShadow castShadow={false} raycast={() => null} />;
}

export function CliffShell({ instances }: { instances: CliffInstance[] }) {
  const lib = useCliffLibrary();
  const byVariant = useMemo(() => {
    const g: Record<string, CliffInstance[]> = {};
    for (const it of instances) (g[it.v] ??= []).push(it);
    return g;
  }, [instances]);
  return (
    <group>
      {Object.entries(byVariant).map(([v, items]) => (lib[v] ? <Pieces key={v} part={lib[v]} items={items} /> : null))}
    </group>
  );
}

useGLTF.preload(CLIFF_MODEL, false, true);
