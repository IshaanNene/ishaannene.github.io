/**
 * Editorial page renderer — independent of the 3D world. It reads the same
 * material/typography presets so each page carries its object's identity.
 */
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { DESTINATION_MAP, type DestinationId } from "@/config/world";
import { SITE } from "@/config/site";
import type { ContentEntry, ContentSummary } from "@/lib/content/schema";
import { getMaterialPreset } from "@/presets/materials";
import { getShapePreset } from "@/presets/shapes";
import { getTypographyPreset } from "@/presets/typography";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { HeroCanvas } from "./HeroCanvas";

function isDark(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

export function surfaceStyle(material: string): CSSProperties {
  const e = getMaterialPreset(material).editorial;
  return {
    ["--s-bg" as string]: e.bg,
    ["--s-fg" as string]: e.fg,
    ["--s-muted" as string]: e.muted,
    ["--s-accent" as string]: e.accent,
    ["--s-on-accent" as string]: isDark(e.accent) ? "#F4EFE6" : "#171717",
    ["--s-rule" as string]: e.rule,
  };
}

const FONT_CLASS = { serif: "font-serif", sans: "font-sans font-bold tracking-tight", mono: "font-mono" } as const;

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      {children}
      <footer className="border-t-2 border-ink bg-ink px-4 py-10 text-cream md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-2xl font-bold">{SITE.name}</p>
            <p className="mono-label mt-1 text-cream/50">An archipelago of work · built with Blender, three.js & Markdown</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="nb-btn">
              ← Back to the archipelago
            </Link>
            {SITE.contact.map((c) => (
              <a key={c.id} href={c.href} className="nb-btn">
                {c.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export function DestinationHero({ id, entries, children }: { id: DestinationId; entries: ContentSummary[]; children?: ReactNode }) {
  const d = DESTINATION_MAP[id];
  return (
    <section className="grid border-b-2 border-ink lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col justify-between gap-8 border-b-2 border-ink p-6 md:p-10 lg:border-r-2 lg:border-b-0">
        <div>
          <p className="mono-label flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center bg-ink text-lime">{d.key}</span> {d.kicker}
          </p>
          <h1 className="mt-6 text-6xl leading-[0.9] font-bold tracking-tight md:text-8xl">{d.title}</h1>
          <p className="mt-6 max-w-md text-xl leading-snug">{d.tagline}</p>
          <p className="mt-3 max-w-md text-ink/65">{d.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/?focus=${id}`} className="nb-btn nb-btn--dark">
            View on the map ↗
          </Link>
          {children}
        </div>
      </div>
      <div className="relative h-[380px] bg-[#efae86] md:h-[520px]">
        <HeroCanvas id={id} entries={entries} />
        <p className="mono-label pointer-events-none absolute bottom-3 left-3 bg-cream px-2 py-1 border-2 border-ink">Live 3D · drag to orbit · click an object</p>
      </div>
    </section>
  );
}

export function MaterialSwatch({ material }: { material: string }) {
  const m = getMaterialPreset(material);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 border-[1.5px] border-ink" style={{ background: m.surface.color }} />
      <span className="mono-label">{m.label}</span>
    </span>
  );
}

/** Index listing for blogs/projects/research/playground: each row wears its object's material. */
export function EntryIndex({ entries }: { entries: ContentSummary[] }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 md:px-8">
      <div className="mb-6 flex items-end justify-between border-b-2 border-ink pb-3">
        <h2 className="text-3xl font-bold">Index</h2>
        <span className="mono-label text-ink/50">{entries.length} entries · auto-generated from Markdown</span>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {entries.map((e) => {
          const t = getTypographyPreset(e.visual.typography);
          return (
            <li key={e.slug}>
              <Link href={e.href} className={`surface surface-${getMaterialPreset(e.visual.material).editorial.pattern} group block border-2 border-ink p-5 shadow-[4px_4px_0_#171717] transition-transform hover:-translate-y-0.5`} style={surfaceStyle(e.visual.material)}>
                <div className="mb-8 flex items-center justify-between">
                  <span className="mono-label" style={{ color: "var(--s-muted)" }}>
                    {e.date} · {getShapePreset(e.visual.objectType).label}
                  </span>
                  {e.featured && <span className="mono-label bg-lime px-1.5 text-ink">Featured</span>}
                </div>
                <h3 className={`text-3xl leading-tight ${FONT_CLASS[t.editorialFont]} title-${t.treatment} ${t.uppercase ? "uppercase" : ""}`}>{e.title}</h3>
                <p className="mt-3 text-[15px] leading-snug" style={{ color: "var(--s-muted)" }}>
                  {e.excerpt}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {e.tags.map((tag) => (
                    <span key={tag} className="mono-label border px-1.5" style={{ borderColor: "var(--s-rule)" }}>
                      {tag}
                    </span>
                  ))}
                  <span className="mono-label ml-auto group-hover:underline">Read →</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Long-form reading page with a material-themed header and a plain, accessible body. */
export function ArticleLayout({ entry, prev, next }: { entry: ContentEntry; prev?: ContentSummary; next?: ContentSummary }) {
  const mat = getMaterialPreset(entry.visual.material);
  const typo = getTypographyPreset(entry.visual.typography);
  const dest = DESTINATION_MAP[entry.category as DestinationId];
  return (
    <article>
      <header className={`surface surface-${mat.editorial.pattern} border-b-2 border-ink`} style={surfaceStyle(entry.visual.material)}>
        <div className="mx-auto max-w-5xl px-4 pt-10 pb-14 md:px-8 md:pt-16 md:pb-20">
          <nav className="mono-label mb-10 flex flex-wrap items-center gap-2" style={{ color: "var(--s-muted)" }} aria-label="Breadcrumb">
            <Link href="/" className="hover:underline">
              Archipelago
            </Link>
            <span>/</span>
            <Link href={dest.route} className="hover:underline">
              {dest.title}
            </Link>
            <span>/</span>
            <span>{entry.slug}</span>
          </nav>
          <div className="mb-6 flex flex-wrap gap-2">
            <span className="mono-label border-2 px-2 py-0.5" style={{ borderColor: "var(--s-fg)" }}>
              {mat.label}
            </span>
            <span className="mono-label border-2 px-2 py-0.5" style={{ borderColor: "var(--s-fg)" }}>
              {typo.label}
            </span>
            <span className="mono-label px-2 py-0.5" style={{ background: "var(--s-accent)", color: "var(--s-on-accent)" }}>
              {getShapePreset(entry.visual.objectType).label}
            </span>
          </div>
          <h1 className={`max-w-4xl text-5xl leading-[0.95] md:text-7xl ${FONT_CLASS[typo.editorialFont]} title-${typo.treatment} ${typo.uppercase ? "uppercase" : ""}`}>{entry.title}</h1>
          {entry.subtitle && <p className="mt-4 font-mono text-sm uppercase tracking-widest">{entry.subtitle}</p>}
          <p className="mt-6 max-w-2xl text-xl leading-snug" style={{ color: "var(--s-muted)" }}>
            {entry.excerpt}
          </p>
          <div className="mono-label mt-8 flex flex-wrap gap-x-6 gap-y-2" style={{ color: "var(--s-muted)" }}>
            <span>{entry.date}</span>
            <span>{entry.readingMinutes} min read</span>
            <span>{entry.tags.join(" · ")}</span>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 md:grid-cols-[minmax(0,1fr)_200px] md:px-8">
        <div className="prose-body" dangerouslySetInnerHTML={{ __html: entry.html }} />
        <aside className="space-y-4 md:sticky md:top-24 md:self-start">
          {entry.links.length > 0 && (
            <div className="nb-panel p-3">
              <p className="mono-label mb-2 text-ink/60">Links</p>
              {entry.links.map((l) => (
                <a key={l.href} href={l.href} className="block py-1 font-medium underline decoration-coral decoration-2">
                  {l.label} ↗
                </a>
              ))}
            </div>
          )}
          <Link href={`/?focus=${entry.category}`} className="nb-btn w-full justify-center">
            Find it on the map
          </Link>
          <Link href={dest.route} className="nb-btn nb-btn--dark w-full justify-center">
            All {dest.title.toLowerCase()}
          </Link>
        </aside>
      </div>
      {(prev || next) && (
        <nav className="mx-auto grid max-w-5xl gap-3 px-4 pb-16 md:grid-cols-2 md:px-8" aria-label="More">
          {prev ? (
            <Link href={prev.href} className="nb-panel block p-4 hover:bg-lime">
              <span className="mono-label text-ink/50">← Previous</span>
              <span className="mt-1 block text-lg font-bold">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={next.href} className="nb-panel block p-4 text-right hover:bg-lime">
              <span className="mono-label text-ink/50">Next →</span>
              <span className="mt-1 block text-lg font-bold">{next.title}</span>
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}
