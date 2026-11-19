import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { cache } from "react";
import { MATERIAL_PRESETS } from "@/presets/materials";
import { SHAPE_PRESETS } from "@/presets/shapes";
import { TYPOGRAPHY_PRESETS } from "@/presets/typography";
import {
  CATEGORIES,
  CATEGORY_DEFAULTS,
  FrontmatterSchema,
  type Category,
  type ContentEntry,
  type ContentSummary,
  type ResolvedVisual,
} from "./schema";

const CONTENT_ROOT = path.join(process.cwd(), "content");

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/\.md$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function hrefFor(category: Category, slug: string) {
  return category === "resume" ? `/resume/#${slug}` : `/${category}/${slug}/`;
}

function resolveVisual(category: Category, fm: ReturnType<typeof FrontmatterSchema.parse>, file: string): ResolvedVisual {
  const d = CATEGORY_DEFAULTS[category];
  const v = fm.visual;
  const check = (kind: string, id: string | undefined, table: Record<string, unknown>, fallback: string) => {
    if (id && !table[id]) {
      console.warn(`[content] ${file}: unknown ${kind} "${id}" — falling back to "${fallback}". Known: ${Object.keys(table).join(", ")}`);
      return fallback;
    }
    return id ?? fallback;
  };
  const modelPath = v.modelPath ?? fm.modelPath;
  return {
    material: check("visual.material", v.material, MATERIAL_PRESETS, d.material),
    typography: check("visual.typography", v.typography, TYPOGRAPHY_PRESETS, d.typography),
    objectType: modelPath ? "model" : check("visual.objectType", v.objectType, SHAPE_PRESETS, d.objectType),
    placement: v.placement,
    scale: v.scale,
    rotation: v.rotation,
    color: v.color,
    modelPath,
    interaction: v.interaction,
  };
}

function parseFile(category: Category, file: string): ContentEntry | null {
  const sourcePath = path.join(CONTENT_ROOT, category, file);
  const raw = fs.readFileSync(sourcePath, "utf8");
  const { data, content } = matter(raw);
  const result = FrontmatterSchema.safeParse(data);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    // Fail loudly at build time: invalid metadata should never ship silently.
    throw new Error(`[content] Invalid frontmatter in content/${category}/${file} — ${msg}`);
  }
  const fm = result.data;
  if (fm.category && fm.category !== category) {
    console.warn(`[content] ${file}: category "${fm.category}" does not match folder "${category}" — folder wins.`);
  }
  const slug = fm.slug ?? slugify(file);
  const words = content.split(/\s+/).filter(Boolean).length;
  return {
    title: fm.title,
    slug,
    category,
    date: fm.date,
    excerpt: fm.excerpt,
    tags: fm.tags,
    featured: fm.featured,
    subtitle: fm.subtitle,
    role: fm.role,
    organization: fm.organization,
    period: fm.period,
    links: fm.links,
    href: hrefFor(category, slug),
    visual: resolveVisual(category, fm, file),
    readingMinutes: Math.max(1, Math.round(words / 220)),
    html: marked.parse(content, { async: false, gfm: true }) as string,
    sourcePath: path.relative(process.cwd(), sourcePath),
  };
}

/** Every Markdown file under content/<category>/ — discovered automatically. */
export const getAllEntries = cache((): ContentEntry[] => {
  const all: ContentEntry[] = [];
  for (const category of CATEGORIES) {
    const dir = path.join(CONTENT_ROOT, category);
    if (!fs.existsSync(dir)) continue;
    const seen = new Set<string>();
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_"))) {
      const entry = parseFile(category, file);
      if (!entry) continue;
      if (seen.has(entry.slug)) throw new Error(`[content] Duplicate slug "${entry.slug}" in content/${category}`);
      seen.add(entry.slug);
      all.push(entry);
    }
  }
  return all.sort((a, b) => Number(b.featured) - Number(a.featured) || b.date.localeCompare(a.date));
});

export function getEntries(category: Category): ContentEntry[] {
  return getAllEntries().filter((e) => e.category === category);
}

export function getEntry(category: Category, slug: string): ContentEntry | undefined {
  return getEntries(category).find((e) => e.slug === slug);
}

export function toSummary(e: ContentEntry): ContentSummary {
  const { html: _h, links: _l, sourcePath: _s, ...rest } = e;
  return rest;
}

/** Lightweight registry for the 3D world and the command palette. */
export function getContentRegistry(): ContentSummary[] {
  return getAllEntries().map(toSummary);
}
