"""
Realistic vegetation library built from CC0 Poly Haven scans (assets-src/polyhaven/models,
fetched with scripts/fetch-polyhaven.py).

The scans are far too heavy for a web scene (the broadleaf tree alone is ~1M triangles of
individually modelled leaves), so they are converted into game-style assets:

- Trees: clusters of the real leaves/needles are rendered (Cycles, albedo only, transparent film)
  into a 2x2 alpha "card" atlas. The crown is rebuilt from cards placed at k-means centres of the
  original leaves, oriented like the leaves they replace, with normals bent outward from the crown
  centre (soft volumetric shading) and a vertex-colour occlusion term (darker inside the crown).
  Trunk and main limbs are kept and decimated; thin twigs live in the card texture.
- Shrubs: already alpha cards; decimated.
- Rocks: decimated scans that keep their normal maps.

Output nodes keep the variant names the island manifests use (veg_broad_a, veg_conifer, ...),
so placement data is unchanged. Materials are prefixed PH_ so the runtime keeps the GLB's own
textured materials instead of swapping them for the stylised library.

Run:  .venv-blender/bin/python scripts/blender/build_vegetation.py
"""
from __future__ import annotations

import math
import os
import sys

import bpy  # noqa: I001  (bpy must load before bmesh)
import bmesh
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ROOT, "assets-src", "polyhaven", "models")
OUT_GLB = os.path.join(ROOT, "public", "models", "vegetation", "vegetation.glb")
OUT_BLEND = os.path.join(ROOT, "assets-src", "blender", "vegetation", "vegetation.blend")
WORK = os.path.join(ROOT, "assets-src", "polyhaven", "_build")
RNG = np.random.default_rng(7)


# ------------------------------------------------------------------ scene helpers

def clean():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_gltf(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name, f"{name}.gltf"))
    new = [o for o in bpy.data.objects if o not in before]
    # flatten hierarchy, apply transforms
    for o in new:
        if o.type == "MESH":
            mw = o.matrix_world.copy()
            o.parent = None
            o.matrix_world = mw
    meshes = [o for o in new if o.type == "MESH"]
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    for o in meshes:
        o.data = o.data.copy()
        o.data.transform(o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
    return {o.name: o for o in meshes}


def new_object(name, mesh):
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    return o


def mesh_arrays(me):
    n = len(me.vertices)
    co = np.zeros(n * 3, np.float32)
    me.vertices.foreach_get("co", co)
    e = np.zeros(len(me.edges) * 2, np.int64)
    me.edges.foreach_get("vertices", e)
    return co.reshape(-1, 3), e.reshape(-1, 2)


def loose_labels(me):
    """Connected-component label per vertex (label propagation over edges)."""
    co, e = mesh_arrays(me)
    lab = np.arange(len(co))
    while True:
        m = np.minimum(lab[e[:, 0]], lab[e[:, 1]])
        new = lab.copy()
        np.minimum.at(new, e[:, 0], m)
        np.minimum.at(new, e[:, 1], m)
        new = new[new]  # pointer jumping
        if np.array_equal(new, lab):
            break
        lab = new
    _, lab = np.unique(lab, return_inverse=True)
    return co, lab


def split_by_material(o):
    """Return {material_name: object} with one object per material slot."""
    out = {}
    for i, slot in enumerate(o.material_slots):
        me = o.data.copy()
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != i], context="FACES")
        bm.to_mesh(me)
        bm.free()
        me.materials.clear()
        me.materials.append(slot.material)
        out[slot.material.name] = new_object(f"{o.name}_{slot.material.name}", me)
    bpy.data.objects.remove(o, do_unlink=True)
    return out


def decimate(o, ratio):
    m = o.modifiers.new("dec", "DECIMATE")
    m.decimate_type = "COLLAPSE"
    m.ratio = ratio
    m.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = o
    with bpy.context.temp_override(object=o, active_object=o):
        bpy.ops.object.modifier_apply(modifier=m.name)
    return o


