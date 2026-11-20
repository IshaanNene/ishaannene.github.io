"""
Cliff kit from CC0 Poly Haven rock scans (assets-src/polyhaven/models): the pieces that wrap each
island's underside (placements are generated with the islands, see generate_islands.place_cliffs).

Every scan is an open, one-sided shell whose visible face looks down -Y (Blender, Z up). Each piece is
decimated to a web budget and normalised: origin at its bounding-box centre, width (X) = 1, face still
toward -Y, so placement only needs a frame (tangent, -outward, up) and a scale. Long scans are sliced
into several pieces. The mean albedo of each texture is stored on the material (glTF extras ->
material.userData.meanRGB) so the runtime can bring all scans to one rock tone.

Run:  .venv-blender/bin/python scripts/blender/build_cliffs.py   (or npm run assets:cliffs)
"""
from __future__ import annotations

import os
import sys

import bpy  # noqa: I001
import bmesh
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_vegetation as bv  # noqa: E402  (shared import / decimate helpers)

ROOT = bv.ROOT
OUT_GLB = os.path.join(ROOT, "public", "models", "cliffs", "cliffs.glb")
OUT_BLEND = os.path.join(ROOT, "assets-src", "blender", "cliffs", "cliffs.blend")

# (scan, slices along X, triangle budget per piece)
# ~130 pieces per island x 7 islands: budgets stay low, the normal maps carry the detail
PIECES = [
    ("namaqualand_cliff_01", 1, 1300),
    ("namaqualand_cliff_02", 2, 1300),
    ("rock_face_01", 1, 1100),
    ("rock_face_02", 1, 1000),
    ("mountainside", 1, 1300),
    ("coastal_cliff_01", 4, 1100),
]
CLIFF_VARIANTS = []  # filled by main(); mirrored in src/config (manifest stores variant names)


def slice_x(o, n):
    """Split a mesh into n chunks along X (bisect, keep each side)."""
    co, _ = bv.mesh_arrays(o.data)
    lo, hi = co[:, 0].min(), co[:, 0].max()
    out = []
    for k in range(n):
        a = lo + (hi - lo) * k / n
        b = lo + (hi - lo) * (k + 1) / n
        p = o.copy()
        p.data = o.data.copy()
        bpy.context.scene.collection.objects.link(p)
        bm = bmesh.new()
        bm.from_mesh(p.data)
        if k > 0:
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(a, 0, 0), plane_no=(-1, 0, 0), clear_outer=True)
        if k < n - 1:
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(b, 0, 0), plane_no=(1, 0, 0), clear_outer=True)
        bm.to_mesh(p.data)
        bm.free()
        out.append(p)
    bpy.data.objects.remove(o, do_unlink=True)
    return out


def normalise_piece(o):
    co, _ = bv.mesh_arrays(o.data)
    lo, hi = co.min(0), co.max(0)
    c = (lo + hi) / 2
    w = hi[0] - lo[0]
    o.data.transform(Matrix.Diagonal((1 / w, 1 / w, 1 / w, 1)) @ Matrix.Translation(Vector(-c)))
    return o


def mean_albedo(mat):
    for n in mat.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image and any(l.to_socket.name == "Base Color" for l in n.outputs["Color"].links):
            px = np.array(n.image.pixels[:], np.float32).reshape(-1, 4)[::7, :3]
            srgb = px.mean(0)
            return [float(round(v, 4)) for v in np.clip(srgb, 0, 1) ** 2.2]
    return [0.2, 0.2, 0.2]


def main():
    bv.clean()
    out = []
    for name, slices, budget in PIECES:
        objs = bv.import_gltf(name)
        o = max(objs.values(), key=bv.tris)
        for other in objs.values():
            if other is not o:
                bpy.data.objects.remove(other, do_unlink=True)
        parts = slice_x(o, slices) if slices > 1 else [o]
        for k, p in enumerate(parts):
            bv.decimate(p, min(1.0, budget / max(1, bv.tris(p))))
            normalise_piece(p)
            mat = p.material_slots[0].material
            if not mat.name.startswith("PH_"):
                mat["meanRGB"] = mean_albedo(mat)
                mat.name = f"PH_cliff_{name}"
            p.name = f"cliff_{name}{'_' + str(k) if slices > 1 else ''}"
            p.data.name = p.name
            # drop the scan's vertex colours, if any; the runtime adds its own darkening
            for a in list(p.data.color_attributes):
                p.data.color_attributes.remove(a)
            out.append(p)
    for p in out:
        print(f"[cliff] {p.name:28s} {bv.tris(p):5d} tris  dims {tuple(round(d, 2) for d in p.dimensions)}", flush=True)
    bpy.ops.object.select_all(action="DESELECT")
    for p in out:
        p.select_set(True)
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
        export_texcoords=True, export_normals=True, export_extras=True, export_vertex_color="NONE",
        export_cameras=False, export_lights=False, export_animations=False, export_image_format="AUTO",
    )
    os.makedirs(os.path.dirname(OUT_BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, compress=True)
    print("[cliff] exported", OUT_GLB, flush=True)


if __name__ == "__main__":
    main()
