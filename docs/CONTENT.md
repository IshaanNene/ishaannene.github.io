# Content system

Content is Markdown. Each file becomes **two things automatically**:

1. A physical object in the 3D world — a carved slab, metal plaque, etched glass
   panel, grass-grown hedge, concrete wall… with real mesh typography — placed on
   its category's island.
2. A reading page with a header themed by the same material and typography, and a
   plain, accessible Markdown body.

You never edit the 3D scene to add content. Drop a file in, rebuild.

```
content/blogs/*.md       → Blogs island (library)        → /blogs/<slug>/
content/projects/*.md    → Projects island (industrial)  → /projects/<slug>/
content/research/*.md    → Research island (observatory) → /research/<slug>/
content/playground/*.md  → Playground island (workshop)  → /playground/<slug>/
content/resume/*.md      → Resume island (pavilion)      → /resume/#<slug>
```

Files starting with `_` are ignored.

## Frontmatter

```yaml
---
title: Designing for Failure            # required
slug: designing-for-failure             # optional, defaults to the file name (kebab-case)
category: blogs                         # optional, defaults to the folder
date: 2026-05-02                        # required
excerpt: One or two sentences.
tags: [distributed-systems, reliability]
featured: true                          # featured entries take the first slot
subtitle: Optional line under the title
links:                                  # shown in the article sidebar
  - { label: GitHub, href: https://github.com/... }
# resume only
role: Senior Software Engineer
organization: Example Corp
period: 2023 — Present
visual:                                 # everything here is optional
  material: granite                     # see presets below
  typography: carved-display
  objectType: monument
  placement: auto                       # auto | slot index (0..n) | { x: 1.2, z: -3 } island-local metres
  scale: 1.1                            # 0–4
  rotation: 15                          # degrees, added to the slot's facing
  color: "#FF7043"                      # tints the surface
  modelPath: /models/content/foo.glb    # use an external GLB instead of a procedural shape
  interaction: link                     # link | none
---
```

Category defaults when `visual` is omitted:

| Category | Material | Typography | Object |
|---|---|---|---|
| blogs | stone | engraved-serif | slab |
| projects | metal | embossed-sans | plaque |
| research | glass | etched-mono | glass-panel |
| playground | grass | grown-display | hedge |
| resume | concrete | embossed-sans | wall |

These are only defaults — any category can use any combination.

Validation: invalid frontmatter fails the build with the file name and the
field. Unknown preset names log a warning and fall back to the category default.
Duplicate slugs fail the build.

## Presets

All presets are plain data. The 3D renderer and the editorial renderer read the
same entries, so a page header always matches its object.

**Materials** — `src/presets/materials.ts`
`stone, granite, wood, metal, brass, corten, concrete, paper, glass, grass, water, lacquer, clay`
Each defines a PBR `surface`, an `ink` (lettering) material and `editorial`
tokens (`bg, fg, muted, accent, rule, pattern`) for the page.

**Typography** — `src/presets/typography.ts`
`engraved-serif, carved-display, engraved-sans, embossed-sans, embossed-serif, inlay-brass, stencil-mono, etched-mono, etched-sans, grown-display, grown-sans, painted-sans`
Each picks a 3D typeface, extrusion depth, bevel, letter-spacing, case and a
treatment: `engraved` (cut into the surface), `embossed` (raised), `inlay`
(flush metal), `etched` (frosted on glass), `grown` (foliage lettering), `painted`.

**Shapes** — `src/presets/shapes.ts` (data) + `src/three/content/shapes.tsx` (geometry)
`slab, monument, signboard, plaque, book, installation, glass-panel, lectern, wall, hedge, sculpture, model`
Each declares a footprint and a text area (`width, y, z, size, maxLines, tilt`);
titles are wrapped and auto-fitted into that area.

## Adding a preset

- **Material**: add an entry to `MATERIAL_PRESETS`. Nothing else changes.
- **Typography**: add an entry to `TYPOGRAPHY_PRESETS`. For a new typeface, convert
  a TTF/OTF to typeface JSON (e.g. facetype.js), put it in `public/fonts/` and add it
  to `FONT_URLS`.
- **Shape**: add its data to `SHAPE_PRESETS` and a component to `SHAPES` in
  `src/three/content/shapes.tsx`. The component receives the resolved surface,
  ink and accent materials and renders `<ThreeDTypography>` in its text area.

## Architecture

```
content/*.md
   │  src/lib/content/registry.ts   (gray-matter + zod + marked, build time, server only)
   ▼
ContentEntry { slug, category, href, html, visual: { material, typography, objectType, … } }
   │                                        │
   ▼                                        ▼
3D: src/three/content/                     Pages: src/components/editorial/
  ContentLayer       placement → slots       ArticleLayout / EntryIndex
  MaterialContentObject  generic renderer    (themed by the same presets)
  shapes / ThreeDTypography / contentMaterials
```

The parser, presets, 3D renderer and editorial renderer only share the
`ContentEntry` type and the preset registries.

## Placement

Each island exports a list of `slots` (a position and a facing direction) on
open ground beside its paths. Entries are assigned in this order: explicit slot index → explicit
`{x, z}` → next free slot (featured first, then newest) → a spiral around the
island edge if there are more entries than slots. The Y position is found by
raycasting onto the terrain, so objects always sit on the ground.
