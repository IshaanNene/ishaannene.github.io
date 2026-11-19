"use client";
/**
 * FloatingIsland — one destination: progressive LOD model, instanced
 * vegetation, physical content, 3D name sign and hover/selection behaviour.
 */
import { Html, useCursor } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { DESTINATION_MAP, WORLD_MANIFEST, type DestinationId } from "@/config/world";
import { SITE } from "@/config/site";
import type { ContentSummary } from "@/lib/content/schema";
import { getMaterialPreset } from "@/presets/materials";
import { getTypographyPreset } from "@/presets/typography";
import { useIslandNodes } from "./AssetLoader";
import { surfaceMaterial } from "./content/contentMaterials";
import { ContentLayer, assignPlacements, useContactPlacements } from "./content/ContentLayer";
import { MaterialContentObject } from "./content/MaterialContentObject";
import { ThreeDTypography } from "./content/ThreeDTypography";
import { AnimatedParts, Building, IslandTerrain, Landmark, RockFoundation, Waterfall } from "./IslandParts";
import { MaterialSet } from "./materials";
import { useWorld } from "./store";
import { Vegetation } from "./Vegetation";

class ModelErrorBoundary extends Component<{ children: ReactNode; label: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.error(`[world] failed to load ${this.props.label}`, e);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function IslandModel({ url, mats, interactive }: { url: string; mats: MaterialSet; interactive: boolean }) {
  const n = useIslandNodes(url, mats);
  return (
    <group>
      <IslandTerrain nodes={n.terrain} />
      <RockFoundation nodes={n.foundation} />
      <Building nodes={n.buildings} />
      <Landmark nodes={[...n.landmarks, ...n.props, ...n.other]} />
      <Waterfall water={n.water} falls={n.waterfalls} />
      <AnimatedParts nodes={n.anim} interactive={interactive} />
    </group>
  );
}

const tmp = new THREE.Vector3();

/** Low LOD always; high LOD is fetched lazily when the camera comes close, then swapped by distance. */
function IslandLOD({ id, mats, forceHigh, interactive }: { id: DestinationId; mats: MaterialSet; forceHigh: boolean; interactive: boolean }) {
  const d = DESTINATION_MAP[id];
  const [wantHigh, setWantHigh] = useState(forceHigh);
  const [near, setNear] = useState(forceHigh);
  const quality = useWorld((s) => s.quality);
  const selected = useWorld((s) => s.selected);
  useFrame(({ camera }) => {
    if (forceHigh) return;
    const dist = camera.position.distanceTo(tmp.set(...d.position));
    const loadAt = d.radius * (quality === "high" ? 6.5 : 4.5) + 14;
    const isNear = dist < loadAt || selected === id;
    if (isNear && !wantHigh) setWantHigh(true);
    if (isNear !== near && (isNear || dist > loadAt * 1.15)) setNear(isNear);
  });
  const low = <IslandModel url={d.models.low} mats={mats} interactive={interactive} />;
  return (
    <ModelErrorBoundary label={id}>
      <Suspense fallback={null}>
        {wantHigh && near ? (
          <Suspense fallback={low}>
            <IslandModel url={d.models.high} mats={mats} interactive={interactive} />
          </Suspense>
        ) : (
          low
        )}
      </Suspense>
    </ModelErrorBoundary>
  );
}

function IslandSign({ id }: { id: DestinationId }) {
  const m = WORLD_MANIFEST.islands[id];
  const d = DESTINATION_MAP[id];
  const concrete = useMemo(() => surfaceMaterial(getMaterialPreset("concrete"), "#e6e0d5"), []);
  const typo = useMemo(() => ({ ...getTypographyPreset("embossed-sans"), depth: 0.35, wrap: 20 }), []);
  const width = Math.min(4.2, d.title.length * 0.62);
  const rot = Math.atan2(m.sign.facing[0], m.sign.facing[1]);
  return (
    <group position={m.sign.pos} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.12, -0.12]} material={concrete} castShadow receiveShadow>
        <boxGeometry args={[width + 0.5, 0.36, 0.55]} />
      </mesh>
      <Suspense fallback={null}>
        <ThreeDTypography text={d.title} preset={typo} material={concrete} width={width} size={0.78} maxLines={1} position={[0, 0.3, -0.2]} />
      </Suspense>
    </group>
  );
}

export interface FloatingIslandProps {
  id: DestinationId;
  entries: ContentSummary[];
  interactive?: boolean;
  forceHigh?: boolean;
  /** render at origin (for page heroes) instead of world position */
  local?: boolean;
  showLabel?: boolean;
}

export function FloatingIsland({ id, entries, interactive = true, forceHigh = false, local = false, showLabel = true }: FloatingIslandProps) {
  const d = DESTINATION_MAP[id];
  const manifest = WORLD_MANIFEST.islands[id];
  const mats = useMemo(() => new MaterialSet(), []);
  useEffect(() => () => mats.dispose(), [mats]);
  const group = useRef<THREE.Group>(null);
  const ground = useRef<THREE.Group>(null);
  const hovered = useWorld((s) => s.hovered === id);
  const selected = useWorld((s) => s.selected === id);
  const anySelected = useWorld((s) => s.selected !== null);
  const setHovered = useWorld((s) => s.setHovered);
  const select = useWorld((s) => s.select);
  useCursor(hovered && interactive && !selected);
  const glow = useRef(0);
  const baseY = local ? 0 : d.position[1];

  useFrame((_, dt) => {
    const target = hovered && !selected ? 1 : 0;
    glow.current += (target - glow.current) * Math.min(1, dt * 6);
    mats.setHighlight(glow.current * 0.35);
    if (group.current) group.current.position.y = baseY + glow.current * 0.18;
  });

  const placed = useMemo(() => {
    if (!d.contentCategory) return [];
    return assignPlacements(entries.filter((e) => e.category === d.contentCategory), manifest);
  }, [entries, d.contentCategory, manifest]);
  const contact = useContactPlacements(manifest, id === "contact" ? SITE.contact : []);

  const handlers = interactive
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(id);
        },
        onPointerOut: () => setHovered(null),
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.delta > 6) return;
          select(id);
        },
      }
    : {};

  return (
    <group ref={group} position={local ? [0, 0, 0] : d.position} {...handlers}>
      <group ref={ground}>
        <IslandLOD id={id} mats={mats} forceHigh={forceHigh} interactive={interactive} />
      </group>
      <Suspense fallback={null}>
        <Vegetation instances={manifest.vegetation} />
      </Suspense>
      <IslandSign id={id} />
      <ContentLayer placed={placed} ground={ground} interactive={interactive} />
      {contact.map((p) => (
        <MaterialContentObject key={p.item.id} item={p.item} position={p.position} rotationY={p.rotationY} interactive={interactive} />
      ))}
      {showLabel && (
        <Html position={manifest.label} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className={`island-label ${hovered || selected ? "is-active" : ""} ${anySelected && !selected ? "is-dim" : ""}`}>
            <span className="island-label__key">{d.key}</span>
            <span className="island-label__name">{d.title}</span>
            <span className="island-label__kicker">{d.kicker}</span>
          </div>
        </Html>
      )}
    </group>
  );
}
