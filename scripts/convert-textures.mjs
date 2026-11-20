#!/usr/bin/env node
/**
 * Convert the fetched Poly Haven PBR sets (assets-src/polyhaven/textures/<scan>/, see
 * scripts/fetch-polyhaven.py) into web textures at public/textures/pbr/<key>/{color,normal,roughness}.webp,
 * the layout src/three/materials.ts getPbrTexture() reads.
 *
 *   node scripts/convert-textures.mjs            # every set below
 *   node scripts/convert-textures.mjs plaster    # selected keys
 */
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = new URL("../", import.meta.url).pathname;
const SRC = join(root, "assets-src/polyhaven/textures");
const OUT = join(root, "public/textures/pbr");

// runtime key -> Poly Haven scan
const SETS = {
  plaster: "white_plaster_rough_01",
  marble: "marble_01",
  rock_wall: "cliff_side",
  stone: "sandstone_cracks", // desaturated: tinted per preset (carved tablets, island name stones)
  metal: "metal_plate",
  roof_tiles: "clay_roof_tiles",
  corrugated: "corrugated_iron_02",
};
// colour maps turned into neutral grey detail (the runtime tint is the final albedo):
// "normalise" stretches contrast, a number scales the mean to that sRGB grey level
const GREY = { stone: "normalise", plaster: 205, corrugated: 185, rock_wall: 175 };
// map -> [source file, size, webp quality]
const MAPS = {
  color: ["color_Diffuse.jpg", 1024, 80],
  normal: ["normal_nor_gl.jpg", 1024, 86],
  roughness: ["roughness_Rough.jpg", 512, 78],
};

const want = process.argv.slice(2);
for (const [key, scan] of Object.entries(SETS)) {
  if (want.length && !want.includes(key)) continue;
  const dir = join(OUT, key);
  mkdirSync(dir, { recursive: true });
  let total = 0;
  for (const [map, [file, size, quality]] of Object.entries(MAPS)) {
    const src = join(SRC, scan, file);
    if (!existsSync(src)) {
      console.warn(`missing ${src} (run scripts/fetch-polyhaven.py)`);
      continue;
    }
    const out = join(dir, `${map}.webp`);
    let img = sharp(src).resize(size, size, { fit: "fill" });
    if (map === "roughness") img = img.greyscale();
    if (map === "color" && GREY[key] === "normalise") img = img.greyscale().normalise({ lower: 1, upper: 99 }).toColourspace("srgb");
    else if (map === "color" && GREY[key]) {
      const { channels } = await sharp(src).greyscale().stats();
      img = img.greyscale().linear(GREY[key] / channels[0].mean, 0).toColourspace("srgb");
    }
    await img.webp({ quality, effort: 5 }).toFile(out);
    total += statSync(out).size;
  }
  console.log(`ok  ${key.padEnd(11)} <- ${scan.padEnd(24)} ${(total / 1024).toFixed(0)} KB`);
}
