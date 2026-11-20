"use client";
/**
 * Procedural geometry for each content shape preset (src/presets/shapes.ts).
 * A shape draws the physical body; MaterialContentObject places the lettering
 * on the shape's declared text area. Register new shapes in SHAPES below.
 */
import { RoundedBox, useGLTF } from "@react-three/drei";
import { useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { prepareObject } from "../AssetLoader";
import { sharedMaterials } from "../materials";
import { plinthMaterial } from "./contentMaterials";
import { chippedBox, Torch } from "./organic";

export interface ShapeProps {
  body: THREE.Material;
  accent: THREE.Material;
  plinth: THREE.Material;
  modelPath?: string;
  /** stable per-entry seed for organic variation */
  seed?: number;
}

const shadow = { castShadow: true, receiveShadow: true };

function Slab({ body, plinth }: ShapeProps) {
  return (
    <group>
      <RoundedBox args={[1.5, 0.16, 0.5]} radius={0.03} position={[0, 0.08, 0]} material={plinth} {...shadow} />
      <RoundedBox args={[1.3, 1.5, 0.28]} radius={0.05} smoothness={3} position={[0, 0.9, 0]} material={body} {...shadow} />
    </group>
  );
}

function Monument({ body, plinth, accent }: ShapeProps) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]} material={plinth} {...shadow}>
        <boxGeometry args={[1.1, 0.2, 1.1]} />
      </mesh>
      <mesh position={[0, 0.27, 0]} material={body} {...shadow}>
        <boxGeometry args={[0.9, 0.14, 0.9]} />
      </mesh>
      <RoundedBox args={[0.76, 1.65, 0.76]} radius={0.02} position={[0, 1.16, 0]} material={body} {...shadow} />
      <mesh position={[0, 2.16, 0]} rotation={[0, Math.PI / 4, 0]} material={body} {...shadow}>
        <coneGeometry args={[0.54, 0.36, 4]} />
      </mesh>
      <mesh position={[0, 1.94, 0.385]} material={accent}>
        <boxGeometry args={[0.5, 0.04, 0.01]} />
      </mesh>
    </group>
  );
}

function Signboard({ body }: ShapeProps) {
  return (
    <group>
      {[-0.66, 0.66].map((x) => (
        <mesh key={x} position={[x, 0.8, -0.02]} material={body} {...shadow}>
          <boxGeometry args={[0.1, 1.6, 0.1]} />
        </mesh>
      ))}
      <RoundedBox args={[1.5, 0.78, 0.08]} radius={0.02} position={[0, 1.16, 0.02]} material={body} {...shadow} />
      <mesh position={[0, 1.62, 0]} rotation={[0.25, 0, 0]} material={body} {...shadow}>
        <boxGeometry args={[1.62, 0.05, 0.28]} />
      </mesh>
    </group>
  );
}

function Plaque({ body, plinth }: ShapeProps) {
  return (
    <group>
      <mesh position={[0, 0.35, -0.04]} material={plinth} {...shadow}>
        <boxGeometry args={[1.05, 0.7, 0.45]} />
      </mesh>
      <mesh position={[0, 0.79, 0.01]} rotation={[-0.5, 0, 0]} material={plinth} {...shadow}>
        <boxGeometry args={[1.05, 0.06, 0.52]} />
      </mesh>
      <group position={[0, 0.86, 0.02]} rotation={[-0.5, 0, 0]}>
        <RoundedBox args={[0.96, 0.46, 0.04]} radius={0.01} position={[0, 0, 0.015]} material={body} {...shadow} />
      </group>
    </group>
  );
}

