import type { Metadata } from "next";
import { DestinationHero, EntryIndex, PageShell } from "@/components/editorial/Editorial";
import { DESTINATION_MAP } from "@/config/world";
import { getEntries, toSummary } from "@/lib/content/registry";

export const metadata: Metadata = { title: DESTINATION_MAP.research.title, description: DESTINATION_MAP.research.tagline };

export default function Page() {
  const entries = getEntries("research").map(toSummary);
  return (
    <PageShell>
      <DestinationHero id="research" entries={entries} />
      <EntryIndex entries={entries} />
    </PageShell>
  );
}
