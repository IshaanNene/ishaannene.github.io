"use client";
/** Golden-hour lighting, sky, environment reflections, fog and clouds. */
import { Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { WORLD_MANIFEST } from "@/config/world";
import { DESTINATION_MAP } from "@/config/world";
import { windUniforms } from "./materials";
import { HAZE_COLOR, PhysicalSky } from "./Scenery";
import { useWorld } from "./store";
import { tickWater } from "./water";

export const SUN_DIR = new THREE.Vector3(-0.62, 0.32, -0.72).normalize();

export function Lighting({ shadowSize = 2048, extent = 48 }: { shadowSize?: number; extent?: number }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();
  useEffect(() => {
    if (sun.current) scene.add(sun.current.target);
  }, [scene]);
  return (
    <>
      <hemisphereLight args={["#ffcfa1", "#3d4a6e", 0.55]} />
      <directionalLight
        ref={sun}
        position={SUN_DIR.clone().multiplyScalar(90).toArray()}
        intensity={4.6}
        color="#ffb174"
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={10}
        shadow-camera-far={200}
      />
      {/* cool rim from the opposite side keeps shadowed faces readable */}
      <directionalLight position={[50, 30, 60]} intensity={0.45} color="#8fa6ff" />
    </>
  );
}

export function SkyAndEnvironment({ fog = true, skyClouds = true }: { fog?: boolean; skyClouds?: boolean }) {
  return (
    <>
      <PhysicalSky clouds={skyClouds} />
      {fog && <fog attach="fog" args={[HAZE_COLOR, 110, 520]} />}
      <Environment resolution={256} frames={1} environmentIntensity={0.9}>
        <PhysicalSky clouds={false} exposure={0.5} />
        <Lightformer form="rect" intensity={5} color="#ffb070" position={SUN_DIR.clone().multiplyScalar(40).toArray()} scale={[60, 14, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#ffd8b8" position={[0, 40, 0]} rotation-x={Math.PI / 2} scale={[80, 80, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#93a8ff" position={[40, 10, 30]} scale={[30, 10, 1]} target={[0, 0, 0]} />
      </Environment>
    </>
  );
}

/** Rotating lighthouse beam + glow on the contact island. */
export function LighthouseBeam() {
  const ext = WORLD_MANIFEST.islands.contact?.extras.lighthouse;
  const pos = DESTINATION_MAP.contact.position;
  const beam = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (beam.current) beam.current.rotation.y += dt * 1.2;
  });
  if (!ext) return null;
  const p: [number, number, number] = [pos[0] + ext[0], pos[1] + ext[1], pos[2] + ext[2]];
  return (
    <group position={p}>
      <pointLight color="#ffc070" intensity={8} distance={14} decay={2} />
      <group ref={beam}>
        {[0, Math.PI].map((r) => (
          <mesh key={r} rotation={[0, r, Math.PI / 2]} position={[Math.cos(r) * 4.2, 0, -Math.sin(r) * 4.2]}>
            <coneGeometry args={[0.7, 8, 24, 1, true]} />
            <meshBasicMaterial color="#ffd9a0" transparent opacity={0.05} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Global time uniforms + throttled shadow updates (static world → re-render shadows at ~12 Hz). */
export function WorldClock() {
  const { gl } = useThree();
  const frame = useRef(0);
  const quality = useWorld((s) => s.quality);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    windUniforms.uTime.value = t;
    tickWater(t);
    frame.current++;
    if (frame.current % (quality === "high" ? 5 : 12) === 0) gl.shadowMap.needsUpdate = true;
  });
  return null;
}
