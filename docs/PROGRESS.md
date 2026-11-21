# Progress

Status as of 2026-11-19. Verified in a real browser (desktop and a 375×812
mobile viewport) against the dev server and the static export (`out/`).

## 1. Completed 3D models (Blender-generated GLBs, editable `.blend` sources)

| Asset | File | Contents |
|---|---|---|
| About island (HQ) | `islands/about.glb` + LOD1 | stepped headquarters tower, rooftop garden, plaza with fountain, pond + waterfall, 6 bridge landings |
| Projects island (industrial) | `islands/projects.glb` + LOD1 | server hall, pipe racks, cooling towers, chimney, catwalk, gravel yard |
| Blogs island (library) | `islands/blogs.glb` + LOD1 | colonnaded library, domed reading room, archive tower, bookshelves, garden |
| Research island (observatory) | `islands/research.glb` + LOD1 | observatory dome, glass lab, tiered tower, particle ring, dish |
| Playground island (workshop) | `islands/playground.glb` + LOD1 | workshop shed, bouncy pylons, spinning sculptures, circular plaza |
| Resume island (pavilion) | `islands/resume.glb` + LOD1 | exhibition pavilion, concrete walls, colonnade |
| Contact island (harbour) | `islands/contact.glb` + LOD1 | lighthouse, radio mast, harbour huts, wooden dock and pier |
| 8 bridges | `bridges/*.glb` | plank, truss, arch, suspension — railings, supports, abutments |
| Vegetation kit | `vegetation/vegetation.glb` | 2 broadleaf trees, conifer, cypress, bush, rock, palm |

Every island includes an irregular layered rock foundation with strata and
hanging rocks, terrain with paths, baked vertex AO, and semantic node groups.

## 2. Procedural runtime geometry (built in three.js from presets)

These are intentionally procedural so they can be generated from Markdown:

- **Content objects**: 12 shapes (slab, monument, signboard, plaque, book,
  installation, glass-panel, lectern, wall, hedge, sculpture, model plinth)
  with real extruded/engraved/etched/grown 3D lettering.
- **Island name signs**: 3D concrete lettering on plinths.
- **Contact signboards**: generated from `src/config/site.ts`.
- **Atmosphere**: sky dome shader, volumetric-style cloud layer, sea of
  clouds, lighthouse beam, water and waterfall shaders, foliage wind.

## 2b. Realism pass (2026-11-20)

- Scanned CC0 textures (Poly Haven) on cliffs, grass, timber, concrete and stone.
- Physical sunset sky (three.js Sky), reflective ocean far below (Water, high quality only),
  sun-lit cloud banks, waterfalls that fall the full drop into mist, floating islets, an airship.
- Island names are carved into chipped stone blocks.
- Content objects follow the reference styles: blogs → carved stone tablet with an interlace
  border and torch (Cinzel); projects → wooden arrow signpost, hand-painted red lettering
  (Bangers); playground → grass-grown letters (Archivo Black + instanced blades);
  resume → tilted cast-concrete block with raised letters (Fredoka); research → bolted brushed-steel
  panel on legs with dark etched lettering (a part-metallic "steel" preset, since fully metallic
  surfaces mirrored the dark sky and went black).
- Contact: GitHub board moved to brushed steel with engraved lettering; boathouse moved off the
  signboards and given a terracotta roof.
- Tried and reverted: clustered, photo-textured tree crowns and smooth boulders looked worse
  than the clean low-poly versions. Trees stay stylised; a hand-modelled tree kit is the next step.

## 2c. Full-realism pass (in progress, 2026-11-20)

- Vegetation library rebuilt from CC0 Poly Haven scans (`scripts/blender/build_vegetation.py`,
  sources via `scripts/fetch-polyhaven.py`, `npm run assets:vegetation`): scanned broadleaf trunks
  with crowns rebuilt from rendered leaf cards (~7k tris instead of 1.07M), card-based conifers and
  cypresses with real fir-needle sprays, leaf-mound bushes, mossy scanned rocks. 1.4 MB total.
- Seasonal foliage: each tree instance gets its own hue (summer greens with gold, amber, orange
  and russet trees mixed in); leaf detail comes from the scan, hue from the instance.
- Ground cover on every lawn (`src/three/GroundCover.tsx`): instanced wind-swaying grass blades,
  wildflower drifts and scanned pebbles, thinned by the terrain's baked AO.
