"use client";
/**
 * Scenery around the archipelago: physical sunset sky, a reflective ocean far
 * below, sun-lit cloud banks, small floating islets and a drifting airship.
 * Built from three.js' bundled Sky / Water objects plus runtime geometry.
 */
import { Cloud, Clouds, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { Water } from "three/examples/jsm/objects/Water.js";
import { VEGETATION_MODEL } from "@/config/world";
import { prepareObject } from "./AssetLoader";
import { getTexture, sharedMaterials } from "./materials";

/** The visible sun sits lower on the horizon than the key light (art-directed golden hour). */
export const SUN_SKY_DIR = new THREE.Vector3(-0.64, 0.085, -0.76).normalize();
export const OCEAN_Y = -34;
/** Scene fog / horizon haze colour (sRGB). */
export const HAZE_COLOR = "#e7ab84";

function makeSky(withClouds: boolean, exposure: number) {
  const sky = new Sky();
  sky.scale.setScalar(4000);
  sky.frustumCulled = false;
  const u = sky.material.uniforms;
  u.turbidity.value = 7;
  u.rayleigh.value = 2.4;
  u.mieCoefficient.value = 0.006;
  u.mieDirectionalG.value = 0.86;
  u.sunPosition.value.copy(SUN_SKY_DIR);
  if (u.cloudCoverage) {
    u.cloudCoverage.value = withClouds ? 0.42 : 0;
    u.cloudDensity.value = 0.5;
    u.cloudScale.value = 0.00028;
    u.cloudElevation.value = 0.42;
  }
  // scale the radiance so the sky sits under ACES without blowing out, and melt the horizon
  // (and everything below it) into the scene fog so distant geometry never shows a hard edge
  const haze = new THREE.Color(HAZE_COLOR);
  sky.material.onBeforeCompile = (shader) => {
    shader.uniforms.uHaze = { value: haze };
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform vec3 uHaze;\nvoid main() {")
      .replace(
        "gl_FragColor = vec4( texColor, 1.0 );",
        `vec3 skyc = texColor * ${exposure.toFixed(3)};
        float haze = 1.0 - smoothstep( -0.015, 0.16, direction.y );
        gl_FragColor = vec4( mix( skyc, uHaze, haze * haze * 0.92 + step( direction.y, -0.015 ) * 0.08 ), 1.0 );`,
      );
  };
  sky.material.customProgramCacheKey = () => `sky-${exposure}`;
  return sky;
}

export function PhysicalSky({ clouds = true, exposure = 0.62 }: { clouds?: boolean; exposure?: number }) {
  const sky = useMemo(() => makeSky(clouds, exposure), [clouds, exposure]);
  useEffect(() => () => sky.material.dispose(), [sky]);
  useFrame((_, dt) => {
    const u = sky.material.uniforms;
    if (u.time) u.time.value += dt * 40;
  });
  return <primitive object={sky} renderOrder={-10} />;
}

/** Ocean far below. High quality uses three's planar-reflection Water; low uses a cheap env-mapped plane. */
export function Ocean({ reflective }: { reflective: boolean }) {
  const water = useMemo(() => {
    if (!reflective) return null;
    const normals = getTexture("water", "normal")!;
    const w = new Water(new THREE.PlaneGeometry(2400, 2400), {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: normals,
      sunDirection: SUN_SKY_DIR.clone(),
      sunColor: 0xffc58a,
      waterColor: 0x2f5f80,
      distortionScale: 2.4,
      fog: true,
    });
    w.rotation.x = -Math.PI / 2;
    w.position.y = OCEAN_Y;
    const u = w.material.uniforms;
    u.size.value = 1.6;
    u.alpha.value = 1;
    return w;
  }, [reflective]);
  useEffect(() => () => water?.material.dispose(), [water]);
  useFrame((_, dt) => {
    if (water) water.material.uniforms.time.value += dt * 0.4;
  });
  if (water) return <primitive object={water} />;
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={OCEAN_Y}>
      <planeGeometry args={[2400, 2400]} />
      <meshStandardMaterial color="#5a87a6" roughness={0.08} metalness={0.1} envMapIntensity={2.4} />
    </mesh>
  );
}

/** Lit cumulus: a soft sea of cloud between islands and ocean, plus big banks on the horizon. */
export function CloudBanks({ detail = 1 }: { detail?: number }) {
  const hi = detail > 1;
  const ring = useMemo(() => {
    const out: { p: [number, number, number]; s: number; seed: number }[] = [];
    const n = hi ? 11 : 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4;
      const r = 120 + ((i * 37) % 50);
      out.push({ p: [Math.cos(a) * r, -14 + ((i * 13) % 18), Math.sin(a) * r], s: 1 + ((i * 7) % 5) * 0.18, seed: 30 + i });
    }
    return out;
  }, [hi]);
  return (
    <Clouds texture="/textures/cloud.png" limit={hi ? 420 : 200} material={THREE.MeshLambertMaterial}>
      {/* broken sea of cloud just above the ocean: gaps let the water show through */}
      <Cloud seed={2} position={[0, -24, 0]} bounds={[90, 3, 80]} segments={hi ? 70 : 34} volume={30} color="#fff1e4" opacity={0.85} speed={0.04} fade={12} growth={6} />
      <Cloud seed={5} position={[-26, -15, -18]} bounds={[26, 2.5, 16]} segments={hi ? 22 : 10} volume={11} color="#fff4ea" opacity={0.8} speed={0.07} />
      <Cloud seed={8} position={[26, -16, 22]} bounds={[24, 2.5, 16]} segments={hi ? 22 : 10} volume={11} color="#fff4ea" opacity={0.8} speed={0.07} />
      <Cloud seed={9} position={[6, -18, -40]} bounds={[30, 2.5, 10]} segments={hi ? 18 : 8} volume={10} color="#fff4ea" opacity={0.75} speed={0.06} />
      {ring.map((c) => (
        <Cloud key={c.seed} seed={c.seed} position={c.p} bounds={[28 * c.s, 10 * c.s, 14 * c.s]} segments={hi ? 26 : 12} volume={26 * c.s} color="#ffe9d6" opacity={0.95} speed={0.03} fade={20} />
      ))}
    </Clouds>
  );
}

