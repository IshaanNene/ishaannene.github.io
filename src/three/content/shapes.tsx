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

export interface ShapeProps {
  body: THREE.Material;
  accent: THREE.Material;
  plinth: THREE.Material;
  modelPath?: string;
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

export const SHAPES: Record<string, (p: ShapeProps) => ReactNode> = {
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