function Book({ body, plinth }: ShapeProps) {
  const paper = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f6f1e7", roughness: 0.95 }), []);
  return (
    <group>
      <mesh position={[0, 0.22, 0]} material={plinth} {...shadow}>
        <boxGeometry args={[1.3, 0.44, 0.75]} />
      </mesh>
      <group position={[0, 0.5, 0]} rotation={[-0.32, 0, 0]}>
        {[-1, 1].map((s) => (
          <group key={s} rotation={[0, 0, s * -0.08]}>
            <mesh position={[s * 0.33, 0.0, 0]} material={body} {...shadow}>
              <boxGeometry args={[0.66, 0.04, 0.9]} />
            </mesh>
            <mesh position={[s * 0.31, 0.07, 0]} material={paper} {...shadow}>
              <boxGeometry args={[0.6, 0.1, 0.84]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]} material={body} {...shadow}>
          <cylinderGeometry args={[0.05, 0.05, 0.9, 12]} />
        </mesh>
      </group>
    </group>
  );
}

function Installation({ body, accent }: ShapeProps) {
  return (
    <group>
      {[-0.72, 0.72].map((x) => (
        <mesh key={x} position={[x, 0.75, 0]} material={body} {...shadow}>
          <boxGeometry args={[0.2, 1.5, 0.5]} />
        </mesh>
      ))}
      <mesh position={[0, 1.42, 0]} material={body} {...shadow}>
        <boxGeometry args={[1.7, 0.18, 0.55]} />
      </mesh>
      <mesh position={[0, 0.82, -0.05]} material={body} {...shadow}>
        <boxGeometry args={[1.26, 0.9, 0.12]} />
      </mesh>
      <mesh position={[0, 0.05, 0]} material={body} {...shadow}>
        <boxGeometry args={[1.8, 0.1, 0.62]} />
      </mesh>
      <mesh position={[0, 1.335, 0.282]} material={accent}>
        <boxGeometry args={[1.0, 0.03, 0.01]} />
      </mesh>
    </group>
  );
}

function GlassPanel({ body }: ShapeProps) {
  const metal = sharedMaterials.get("metal", false);
  return (
    <group>
      <mesh position={[0, 0.08, 0]} material={metal} {...shadow}>
        <boxGeometry args={[1.35, 0.16, 0.34]} />
      </mesh>
      {[-0.63, 0.63].map((x) => (
        <mesh key={x} position={[x, 0.95, 0]} material={metal} {...shadow}>
          <boxGeometry args={[0.05, 1.7, 0.1]} />
        </mesh>
      ))}
      <mesh position={[0, 0.98, 0]} material={body} renderOrder={4}>
        <boxGeometry args={[1.2, 1.55, 0.06]} />
      </mesh>
    </group>
  );
}

function Lectern({ body, plinth }: ShapeProps) {
  return (
    <group>
      <mesh position={[0, 0.04, 0]} material={plinth} {...shadow}>
        <boxGeometry args={[0.8, 0.08, 0.6]} />
      </mesh>
      <mesh position={[0, 0.48, -0.05]} material={plinth} {...shadow}>
        <boxGeometry args={[0.22, 0.9, 0.22]} />
      </mesh>
      <group position={[0, 0.98, 0]} rotation={[-0.7, 0, 0]}>
        <RoundedBox args={[0.9, 0.62, 0.05]} radius={0.015} position={[0, 0, -0.026]} material={body} {...shadow} />
      </group>
    </group>
  );
}

function Wall({ body, plinth }: ShapeProps) {
  return (
    <group>
      <mesh position={[0, 0.06, 0]} material={plinth} {...shadow}>
        <boxGeometry args={[2.1, 0.12, 0.55]} />
      </mesh>
      <mesh position={[0, 0.8, 0]} material={body} {...shadow}>
        <boxGeometry args={[1.9, 1.4, 0.35]} />
      </mesh>
      {[-1.0, 1.0].map((x) => (
        <mesh key={x} position={[x, 0.65, -0.05]} material={body} {...shadow}>
          <boxGeometry args={[0.16, 1.3, 0.48]} />
        </mesh>
      ))}
      <mesh position={[0, 1.53, 0]} material={body} {...shadow}>
        <boxGeometry args={[2.1, 0.08, 0.42]} />
      </mesh>
    </group>
  );
}

function Hedge({ body, plinth }: ShapeProps) {
  return (
    <group>
      <mesh position={[0, 0.12, 0]} material={plinth} {...shadow}>
        <boxGeometry args={[1.8, 0.24, 0.85]} />
      </mesh>
      <RoundedBox args={[1.68, 0.14, 0.74]} radius={0.05} position={[0, 0.26, 0]} material={body} {...shadow} />
    </group>
  );
}

function Sculpture({ body, accent, plinth }: ShapeProps) {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} material={plinth} {...shadow}>
        <boxGeometry args={[0.95, 0.5, 0.95]} />
      </mesh>
      <mesh position={[0, 0.85, 0]} rotation={[0, 0.4, 0]} material={body} {...shadow}>
        <boxGeometry args={[0.55, 0.7, 0.55]} />
      </mesh>
      <mesh position={[0.05, 1.5, 0]} material={body} {...shadow}>
        <sphereGeometry args={[0.34, 24, 16]} />
      </mesh>
      <mesh position={[0, 1.98, 0]} rotation={[0.4, 0, 0.6]} material={accent}>
        <torusGeometry args={[0.24, 0.05, 10, 32]} />
      </mesh>
    </group>
  );
}

