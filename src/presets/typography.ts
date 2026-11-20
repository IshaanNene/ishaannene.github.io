/**
 * Typography presets for physical 3D lettering (mesh text from typeface fonts)
 * and their editorial counterparts. Add a preset here to make it available to
 * every content object; no renderer changes required.
 */
/** serif/sans/mono/display: three.js sample faces · roman: Cinzel Bold · brush: Bangers · heavy: Archivo Black · rounded: Fredoka Bold */
export type FontFace3D = "serif" | "sans" | "mono" | "display" | "roman" | "brush" | "heavy" | "rounded";

/**
 * engraved — dark inlay set into the surface (carved look)
 * embossed — raised letters in the body material
 * inlay    — raised letters in a contrasting material (brass on stone…)
 * etched   — frosted, semi-transparent letters (glass)
 * grown    — chunky bevelled letters in living foliage
 * painted  — near-flat colour letters
 */
export type Treatment = "engraved" | "embossed" | "inlay" | "etched" | "grown" | "painted";

export interface TypographyPreset {
  id: string;
  label: string;
  font: FontFace3D;
  treatment: Treatment;
  /** extrusion depth relative to text size */
  depth: number;
  bevel: number;
  uppercase: boolean;
  /** max characters per line before wrapping */
  wrap: number;
  lineHeight: number;
  /** optional override of the ink material (a material preset id) */
  inkMaterial?: string;
  /** font family used for the editorial page header */
  editorialFont: "serif" | "sans" | "mono";
}

export const FONT_URLS: Record<FontFace3D, string> = {
  serif: "/fonts/serif-bold.json",
  sans: "/fonts/sans-bold.json",
  mono: "/fonts/mono.json",
  display: "/fonts/display-bold.json",
  roman: "/fonts/cinzel-bold.json",
  brush: "/fonts/bangers.json",
  heavy: "/fonts/archivo-black.json",
  rounded: "/fonts/fredoka-bold.json",
};

export const TYPOGRAPHY_PRESETS: Record<string, TypographyPreset> = {
  "carved-roman": { id: "carved-roman", label: "Carved Roman capitals", font: "roman", treatment: "engraved", depth: 0.16, bevel: 0.02, uppercase: true, wrap: 14, lineHeight: 1.36, inkMaterial: "bronze", editorialFont: "serif" },
  "painted-sign": { id: "painted-sign", label: "Hand-painted sign", font: "brush", treatment: "painted", depth: 0.03, bevel: 0, uppercase: true, wrap: 13, lineHeight: 1.05, inkMaterial: "paint", editorialFont: "sans" },
  "grass-grown": { id: "grass-grown", label: "Grass-grown letters", font: "heavy", treatment: "grown", depth: 0.7, bevel: 0.04, uppercase: true, wrap: 10, lineHeight: 1.1, inkMaterial: "grass", editorialFont: "sans" },
  "etched-steel": { id: "etched-steel", label: "Etched steel grotesk", font: "sans", treatment: "engraved", depth: 0.05, bevel: 0, uppercase: true, wrap: 18, lineHeight: 1.3, editorialFont: "mono" },
  "raised-concrete": { id: "raised-concrete", label: "Raised cast concrete", font: "rounded", treatment: "embossed", depth: 0.32, bevel: 0.03, uppercase: false, wrap: 16, lineHeight: 1.1, editorialFont: "sans" },
  "engraved-serif": { id: "engraved-serif", label: "Engraved serif", font: "serif", treatment: "engraved", depth: 0.12, bevel: 0.012, uppercase: false, wrap: 16, lineHeight: 1.25, editorialFont: "serif" },
  "carved-display": { id: "carved-display", label: "Carved display caps", font: "display", treatment: "engraved", depth: 0.14, bevel: 0.015, uppercase: true, wrap: 13, lineHeight: 1.2, editorialFont: "serif" },
  "engraved-sans": { id: "engraved-sans", label: "Engraved grotesk", font: "sans", treatment: "engraved", depth: 0.12, bevel: 0.01, uppercase: true, wrap: 14, lineHeight: 1.2, editorialFont: "sans" },
  "embossed-sans": { id: "embossed-sans", label: "Embossed grotesk", font: "sans", treatment: "embossed", depth: 0.28, bevel: 0.02, uppercase: true, wrap: 14, lineHeight: 1.2, editorialFont: "sans" },
  "embossed-serif": { id: "embossed-serif", label: "Embossed serif", font: "serif", treatment: "embossed", depth: 0.25, bevel: 0.02, uppercase: false, wrap: 16, lineHeight: 1.25, editorialFont: "serif" },
  "inlay-brass": { id: "inlay-brass", label: "Brass inlay", font: "serif", treatment: "inlay", depth: 0.16, bevel: 0.015, uppercase: true, wrap: 15, lineHeight: 1.25, inkMaterial: "brass", editorialFont: "serif" },
  "stencil-mono": { id: "stencil-mono", label: "Industrial mono", font: "mono", treatment: "painted", depth: 0.04, bevel: 0, uppercase: true, wrap: 16, lineHeight: 1.3, editorialFont: "mono" },
  "etched-mono": { id: "etched-mono", label: "Etched mono", font: "mono", treatment: "etched", depth: 0.05, bevel: 0, uppercase: false, wrap: 18, lineHeight: 1.3, editorialFont: "mono" },
  "etched-sans": { id: "etched-sans", label: "Etched grotesk", font: "sans", treatment: "etched", depth: 0.05, bevel: 0, uppercase: true, wrap: 15, lineHeight: 1.25, editorialFont: "sans" },
  "grown-display": { id: "grown-display", label: "Grass-grown display", font: "display", treatment: "grown", depth: 0.55, bevel: 0.06, uppercase: true, wrap: 11, lineHeight: 1.2, inkMaterial: "grass", editorialFont: "sans" },
  "grown-sans": { id: "grown-sans", label: "Topiary grotesk", font: "sans", treatment: "grown", depth: 0.5, bevel: 0.05, uppercase: false, wrap: 12, lineHeight: 1.2, inkMaterial: "grass", editorialFont: "sans" },
  "painted-sans": { id: "painted-sans", label: "Painted grotesk", font: "sans", treatment: "painted", depth: 0.05, bevel: 0, uppercase: true, wrap: 14, lineHeight: 1.2, editorialFont: "sans" },
};

export const DEFAULT_TYPOGRAPHY = "engraved-serif";

export function getTypographyPreset(id: string | undefined): TypographyPreset {
  return TYPOGRAPHY_PRESETS[id ?? ""] ?? TYPOGRAPHY_PRESETS[DEFAULT_TYPOGRAPHY];
}

/** Greedy word wrap shared by 3D text layout. */
export function wrapLines(text: string, max: number, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max && line) {
      lines.push(line);
      line = w;
    } else {
      line = (line + " " + w).trim();
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, "") + "…";
    return kept;
  }
  return lines;
}
