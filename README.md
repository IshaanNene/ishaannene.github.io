# Archipelago portfolio

An explorable 3D portfolio: seven floating islands joined by bridges, rendered in
golden-hour light. About sits in the centre, surrounded by Projects, Blogs,
Research, Playground, Resume and Contact. Every blog post, project and paper is
a physical 3D object on its island, generated from Markdown.

- **World**: Blender-generated GLBs (`scripts/blender`), React Three Fiber, drei, three-mesh-bvh
- **Site**: Next.js App Router, static export for GitHub Pages, Tailwind v4
- **Content**: Markdown + zod-validated frontmatter → 3D objects + reading pages

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # static export → out/
npm run assets       # regenerate all 3D assets (needs .venv-blender, see docs/ASSETS.md)
```

| Doc | |
|---|---|
| [docs/CONTENT.md](docs/CONTENT.md) | adding content, frontmatter, material/typography/shape presets |
| [docs/ASSETS.md](docs/ASSETS.md) | Blender pipeline, regenerating and replacing models |
| [docs/PROGRESS.md](docs/PROGRESS.md) | what is finished, procedural, placeholder or awaiting refinement |

Controls on the map: drag to orbit, right-drag to pan, scroll to zoom, `1`–`7` jump
to an island, `Esc` reset, `Enter` open, `⌘K` search.

Deploys from `main` via `.github/workflows/static.yml`.
