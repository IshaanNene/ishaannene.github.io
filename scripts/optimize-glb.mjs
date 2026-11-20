#!/usr/bin/env node
/**
 * Meshopt-compress every exported GLB in public/models in place.
 * Run after `npm run assets:blender`. Node names and material names
 * (M_<preset>) are preserved, so the runtime material swap keeps working.
 * Already-compressed files are skipped (EXT_meshopt_compression present).
 *
 *   node scripts/optimize-glb.mjs                  # new exports only
 *   node scripts/optimize-glb.mjs --force islands  # recompress selected folders
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../public/models/", import.meta.url).pathname;
const bin = new URL("../node_modules/.bin/gltf-transform", import.meta.url).pathname;
const force = process.argv.includes("--force");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (f.endsWith(".glb")) yield p;
  }
}

let before = 0;
let after = 0;
for (const file of walk(root)) {
  const rel = file.replace(root, "");
  if (only.length && !only.some((o) => rel.startsWith(o))) continue;
  const size = statSync(file).size;
  const buf = readFileSync(file);
  // GLB: 12-byte header, then the JSON chunk (length at byte 12)
  const head = buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8");
  if (!force && head.includes("EXT_meshopt_compression")) {
    console.log(`skip  ${file.replace(root, "")} (already compressed)`);
    continue;
  }
  execFileSync(bin, ["meshopt", file, file, "--level", "medium"], { stdio: "ignore" });
  const out = statSync(file).size;
  before += size;
  after += out;
  console.log(`ok    ${file.replace(root, "").padEnd(36)} ${(size / 1024).toFixed(0).padStart(6)} KB → ${(out / 1024).toFixed(0).padStart(5)} KB`);
}
if (before) console.log(`\ntotal ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB`);
