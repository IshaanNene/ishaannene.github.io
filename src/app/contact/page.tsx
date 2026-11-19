import type { Metadata } from "next";
import { DestinationHero, PageShell, surfaceStyle } from "@/components/editorial/Editorial";
import { SITE } from "@/config/site";
import { getMaterialPreset } from "@/presets/materials";
import { getTypographyPreset } from "@/presets/typography";

export const metadata: Metadata = { title: "Contact", description: "Send a signal from the harbour." };

export default function Page() {
  return (
    <PageShell>
      <DestinationHero id="contact" entries={[]} />
      <section className="mx-auto max-w-5xl px-4 py-14 md:px-8">
        <h2 className="mb-8 border-b-2 border-ink pb-3 text-3xl font-bold">Harbour signboards</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {SITE.contact.map((c) => {
            const t = getTypographyPreset(c.typography);
            return (
              <a key={c.id} href={c.href} className={`surface surface-${getMaterialPreset(c.material).editorial.pattern} block border-2 border-ink p-6 shadow-[4px_4px_0_#171717] transition-transform hover:-translate-y-0.5`} style={surfaceStyle(c.material)}>
                <span className="mono-label" style={{ color: "var(--s-muted)" }}>
                  {getMaterialPreset(c.material).label}
                </span>
                <span className={`mt-10 block text-4xl font-bold title-${t.treatment} ${t.uppercase ? "uppercase" : ""}`}>{c.label}</span>
                <span className="mt-2 block font-mono text-sm break-all">{c.value}</span>
              </a>
            );
          })}
        </div>
        <p className="mt-10 max-w-xl text-lg text-ink/70">The fastest way to reach me is email. For code, issues and pull requests are welcome on GitHub.</p>
      </section>
    </PageShell>
  );
}