/** Externally supplied GLB: normalised to ~1.2 m and placed on a plinth. */
function Model({ modelPath, plinth }: ShapeProps) {
  const gltf = useGLTF(modelPath!, false, true);
  const obj = useMemo(() => {
    const o = gltf.scene.clone(true);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = m.receiveShadow = true;
      }
    });
    // keep authored materials, but enable shadows / BVH
    prepareObject(o, sharedMaterials, { raycast: true });
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3());
    const s = 1.2 / Math.max(size.x, size.y, size.z, 0.001);
    o.scale.setScalar(s);
    o.position.set(-((box.min.x + box.max.x) / 2) * s, 0.3 - box.min.y * s, -((box.min.z + box.max.z) / 2) * s);
    return o;
  }, [gltf]);
  return (
    <group>
      <mesh position={[0, 0.15, 0]} material={plinth} {...shadow}>
        <boxGeometry args={[1.2, 0.3, 1.2]} />
      </mesh>
      <primitive object={obj} />
    </group>
  );
}

/* ------------------------------------------------ reference-style objects */

function Boulders({ seed = 1, spread = 1, count = 4, material }: { seed?: number; spread?: number; count?: number; material: THREE.Material }) {
  const items = useMemo(() => {
    const out: { p: [number, number, number]; s: number; r: number }[] = [];
    for (let i = 0; i < count; i++) {
      const a = seed * 1.7 + i * 2.39;
      const r = 0.6 + ((seed * 13 + i * 7) % 10) / 22;
      out.push({ p: [Math.cos(a) * r * spread, 0.04, Math.sin(a) * r * 0.45 * spread - 0.1], s: 0.08 + ((seed + i * 5) % 7) / 55, r: a });
    }
    return out;
  }, [seed, spread, count]);
  return (
    <>
      {items.map((b, i) => (
        <mesh key={i} position={b.p} rotation={[b.r, b.r * 2, 0]} scale={[b.s * 1.4, b.s * 0.8, b.s * 1.2]} material={material} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </>
  );
}

/** Interlace border: rows of small rings alternating ±45°, carved proud of the face. */
function KnotBorder({ w, h, z, material }: { w: number; h: number; z: number; material: THREE.Material }) {
  const mesh = useMemo(() => {
    const ring = new THREE.TorusGeometry(0.034, 0.0095, 5, 14);
    const pts: { x: number; y: number; vertical: boolean }[] = [];
    const step = 0.052;
    for (let x = -w / 2; x <= w / 2 + 1e-6; x += step) {
      pts.push({ x, y: h / 2, vertical: false }, { x, y: -h / 2, vertical: false });
    }
    for (let y = -h / 2 + step; y < h / 2 - 1e-6; y += step) {
      pts.push({ x: -w / 2, y, vertical: true }, { x: w / 2, y, vertical: true });
    }
    const im = new THREE.InstancedMesh(ring, material, pts.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    pts.forEach((p, i) => {
      const flip = i % 2 === 0 ? 1 : -1;
      e.set(0, flip * 0.75, p.vertical ? Math.PI / 2 : 0);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(p.x, p.y, z), q, new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, m);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    return im;
  }, [w, h, z, material]);
  return <primitive object={mesh} />;
}

/** Blogs: a heavy stone tablet with chipped edges, an interlaced border and a burning torch. */
function Tablet({ body, plinth, seed = 1 }: ShapeProps) {
  const geo = useMemo(() => chippedBox(1.75, 1.3, 0.36, seed, 0.07), [seed]);
  const W = 1.75;
  const H = 1.3;
  return (
    <group>
      <mesh geometry={geo} position={[0, 0.72, 0]} material={body} castShadow receiveShadow />
      {/* raised frame + interlace, inset from the edge */}
      {[
        [0, H / 2 - 0.1, W - 0.2, 0.05],
        [0, -H / 2 + 0.1, W - 0.2, 0.05],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, 0.72 + y, 0.19]} material={body} castShadow receiveShadow>
          <boxGeometry args={[w, h, 0.03]} />
        </mesh>
      ))}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (W / 2 - 0.1), 0.72, 0.19]} material={body} castShadow receiveShadow>
          <boxGeometry args={[0.05, H - 0.2, 0.03]} />
        </mesh>
      ))}
      <group position={[0, 0.72, 0]}>
        <KnotBorder w={W - 0.36} h={H - 0.36} z={0.19} material={body} />
      </group>
      <Boulders seed={seed} spread={1.2} count={5} material={body} />
      <Torch position={[-1.12, 0, 0.28]} />
    </group>
  );
}

