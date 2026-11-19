import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleLayout, PageShell } from "@/components/editorial/Editorial";
import { getEntries, getEntry, toSummary } from "@/lib/content/registry";

export const dynamicParams = false;

export function generateStaticParams() {
  return getEntries("blogs").map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = getEntry("blogs", (await params).slug);
  return e ? { title: e.title, description: e.excerpt } : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getEntry("blogs", slug);
  if (!entry) notFound();
  const all = getEntries("blogs");
  const i = all.findIndex((e) => e.slug === slug);
  return (
    <PageShell>
      <ArticleLayout entry={entry} prev={all[i - 1] && toSummary(all[i - 1])} next={all[i + 1] && toSummary(all[i + 1])} />
    </PageShell>
  );
}
