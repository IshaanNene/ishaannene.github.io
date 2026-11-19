import { HomeExperience } from "@/components/HomeExperience";
import { getContentRegistry } from "@/lib/content/registry";

export default function Home() {
  // The registry is built from content/**/*.md at build time; the world
  // turns every entry into a physical object automatically.
  return <HomeExperience entries={getContentRegistry()} />;
}
