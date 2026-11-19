"use client";
/** Golden-hour lighting, sky, environment reflections, fog and clouds. */
import { Cloud, Clouds, Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { WORLD_MANIFEST } from "@/config/world";
import { DESTINATION_MAP } from "@/config/world";
import { windUniforms } from "./materials";
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

/** Golden-hour gradient dome with a soft sun glow (cheaper and more art-directable than a physical sky). */
function SkyDome() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uSun: { value: SUN_DIR } },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uSun;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 zenith = vec3(0.27, 0.33, 0.56);
            vec3 upper = vec3(0.62, 0.55, 0.70);
            vec3 horizon = vec3(1.0, 0.66, 0.45);
            vec3 below = vec3(0.86, 0.62, 0.58);
            vec3 col = h > 0.0
              ? mix(mix(horizon, upper, smoothstep(0.0, 0.25, h)), zenith, smoothstep(0.25, 0.85, h))
              : mix(horizon, below, smoothstep(0.0, -0.35, h));
            float s = max(dot(d, normalize(uSun)), 0.0);
            col += vec3(1.0, 0.55, 0.25) * pow(s, 6.0) * 0.55;
            col += vec3(1.0, 0.85, 0.6) * pow(s, 180.0) * 2.5;
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    [],
  );
  return (
    <mesh material={mat} scale={500} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[1, 48, 24]} />
    </mesh>
  );
}

export function SkyAndEnvironment({ fog = true }: { fog?: boolean }) {
  return (
    <>
      <SkyDome />
      {fog && <fog attach="fog" args={["#efae86", 80, 260]} />}
      <Environment resolution={256} frames={1} environmentIntensity={0.85}>
        <mesh scale={100}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial side={THREE.BackSide} color="#6a6f9a" />
        </mesh>
        <Lightformer form="rect" intensity={6} color="#ffb070" position={SUN_DIR.clone().multiplyScalar(40).toArray()} scale={[60, 14, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.6} color="#ffd8b8" position={[0, 40, 0]} rotation-x={Math.PI / 2} scale={[80, 80, 1]} />
        <Lightformer form="ring" intensity={1.2} color="#ff8a5c" position={[30, 6, 40]} scale={14} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.8} color="#93a8ff" position={[40, 10, 30]} scale={[30, 10, 1]} target={[0, 0, 0]} />
      </Environment>
    </>
  );
}

export function WorldClouds({ count = 1 }: { count?: number }) {
  if (count <= 0) return null;
  return (
    <Clouds texture="/textures/cloud.png" limit={200} material={THREE.MeshBasicMaterial}>
      {/* sea of clouds beneath the archipelago */}
      <Cloud seed={2} position={[0, -16, 0]} bounds={[70, 3, 60]} segments={count > 1 ? 60 : 30} volume={28} color="#f6d9c4" opacity={0.9} speed={0.05} fade={60} />
      <Cloud seed={5} position={[-20, -11, -20]} bounds={[30, 2, 20]} segments={count > 1 ? 18 : 8} volume={12} color="#ffe6d2" opacity={0.7} speed={0.08} />
      <Cloud seed={8} position={[24, -10, 18]} bounds={[26, 2, 18]} segments={count > 1 ? 18 : 8} volume={12} color="#ffe2c9" opacity={0.7} speed={0.08} />
      {/* high wisps */}
      {count > 1 && (
        <>
          <Cloud seed={11} position={[-40, 16, -55]} bounds={[24, 3, 6]} segments={14} volume={10} color="#ffd2b0" opacity={0.65} speed={0.1} />
          <Cloud seed={13} position={[48, 12, -40]} bounds={[22, 2, 6]} segments={12} volume={9} color="#ffcaa6" opacity={0.6} speed={0.1} />
          <Cloud seed={17} position={[0, 20, -80]} bounds={[50, 3, 8]} segments={16} volume={14} color="#ffc69e" opacity={0.55} speed={0.06} />
        </>
      )}
    </Clouds>
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
