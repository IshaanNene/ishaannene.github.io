"use client";
/**
 * ContentLayer — places every registry entry of a destination onto the island
 * automatically. Slots come from the Blender manifest (authored placements);
 * entries beyond the slot count, or with explicit {x, z} placement, are
 * dropped onto the terrain by raycasting the island geometry.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import type { IslandManifest, Vec3 } from "@/config/world";
import type { ContentSummary } from "@/lib/content/schema";
import { MaterialContentObject, type PhysicalContent } from "./MaterialContentObject";

export interface Placed {
  item: PhysicalContent;
  position: Vec3;
  rotationY: number;
  needsGround: boolean;
}

export function toPhysical(e: ContentSummary): PhysicalContent {
  return {
    id: `${e.category}/${e.slug}`,
    title: e.title,
    subtitle: e.subtitle ?? (e.category === "resume" ? [e.organization, e.period].filter(Boolean).join(" · ") : formatDate(e.date)),
    href: e.href,
    material: e.visual.material,
    typography: e.visual.typography,
    objectType: e.visual.objectType,
    color: e.visual.color,
    modelPath: e.visual.modelPath,
    scale: e.visual.scale,
    interaction: e.visual.interaction,
  };
}

function formatDate(d: string) {
  const dt = new Date(d + "T00:00:00Z");
  return dt.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).toUpperCase();
}

export function assignPlacements(entries: ContentSummary[], manifest: IslandManifest, kinds: string[] = ["content", "resume"]): Placed[] {
  const slots = manifest.slots.filter((s) => kinds.includes(s.kind));
  const used = new Set<number>();
  const placed: Placed[] = [];
  const pending: ContentSummary[] = [];
  const angle = (f: [number, number]) => Math.atan2(f[0], f[1]);

  for (const e of entries) {
    const p = e.visual.placement;
    if (typeof p === "number" && slots[p] && !used.has(p)) {
      used.add(p);
      placed.push({ item: toPhysical(e), position: slots[p].pos, rotationY: angle(slots[p].facing) + (e.visual.rotation * Math.PI) / 180, needsGround: false });
    } else if (typeof p === "object") {
      const a = Math.atan2(p.x, p.z);
      placed.push({ item: toPhysical(e), position: [p.x, 0, p.z], rotationY: a + (e.visual.rotation * Math.PI) / 180, needsGround: true });
    } else pending.push(e);
  }
  let overflow = 0;
  for (const e of pending) {
    const free = slots.findIndex((_, i) => !used.has(i));
    if (free >= 0) {
      used.add(free);
      const s = slots[free];
      placed.push({ item: toPhysical(e), position: s.pos, rotationY: angle(s.facing) + (e.visual.rotation * Math.PI) / 180, needsGround: false });
    } else {
      // spiral outward along the island footprint, facing outward
      const a = 2.3 + overflow * 0.83;
      const r = manifest.radius * (0.62 + 0.06 * (overflow % 3));
      overflow++;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      placed.push({ item: toPhysical(e), position: [x, 0, z], rotationY: Math.atan2(x, z), needsGround: true });
    }
  }
  return placed;
}

const ray = new THREE.Raycaster();
const down = new THREE.Vector3(0, -1, 0);

/** Resolves ground height for placements that need it, once the island geometry exists. */
function useGrounded(placed: Placed[], ground: RefObject<THREE.Object3D | null>) {
  const [heights, setHeights] = useState<Record<number, number>>({});
  const done = useRef(false);
  useFrame(() => {
    if (done.current || !ground.current) return;
    const need = placed.map((p, i) => [p, i] as const).filter(([p]) => p.needsGround);
    if (!need.length) {
      done.current = true;
      return;
    }
    const g = ground.current;
    g.updateWorldMatrix(true, true);
    const out: Record<number, number> = {};
    let ok = 0;
    for (const [p, i] of need) {
      const origin = g.localToWorld(new THREE.Vector3(p.position[0], 30, p.position[2]));
      ray.set(origin, down);
      const hit = ray.intersectObject(g, true)[0];
      if (hit) {
        out[i] = g.worldToLocal(hit.point.clone()).y;
        ok++;
      }
    }
    if (ok === need.length) {
      done.current = true;
      setHeights(out);
    }
  });
  return heights;
}

export function ContentLayer({ placed, ground, interactive = true }: { placed: Placed[]; ground: RefObject<THREE.Object3D | null>; interactive?: boolean }) {
  const heights = useGrounded(placed, ground);
  return (
    <group>
      {placed.map((p, i) => {
        if (p.needsGround && heights[i] === undefined) return null;
        const pos: Vec3 = p.needsGround ? [p.position[0], heights[i], p.position[2]] : p.position;
        return <MaterialContentObject key={p.item.id} item={p.item} position={pos} rotationY={p.rotationY} interactive={interactive} />;
      })}
    </group>
  );
}

export function useContactPlacements(manifest: IslandManifest, links: readonly { id: string; label: string; value: string; href: string; material: string; typography: string }[]) {
  return useMemo(() => {
    const slots = manifest.slots.filter((s) => s.kind === "contact");
    return links.slice(0, slots.length).map((l, i) => ({
      item: {
        id: `contact/${l.id}`,
        title: l.label,
        subtitle: l.value,
        href: l.href,
        material: l.material,
        typography: l.typography,
        objectType: "signboard",
        external: !l.href.startsWith("/"),
      } as PhysicalContent,
      position: slots[i].pos,
      rotationY: Math.atan2(slots[i].facing[0], slots[i].facing[1]),
      needsGround: false,
    }));
  }, [manifest, links]);
}
