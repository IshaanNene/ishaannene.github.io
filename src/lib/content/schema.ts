import { z } from "zod";

export const CATEGORIES = ["blogs", "projects", "research", "playground", "resume"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Default physical treatment per category (overridable per entry via `visual`). */
export const CATEGORY_DEFAULTS: Record<Category, { material: string; typography: string; objectType: string }> = {
  blogs: { material: "stone", typography: "carved-roman", objectType: "tablet" },
  projects: { material: "wood", typography: "painted-sign", objectType: "signpost" },
  research: { material: "steel", typography: "etched-steel", objectType: "metal-panel" },
  playground: { material: "grass", typography: "grass-grown", objectType: "grass-letters" },
  resume: { material: "concrete", typography: "raised-concrete", objectType: "concrete-block" },
};

const Placement = z.union([
  z.literal("auto"),
  z.number().int().nonnegative(),
  z.object({ x: z.number(), z: z.number() }),
]);

export const VisualSchema = z
  .object({
    material: z.string().optional(),
    typography: z.string().optional(),
    objectType: z.string().optional(),
    placement: Placement.default("auto"),
    scale: z.number().positive().max(4).default(1),
    rotation: z.number().default(0),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    modelPath: z.string().optional(),
    interaction: z.enum(["link", "none"]).default("link"),
  })
  .default({ placement: "auto", scale: 1, rotation: 0, interaction: "link" });

export const FrontmatterSchema = z.object({
  title: z.string().min(1),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case")
    .optional(),
  category: z.enum(CATEGORIES).optional(),
  date: z.union([z.string(), z.date()]).transform((d) => new Date(d).toISOString().slice(0, 10)),
  excerpt: z.string().default(""),
  tags: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  subtitle: z.string().optional(),
  /** resume-only fields */
  role: z.string().optional(),
  organization: z.string().optional(),
  period: z.string().optional(),
  links: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
  modelPath: z.string().optional(),
  visual: VisualSchema,
});

export type Frontmatter = z.infer<typeof FrontmatterSchema>;

export interface ResolvedVisual {
  material: string;
  typography: string;
  objectType: string;
  placement: "auto" | number | { x: number; z: number };
  scale: number;
  rotation: number;
  color?: string;
  modelPath?: string;
  interaction: "link" | "none";
}

/** Serializable entry passed to client components (no body). */
export interface ContentSummary {
  title: string;
  slug: string;
  category: Category;
  date: string;
  excerpt: string;
  tags: string[];
  featured: boolean;
  subtitle?: string;
  role?: string;
  organization?: string;
  period?: string;
  href: string;
  visual: ResolvedVisual;
  readingMinutes: number;
}

export interface ContentEntry extends ContentSummary {
  html: string;
  links: { label: string; href: string }[];
  sourcePath: string;
}
