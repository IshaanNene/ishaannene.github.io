"use client";
/**
 * MaterialContentObject — the generic physical renderer for one content entry.
 * material preset × typography preset × shape preset (or external GLB) →
 * an interactive 3D object that links to the entry's page.
 */
import { useCursor } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { Component, Suspense, useMemo, useRef, useState, type ReactNode } from "react";
import type * as THREE from "three";
import { getMaterialPreset } from "@/presets/materials";
import { getShapePreset } from "@/presets/shapes";
import { getTypographyPreset } from "@/presets/typography";
import { useWorld } from "../store";
import { accentMaterial, inkMaterial, plinthMaterial, surfaceMaterial } from "./contentMaterials";
import { SHAPES } from "./shapes";
import { ThreeDTypography, layoutText } from "./ThreeDTypography";

export interface PhysicalContent {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  material: string;
  typography: string;
  objectType: string;
  color?: string;
  modelPath?: string;
  scale?: number;
  interaction?: "link" | "none";
  external?: boolean;
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("[content] external model failed to load — using procedural fallback", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function MaterialContentObject({
  item,
  position,
  rotationY,
  interactive = true,
}: {
  item: PhysicalContent;
  position: [number, number, number];
  rotationY: number;
  interactive?: boolean;
}) {
  const router = useRouter();
  const setHoveredContent = useWorld((s) => s.setHoveredContent);
  const [hover, setHover] = useState(false);
  useCursor(hover && interactive);
  const group = useRef<THREE.Group>(null);
  const lift = useRef(0);

  const mat = getMaterialPreset(item.material);
  const typo = getTypographyPreset(item.typography);
  const shape = getShapePreset(item.objectType);
  const body = useMemo(() => surfaceMaterial(mat, item.color), [mat, item.color]);
  const ink = useMemo(() => inkMaterial(mat, typo, item.color), [mat, typo, item.color]);
  const plinth = useMemo(() => plinthMaterial(), []);
  const Shape = SHAPES[shape.id] ?? SHAPES.slab;
  const t = shape.text;

  const title = layoutText(item.title, typo, t.width, t.size, t.maxLines);
  const lead = title.size * typo.lineHeight;
  const blockH = (title.lines.length - 1) * lead;
  const showSub = shape.subtitle && item.subtitle;

  useFrame((_, dt) => {
    if (!group.current) return;
    const target = hover ? 0.12 : 0;
    lift.current += (target - lift.current) * Math.min(1, dt * 10);
    group.current.position.y = position[1] + lift.current;
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    setHover(true);
    setHoveredContent(item.id);
  };
  const onOut = () => {
    setHover(false);
    setHoveredContent(null);
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive || item.interaction === "none") return;
    e.stopPropagation();
    if (e.delta > 6) return; // was a drag
    if (item.external) window.open(item.href, "_blank", "noopener");
    else router.push(item.href);
  };

  const fallback = <SHAPES.slab body={body} accent={accentMaterial} plinth={plinth} />;

  return (
    <group
      ref={group}
      position={position}
      rotation={[0, rotationY, 0]}
      scale={item.scale ?? 1}
      onPointerOver={onOver}
      onPointerOut={onOut}
      onClick={onClick}
      userData={{ contentId: item.id }}
    >
      {item.modelPath ? (
        <ModelBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <Shape body={body} accent={accentMaterial} plinth={plinth} modelPath={item.modelPath} />
          </Suspense>
        </ModelBoundary>
      ) : (
        <Shape body={body} accent={accentMaterial} plinth={plinth} />
      )}
      <group position={[0, t.y, t.pivotZ ?? 0]} rotation={[t.tilt ?? 0, 0, 0]}>
        <Suspense fallback={null}>
          <ThreeDTypography
            text={item.title}
            preset={typo}
            material={ink}
            width={t.width}
            size={t.size}
            maxLines={t.maxLines}
            position={[0, blockH / 2 + (showSub ? title.size * 0.6 : 0), t.z]}
          />
          {showSub ? (
            <ThreeDTypography
              text={item.subtitle!}
              preset={{ ...getTypographyPreset("etched-mono"), treatment: typo.treatment === "embossed" ? "painted" : typo.treatment, uppercase: true, wrap: 28 }}
              material={ink}
              width={t.width}
              size={t.size * 0.42}
              maxLines={1}
              position={[0, -blockH / 2 - title.size * 0.6, t.z]}
            />
          ) : null}
        </Suspense>
      </group>
      {/* hover affordance: lime emissive sill */}
      <mesh position={[0, 0.02, shape.size[2] / 2 + 0.06]} visible={hover} material={accentMaterial}>
        <boxGeometry args={[shape.size[0] * 0.8, 0.03, 0.03]} />
      </mesh>
    </group>
  );
}
