import worldJson from "../../config/world.json";
import manifestJson from "../generated/world-manifest.json";

export type DestinationId = "about" | "projects" | "blogs" | "research" | "playground" | "resume" | "contact";
export type Vec3 = [number, number, number];

export interface SlotDef {
  kind: string;
  pos: Vec3;
  facing: [number, number];
}

export interface VegInstance {
  v: string;
  p: Vec3;
  r: number;
  s: number;
}

export interface IslandManifest {
  slots: SlotDef[];
  vegetation: VegInstance[];
  label: Vec3;
  sign: { pos: Vec3; facing: [number, number] };
  outline: [number, number][];
  radius: number;
  depth: number;
  objects: string[];
  extras: { waterfalls?: { top: Vec3; height: number }[]; lighthouse?: Vec3 };
}

export interface BridgeManifest {
  id: string;
  from: DestinationId;
  to: DestinationId;
  type: string;
  a: Vec3;
  b: Vec3;
}

export interface Destination {
  id: DestinationId;
  title: string;
  kicker: string;
  tagline: string;
  description: string;
  route: string;
  accent: string;
  key: string;
  position: Vec3;
  radius: number;
  depth: number;
  models: { high: string; low: string };
  /** content categories rendered as physical objects on this island */
  contentCategory?: "blogs" | "projects" | "research" | "playground" | "resume";
}

const META: Record<DestinationId, Omit<Destination, "id" | "position" | "radius" | "depth" | "models">> = {
  about: {
    title: "About",
    kicker: "Headquarters",
    tagline: "A brutalist headquarters at the centre of the archipelago.",
    description: "Who I am, how I work, and what I care about building. Every bridge in the world starts here.",
    route: "/about",
    accent: "#DFFF00",
    key: "1",
  },
  projects: {
    title: "Projects",
    kicker: "Industrial district",
    tagline: "Server halls, pipelines and cooling towers — the things I have shipped.",
    description: "Systems, products and infrastructure. Each project stands as a plaque, sign or installation along the promenade.",
    route: "/projects",
    accent: "#FF7043",
    key: "2",
    contentCategory: "projects",
  },
  blogs: {
    title: "Blogs",
    kicker: "Library & archive",
    tagline: "A monumental library where every essay is carved in stone.",
    description: "Long-form writing on engineering and design. Walk the terrace and read the slabs.",
    route: "/blogs",
    accent: "#F4EFE6",
    key: "3",
    contentCategory: "blogs",
  },
  research: {
    title: "Research",
    kicker: "Observatory",
    tagline: "Observatory, laboratories and experimental structures.",
    description: "Papers, investigations and open questions, etched into glass installations around the labs.",
    route: "/research",
    accent: "#477BFF",
    key: "4",
    contentCategory: "research",
  },
  playground: {
    title: "Playground",
    kicker: "Workshops",
    tagline: "Workshops, prototypes and things that move when you poke them.",
    description: "Experiments, toys and half-finished ideas. Touch the pylons.",
    route: "/playground",
    accent: "#8BC9A5",
    key: "5",
    contentCategory: "playground",
  },
  resume: {
    title: "Resume",
    kicker: "Exhibition hall",
    tagline: "An exhibition pavilion of work, milestones and recognition.",
    description: "Experience and achievements, set in concrete and stone.",
    route: "/resume",
    accent: "#E8E2D7",
    key: "6",
    contentCategory: "resume",
  },
  contact: {
    title: "Contact",
    kicker: "Harbour & lighthouse",
    tagline: "A coastal island with a lighthouse, a radio mast and a sky harbour.",
    description: "Send a signal. Email, code and social channels are posted on the harbour signboards.",
    route: "/contact",
    accent: "#FF7043",
    key: "7",
  },
};

export const WORLD_MANIFEST = manifestJson as unknown as {
  islands: Record<DestinationId, IslandManifest>;
  bridges: BridgeManifest[];
};

export const DESTINATIONS: Destination[] = worldJson.islands.map((i) => ({
  id: i.id as DestinationId,
  ...META[i.id as DestinationId],
  position: i.position as Vec3,
  radius: i.radius,
  depth: i.depth,
  models: { high: `/models/islands/${i.id}.glb`, low: `/models/islands/${i.id}_lod1.glb` },
}));

export const DESTINATION_MAP = Object.fromEntries(DESTINATIONS.map((d) => [d.id, d])) as Record<DestinationId, Destination>;

export const VEGETATION_MODEL = "/models/vegetation/vegetation.glb";

export const OVERVIEW = {
  position: [4, 34, 72] as Vec3,
  target: [0, -4, -2] as Vec3,
};

/** Camera pose for a focused destination: look from the front-outside, slightly above. */
export function focusPose(d: Destination): { position: Vec3; target: Vec3 } {
  const [x, y, z] = d.position;
  const target: Vec3 = [x, y + 0.9, z];
  const out = [x * 0.35, z * 0.35 + 22];
  const len = Math.hypot(out[0], out[1]) || 1;
  const dist = d.radius * 2.2 + 7;
  const el = 0.46;
  return {
    target,
    position: [x + (out[0] / len) * dist * Math.cos(el), y + 0.9 + dist * Math.sin(el), z + (out[1] / len) * dist * Math.cos(el)],
  };
}
