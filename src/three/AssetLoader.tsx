"use client";
/**
 * AssetLoader — loads Blender GLBs (meshopt-compressed), swaps in the runtime
 * material library, enables BVH-accelerated raycasting and splits the scene
 * into semantic node groups (terrain / foundation / buildings / landmarks /
 * props / water / waterfall / anim_*), mirroring the Blender `Builder` objects.
 */
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import { MaterialSet, materialKey } from "./materials";
import { getWaterMaterial, createWaterfallMaterial } from "./water";

export interface IslandNodes {
  root: THREE.Group;
  terrain: THREE.Object3D[];
  foundation: THREE.Object3D[];
  buildings: THREE.Object3D[];
  landmarks: THREE.Object3D[];
  props: THREE.Object3D[];
  water: THREE.Object3D[];
  waterfalls: THREE.Object3D[];
  anim: THREE.Object3D[];
  other: THREE.Object3D[];
}

const bvhDone = new WeakSet<THREE.BufferGeometry>();

function ensureBVH(geo: THREE.BufferGeometry) {
  if (bvhDone.has(geo)) return;
  bvhDone.add(geo);
  try {
    (geo as THREE.BufferGeometry & { boundsTree?: MeshBVH }).boundsTree = new MeshBVH(geo);
  } catch {
    /* non-indexed edge cases fall back to brute-force raycast */
  }
}

export function prepareObject(
  obj: THREE.Object3D,
  mats: MaterialSet,
  opts: { castShadow?: boolean; receiveShadow?: boolean; raycast?: boolean; waterfallHeight?: number } = {},
) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.Material;
    const key = materialKey(src);
    const hasColor = !!mesh.geometry.attributes.color;
    if (key === "water") {
      mesh.material = opts.waterfallHeight ? createWaterfallMaterial(opts.waterfallHeight) : getWaterMaterial();
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 2;
    } else {
      mesh.material = mats.get(key, hasColor);
      mesh.castShadow = opts.castShadow ?? true;
      mesh.receiveShadow = opts.receiveShadow ?? true;
      if (key === "glass") {
        mesh.castShadow = false;
        mesh.renderOrder = 3;
      }
    }
    if (opts.raycast === false) {
      mesh.raycast = () => {};
    } else {
      ensureBVH(mesh.geometry);
      mesh.raycast = acceleratedRaycast;
    }
  });
}

export function useIslandNodes(url: string, mats: MaterialSet): IslandNodes {
  const gltf = useGLTF(url, false, true);
  return useMemo(() => {
    const root = gltf.scene.clone(true);
    const nodes: IslandNodes = {
      root,
      terrain: [],
      foundation: [],
      buildings: [],
      landmarks: [],
      props: [],
      water: [],
      waterfalls: [],
      anim: [],
      other: [],
    };
    for (const child of [...root.children]) {
      const n = child.name;
      if (n.startsWith("waterfall")) {
        // ribbon height is encoded by its bounding box
        const box = new THREE.Box3().setFromObject(child);
        prepareObject(child, mats, { raycast: false, waterfallHeight: Math.max(1, box.max.y - box.min.y) });
        nodes.waterfalls.push(child);
      } else if (n.startsWith("water")) {
        prepareObject(child, mats, { raycast: true });
        nodes.water.push(child);
      } else if (n.startsWith("anim_")) {
        prepareObject(child, mats);
        nodes.anim.push(child);
      } else if (n.startsWith("terrain")) {
        prepareObject(child, mats, { castShadow: false });
        nodes.terrain.push(child);
      } else if (n.startsWith("foundation")) {
        prepareObject(child, mats, { castShadow: true });
        nodes.foundation.push(child);
      } else if (n.startsWith("buildings")) {
        prepareObject(child, mats);
        nodes.buildings.push(child);
      } else if (n.startsWith("landmarks")) {
        prepareObject(child, mats);
        nodes.landmarks.push(child);
      } else if (n.startsWith("props")) {
        prepareObject(child, mats, { raycast: false });
        nodes.props.push(child);
      } else {
        prepareObject(child, mats);
        nodes.other.push(child);
      }
    }
    return nodes;
  }, [gltf, mats]);
}

export function useBridgeScene(url: string, mats: MaterialSet) {
  const gltf = useGLTF(url, false, true);
  return useMemo(() => {
    const root = gltf.scene.clone(true);
    prepareObject(root, mats, { raycast: false });
    return root;
  }, [gltf, mats]);
}

export function preloadModel(url: string) {
  useGLTF.preload(url, false, true);
}
