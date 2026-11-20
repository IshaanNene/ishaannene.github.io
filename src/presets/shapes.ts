/**
 * Physical object shapes for content entries. Pure data (dimensions + text
 * area); the matching geometry lives in src/three/content/shapes.tsx.
 * To add a shape: add an entry here and a builder component in shapes.tsx.
 */
export interface ShapePreset {
  id: string;
  label: string;
  /** nominal footprint/height in metres (before visual.scale) */
  size: [number, number, number];
  /** text area on the object's front face, object-local */
  /** text block is centred on (0, y); `tilt` rotates about X around (0, y, pivotZ); z is the face offset in that frame */
  text: { width: number; y: number; z: number; pivotZ?: number; size: number; maxLines: number; tilt?: number; anchor?: "center" | "bottom" };
  subtitle?: boolean;
}

export const SHAPE_PRESETS: Record<string, ShapePreset> = {
  "metal-panel": { id: "metal-panel", label: "Brushed steel panel", size: [1.45, 1.7, 0.5], text: { width: 1.06, y: 1.34, z: 0.026, size: 0.1, maxLines: 3 }, subtitle: true },
  tablet: { id: "tablet", label: "Carved stone tablet", size: [1.9, 1.5, 0.7], text: { width: 1.25, y: 0.82, z: 0.18, size: 0.15, maxLines: 3 }, subtitle: true },
  "grass-letters": { id: "grass-letters", label: "Grass-grown letters", size: [1.6, 0.8, 0.5], text: { width: 1.55, y: 0.05, z: 0, size: 0.34, maxLines: 2, anchor: "bottom" }, subtitle: false },
  signpost: { id: "signpost", label: "Wooden signpost", size: [1.15, 1.9, 0.4], text: { width: 0.8, y: 1.38, z: 0.045, size: 0.15, maxLines: 2 }, subtitle: false },
  "concrete-block": { id: "concrete-block", label: "Cast concrete block", size: [2.1, 0.6, 1.3], text: { width: 1.7, y: 0.29, z: 0.0, pivotZ: 0.08, size: 0.2, maxLines: 2, tilt: -1.1 }, subtitle: true },
  slab: { id: "slab", label: "Standing stone slab", size: [1.3, 1.65, 0.5], text: { width: 1.08, y: 1.08, z: 0.14, size: 0.12, maxLines: 3 }, subtitle: true },
  monument: { id: "monument", label: "Stone monument", size: [1.1, 2.3, 1.1], text: { width: 0.66, y: 1.35, z: 0.38, size: 0.09, maxLines: 4 }, subtitle: true },
  signboard: { id: "signboard", label: "Timber signboard", size: [1.5, 1.65, 0.3], text: { width: 1.3, y: 1.2, z: 0.06, size: 0.12, maxLines: 3 }, subtitle: true },
  plaque: { id: "plaque", label: "Metal plaque on plinth", size: [1.05, 1.0, 0.6], text: { width: 0.86, y: 0.86, z: 0.036, pivotZ: 0.02, size: 0.085, maxLines: 3, tilt: -0.5 }, subtitle: true },
  book: { id: "book", label: "Monumental book", size: [1.3, 0.75, 0.9], text: { width: 1.05, y: 0.62, z: 0.003, pivotZ: -0.04, size: 0.08, maxLines: 3, tilt: -1.89 }, subtitle: false },
  installation: { id: "installation", label: "Concrete installation", size: [1.8, 1.5, 0.62], text: { width: 1.14, y: 0.86, z: 0.012, size: 0.12, maxLines: 3 }, subtitle: true },
  "glass-panel": { id: "glass-panel", label: "Etched glass panel", size: [1.35, 1.8, 0.34], text: { width: 1.02, y: 1.08, z: 0.031, size: 0.095, maxLines: 4 }, subtitle: true },
  lectern: { id: "lectern", label: "Display lectern", size: [0.9, 1.2, 0.6], text: { width: 0.78, y: 0.98, z: 0.0, size: 0.075, maxLines: 3, tilt: -0.7 }, subtitle: false },
  wall: { id: "wall", label: "Embossed wall segment", size: [2.1, 1.57, 0.55], text: { width: 1.7, y: 0.92, z: 0.175, size: 0.13, maxLines: 2 }, subtitle: true },
  hedge: { id: "hedge", label: "Grass-grown lettering", size: [1.8, 0.7, 0.85], text: { width: 1.65, y: 0.47, z: -0.05, size: 0.2, maxLines: 2 }, subtitle: false },
  sculpture: { id: "sculpture", label: "Sculptural totem", size: [0.95, 2.2, 0.95], text: { width: 0.86, y: 0.27, z: 0.475, size: 0.075, maxLines: 3 }, subtitle: false },
  model: { id: "model", label: "External GLB model", size: [1.2, 1.5, 1.2], text: { width: 1.05, y: 0.15, z: 0.6, size: 0.075, maxLines: 2 }, subtitle: false },
};

export const DEFAULT_SHAPE = "slab";

export function getShapePreset(id: string | undefined): ShapePreset {
  return SHAPE_PRESETS[id ?? ""] ?? SHAPE_PRESETS[DEFAULT_SHAPE];
}
