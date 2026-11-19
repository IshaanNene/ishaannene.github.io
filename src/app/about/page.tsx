import type { Metadata } from "next";
import Link from "next/link";
import { DestinationHero, PageShell } from "@/components/editorial/Editorial";
import { SITE } from "@/config/site";
import { DESTINATIONS } from "@/config/world";
import { getContentRegistry } from "@/lib/content/registry";

export const metadata: Metadata = { title: "About", description: SITE.description };

export default function Page() {
  const all = getContentRegistry();
  const counts = Object.fromEntries(DESTINATIONS.map((d) => [d.id, all.filter((e) => e.category === d.contentCategory).length]));
  return (
    <PageShell>
      <DestinationHero id="about" entries={all} />
      <section className="surface surface-concrete border-b-2 border-ink" style={{ ["--s-bg" as string]: "#d6d0c5", ["--s-fg" as string]: "#171717" }}>
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1fr_1.3fr] md:px-8">
          <div>
            <p className="mono-label">{SITE.role}</p>
            <h2 className="mt-3 text-5xl font-bold tracking-tight">{SITE.name}</h2>
          </div>
          <div className="space-y-5 text-xl leading-relaxed">
            {SITE.bio.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-14 md:px-8">
        <h2 className="mb-6 border-b-2 border-ink pb-3 text-3xl font-bold">Principles</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {SITE.principles.map((p, i) => (
            <div key={p.title} className="nb-panel p-5">
              <span className="mono-label text-ink/50">0{i + 1}</span>
              <h3 className="mt-6 text-2xl font-bold">{p.title}</h3>
              <p className="mt-2 text-ink/70">{p.text}</p>
            </div>
          ))}
        </div>
        <h2 className="mt-14 mb-6 border-b-2 border-ink pb-3 text-3xl font-bold">The islands</h2>
        <div className="grid gap-px border-2 border-ink bg-ink sm:grid-cols-2 lg:grid-cols-3">
          {DESTINATIONS.filter((d) => d.id !== "about").map((d) => (
            <Link key={d.id} href={d.route} className="block bg-cream p-5 hover:bg-lime">
              <span className="mono-label text-ink/50">
                {d.key} · {d.kicker}
                {counts[d.id] ? ` · ${counts[d.id]} objects` : ""}
              </span>
              <span className="mt-2 block text-2xl font-bold">{d.title}</span>
              <span className="mt-1 block text-sm text-ink/70">{d.tagline}</span>
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
