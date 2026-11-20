/**
 * Personal details. PLACEHOLDER COPY — replace with your own bio and links.
 */
export const SITE = {
  name: "Ishaan Nene",
  wordmark: "ISHAAN NENE",
  role: "Software engineer",
  url: "https://ishaannene.github.io",
  description: "An explorable 3D archipelago portfolio — projects, writing, research and experiments as physical objects.",
  bio: [
    "I build software systems and the tools around them — from distributed back-ends to the interfaces people actually touch.",
    "This site is an archipelago: each island is a part of my work, and every essay, project and experiment is a physical object you can walk up to and read.",
  ],
  principles: [
    { title: "Make it real", text: "Prototype in the medium. Ship the thing, then refine." },
    { title: "Systems over screens", text: "Good interfaces are the visible tip of well-shaped systems." },
    { title: "Boring where it counts", text: "Reliability is a feature; novelty is a budget." },
  ],
  contact: [
    { id: "email", label: "Email", value: "hello@example.com", href: "mailto:hello@example.com", material: "wood", typography: "engraved-sans" },
    { id: "github", label: "GitHub", value: "github.com/IshaanNene", href: "https://github.com/IshaanNene", material: "steel", typography: "engraved-sans" },
    { id: "linkedin", label: "LinkedIn", value: "linkedin.com/in/", href: "https://www.linkedin.com/", material: "corten", typography: "stencil-mono" },
  ],
} as const;