/* ---------------------------------------------------------------- islets */

function rand(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** Irregular inverted-cone rock with a domed grass cap. */
function makeIsletGeometry(seed: number, radius: number) {
  const r = rand(seed);
  const rock = new THREE.ConeGeometry(radius, radius * (1.0 + r() * 0.6), 10, 5, false);
  rock.rotateX(Math.PI);
  const pos = rock.attributes.position;
  const v = new THREE.Vector3();
  const h = (rock.parameters as { height: number }).height;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 0.75 + 0.5 * Math.abs(Math.sin(v.x * 3.1 + seed) * Math.cos(v.z * 2.7 + v.y * 1.3));
    if (v.y < h / 2 - 0.01) {
      v.x *= k;
      v.z *= k;
    }
    v.y += Math.sin(v.x * 2.3 + v.z * 1.7 + seed) * 0.12 * radius;
    pos.setXYZ(i, v.x, v.y - h / 2, v.z);
  }
  rock.computeVertexNormals();
  const top = new THREE.SphereGeometry(radius * 1.04, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  top.scale(1, 0.28, 1);
  return { rock, top };
}

const ISLETS: { p: [number, number, number]; r: number; trees: number }[] = [
  { p: [-48, 4, 12], r: 2.2, trees: 2 },
  { p: [44, 7, -22], r: 1.8, trees: 1 },
  { p: [-6, -7, 40], r: 2.6, trees: 3 },
  { p: [38, -9, 38], r: 1.5, trees: 1 },
  { p: [-40, -6, -36], r: 2.0, trees: 2 },
  { p: [2, 9, -46], r: 1.3, trees: 1 },
  { p: [56, 1, 6], r: 1.1, trees: 0 },
  { p: [-58, -10, -8], r: 1.6, trees: 1 },
  { p: [24, 12, -46], r: 0.9, trees: 0 },
  { p: [-28, 10, 34], r: 1.0, trees: 0 },
  { p: [62, -12, -30], r: 2.4, trees: 2 },
  { p: [-66, 2, 30], r: 1.9, trees: 1 },
];

export function Islets() {
  const veg = useGLTF(VEGETATION_MODEL, false, true);
  const group = useRef<THREE.Group>(null);
  const items = useMemo(() => {
    const rockMat = sharedMaterials.get("cliff_stone_mid", false);
    const grassMat = sharedMaterials.get("grass", false);
    const kinds = ["conifer", "broad_a", "cypress", "broad_b"];
    return ISLETS.map((s, i) => {
      const { rock, top } = makeIsletGeometry(17 + i * 31, s.r);
      const g = new THREE.Group();
      const m1 = new THREE.Mesh(rock, rockMat);
      const m2 = new THREE.Mesh(top, grassMat);
      m1.castShadow = m2.receiveShadow = true;
      g.add(m1, m2);
      for (let t = 0; t < s.trees; t++) {
        const kind = kinds[(i + t) % kinds.length];
        const src = veg.scene.getObjectByName(`veg_${kind}`) ?? veg.scene.getObjectByName(kind);
        if (!src) continue;
        const tree = src.clone(true);
        tree.position.set(0, 0, 0);
        prepareObject(tree, sharedMaterials, { raycast: false });
        const a = t * 2.3 + i;
        const d = s.trees > 1 ? s.r * 0.45 : 0;
        tree.position.set(Math.cos(a) * d, s.r * 0.12, Math.sin(a) * d);
        tree.scale.setScalar(0.45 + s.r * 0.12);
        g.add(tree);
      }
      g.position.set(...s.p);
      g.rotation.y = i * 1.7;
      return { g, base: s.p[1], phase: i * 0.9 };
    });
  }, [veg]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (const it of items) it.g.position.y = it.base + Math.sin(t * 0.35 + it.phase) * 0.35;
  });
  return (
    <group ref={group}>
      {items.map((it, i) => (
        <primitive key={i} object={it.g} />
      ))}
    </group>
  );
}

