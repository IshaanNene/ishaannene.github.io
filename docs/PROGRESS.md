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

## 3. Placeholder content and copy (replace with real material)

- `src/config/site.ts`: role, bio, principles and the email address
  (`hello@example.com`) are placeholders. The GitHub link is real.
- All Markdown in `content/`: 5 blogs, 5 projects, 4 research, 4 playground and
  4 resume entries, each marked *Placeholder*.
- 3D typefaces in `public/fonts/` are three.js sample typefaces (Helvetiker,
  Droid Serif, Droid Sans Mono, Optimer). Convert the site fonts (Space Grotesk,
  Instrument Serif, JetBrains Mono) to typeface JSON for a matching identity.
- No social preview image (`og:image`) yet.

## 4. Assets awaiting refinement

- Contact island dock and pier geometry is busy close up; simplify the piling layout.
- Building silhouettes are modular kit-bash (bevelled boxes, lathes, tubes).
  They read well at portfolio zoom levels. Hero buildings would benefit from a
  hand-modelling pass in the `.blend` sources (window insets, trims, roof detail).
- Tree variants are stylised low-poly. Leaf cards or a denser crown would add realism.
- Textures are generated tiling normal/roughness maps. Photographic PBR sets
  would add surface detail.
- Large first load: about 6.8 MB of models after meshopt. LOD1 loads first. Possible
  next steps are KTX2 textures and splitting `about.glb` further.

## Verified

- Overview renders all 7 islands, bridges, vegetation, labels, mini-map and HUD.
- Hover highlight, click-to-focus, keys `1`–`7` / `Esc` / arrows / `+ −` / `Enter`,
  `?focus=<id>` deep links, Cmd+K palette.
- Clicking a 3D content object opens its page; headers match material and typography.
- Every destination page renders a live 3D hero of its island.
- Mobile: menu, camera buttons, bottom panel with the island framed above it.
- `npm run build` statically generates all 28 routes. `out/` served locally works with compressed models.
- WebGL-unavailable and renderer-crash paths fall back to an HTML destination list.

## Not yet verified

- Deployment on GitHub Pages (workflow rewritten, not pushed).
- Real low-end mobile hardware; only emulated in a desktop browser.
- Real frame rate. The QA browser throttled every WebGL canvas, including a bare
  `clear()` test, to about 1 fps, so frame timing must be measured in a normal browser window.
- Safari / Firefox.