def keep_vertices(o, mask):
    """Delete vertices where mask is False."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not mask[v.index]], context="VERTS")
    bm.to_mesh(o.data)
    bm.free()


def tris(o):
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles)


def kmeans(pts, k, iters=18):
    c = pts[RNG.choice(len(pts), k, replace=False)].copy()
    for _ in range(iters):
        d = ((pts[:, None, :] - c[None, :, :]) ** 2).sum(-1) if len(pts) * k < 4e7 else None
        if d is None:
            lab = np.empty(len(pts), np.int64)
            for s in range(0, len(pts), 4000):
                lab[s:s + 4000] = ((pts[s:s + 4000, None, :] - c[None]) ** 2).sum(-1).argmin(1)
        else:
            lab = d.argmin(1)
        for j in range(k):
            m = lab == j
            if m.any():
                c[j] = pts[m].mean(0)
    return c, lab


# ------------------------------------------------------------------ card atlas rendering

def albedo_material(src_mat):
    """Copy of a material that emits its base-colour texture (alpha preserved) for atlas renders."""
    m = src_mat.copy()
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    col_link = next((l for l in nt.links if l.to_socket == bsdf.inputs["Base Color"]), None)
    alpha_link = next((l for l in nt.links if l.to_socket == bsdf.inputs["Alpha"]), None)
    emit = nt.nodes.new("ShaderNodeEmission")
    if col_link:
        nt.links.new(col_link.from_socket, emit.inputs["Color"])
    else:
        emit.inputs["Color"].default_value = bsdf.inputs["Base Color"].default_value
    shader = emit.outputs[0]
    if alpha_link:
        transp = nt.nodes.new("ShaderNodeBsdfTransparent")
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(alpha_link.from_socket, mix.inputs["Fac"])
        nt.links.new(transp.outputs[0], mix.inputs[1])
        nt.links.new(emit.outputs[0], mix.inputs[2])
        shader = mix.outputs[0]
    nt.links.new(shader, out.inputs["Surface"])
    return m


def render_tile(objs, normal, path, res=512, up_hint=None):
    """Orthographic albedo render of `objs` looking down -normal, framed to their extent.
    `up_hint` (world vector) becomes the image's +Y, e.g. a branch's outward direction."""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 24
    sc.cycles.use_denoising = False
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = res
    sc.view_settings.view_transform = "Standard"
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    if sc.world is None:
        sc.world = bpy.data.worlds.new("w")
    sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.0
    pts = np.concatenate([np.array([o.matrix_world @ v.co for v in o.data.vertices]) for o in objs if len(o.data.vertices)])
    centre = pts.mean(0)
    n = Vector(normal).normalized()
    cam_d = bpy.data.cameras.new("cardcam")
    cam_d.type = "ORTHO"
    cam = bpy.data.objects.new("cardcam", cam_d)
    sc.collection.objects.link(cam)
    if up_hint is not None:
        y = Vector(up_hint)
        y = (y - n * y.dot(n)).normalized()
        x = y.cross(n)
        cam.rotation_euler = Matrix((x, y, n)).transposed().to_euler()
    else:
        cam.rotation_euler = n.to_track_quat("Z", "Y").to_euler()  # camera looks down its -Z
    cam.location = Vector(centre) + n * 5
    bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    local = np.array([inv @ Vector(p) for p in pts])
    ext = max(np.ptp(local[:, 0]), np.ptp(local[:, 1]))
    off = Vector(((local[:, 0].max() + local[:, 0].min()) / 2, (local[:, 1].max() + local[:, 1].min()) / 2, 0))
    cam.location = cam.matrix_world @ off
    cam_d.ortho_scale = ext * 1.04
    cam_d.clip_end = 20
    sc.camera = cam
    for o in sc.objects:
        o.hide_render = not (o in objs or o == cam)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    for o in sc.objects:
        o.hide_render = False
    return ext


def compose_atlas(tiles, path):
    imgs = [bpy.data.images.load(t) for t in tiles]
    res = imgs[0].size[0]
    atlas = np.zeros((res * 2, res * 2, 4), np.float32)
    for i, im in enumerate(imgs):
        px = np.array(im.pixels[:], np.float32).reshape(res, res, 4)
        # bleed colour into transparent texels so mip-mapping does not darken the edges
        # erode alpha 2px: the scans' leaf textures have dark rims right at the silhouette
        al = px[..., 3]
        for _ in range(2):
            al = np.minimum.reduce([al, np.roll(al, 1, 0), np.roll(al, -1, 0), np.roll(al, 1, 1), np.roll(al, -1, 1)])
        px[..., 3] = al
        a = px[..., 3:4]
        mean = (px[..., :3] * a).sum((0, 1)) / max(a.sum(), 1)
        px[..., :3] = np.where(a > 0.02, px[..., :3], mean)
        y, x = divmod(i, 2)
        atlas[y * res:(y + 1) * res, x * res:(x + 1) * res] = px
    out = bpy.data.images.new(os.path.basename(path), res * 2, res * 2, alpha=True)
    out.pixels = atlas.ravel()
    out.filepath_raw = path
    out.file_format = "PNG"
    out.save()
    for im in imgs:
        bpy.data.images.remove(im)
    return bpy.data.images.load(path)


def card_material(name, image):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = image
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.8
    return m


# ------------------------------------------------------------------ crown builder

def build_crown(name, foliage, extra_sources, n_clusters, card_scale, normal_mode, tile_dir, tile_normal_up=False,
                cards_per_cluster=2):
    """Replace the `foliage` object (many small loose parts) with alpha cards."""
    co, lab = loose_labels(foliage.data)
    npieces = lab.max() + 1
    cnt = np.bincount(lab, minlength=npieces).astype(np.float32)
    cent = np.stack([np.bincount(lab, co[:, i], npieces) for i in range(3)], 1) / cnt[:, None]
    centres, plab = kmeans(cent, n_clusters)
    crown_c = cent.mean(0)
    crown_r = np.percentile(np.linalg.norm(cent - crown_c, axis=1), 90)

    # piece normals: average face normal per piece
    me = foliage.data
    fn = np.zeros(len(me.polygons) * 3, np.float32)
    me.polygons.foreach_get("normal", fn)
    fv = np.zeros(len(me.polygons), np.int64)
    me.polygons.foreach_get("loop_start", fv)
    lv = np.zeros(len(me.loops), np.int64)
    me.loops.foreach_get("vertex_index", lv)
    face_piece = lab[lv[fv]]
    fn = fn.reshape(-1, 3)
    pn = np.stack([np.bincount(face_piece, fn[:, i], npieces) for i in range(3)], 1)

    # ---- render 4 representative clusters into the atlas
    os.makedirs(tile_dir, exist_ok=True)
    sizes = np.bincount(plab, minlength=n_clusters)
    order = np.argsort(-sizes)
    picks = [order[int(len(order) * f)] for f in (0.05, 0.2, 0.35, 0.5)]
    tiles = []
    ext_ratio = []
    for t, j in enumerate(picks):
        member = plab[lab] == j  # vertex mask
        tmp = foliage.copy()
        tmp.data = foliage.data.copy()
        sc = bpy.context.scene
        sc.collection.objects.link(tmp)
        keep_vertices(tmp, member)
        objs = [tmp]
        pc = co[member].mean(0)
        rad = np.linalg.norm(co[member] - pc, axis=1).max()
        for src in extra_sources:
            e = src.copy()
            e.data = src.data.copy()
            sc.collection.objects.link(e)
            eco, _ = mesh_arrays(e.data)
            keep_vertices(e, np.linalg.norm(eco - pc, axis=1) < rad * 0.9)
            if len(e.data.vertices):
                objs.append(e)
            else:
                bpy.data.objects.remove(e, do_unlink=True)
        for o in objs:
            for i, slot in enumerate(o.material_slots):
                slot.material = albedo_material(slot.material)
        nrm = np.array([0, 0, 1.0]) if tile_normal_up else pn[np.unique(lab[member])].sum(0)
        if np.linalg.norm(nrm) < 1e-6:
            nrm = np.array([0, 0, 1.0])
        path = os.path.join(tile_dir, f"{name}_tile{t}.png")
        render_tile(objs, nrm, path)
        tiles.append(path)
        for o in objs:
            bpy.data.objects.remove(o, do_unlink=True)
    atlas = compose_atlas(tiles, os.path.join(tile_dir, f"{name}_atlas.png"))
    mat = card_material(f"PH_{name}_cards", atlas)

    # ---- cards
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    col = bm.loops.layers.color.new("Color")
    normals = []
    for j in range(n_clusters):
        m = plab == j
        if not m.any():
            continue
        pts = cent[m]
        c = centres[j]
        spread = np.sqrt(((pts - c) ** 2).sum(1).mean()) if len(pts) > 1 else 0.05
        size = max(0.12, spread * card_scale)
        if normal_mode == "cluster":
            nrm = pn[m].sum(0)
        else:  # "up": sprays lie roughly flat, tilted outward
            out = c - crown_c
            out[2] = 0
            nrm = np.array([0, 0, 1.0]) + out / (np.linalg.norm(out) + 1e-6) * 0.35
        if np.linalg.norm(nrm) < 1e-6:
            nrm = RNG.normal(size=3)
        for k in range(cards_per_cluster):
            n = Vector(nrm).normalized()
            if k > 0:
                tilt = Matrix.Rotation(RNG.uniform(0.7, 1.2) * RNG.choice([-1, 1]), 3, Vector(RNG.normal(size=3)).normalized())
                n = (tilt @ n).normalized()
            q = n.to_track_quat("Z", "Y") @ Matrix.Rotation(RNG.uniform(0, math.tau), 4, "Z").to_quaternion()
            R = q.to_matrix()
            s = size * RNG.uniform(0.85, 1.15)
            centre = Vector(c) + Vector(RNG.normal(scale=spread * 0.15, size=3))
            corners = [R @ Vector((x * s / 2, y * s / 2, 0)) + centre for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            verts = [bm.verts.new(p) for p in corners]
            f = bm.faces.new(verts)
            tile = RNG.integers(0, 4)
            ty, tx = divmod(int(tile), 2)
            uvs = [(0, 0), (1, 0), (1, 1), (0, 1)]
            for loop, (u, v) in zip(f.loops, uvs):
                loop[uvl].uv = ((tx + u) / 2, (ty + v) / 2)
                p = loop.vert.co
                d = (Vector(p) - Vector(crown_c))
                depth = min(1.0, d.length / crown_r)
                h = (p.z - (crown_c[2] - crown_r)) / (2 * crown_r)
                ao = 0.42 + 0.58 * depth ** 0.8 * (0.75 + 0.25 * max(0.0, min(1.0, h)))
                loop[col] = (ao, ao, ao, 1.0)
    me = bpy.data.meshes.new(f"{name}_cards")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    # bent normals: from the crown centre outward, nudged up
    vn = []
    for v in me.vertices:
        d = Vector(v.co) - Vector(crown_c)
        d.z += crown_r * 0.35
        vn.append(d.normalized())
    me.normals_split_custom_set_from_vertices(vn)
    cards = new_object(f"{name}_cards", me)
    bpy.data.objects.remove(foliage, do_unlink=True)
    return cards


def keep_largest_parts(o, n_keep, min_len=0.0):
    co, lab = loose_labels(o.data)
    npieces = lab.max() + 1
    lo = np.full((npieces, 3), np.inf)
    hi = np.full((npieces, 3), -np.inf)
    np.minimum.at(lo, lab, co)
    np.maximum.at(hi, lab, co)
    diag = np.linalg.norm(hi - lo, axis=1)
    keep = np.argsort(-diag)[:n_keep]
    keep = keep[diag[keep] >= min_len]
    mask = np.isin(lab, keep)
    keep_vertices(o, mask)
    return o


def join(objs, name):
    objs = [o for o in objs if o is not None]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


def rename_materials(o, prefix):
    for slot in o.material_slots:
        if slot.material and not slot.material.name.startswith("PH_"):
            slot.material.name = f"PH_{prefix}_{slot.material.name}"


def normalise(o, height=None, width=None, scale=None, sxy=1.0, sz=1.0):
    """Base on the ground at the origin, then scale to a target height / width."""
    co, _ = mesh_arrays(o.data)
    lo, hi = co.min(0), co.max(0)
    foot = co[co[:, 2] < lo[2] + (hi[2] - lo[2]) * 0.06]  # trunk base / footprint, not the crown
    base = Vector((foot[:, 0].mean(), foot[:, 1].mean(), lo[2]))
    o.data.transform(Matrix.Translation(-base))
    if scale is None:
        if height:
            scale = height / (hi[2] - lo[2])
        else:
            scale = width / max(hi[0] - lo[0], hi[1] - lo[1])
    o.data.transform(Matrix.Diagonal((scale * sxy, scale * sxy, scale * sz, 1)))
    return o


def ensure_colors(o, value=1.0):
    me = o.data
    if "Color" not in me.color_attributes:
        a = me.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
        data = np.full(len(me.loops) * 4, value, np.float32)
        data[3::4] = 1
        a.data.foreach_set("color", data)
    me.color_attributes.active_color = me.color_attributes["Color"]


def ground_ao(o, height):
    """Vertex AO: darker near the ground and the trunk core."""
    me = o.data
    if "Color" in me.color_attributes:
        me.color_attributes.remove(me.color_attributes["Color"])
    a = me.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
    lv = np.zeros(len(me.loops), np.int64)
    me.loops.foreach_get("vertex_index", lv)
    co, _ = mesh_arrays(me)
    z = co[lv, 2] / max(height, 1e-3)
    ao = np.clip(0.55 + 0.45 * np.sqrt(np.clip(z, 0, 1)), 0, 1)
    data = np.repeat(ao, 4).astype(np.float32)
    data[3::4] = 1
    a.data.foreach_set("color", data)
    me.color_attributes.active_color = a


# ------------------------------------------------------------------ variants

def build_broadleaf():
    objs = import_gltf("island_tree_02")
    tree = next(iter(objs.values()))
    parts = split_by_material(tree)
    trunk = parts["island_tree_02"]
    branches = parts["island_tree_02_branches"]
    leaves = parts["island_tree_02_leaves"]
    keep_largest_parts(branches, 260)
    cards = build_crown("broadleaf", leaves, [branches], n_clusters=360, card_scale=3.0,
                        normal_mode="cluster", tile_dir=WORK)
    decimate(trunk, 0.09)
    decimate(branches, 0.12)
    wood = join([trunk, branches], "broadleaf_wood")
    rename_materials(wood, "broadleaf")
    ground_ao(wood, 3.4)
    tree = join([wood, cards], "broadleaf")
    return tree


def spray_atlas(name):
    """Render four branch sprays of the fir sapling's real needles, stem along the image's +Y."""
    objs = import_gltf("fir_sapling")
    a = objs["fir_sapling_a"]
    for o in objs.values():
        if o is not a:
            bpy.data.objects.remove(o, do_unlink=True)
    parts = split_by_material(a)
    wood = parts["fir_sapling_branches"]
    twigs = parts["fir_sapling_twigs"]
    co, lab = loose_labels(twigs.data)
    npieces = lab.max() + 1
    cnt = np.bincount(lab, minlength=npieces).astype(np.float32)
    cent = np.stack([np.bincount(lab, co[:, i], npieces) for i in range(3)], 1) / cnt[:, None]
    # group twigs into ~branch-sized sprays
    _, plab = kmeans(cent, 14)
    sizes = np.bincount(plab, minlength=14)
    order = np.argsort(-sizes)
    tiles = []
    sc = bpy.context.scene
    for t, j in enumerate(order[[0, 1, 2, 3]]):
        member = plab[lab] == j
        tmp = twigs.copy()
        tmp.data = twigs.data.copy()
        sc.collection.objects.link(tmp)
        keep_vertices(tmp, member)
        for slot in tmp.material_slots:
            slot.material = albedo_material(slot.material)
        pc = co[member].mean(0)
        out = Vector((pc[0], pc[1], 0))
        if out.length < 1e-4:
            out = Vector((1, 0, 0))
        path = os.path.join(WORK, f"{name}_tile{t}.png")
        render_tile([tmp], (0, 0, 1), path, up_hint=out)
        tiles.append(path)
        bpy.data.objects.remove(tmp, do_unlink=True)
    bpy.data.objects.remove(twigs, do_unlink=True)
    atlas = compose_atlas(tiles, os.path.join(WORK, f"{name}_atlas.png"))
    bark = wood.material_slots[0].material
    bpy.data.objects.remove(wood, do_unlink=True)
    bark.name = f"PH_{name}_bark"
    return card_material(f"PH_{name}_cards", atlas), bark


def build_conifer(name, cards_mat, bark_mat, radius=0.36, whorls=20, per=7, droop=(0.12, 0.38), seed=3,
                  base=0.08, power=0.9):
    """Unit-height conifer: tapered trunk + whorls of drooping branch cards (spray texture)."""
    rng = np.random.default_rng(seed)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    col = bm.loops.layers.color.new("Color")
    normals = {}

    def quad(pts, uvs, mat, ao_vals, nrm_fn):
        vs = [bm.verts.new(p) for p in pts]
        f = bm.faces.new(vs)
        f.material_index = mat
        for loop, uv, ao in zip(f.loops, uvs, ao_vals):
            loop[uvl].uv = uv
            loop[col] = (ao, ao, ao, 1.0)
        for v in vs:
            normals[v] = nrm_fn(v.co)

    # trunk (8-sided, tapered), bark UVs wrap once around
    segs, h = 8, 0.9
    for k in range(segs):
        a0, a1 = math.tau * k / segs, math.tau * (k + 1) / segs
        r0, r1 = 0.024, 0.004
        p = [Vector((math.cos(a0) * r0, math.sin(a0) * r0, 0)), Vector((math.cos(a1) * r0, math.sin(a1) * r0, 0)),
             Vector((math.cos(a1) * r1, math.sin(a1) * r1, h)), Vector((math.cos(a0) * r1, math.sin(a0) * r1, h))]
        quad(p, [(k / segs, 0), ((k + 1) / segs, 0), ((k + 1) / segs, 4), (k / segs, 4)], 1, [0.5, 0.5, 0.9, 0.9],
             lambda c: Vector((c.x, c.y, 0)).normalized() if Vector((c.x, c.y)).length > 1e-6 else Vector((0, 0, 1)))
    # branch whorls, top to bottom; widest near the base
    for i in range(whorls):
        t = (i + 0.5) / whorls
        z = base + (1 - base) * t
        r = radius * (1 - t) ** power + 0.035
        n = max(3, int(round(per * (0.55 + 0.45 * (1 - t)))))
        off = rng.uniform(0, math.tau)
        for b in range(n):
            az = off + math.tau * b / n + rng.uniform(-0.25, 0.25)
            outv = Vector((math.cos(az), math.sin(az), 0))
            side = Vector((-math.sin(az), math.cos(az), 0))
            d = rng.uniform(*droop)
            L = r * rng.uniform(0.85, 1.15)
            for c, (roll, wscale) in enumerate(((0.0, 1.05), (rng.uniform(0.9, 1.25), 0.8), (rng.uniform(-1.25, -0.9), 0.7))):
                axis = (outv * math.cos(d) - Vector((0, 0, math.sin(d)))).normalized()
                sd = (Matrix.Rotation(roll, 3, axis) @ side).normalized()
                w = L * wscale
                p0 = Vector((0, 0, z)) + outv * 0.01
                p1 = p0 + axis * L
                pts = [p0 - sd * w * 0.25, p0 + sd * w * 0.25, p1 + sd * w / 2, p1 - sd * w / 2]
                tile = int(rng.integers(0, 4))
                ty, tx = divmod(tile, 2)
                uvs = [((tx + 0.25) / 2, ty / 2), ((tx + 0.75) / 2, ty / 2), ((tx + 1) / 2, (ty + 1) / 2), (tx / 2, (ty + 1) / 2)]
                inner = 0.42 + 0.2 * t
                outer = 0.85 + 0.15 * t
                quad(pts, uvs, 0, [inner, inner, outer, outer],
                     lambda co_: (Vector((co_.x, co_.y, 0)) + Vector((0, 0, radius * 0.6))).normalized())
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    vn = [normals.get(v, Vector((0, 0, 1))) for v in bm.verts]
    bm.free()
    me.materials.append(cards_mat)
    me.materials.append(bark_mat)
    me.normals_split_custom_set_from_vertices(vn)
    return new_object(name, me)


def build_leaf_mound(name, mat, n=90, rx=0.55, rz=0.42, seed=5):
    """A dense bush: real-leaf cards on an ellipsoidal shell, bent normals, darker inside/below."""
    rng = np.random.default_rng(seed)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    col = bm.loops.layers.color.new("Color")
    vn = []
    for i in range(n):
        d = rng.normal(size=3)
        d[2] = abs(d[2]) * 0.9 + 0.05
        d /= np.linalg.norm(d)
        shell = rng.uniform(0.45, 1.0)
        c = Vector((d[0] * rx * shell, d[1] * rx * shell, rz * 0.15 + d[2] * rz * shell))
        nrm = (Vector(d) + Vector(rng.normal(scale=0.5, size=3))).normalized()
        q = nrm.to_track_quat("Z", "Y") @ Matrix.Rotation(rng.uniform(0, math.tau), 4, "Z").to_quaternion()
        R = q.to_matrix()
        sz = rng.uniform(0.38, 0.55)
        verts = [bm.verts.new(R @ Vector((x * sz / 2, y * sz / 2, 0)) + c) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        f = bm.faces.new(verts)
        ty, tx = divmod(int(rng.integers(0, 4)), 2)
        for loop, (u, v) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            loop[uvl].uv = ((tx + u) / 2, (ty + v) / 2)
            p = loop.vert.co
            ao = 0.4 + 0.6 * min(1.0, Vector((p.x / rx, p.y / rx, p.z / rz)).length) * (0.7 + 0.3 * min(1.0, p.z / rz))
            loop[col] = (ao, ao, ao, 1.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    for v in bm.verts:
        q = Vector((v.co.x, v.co.y, v.co.z + rz * 0.6))
        vn.append(q.normalized())
    bm.free()
    me.materials.append(mat)
    me.normals_split_custom_set_from_vertices(vn)
    return new_object(name, me)


def build_shrub():
    objs = import_gltf("shrub_02")
    keep = objs["shrub_02_b"]
    for o in objs.values():
        if o is not keep:
            bpy.data.objects.remove(o, do_unlink=True)
    decimate(keep, 0.22)
    rename_materials(keep, "shrub")
    ground_ao(keep, 1.2)
    keep.name = "shrub"
    return keep


def build_rock():
    objs = import_gltf("rock_moss_set_01")
    keep = [objs["rock_moss_set_01_rock03"], objs["rock_moss_set_01_rock04"]]
    for o in objs.values():
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    for o in keep:
        decimate(o, 1400 / max(1, tris(o)))
        normalise(o, width=1.0)
    keep[1].data.transform(Matrix.Translation((0.62, 0.25, 0)) @ Matrix.Diagonal((0.55, 0.55, 0.55, 1)))
    r = join(keep, "rock")
    rename_materials(r, "rock")
    ground_ao(r, 0.6)
    return r


def instance(src, name, height=None, width=None, sxy=1.0, sz=1.0, rz=0.0):
    me = src.data.copy()
    o = new_object(name, me)
    normalise(o, height=height, width=width, sxy=sxy, sz=sz)
    if rz:
        o.data.transform(Matrix.Rotation(rz, 4, "Z"))
    if "Color" in o.data.color_attributes:
        o.data.color_attributes.active_color = o.data.color_attributes["Color"]
    return o


def main():
    clean()
    os.makedirs(WORK, exist_ok=True)
    broad = build_broadleaf()
    spray, bark = spray_atlas("fir")
    fir = build_conifer("fir", spray, bark)
    cypress = build_conifer("cypress", spray, bark, radius=0.2, whorls=26, per=6, droop=(-0.35, 0.05), seed=11,
                            base=0.05, power=0.6)
    shrub = build_leaf_mound("shrub", bpy.data.materials["PH_broadleaf_cards"])
    rock = build_rock()
    out = [
        instance(broad, "veg_broad_a", height=3.0),
        instance(broad, "veg_broad_b", height=3.3, sxy=0.85, rz=1.9),
        instance(broad, "veg_palm", height=2.7, sxy=0.9, rz=-1.2),
        instance(fir, "veg_conifer", height=2.8),
        instance(cypress, "veg_cypress", height=3.25),
        instance(shrub, "veg_bush", width=1.25),
        instance(rock, "veg_rock", width=1.3),
    ]
    for o in (broad, fir, cypress, shrub, rock):
        bpy.data.objects.remove(o, do_unlink=True)
    for o in out:
        print(f"[veg] {o.name:14s} {tris(o):6d} tris  dims {tuple(round(d, 2) for d in o.dimensions)}", flush=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in out:
        o.select_set(True)
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
        export_vertex_color="ACTIVE", export_texcoords=True, export_normals=True,
        export_cameras=False, export_lights=False, export_animations=False, export_image_format="AUTO",
    )
    os.makedirs(os.path.dirname(OUT_BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, compress=True)
    print("[veg] exported", OUT_GLB, flush=True)


if __name__ == "__main__":
    main()
