"use client";
/**
 * Organic detail for content objects: chipped stone/concrete blocks, grass fur
 * grown over any mesh (e.g. 3D lettering), and a flickering torch.
 */
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { useWorld } from "../store";
import { windUniforms } from "../materials";

function hash3(x: number, y: number, z: number, seed: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 4.1) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * A box with irregular, chipped edges: vertices near edges are pushed inward by
 * noise, faces get a slight wobble. `keepFront` leaves the +Z face flat so
 * lettering sits cleanly on it.
 */
export function chippedBox(w: number, h: number, d: number, seed = 1, amount = 0.06, keepFront = true) {
  const g = new THREE.BoxGeometry(w, h, d, Math.max(4, Math.round(w * 10)), Math.max(4, Math.round(h * 10)), Math.max(2, Math.round(d * 8)));
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const ex = Math.abs(Math.abs(v.x) - w / 2) < 1e-4;
    const ey = Math.abs(Math.abs(v.y) - h / 2) < 1e-4;
    const ez = Math.abs(Math.abs(v.z) - d / 2) < 1e-4;
    const edges = Number(ex) + Number(ey) + Number(ez);
    const n = hash3(Math.round(v.x * 9), Math.round(v.y * 9), Math.round(v.z * 9), seed);
    const n2 = hash3(Math.round(v.x * 3), Math.round(v.y * 3), Math.round(v.z * 3), seed + 7);
    const chip = edges >= 2 ? amount * (0.4 + n * 0.9 + n2 * 0.8) : amount * 0.18 * n;
    const frontFlat = keepFront && v.z > d / 2 - 1e-4 && edges < 2;
    if (frontFlat) continue;
    // push towards the centre — rounds and chips the edges
    const dir = v.clone().multiply(new THREE.Vector3(1 / w, 1 / h, 1 / d)).normalize();
    v.addScaledVector(dir, -chip);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------ grass fur */

const bladeMaterial = (() => {
  if (typeof window === "undefined") return null as unknown as THREE.MeshStandardMaterial;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec3 ip = instanceMatrix[3].xyz;
        float k = position.y * position.y;
        transformed.x += sin(uTime * 2.1 + ip.x * 9.0 + ip.y * 4.0) * 0.35 * k;
        transformed.z += cos(uTime * 1.7 + ip.z * 8.0) * 0.25 * k;`,
      );
  };
  m.customProgramCacheKey = () => "grass-blade";
  return m;
})();

/** One tapered blade, 1 unit tall, coloured dark at the root to bright tip. */
function bladeGeometry() {
  const g = new THREE.BufferGeometry();
  const segs = 3;
  const pos: number[] = [];
  const col: number[] = [];
  const root = new THREE.Color("#3f6e22");
  const tip = new THREE.Color("#c4ec78");
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const wdt = 0.09 * (1 - t) + 0.005;
    const bend = t * t * 0.18;
    pos.push(-wdt, t, bend, wdt, t, bend);
    const c = root.clone().lerp(tip, t);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
  }
  const idx: number[] = [];
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

let sharedBlade: THREE.BufferGeometry | null = null;

/**
 * Grows instanced grass blades over the surface of `target` (sampled with
 * three's MeshSurfaceSampler). Blades follow the surface normal, sway in the wind.
 */
export function GrassFur({ target, length = 0.08, density = 900 }: { target: React.RefObject<THREE.Mesh | null>; length?: number; density?: number }) {
  const quality = useWorld((s) => s.quality);
  const [mesh, setMesh] = useState<THREE.InstancedMesh | null>(null);
  useLayoutEffect(() => {
    const src = target.current;
    if (!src || !src.geometry?.attributes.position) return;
    sharedBlade ??= bladeGeometry();
    src.geometry.computeBoundingBox();
    const area = (() => {
      const s = new THREE.Vector3();
      src.geometry.boundingBox!.getSize(s);
      return Math.max(0.05, s.x * s.y * 2 + s.x * s.z * 2);
    })();
    const count = Math.min(9000, Math.round(area * density * (quality === "high" ? 1 : 0.55)));
    const sampler = new MeshSurfaceSampler(src).build();
    const im = new THREE.InstancedMesh(sharedBlade, bladeMaterial, count);
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const m = new THREE.Matrix4();
    const tilt = new THREE.Quaternion();
    for (let i = 0; i < count; i++) {
      sampler.sample(p, n);
      // blades lean outward from the surface but bias upward (gravity / light)
      n.lerp(up, 0.35).normalize();
      q.setFromUnitVectors(up, n);
      tilt.setFromAxisAngle(up, Math.random() * Math.PI * 2);
      q.multiply(tilt);
      const l = length * (0.6 + Math.random() * 0.8);
      m.compose(p, q, new THREE.Vector3(l * 0.9, l, l * 0.9));
      im.setMatrixAt(i, m);
    }
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = false;
    im.receiveShadow = true;
    im.raycast = () => {};
    setMesh(im);
    return () => {
      im.dispose();
      setMesh(null);
    };
  }, [target, length, density, quality]);
  return mesh ? <primitive object={mesh} /> : null;
}

/* ---------------------------------------------------------------- torch */

const flameMaterial = (() => {
  if (typeof window === "undefined") return null as unknown as THREE.ShaderMaterial;
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: windUniforms.uTime },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float t = uv.y;
        p.x += sin(uTime * 9.0 + t * 6.0) * 0.03 * t;
        p.z += cos(uTime * 7.0 + t * 5.0) * 0.03 * t;
        p.y *= 1.0 + sin(uTime * 13.0) * 0.08;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        float t = vUv.y;
        vec3 core = vec3(1.0, 0.92, 0.6);
        vec3 outer = vec3(1.0, 0.42, 0.08);
        vec3 col = mix(core, outer, smoothstep(0.1, 0.8, t));
        float a = (1.0 - t) * 0.9;
        gl_FragColor = vec4(col * 2.2, a);
      }`,
  });
})();

/** Wooden torch with an iron cup, animated flame and (optionally) a flickering light. */
export function Torch({ position, light = false }: { position: [number, number, number]; light?: boolean }) {
  const lamp = useRef<THREE.PointLight>(null);
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: "#5a3a22", roughness: 0.9 }), []);
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a2724", roughness: 0.6, metalness: 0.7 }), []);
  useFrame(({ clock }) => {
    if (lamp.current) lamp.current.intensity = 2.2 + Math.sin(clock.elapsedTime * 11) * 0.4 + Math.sin(clock.elapsedTime * 23) * 0.25;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]} material={wood} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 1.0, 7]} />
      </mesh>
      <mesh position={[0, 1.04, 0]} material={iron} castShadow>
        <cylinderGeometry args={[0.09, 0.05, 0.12, 8, 1, true]} />
      </mesh>
      <mesh position={[0, 1.22, 0]} material={flameMaterial} renderOrder={4}>
        <coneGeometry args={[0.075, 0.32, 10, 4, true]} />
      </mesh>
      <mesh position={[0, 1.16, 0]} material={flameMaterial} renderOrder={4} scale={[0.6, 0.6, 0.6]}>
        <sphereGeometry args={[0.1, 10, 8]} />
      </mesh>
      {light && <pointLight ref={lamp} position={[0, 1.3, 0.1]} color="#ff9a45" intensity={2.2} distance={4} decay={2} />}
    </group>
  );
}
