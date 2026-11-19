"use client";
/** A single island, slowly orbiting, for destination page heroes. Reuses the world's island renderer. */
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import * as THREE from "three";
import { DESTINATION_MAP, type DestinationId } from "@/config/world";
import type { ContentSummary } from "@/lib/content/schema";
import { LighthouseBeam, Lighting, SkyAndEnvironment, WorldClock } from "./Atmosphere";
import { FloatingIsland } from "./FloatingIsland";
import { useWorld } from "./store";

export default function IslandHero({ id, entries }: { id: DestinationId; entries: ContentSummary[] }) {
  const d = DESTINATION_MAP[id];
  const r = d.radius;
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) useWorld.getState().setQuality("low");
  }, []);
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 32, position: [r * 1.6, r * 1.15, r * 2.6], near: 0.3, far: 400 }} gl={{ toneMapping: THREE.ACESFilmicToneMapping }}>
      <WorldClock />
      <SkyAndEnvironment fog={false} />
      <Lighting shadowSize={2048} extent={r * 1.6} />
      <Suspense fallback={null}>
        <group position={[0, -1.2, 0]}>
          <FloatingIsland id={id} entries={entries} local forceHigh showLabel={false} />
          {id === "contact" && (
            <group position={[-d.position[0], -d.position[1], -d.position[2]]}>
              <LighthouseBeam />
            </group>
          )}
        </group>
      </Suspense>
      <OrbitControls autoRotate autoRotateSpeed={0.45} enablePan={false} enableZoom minDistance={r * 1.6} maxDistance={r * 4.5} maxPolarAngle={1.35} target={[0, 0.5, 0]} enableDamping />
    </Canvas>
  );
}
