"use client";
/**
 * ThreeDTypography — real extruded mesh lettering (TextGeometry via typeface
 * fonts). The typography preset decides font, depth, bevel and how the text
 * meets the surface:
 *   engraved → letters sunk into the surface, only a dark inlay skin shows
 *   embossed / inlay / grown → letters stand proud of the surface
 *   etched / painted → near-flush thin lettering
 */
import { Center, Text3D } from "@react-three/drei";
import { useMemo, useRef } from "react";
import type * as THREE from "three";
import { GrassFur } from "./organic";
import { FONT_URLS, wrapLines, type TypographyPreset } from "@/presets/typography";

export interface ThreeDTypographyProps {
  text: string;
  preset: TypographyPreset;
  material: THREE.Material;
  /** available width in metres */
  width: number;
  size: number;
  maxLines?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** override the wrap length of the preset */
  wrap?: number;
  align?: "center" | "left";
}

const GLYPH_ASPECT: Record<string, number> = { serif: 0.62, sans: 0.66, mono: 0.62, display: 0.7, roman: 0.86, brush: 0.52, heavy: 0.84, rounded: 0.62 };

export function layoutText(text: string, preset: TypographyPreset, width: number, size: number, maxLines = 3, wrap?: number) {
  const t = preset.uppercase ? text.toUpperCase() : text;
  const lines = wrapLines(t, wrap ?? preset.wrap, maxLines);
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const est = longest * size * GLYPH_ASPECT[preset.font];
  const fit = est > width ? width / est : 1;
  return { lines, size: size * fit };
}

export function ThreeDTypography({ text, preset, material, width, size, maxLines = 3, position = [0, 0, 0], rotation = [0, 0, 0], wrap }: ThreeDTypographyProps) {
  const { lines, size: s } = useMemo(() => layoutText(text, preset, width, size, maxLines, wrap), [text, preset, width, size, maxLines, wrap]);
  const height = Math.max(0.004, preset.depth * s);
  const lead = s * preset.lineHeight;
  // engraved letters sit inside the body; front face 3 mm proud
  const zOffset = preset.treatment === "engraved" ? -height + 0.003 : preset.treatment === "etched" || preset.treatment === "painted" ? 0.001 : -0.002;
  return (
    <group position={position} rotation={rotation}>
      {lines.map((line, i) => (
        <Center key={i} disableY disableZ position={[0, -i * lead, zOffset]}>
          <TextLine line={line} preset={preset} size={s} height={height} material={material} />
        </Center>
      ))}
    </group>
  );
}

function TextLine({ line, preset, size, height, material }: { line: string; preset: TypographyPreset; size: number; height: number; material: THREE.Material }) {
  const ref = useRef<THREE.Mesh>(null);
  const grown = preset.treatment === "grown";
  return (
    <>
      <Text3D
        ref={ref}
        font={FONT_URLS[preset.font]}
        size={size}
        height={height}
        curveSegments={preset.font === "mono" ? 3 : 6}
        bevelEnabled={preset.bevel > 0}
        bevelThickness={preset.bevel * size}
        bevelSize={preset.bevel * size * 0.6}
        bevelSegments={grown ? 3 : 2}
        material={material}
        castShadow={preset.treatment !== "engraved"}
        receiveShadow
      >
        {line}
      </Text3D>
      {grown && <GrassFur target={ref} length={size * 0.11} density={2200} key={line} />}
    </>
  );
}
