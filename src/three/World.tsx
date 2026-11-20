"use client";
/** The homepage archipelago: Canvas root composing every world system. */
import { AdaptiveDpr, PerformanceMonitor, Preload, useProgress } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, SMAA, Vignette } from "@react-three/postprocessing";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { DESTINATIONS } from "@/config/world";
import type { ContentSummary } from "@/lib/content/schema";
import { preloadModel } from "./AssetLoader";
import { LighthouseBeam, Lighting, SkyAndEnvironment, WorldClock } from "./Atmosphere";
import { Airship, CloudBanks, Islets, Ocean } from "./Scenery";
import { Bridges } from "./Bridge";
import { FloatingIsland } from "./FloatingIsland";
import { useWorld } from "./store";
import { DestinationController, WorldCamera, WorldNavigation } from "./WorldCamera";

// low LODs first: the whole archipelago is visible immediately
DESTINATIONS.forEach((d) => preloadModel(d.models.low));

/** Polls the loading manager from the render loop (avoids setState-during-render from loaders). */
function ReadySignal() {
  const frames = useRef(0);
  const since = useRef(0);
  useFrame(() => {
    const { active, progress } = useProgress.getState();
    const st = useWorld.getState();
    if (st.ready) return;
    const now = performance.now();
    if (active || progress < 100) {
      frames.current = 0;
      since.current = now;
      return;
    }
    // a couple of rendered frames (shaders compiled) + a short settle — time-based so a throttled tab doesn't stall
    if (++frames.current >= 3 && now - since.current > 350) st.setReady(true);
  });
  return null;
}

/** Development only: `window.__world` exposes the renderer, scene and camera for inspection. */
function DebugHandle() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __world?: unknown }).__world = { gl, scene, camera, THREE };
  }, [gl, scene, camera]);
  return null;
}

export default function World({ entries }: { entries: ContentSummary[] }) {
  const quality = useWorld((s) => s.quality);
  const setQuality = useWorld((s) => s.setQuality);
  const [dpr, setDpr] = useState<[number, number]>([1, 2]);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 760;
    const lowMem = ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
    if (coarse || lowMem) {
      setQuality("low");
      setDpr([1, 1.5]);
    }
  }, [setQuality]);

  const high = quality === "high";

  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={dpr}
      camera={{ fov: 38, near: 0.5, far: 2500, position: [6, 46, 66] }}
      gl={{ antialias: !high, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      onPointerMissed={() => useWorld.getState().setHovered(null)}
      className="world-canvas"
    >
      <PerformanceMonitor
        onDecline={() => {
          setQuality("low");
          setDpr([1, 1.25]);
        }}
        flipflops={2}
      />
      <AdaptiveDpr pixelated={false} />
      <WorldClock />
      <SkyAndEnvironment />
      <Lighting shadowSize={high ? 2048 : 1024} />
      <Suspense fallback={null}>
        {DESTINATIONS.map((d) => (
          <FloatingIsland key={d.id} id={d.id} entries={entries} />
        ))}
        <Bridges />
        <LighthouseBeam />
        <Ocean reflective={high} />
        <CloudBanks detail={high ? 2 : 1} />
        <Islets />
        <Airship />
        <Preload />
      </Suspense>
      <WorldCamera />
      <DestinationController />
      <WorldNavigation />
      <ReadySignal />
      <DebugHandle />
      {high && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <SMAA />
          <Bloom luminanceThreshold={1.0} intensity={0.55} mipmapBlur radius={0.6} />
          <Vignette offset={0.28} darkness={0.42} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