- Island names are gold inlay on sandstone; About's orange ring replaced by a faceted golden gem.
- Sky melts into the fog colour at the horizon (removed the hard line where the ocean ended).
- Island undersides wrapped in scanned rock faces (`scripts/blender/build_cliffs.py`,
  `src/three/CliffShell.tsx`): ~130 instanced pieces per island in leaning bands, all scans
  brought to one sandstone tone, moss on up-facing ledges.
- Scanned props (`scripts/blender/build_props.py`): street lamps and benches along every path,
  plus a themed set per island (Projects: flood lights, pipes, utility boxes; Blogs: café
  tables; Playground: picnic tables, fire pit; Contact: timber pier sections replacing the
  plank piers, lanterns). Lamp glass and bulbs glow.
- Scanned PBR building materials (`node scripts/convert-textures.mjs`): painted render
  (cream, lime, orange, blue, mint) over a rough-plaster detail map, travertine marble for
  light stone, rock-wall texture for mid/dark stone, metal-plate relief on steel, corrugated
  cladding on the Projects server halls, clay tiles on Contact's pitched roofs.
- Overgrown rims (`edge_trees` in `scripts/blender/generate_islands.py`): two staggered rows of
  trees and bushes around every island edge; the front sector (sign side) only gets bushes and
  low cypresses, and bridge landings stay open. ~665k vegetation triangles across the world.
- Grass-blade cards removed (they read as small triangles). Lawns now break up the scanned grass
  texture with a second rotated sample (no visible tiling), lush and sun-dried patches and fine
  clumpy brightness (`applyLawn` in `src/three/materials.ts`), plus low leafy clumps, wildflower
  drifts and pebbles (`GroundCover.tsx`).
- Roads on About, Projects, Research and Resume: asphalt with concrete kerbs and a dashed centre
  line from each bridge landing to the island hub (`build_road_details`).
- Golden sculptures on every island (`place_sculpture` in `scripts/blender/generate_buildings.py`):
  crystal cluster, obelisk, upright ring, icosahedron, double octahedron, spire and gem, each
  turning slowly on a stepped stone plinth.
- Greenery spilling over every rim (`place_drapes` → manifest `drapes`, `Drapes` in
  `src/three/Vegetation.tsx`): ~750 upside-down, stretched leaf mounds hung from the outermost rock
  just below the grass lip (measured per rim sample in `build_foundation`, so none float where the
  lip is pulled in), in mossy greens; bridge landings and waterfall lips stay clear.