/** Playground: lettering stands directly on a low grassy mound and is grown over with grass. */
function GrassLetters({ body }: ShapeProps) {
  return (
    <group>
      <mesh position={[0, -0.02, 0.05]} scale={[0.92, 0.07, 0.34]} material={body} receiveShadow>
        <sphereGeometry args={[1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  );
}

function arrowShape(len: number, h: number, tip: number) {
  const s = new THREE.Shape();
  const l = -len / 2;
  const r = len / 2 - tip;
  s.moveTo(l, -h / 2);
  s.lineTo(r, -h / 2);
  s.lineTo(r + tip, 0);
  s.lineTo(r, h / 2);
  s.lineTo(l, h / 2);
  s.lineTo(l + 0.04, 0);
  s.lineTo(l, -h / 2);
  return s;
}

/** Projects: a rough timber post with an arrow-shaped board, nailed on, pointing left or right. */
function Signpost({ body, seed = 1 }: ShapeProps) {
  const dir = seed % 2 === 0 ? 1 : -1;
  const board = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(arrowShape(1.08, 0.42, 0.2), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 1 });
    g.translate(0, 0, -0.03);
    // UVs from ExtrudeGeometry are in shape units — fine for the plank texture
    return g;
  }, []);
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2b2622", roughness: 0.55, metalness: 0.6 }), []);
  const tilt = (((seed * 37) % 9) - 4) * 0.008;
  return (
    <group>
      <mesh position={[-dir * 0.26, 1.0, -0.09]} rotation={[0, seed, tilt]} material={body} castShadow receiveShadow>
        <cylinderGeometry args={[0.065, 0.08, 2.0, 9]} />
      </mesh>
      <mesh position={[-dir * 0.26, 2.02, -0.09]} material={body} castShadow>
        <coneGeometry args={[0.075, 0.08, 9]} />
      </mesh>
      <group position={[0, 1.38, 0]} scale={[dir, 1, 1]} rotation={[0, 0, tilt]}>
        <mesh geometry={board} material={body} castShadow receiveShadow />
        {[-0.44, 0.26].map((x) => (
          <mesh key={x} position={[x, 0, 0.042]} rotation-x={Math.PI / 2} material={iron}>
            <cylinderGeometry args={[0.018, 0.018, 0.012, 8]} />
          </mesh>
        ))}
      </group>
      {/* trampled soil at the foot */}
      <mesh position={[-dir * 0.26, 0.01, -0.09]} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[0.32, 16]} />
        <meshStandardMaterial color="#6b5440" roughness={1} />
      </mesh>
    </group>
  );
}

/** Resume: a chunky cast-concrete block lying tilted back on rubble, letters raised on its face. */
function ConcreteBlock({ body, plinth, seed = 1 }: ShapeProps) {
  const geo = useMemo(() => chippedBox(2.0, 1.2, 0.35, seed, 0.08), [seed]);
  return (
    <group>
      <mesh geometry={geo} position={[0, 0.12, 0]} rotation-x={-1.1} material={body} castShadow receiveShadow />
      <Boulders seed={seed + 3} spread={1.5} count={7} material={plinth} />
    </group>
  );
}

/** Research: a brushed-steel panel on two legs over a concrete footing, bolted at the corners. */
function MetalPanel({ body, plinth }: ShapeProps) {
  const bolt = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a3d41", roughness: 0.4, metalness: 0.9 }), []);
  return (
    <group>
      <mesh position={[0, 0.09, -0.02]} material={plinth} castShadow receiveShadow>
        <boxGeometry args={[1.45, 0.18, 0.5]} />
      </mesh>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.5, -0.06]} material={body} castShadow>
          <boxGeometry args={[0.07, 0.8, 0.07]} />
        </mesh>
      ))}
      <RoundedBox args={[1.38, 0.95, 0.05]} radius={0.012} position={[0, 1.22, 0]} material={body} castShadow receiveShadow />
      {[
        [-0.62, 1.63],
        [0.62, 1.63],
        [-0.62, 0.81],
        [0.62, 0.81],
      ].map(([x, y]) => (
        <mesh key={`${x}${y}`} position={[x, y, 0.03]} rotation-x={Math.PI / 2} material={bolt}>
          <cylinderGeometry args={[0.022, 0.022, 0.015, 8]} />
        </mesh>
      ))}
    </group>
  );
}

export const SHAPES: Record<string, (p: ShapeProps) => ReactNode> = {
  "metal-panel": MetalPanel,
  tablet: Tablet,
  "grass-letters": GrassLetters,
  signpost: Signpost,
  "concrete-block": ConcreteBlock,
  slab: Slab,
  monument: Monument,
  signboard: Signboard,
  plaque: Plaque,
  book: Book,
  installation: Installation,
  "glass-panel": GlassPanel,
  lectern: Lectern,
  wall: Wall,
  hedge: Hedge,
  sculpture: Sculpture,
  model: Model,
};

export { plinthMaterial };
