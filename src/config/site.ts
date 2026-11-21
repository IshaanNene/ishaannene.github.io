/**
 * Personal details. Bio and principles are drawn from the GitHub profile and project READMEs.
 */
export const SITE = {
  name: "Ishaan Nene",
  wordmark: "ISHAAN NENE",
  role: "Software engineer",
  url: "https://ishaannene.github.io",
  description:
    "Ishaan Nene's portfolio as an explorable 3D archipelago: distributed systems, agents, research and experiments as physical objects.",
  bio: [
    "Software engineer at IBM, mostly in Go, Rust and C/C++. I build distributed back-ends and the tooling around them: a multi-tenant issue tracker on twelve Rust services, a chess platform on Go and Erlang, an autonomous on-call agent and a crawler that doubles as an MCP server.",
    "This site is an archipelago: each island is a part of the work, and every write-up, project and experiment is a physical object you can walk up to and read.",
  ],
  principles: [
    { title: "Production from the first commit", text: "Tenancy, events and operations are designed in, not bolted on after the demo." },
    { title: "Measured, not claimed", text: "Numbers come from a test anyone can rerun, with the caveats next to them." },
    { title: "Evidence before fixes", text: "A root cause cites its evidence; a fix ships with a test that failed before it." },
  ],
  contact: [
    { id: "email", label: "Email", value: "ishaannene@gmail.com", href: "mailto:ishaannene@gmail.com", material: "wood", typography: "engraved-sans" },
    { id: "github", label: "GitHub", value: "github.com/IshaanNene", href: "https://github.com/IshaanNene", material: "steel", typography: "engraved-sans" },
    { id: "linkedin", label: "LinkedIn", value: "in/ishaan-nene", href: "https://www.linkedin.com/in/ishaan-nene-517247256", material: "corten", typography: "stencil-mono" },
    { id: "leetcode", label: "LeetCode", value: "leetcode.com/ishaannene", href: "https://leetcode.com/ishaannene", material: "brass", typography: "engraved-sans" },
    { id: "kaggle", label: "Kaggle", value: "kaggle.com/ishaannene28028", href: "https://www.kaggle.com/ishaannene28028", material: "bronze", typography: "stencil-mono" },
  ],
} as const;
