import type { Metadata } from "next";
import { DestinationHero, EntryIndex, PageShell } from "@/components/editorial/Editorial";
import { DESTINATION_MAP } from "@/config/world";
import { getEntries, toSummary } from "@/lib/content/registry";

export const metadata: Metadata = { title: DESTINATION_MAP.playground.title, description: DESTINATION_MAP.playground.tagline };

export default function Page() {
  const entries = getEntries("playground").map(toSummary);
  return (
    <PageShell>
      <DestinationHero id="playground" entries={entries} />
      <EntryIndex entries={entries} />
    </PageShell>
  );
}