/* --------------------------------------------------------------- airship */

export function Airship() {
  const ref = useRef<THREE.Group>(null);
  const prop = useRef<THREE.Mesh>(null);
  const hull = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push(new THREE.Vector2(Math.sin(Math.PI * t) ** 0.8 * 1.6 * (1 - 0.25 * t), (t - 0.5) * 9));
    }
    const g = new THREE.LatheGeometry(pts, 28);
    g.rotateZ(Math.PI / 2);
    return g;
  }, []);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime * 0.018 + 2.2;
    if (ref.current) {
      ref.current.position.set(Math.cos(t) * 78, 24 + Math.sin(t * 3) * 1.2, Math.sin(t) * 62 - 10);
      // nose is local +X (fins and propeller at -X): yaw it along the velocity of the ellipse
      const vx = -Math.sin(t) * 78;
      const vz = Math.cos(t) * 62;
      ref.current.rotation.y = Math.atan2(-vz, vx);
    }
    if (prop.current) prop.current.rotation.x += dt * 12;
  });
  return (
    <group ref={ref} scale={0.9}>
      <mesh geometry={hull} castShadow>
        <meshStandardMaterial color="#efe6d8" roughness={0.7} />
      </mesh>
      {/* coloured bands */}
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[1.58, 1.58, 0.35, 28, 1, true]} />
          <meshStandardMaterial color="#FF7043" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* tail fins */}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r) => (
        <mesh key={r} position={[-3.9, 0, 0]} rotation-x={r}>
          <boxGeometry args={[1.4, 0.06, 2.2]} />
          <meshStandardMaterial color="#477BFF" roughness={0.6} />
        </mesh>
      ))}
      {/* gondola */}
      <mesh position={[0.3, -1.85, 0]} castShadow>
        <boxGeometry args={[2.2, 0.55, 0.7]} />
        <meshStandardMaterial color="#5f3f29" roughness={0.8} />
      </mesh>
      <mesh position={[0.3, -1.7, 0]}>
        <boxGeometry args={[1.6, 0.18, 0.72]} />
        <meshStandardMaterial color="#FFC979" emissive="#FFB45E" emissiveIntensity={1.2} />
      </mesh>
      <mesh ref={prop} position={[-1.1, -1.85, 0]}>
        <boxGeometry args={[0.04, 0.9, 0.08]} />
        <meshStandardMaterial color="#2a2a2e" />
      </mesh>
    </group>
  );
}

/* ----------------------------------------------- waterfall drops & mist */

/**
 * Extends each island waterfall all the way down past the rock and finishes it
 * in a mist plume — the falls in the GLB only cover the cliff edge.
 */
export function FallDrop({ fall, islandY }: { fall: THREE.Object3D; islandY: number }) {
  const data = useMemo(() => {
    fall.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(fall);
    // box is in the island-local space of the cloned scene (root sits at the island origin)
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const width = Math.max(0.6, Math.max(size.x, size.z) * 0.85);
    const out = new THREE.Vector2(c.x, c.z).normalize();
    const drop = Math.max(10, box.min.y + islandY - (OCEAN_Y + 10));
    return { top: box.min.y + 0.3, x: c.x + out.x * 0.15, z: c.z + out.y * 0.15, width, rotY: Math.atan2(out.x, out.y), drop };
  }, [fall, islandY]);
  const mat = useMemo(() => createDropMaterial(data.drop), [data.drop]);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <group position={[data.x, data.top, data.z]} rotation-y={data.rotY}>
      <mesh position-y={-data.drop / 2} material={mat} renderOrder={2}>
        <planeGeometry args={[data.width, data.drop, 1, 16]} />
      </mesh>
      <Cloud position={[0, -data.drop * 0.62, 0]} seed={Math.round(data.x * 10)} bounds={[data.width * 1.6, 2.4, data.width * 1.6]} segments={6} volume={4} color="#ffffff" opacity={0.55} speed={0.6} fade={30} />
    </group>
  );
}

function createDropMaterial(height: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    uniforms: { uTime: { value: 0 }, uHeight: { value: height }, ...THREE.UniformsLib.fog },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        // the stream widens and frays as it falls
        p.x *= 1.0 + (1.0 - uv.y) * 0.9;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uHeight;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      void main() {
        float fall = 1.0 - vUv.y;
        float y = vUv.y * uHeight;
        float streak = noise(vec2(vUv.x * 14.0, y * 0.7 + uTime * 4.0));
        streak = smoothstep(0.3, 0.95, streak);
        float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        float alpha = (0.35 + streak * 0.5) * edge * (1.0 - smoothstep(0.35, 1.0, fall)) * smoothstep(0.0, 0.04, vUv.y + 0.02);
        vec3 col = mix(vec3(0.55, 0.75, 0.88), vec3(1.0, 0.97, 0.92), 0.55 + streak * 0.45);
        col += vec3(0.2, 0.08, 0.0) * 0.4;
        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }`,
  });
}
