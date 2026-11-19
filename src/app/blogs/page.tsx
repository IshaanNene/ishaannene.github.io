import type { Metadata } from "next";
import { DestinationHero, EntryIndex, PageShell } from "@/components/editorial/Editorial";
import { DESTINATION_MAP } from "@/config/world";
import { getEntries, toSummary } from "@/lib/content/registry";

export const metadata: Metadata = { title: DESTINATION_MAP.blogs.title, description: DESTINATION_MAP.blogs.tagline };

export default function Page() {
  const entries = getEntries("blogs").map(toSummary);
  return (
    <PageShell>
      <DestinationHero id="blogs" entries={entries} />
      <EntryIndex entries={entries} />
    </PageShell>
  );
}