- Airship now flies nose-first (heading follows its elliptical path's velocity).
- Render budget: 5.7M → 3.1M triangles in the overview (cliff pieces decimated to 1.0–1.3k
  tris, lawn pebbles are an 80-triangle stone instead of the 2.8k-triangle scan); low quality also
  halves the rim greenery. Shadow casters 617 → 460: island undersides (their shadow falls into
  open sky), small props, pebbles and lawn tufts no longer render into the shadow map. In
  development `window.__world` exposes `{ gl, scene, camera }`.

## 2d. Hero building detail pass (2026-11-20)

- Shared facade helpers in `scripts/blender/generate_buildings.py`: framed windows with sills,
  mullions, transoms and optional stone surrounds; double doors with canopies and steps; rooftop
  plant (parapet and coping, membrane, air-handling units with fans and louvres, vent stacks,
  skylights); pitched roofs with real eaves overhang, fascias, bargeboards, ridge cap and chimney.
- New `window` material: opaque slate-blue glazing with a sky sheen. Lit rooms use `emit_warm`.
- About HQ: curtain wall with a mullion grid, deep fins on the long faces and scattered lit
  offices; glass balustrades on every terrace; glazed entrance; louvred service core with a roof
  door; roof parapet with plant beside the garden.
- Projects server halls: ribbed roller shutter under a hood, bollards, a personnel door with a
  canopy, wall condensers and roof coping.
- Blogs library: plinth and string course, tall framed reading-room windows with stone surrounds
  on every face (two storeys), arched-bay windows round the archive rotunda.
- Research: porthole windows, base course and door canopy on the observatory; rooftop plant on
  the labs.
- Resume gallery: lit entrance, skylights and vents. Playground workshop: framed shopfront
  window, glazed double door and side windows. Contact: the keeper's cottage gets a stone
  plinth stepping down the slope, door, windows, a tiled gable roof with chimney; the
  boathouse gets barn doors and a gable roof; the comms hut a door, window and roof unit.
- Island models grow by about 0.5 MB in total (LOD0 4.3 MB, LOD1 2.1 MB after meshopt).
- Second pass: the Playground prototype stack is now four windowed studio blocks with metal
  copings and a glass-railed roof terrace with a parasol; the cantilever studio has ribbon
  windows and a raking steel strut back to its pylon. The Resume pavilion has cruciform chrome
  columns, chrome glazing bars, a shadow reveal and downlights in the roof soffit. The Research
  labs are furnished behind the glass: back wall, benches with screens and instruments, racks
  with status lights and ceiling light strips. About 0.17 MB more.

## 2e. Harbour fix and lighter first load (2026-11-20)

- Contact's sky harbour is rebuilt: the piers used to start ~3 units inland, so their sections
  lay across the lawn and beach and overlapped, the moored boats sat on the sand and rim trees
  grew through them. Each pier is now rooted on the beach just inside the rim and runs straight
  out into the void (`harbour` in `SPEC_CONTACT`), with plain sections and an end section only at
  the tip, a lamp and lantern at the end and its boat moored alongside. The landward ends are
  reserved so trees and props keep off, and rim greenery skips the harbour.
- First load ~17 MB → 9.7 MB of models, textures and fonts (measured on a cold overview load):
  - Full-detail island models now load within ~39 units (high quality) instead of ~63, so the
    overview loads only LOD1 and focusing an island fetches it and its close neighbours.
  - Cliff scans use 512 px textures (2.9 MB → 1.0 MB, about a quarter of the VRAM) and props
    256 px (2.1 MB → 0.96 MB); the budgets live in the `assets:cliffs` / `assets:props` scripts.
  - `node scripts/optimize-glb.mjs --force <folder>` recompresses just the named folders.

## 3. Content

- Real content from github.com/IshaanNene, each entry linking its repository:
  7 projects, 4 research projects, 4 playground experiments, and 5 blog posts that are factual
  write-ups of the larger projects (drawn from their READMEs, with their measured numbers and
  stated limitations).
- `src/config/site.ts`: bio and principles drawn from the profile and READMEs; contact has
  email, GitHub, LinkedIn, LeetCode and Kaggle. The Contact island has five signboard slots
  (front row of three, back row of two).
- **Still placeholder:** the 4 resume entries (`content/resume/`), awaiting real role, dates
  and degree details.
- Content objects use Cinzel, Bangers, Archivo Black and Fredoka. Generic labels still
  use three.js sample typefaces (Helvetiker, Droid, Optimer).
- No social preview image (`og:image`) yet.

## 4. Assets awaiting refinement

- Building massing is still modular (bevelled boxes, lathes, tubes). Facades now have
  windows, doors, trims and roof detail on every island (section 2d).
- Tree variants are stylised low-poly. Leaf cards or a denser crown would add realism.
- Textures are generated tiling normal/roughness maps. Photographic PBR sets
  would add surface detail.
- First load is about 9.7 MB (section 2e). The largest remaining items are the vegetation
  library (1.1 MB) and the 1K PBR normal maps for grass, stone and rock (~0.3–0.5 MB each);
  KTX2 textures would cut download and VRAM further.

## Verified

- Overview renders all 7 islands, bridges, vegetation, labels, mini-map and HUD.
- Hover highlight, click-to-focus, keys `1`–`7` / `Esc` / arrows / `+ −` / `Enter`,
  `?focus=<id>` deep links, Cmd+K palette.
- Clicking a 3D content object opens its page; headers match material and typography.
- Every destination page renders a live 3D hero of its island.
- Mobile: menu, camera buttons, bottom panel with the island framed above it.
- `npm run build` statically generates every route. `out/` served locally works with compressed models.
- GitHub Pages deployment: PRs #1–#3 deployed and the live site renders.
- WebGL-unavailable and renderer-crash paths fall back to an HTML destination list.

## Not yet verified

- Real low-end mobile hardware; only emulated in a desktop browser.
- Real frame rate. The QA browser throttled every WebGL canvas, including a bare
  `clear()` test, to about 1 fps, so frame timing must be measured in a normal browser window.
- Safari / Firefox.
