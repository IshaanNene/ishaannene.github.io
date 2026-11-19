"use client";
import { Suspense } from "react";
import { WORLD_MANIFEST } from "@/config/world";
import { useBridgeScene } from "./AssetLoader";
import { sharedMaterials } from "./materials";

/** One Blender-generated bridge (world-space GLB): truss, arch, suspension or rope-plank. */
export function Bridge({ id }: { id: string }) {
  const scene = useBridgeScene(`/models/bridges/${id}.glb`, sharedMaterials);
  return <primitive object={scene} />;
}

export function Bridges() {
  return (
    <>
      {WORLD_MANIFEST.bridges.map((b) => (
        <Suspense key={b.id} fallback={null}>
          <Bridge id={b.id} />
        </Suspense>
      ))}
    </>
  );
}
