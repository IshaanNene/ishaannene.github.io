import type { Metadata } from "next";
import { DestinationHero, PageShell, surfaceStyle } from "@/components/editorial/Editorial";
import { getEntries, toSummary } from "@/lib/content/registry";
import { getMaterialPreset } from "@/presets/materials";
import { getTypographyPreset } from "@/presets/typography";

export const metadata: Metadata = { title: "Resume", description: "Experience, milestones and recognition." };

export default function Page() {
  const entries = getEntries("resume").sort((a, b) => b.date.localeCompare(a.date));
  return (
    <PageShell>
      <DestinationHero id="resume" entries={entries.map(toSummary)}>
        <button className="nb-btn" data-print>
          Print / PDF
        </button>
      </DestinationHero>
      <section className="mx-auto max-w-5xl px-4 py-14 md:px-8">
        <h2 className="mb-8 border-b-2 border-ink pb-3 text-3xl font-bold">Experience</h2>
        <ol className="space-y-6">
          {entries.map((e) => {
            const t = getTypographyPreset(e.visual.typography);
            return (
              <li key={e.slug} id={e.slug} className={`surface surface-${getMaterialPreset(e.visual.material).editorial.pattern} scroll-mt-24 border-2 border-ink shadow-[4px_4px_0_#171717]`} style={surfaceStyle(e.visual.material)}>
                <div className="grid gap-4 p-6 md:grid-cols-[180px_1fr]">
                  <div className="mono-label" style={{ color: "var(--s-muted)" }}>
                    {e.period}
                  </div>
                  <div>
                    <h3 className={`text-3xl font-bold title-${t.treatment} ${t.uppercase ? "uppercase" : ""}`}>{e.role ?? e.title}</h3>
                    <p className="mt-1 font-mono text-sm">{e.organization}</p>
                    <div className="prose-body mt-4 !text-base" style={{ color: "var(--s-fg)" }} dangerouslySetInnerHTML={{ __html: e.html }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
      <script dangerouslySetInnerHTML={{ __html: `document.querySelector('[data-print]')?.addEventListener('click',()=>window.print())` }} />
    </PageShell>
  );
}
