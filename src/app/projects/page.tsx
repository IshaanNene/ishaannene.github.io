import type { Metadata } from "next";
import { DestinationHero, EntryIndex, PageShell } from "@/components/editorial/Editorial";
import { DESTINATION_MAP } from "@/config/world";
import { getEntries, toSummary } from "@/lib/content/registry";

export const metadata: Metadata = { title: DESTINATION_MAP.projects.title, description: DESTINATION_MAP.projects.tagline };

export default function Page() {
  const entries = getEntries("projects").map(toSummary);
  return (
    <PageShell>
      <DestinationHero id="projects" entries={entries} />
      <EntryIndex entries={entries} />
    </PageShell>
  );
}
