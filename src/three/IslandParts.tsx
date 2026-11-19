"use client";
/**
 * Semantic renderers for the node groups of an island GLB. Each is a thin,
 * independently replaceable component: swap the GLB node, keep the behaviour.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type * as THREE from "three";

function Nodes({ nodes }: { nodes: THREE.Object3D[] }) {
  return (
    <>
      {nodes.map((n) => (
        <primitive key={n.uuid} object={n} />
      ))}
    </>
  );
}

/** Grass/sand top surface, paths and paved plazas. Receives shadows only. */
export function IslandTerrain({ nodes }: { nodes: THREE.Object3D[] }) {
  return <Nodes nodes={nodes} />;
}

/** Layered geological foundation with hanging rock spikes. */
export function RockFoundation({ nodes }: { nodes: THREE.Object3D[] }) {
  return <Nodes nodes={nodes} />;
}

/** Architecture: halls, towers, pavilions. */
export function Building({ nodes }: { nodes: THREE.Object3D[] }) {
  return <Nodes nodes={nodes} />;
}

/** Signature structures (pipelines, bookshelves, rings, masts) and small props. */
export function Landmark({ nodes }: { nodes: THREE.Object3D[] }) {
  return <Nodes nodes={nodes} />;
}

/** Pond/pool surfaces and waterfall ribbons (shaders animated globally in tickWater). */
export function Waterfall({ water, falls }: { water: THREE.Object3D[]; falls: THREE.Object3D[] }) {
  return (
    <>
      <Nodes nodes={water} />
      <Nodes nodes={falls} />
    </>
  );
}

/**
 * Animated landmark parts authored in Blender as separate pivoted objects:
 *  anim_spin_*   — slow rotation about Y (dome, dish, lamp, monument ring…)
 *  anim_bob_*    — gentle bobbing (moored sky-boats)
 *  anim_bounce_* — interactive pylons that jump when touched
 */
export function AnimatedParts({ nodes, interactive = true }: { nodes: THREE.Object3D[]; interactive?: boolean }) {
  const state = useMemo(
    () =>
      nodes.map((n) => ({
        node: n,
        baseY: n.position.y,
        baseRot: n.rotation.y,
        kind: n.name.startsWith("anim_spin") ? "spin" : n.name.startsWith("anim_bob") ? "bob" : n.name.startsWith("anim_bounce") ? "bounce" : "none",
        speed: n.name.includes("lamp") ? 1.2 : n.name.includes("kinetic") ? 0.6 : n.name.includes("monument") ? 0.25 : 0.12,
        v: 0,
        y: 0,
      })),
    [nodes],
  );
  const t0 = useRef(Math.random() * 10);
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    t0.current += d;
    for (const s of state) {
      if (s.kind === "spin") s.node.rotation.y += d * s.speed;
      else if (s.kind === "bob") {
        s.node.position.y = s.baseY + Math.sin(t0.current * 1.2 + s.baseRot * 3) * 0.06;
        s.node.rotation.z = Math.sin(t0.current * 0.9) * 0.03;
      } else if (s.kind === "bounce") {
        // damped spring
        s.v += (-s.y * 60 - s.v * 6) * d;
        s.y += s.v * d;
        s.node.position.y = s.baseY + s.y;
      }
    }
  });
  return (
    <>
      {state.map((s) => (
        <primitive
          key={s.node.uuid}
          object={s.node}
          onPointerOver={
            interactive && s.kind === "bounce"
              ? (e: { stopPropagation: () => void }) => {
                  e.stopPropagation();
                  s.v = 4.5;
                }
              : undefined
          }
          onClick={
            interactive && s.kind === "bounce"
              ? (e: { stopPropagation: () => void }) => {
                  e.stopPropagation();
                  s.v = 8;
                }
              : undefined
          }
        />
      ))}
    </>
  );
}
