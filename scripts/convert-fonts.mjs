#!/usr/bin/env node
/**
 * Convert the TTFs in assets-src/fonts into three.js typeface JSON
 * (public/fonts/<name>.json) for TextGeometry / drei <Text3D>.
 * Same glyph encoding as three's TTFLoader, limited to Latin text glyphs
 * to keep the files small.
 *
 *   node scripts/convert-fonts.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import opentype from "opentype.js";

const SRC = new URL("../assets-src/fonts/", import.meta.url).pathname;
const OUT = new URL("../public/fonts/", import.meta.url).pathname;
const KEEP = new Set([..." !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~·–—‘’“”…éèêáàäöüñçÉ×→"]);

function convert(font) {
  const round = Math.round;
  const scale = 100000 / ((font.unitsPerEm || 2048) * 72);
  const glyphs = {};
  const map = font.encoding.cmap.glyphIndexMap;
  for (const code of Object.keys(map)) {
    const ch = String.fromCodePoint(Number(code));
    if (!KEEP.has(ch)) continue;
    const glyph = font.glyphs.get(map[code]);
    const token = { ha: round(glyph.advanceWidth * scale), x_min: round((glyph.xMin ?? 0) * scale), x_max: round((glyph.xMax ?? 0) * scale), o: "" };
    for (const c of glyph.path.commands) {
      const type = c.type.toLowerCase() === "c" ? "b" : c.type.toLowerCase();
      token.o += type + " ";
      if (c.x !== undefined) token.o += `${round(c.x * scale)} ${round(c.y * scale)} `;
      if (c.x1 !== undefined) token.o += `${round(c.x1 * scale)} ${round(c.y1 * scale)} `;
      if (c.x2 !== undefined) token.o += `${round(c.x2 * scale)} ${round(c.y2 * scale)} `;
    }
    glyphs[ch] = token;
  }
  return {
    glyphs,
    familyName: font.getEnglishName("fullName"),
    ascender: round(font.ascender * scale),
    descender: round(font.descender * scale),
    underlinePosition: font.tables.post.underlinePosition,
    underlineThickness: font.tables.post.underlineThickness,
    boundingBox: { xMin: font.tables.head.xMin, xMax: font.tables.head.xMax, yMin: font.tables.head.yMin, yMax: font.tables.head.yMax },
    resolution: 1000,
    original_font_information: { fullName: font.getEnglishName("fullName"), license: font.getEnglishName("license") ?? "" },
  };
}

for (const f of readdirSync(SRC).filter((f) => f.endsWith(".ttf"))) {
  const buf = readFileSync(join(SRC, f));
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const json = JSON.stringify(convert(font));
  const out = join(OUT, basename(f, ".ttf") + ".json");
  writeFileSync(out, json);
  console.log(`${f.padEnd(22)} → public/fonts/${basename(out)}  ${(json.length / 1024).toFixed(0)} KB`);
}
