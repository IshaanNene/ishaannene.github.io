"""
Prop library from CC0 Poly Haven models (assets-src/polyhaven/models): street furniture, lights and
harbour pieces placed on the islands as instances (placements: generate_islands.place_props, stored in
the manifest as {v, p, r, s} exactly like vegetation).

Each prop is one node `prop_<name>`: the chosen source objects are joined, decimated to a web budget,
put on the ground at the origin (footprint centre) and scaled by WORLD_SCALE (world units per metre;
the islands are slightly stylised, so real-world sizes are reduced). Materials keep the scan's
PBR textures and are prefixed PH_ so the runtime uses them as-is (src/three/materials.scannedMaterial).

Run:  .venv-blender/bin/python scripts/blender/build_props.py   (or npm run assets:props)
"""
from __future__ import annotations

import os
import re
import sys

import bpy  # noqa: I001
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_vegetation as bv  # noqa: E402  (shared import / decimate helpers)

ROOT = bv.ROOT
OUT_GLB = os.path.join(ROOT, "public", "models", "props", "props.glb")
OUT_BLEND = os.path.join(ROOT, "assets-src", "blender", "props", "props.blend")
WORLD_SCALE = 0.62

# node name: (scan, object-name filter (substring, or None for all), triangle budget, scale multiplier)
PROPS = {
    "lamp": ("street_lamp_01", None, 1400, 1.0),
    "bench": ("painted_wooden_bench", None, 700, 1.0),
    "seating": ("modular_street_seating", ("arm_rest_0", "back_support", "crossbar", "legs_", "seat", "suspended_support_01"), 2400, 1.0),
    "picnic": ("wooden_picnic_table", None, 1800, 1.0),
    "cafe": ("outdoor_table_chair_set_01", None, 2400, 1.0),
    "firepit": ("stone_fire_pit", None, 1400, 1.0),
    "planter": ("planter_box_01", None, 1000, 1.1),
    "lantern": ("wooden_lantern_01", None, 900, 1.4),
    "utility": ("utility_box_01", None, 900, 1.0),
    "flood": ("flood_lights", ("standing_double_a_",), 2600, 1.0),
    "pipes": ("modular_industrial_pipes_01", None, 2600, 1.0),
    "pier": ("modular_wooden_pier", ("section_02",), 3600, 0.75),
    "pier_end": ("modular_wooden_pier", ("section_03",), 3600, 0.75),
}
# the seating kit is laid out in a row; keep only the backed bench at x < 0.05
X_MAX = {"seating": 0.05}


def build(node, scan, filt, budget, mult):
    objs = bv.import_gltf(scan)
    keep = []
    for name, o in objs.items():
        ok = filt is None or any(f in name for f in filt)
        if ok and node in X_MAX:
            co, _ = bv.mesh_arrays(o.data)
            ok = (co[:, 0].min() + co[:, 0].max()) / 2 < X_MAX[node]
        if ok and node == "seating" and name.startswith("seat_bench"):
            ok = False
        (keep if ok else []).append(o)
        if not ok:
            bpy.data.objects.remove(o, do_unlink=True)
    o = bv.join(keep, f"prop_{node}") if len(keep) > 1 else keep[0]
    o.name = o.data.name = f"prop_{node}"
    n = bv.tris(o)
    if n > budget:
        bv.decimate(o, budget / n)
    co, _ = bv.mesh_arrays(o.data)
    lo, hi = co.min(0), co.max(0)
    base = Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]))
    if node.startswith("pier"):
        # piers hang off the island edge: origin at the deck's landward end, deck top at z = 0
        deck = co[co[:, 2] > hi[2] - 0.6] if hi[2] - lo[2] > 1 else co
        base = Vector(((lo[0] + hi[0]) / 2, lo[1], float(np.percentile(deck[:, 2], 90))))
    s = WORLD_SCALE * mult
    o.data.transform(Matrix.Diagonal((s, s, s, 1)) @ Matrix.Translation(-base))
    for a in list(o.data.color_attributes):
        o.data.color_attributes.remove(a)
    # one material per source texture set: repeated imports of a kit create name.001 copies
    for slot in o.material_slots:
        m = slot.material
        if not m or m.name.startswith("PH_"):
            continue
        want = "PH_prop_" + re.sub(r"[.]\d{3}$", "", m.name)
        if want in bpy.data.materials:
            slot.material = bpy.data.materials[want]
        else:
            m.name = want
    return o


def main():
    bv.clean()
    out = [build(node, *spec) for node, spec in PROPS.items()]
    bpy.context.view_layer.update()
    for p in out:
        print(f"[prop] {p.name:18s} {bv.tris(p):5d} tris  dims {tuple(round(d, 2) for d in p.dimensions)}  "
              f"mats {[s.material.name for s in p.material_slots if s.material]}", flush=True)
    bpy.ops.object.select_all(action="DESELECT")
    for p in out:
        p.select_set(True)
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
        export_texcoords=True, export_normals=True, export_extras=False, export_vertex_color="NONE",
        export_cameras=False, export_lights=False, export_animations=False, export_image_format="AUTO",
    )
    os.makedirs(os.path.dirname(OUT_BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, compress=True)
    print("[prop] exported", OUT_GLB, flush=True)


if __name__ == "__main__":
    main()
