"""
Shared geometry library for the archipelago asset pipeline.

Runs inside Blender's Python (either the Blender app via
`blender -b -P scripts/blender/export_assets.py` or the `bpy` pip module).

Conventions
-----------
* Authoring space is Blender's: Z is up. The glTF exporter converts to Y-up.
  three(x, y, z)  <->  blender(x, -z, y)
* All geometry is accumulated in a `Builder`, bucketed by (object, material).
  Each object becomes ONE mesh with one primitive per material, which keeps
  draw calls low at runtime.
* Material names are a contract with the runtime material library
  (src/three/materials.ts). Keep them in sync.
"""
from __future__ import annotations

import json
import math
import os
import random
from dataclasses import dataclass, field

import bmesh
import bpy
from mathutils import Matrix, Vector, noise
from mathutils.bvhtree import BVHTree

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TAU = math.tau

# --------------------------------------------------------------------------------------
# Materials (fallback PBR values; the runtime replaces these with textured materials)
# --------------------------------------------------------------------------------------

def _hex(h: str):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)

# name: (hex, roughness, metallic, emission_strength)
MATERIALS = {
    "grass":          ("#7FA86A", 0.95, 0.0, 0),
    "grass_dry":      ("#AEB46A", 0.95, 0.0, 0),
    "soil":           ("#6B4E38", 1.0, 0.0, 0),
    "sand":           ("#E6D6B4", 0.95, 0.0, 0),
    "stone_light":    ("#D2C6B3", 0.9, 0.0, 0),
    "stone_mid":      ("#A28F7B", 0.92, 0.0, 0),
    "stone_dark":     ("#5F544A", 0.95, 0.0, 0),
    "stone_cool":     ("#80817F", 0.9, 0.0, 0),
    "concrete":       ("#BDB7AD", 0.85, 0.0, 0),
    "concrete_light": ("#E8E2D7", 0.8, 0.0, 0),
    "concrete_dark":  ("#6E6A65", 0.9, 0.0, 0),
    "paving":         ("#D8CEBD", 0.85, 0.0, 0),
    "metal":          ("#8C9198", 0.38, 0.9, 0),
    "metal_dark":     ("#26262A", 0.45, 0.8, 0),
    "chrome":         ("#D4D8DC", 0.15, 1.0, 0),
    "wood":           ("#9C6B43", 0.8, 0.0, 0),
    "wood_dark":      ("#5B3C27", 0.85, 0.0, 0),
    "glass":          ("#A9C9E8", 0.05, 0.1, 0),
    "water":          ("#3B7CB4", 0.05, 0.0, 0),
    "lime":           ("#DFFF00", 0.6, 0.0, 0),
    "orange":         ("#FF7043", 0.6, 0.0, 0),
    "blue":           ("#477BFF", 0.55, 0.0, 0),
    "mint":           ("#8BC9A5", 0.7, 0.0, 0),
    "ink":            ("#171717", 0.7, 0.0, 0),
    "cream":          ("#F4EFE6", 0.8, 0.0, 0),
    "emit_lime":      ("#DFFF00", 0.4, 0.0, 4),
    "emit_warm":      ("#FFC979", 0.4, 0.0, 3),
    "bark":           ("#5A4230", 0.95, 0.0, 0),
    "foliage":        ("#5E9C70", 0.85, 0.0, 0),
    "foliage_dark":   ("#3E6E52", 0.85, 0.0, 0),
    "foliage_warm":   ("#B9B45C", 0.85, 0.0, 0),
    "foliage_mint":   ("#8BC9A5", 0.85, 0.0, 0),
}


def get_material(name: str):
    mat = bpy.data.materials.get("M_" + name)
    if mat:
        return mat
    hexc, rough, metal, emit = MATERIALS[name]
    mat = bpy.data.materials.new("M_" + name)
    try:
        mat.use_nodes = True
    except Exception:
        pass
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = _hex(hexc)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
        if emit:
            bsdf.inputs["Emission Color"].default_value = _hex(hexc)
            bsdf.inputs["Emission Strength"].default_value = emit
        if name in ("glass", "water"):
            bsdf.inputs["Alpha"].default_value = 0.45
    mat.diffuse_color = _hex(hexc)
    return mat


# --------------------------------------------------------------------------------------
# Math helpers
# --------------------------------------------------------------------------------------

def smoothstep(e0, e1, x):
    if e0 == e1:
        return 0.0 if x < e0 else 1.0
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def T(x=0.0, y=0.0, z=0.0, rz=0.0, rx=0.0, ry=0.0, s=1.0):
    """Translation @ rotZ @ rotY @ rotX @ scale."""
    m = Matrix.Translation((x, y, z))
    if rz:
        m = m @ Matrix.Rotation(rz, 4, "Z")
    if ry:
        m = m @ Matrix.Rotation(ry, 4, "Y")
    if rx:
        m = m @ Matrix.Rotation(rx, 4, "X")
    if s != 1.0:
        if isinstance(s, (tuple, list)):
            m = m @ Matrix.Diagonal((*s, 1.0))
        else:
            m = m @ Matrix.Scale(s, 4)
    return m


def fbm(x, y, z=0.0, octaves=4, off=(0, 0, 0)):
    total, amp, freq, norm = 0.0, 1.0, 1.0, 0.0
    for _ in range(octaves):
        total += amp * noise.noise(Vector((x * freq + off[0], y * freq + off[1], z * freq + off[2])))
        norm += amp
        amp *= 0.5
        freq *= 2.03
    return total / norm


def to_three(v):
    """Blender (x, y, z) -> three.js (x, y, z)."""
    return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]


def facing_three(angle):
    """Facing angle in Blender's XY plane -> three.js XZ unit vector."""
    return [round(math.cos(angle), 4), round(-math.sin(angle), 4)]


# --------------------------------------------------------------------------------------
# Primitive constructors (return bmesh; base at z=0 unless noted)
# --------------------------------------------------------------------------------------

def bm_from(verts, faces):
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in verts]
    for f in faces:
        try:
            bm.faces.new([vs[i] for i in f])
        except ValueError:
            pass
    return bm


def bm_box(sx, sy, sz, bevel=0.0, center=False):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    if not center:
        bmesh.ops.translate(bm, vec=(0, 0, sz / 2), verts=bm.verts)
    bevel = min(bevel, 0.45 * min(sx, sy, sz))
    if bevel > 0.004:
        bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=bevel, segments=1,
                        affect="EDGES", profile=0.5, clamp_overlap=True)
    return bm


def bm_cyl(r1, r2, h, segs=24, center=False):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=h)
    if not center:
        bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=bm.verts)
    return bm


def bm_ico(r, subdiv=2):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
    return bm


def bm_uvsphere(r, u=24, v=12):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r)
    return bm


def bm_lathe(profile, segs=32, a0=0.0, a1=TAU, closed=False):
    """Revolve a list of (r, z) around Z. `closed` closes the profile loop (solid shells).
    Partial revolutions get end caps when closed."""
    full = abs((a1 - a0) - TAU) < 1e-6
    n = len(profile)
    cols = segs if full else segs + 1
    verts, faces = [], []
    for j in range(cols):
        a = a0 + (a1 - a0) * j / segs
        ca, sa = math.cos(a), math.sin(a)
        for r, z in profile:
            verts.append((r * ca, r * sa, z))
    rows = n if closed else n - 1
    for j in range(segs):
        j2 = (j + 1) % cols
        for i in range(rows):
            i2 = (i + 1) % n
            a, b, c, d = j * n + i, j2 * n + i, j2 * n + i2, j * n + i2
            faces.append((a, b, c, d))
    if closed and not full:
        faces.append(tuple(range(n))[::-1])
        faces.append(tuple((cols - 1) * n + i for i in range(n)))
    bm = bm_from(verts, faces)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_prism(pts, h):
    """Extrude a CCW 2D polygon (x, y) upward by h."""
    n = len(pts)
    verts = [(x, y, 0) for x, y in pts] + [(x, y, h) for x, y in pts]
    faces = [tuple(range(n))[::-1], tuple(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
    return bm_from(verts, faces)


def bm_profile_extrude(pts, length):
    """Extrude an XZ profile (x, z) along +Y by `length` (centered)."""
    n = len(pts)
    hl = length / 2
    verts = [(x, -hl, z) for x, z in pts] + [(x, hl, z) for x, z in pts]
    faces = [tuple(range(n)), tuple(range(n, 2 * n))[::-1]]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, n + i, n + j, j))
    bm = bm_from(verts, faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_torus(R, r, segs=32, rsegs=10, arc=TAU):
    full = abs(arc - TAU) < 1e-6
    cols = segs if full else segs + 1
    verts, faces = [], []
    for j in range(cols):
        a = arc * j / segs
        c = Vector((math.cos(a), math.sin(a), 0))
        for i in range(rsegs):
            b = TAU * i / rsegs
            p = c * (R + r * math.cos(b)) + Vector((0, 0, r * math.sin(b)))
            verts.append(p)
    for j in range(segs):
        j2 = (j + 1) % cols
        for i in range(rsegs):
            i2 = (i + 1) % rsegs
            faces.append((j * rsegs + i, j2 * rsegs + i, j2 * rsegs + i2, j * rsegs + i2))
    if not full:
        faces.append(tuple(range(rsegs))[::-1])
        faces.append(tuple((cols - 1) * rsegs + i for i in range(rsegs)))
    return bm_from(verts, faces)


def bm_tube(points, radius, segs=8, caps=True):
    pts = [Vector(p) for p in points]
    n = len(pts)
    tangents = []
    for i in range(n):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, n - 1)]
        tangents.append((b - a).normalized())
    ref = Vector((0, 0, 1)) if abs(tangents[0].z) < 0.9 else Vector((1, 0, 0))
    nrm = tangents[0].cross(ref).normalized()
    verts, faces = [], []
    for i in range(n):
        if i > 0:
            # parallel transport
            axis = tangents[i - 1].cross(tangents[i])
            if axis.length > 1e-6:
                ang = tangents[i - 1].angle(tangents[i])
                nrm = Matrix.Rotation(ang, 3, axis.normalized()) @ nrm
        bin_ = tangents[i].cross(nrm)
        for k in range(segs):
            a = TAU * k / segs
            verts.append(pts[i] + (nrm * math.cos(a) + bin_ * math.sin(a)) * radius)
    for i in range(n - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            faces.append((i * segs + k, i * segs + k2, (i + 1) * segs + k2, (i + 1) * segs + k))
    if caps:
        faces.append(tuple(range(segs))[::-1])
        faces.append(tuple((n - 1) * segs + k for k in range(segs)))
    return bm_from(verts, faces)


def displace(bm, amp, scale, seed=0, axis_weight=(1, 1, 1)):
    off = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
    bm.normal_update()
    for v in bm.verts:
        n = noise.noise(v.co * scale + off)
        d = v.normal * (n * amp)
        v.co += Vector((d.x * axis_weight[0], d.y * axis_weight[1], d.z * axis_weight[2]))
    return bm


def beam_matrix(p0, p1, up=(0, 0, 1)):
    """Matrix placing a unit-length X-aligned, centered box between p0 and p1."""
    p0, p1 = Vector(p0), Vector(p1)
    x = p1 - p0
    length = x.length
    x.normalize()
    upv = Vector(up)
    if abs(x.dot(upv)) > 0.98:
        upv = Vector((1, 0, 0))
    y = upv.cross(x).normalized()
    z = x.cross(y).normalized()
    m = Matrix((
        (x.x, y.x, z.x, 0),
        (x.y, y.y, z.y, 0),
        (x.z, y.z, z.z, 0),
        (0, 0, 0, 1),
    ))
    return Matrix.Translation((p0 + p1) / 2) @ m, length


# --------------------------------------------------------------------------------------
# Builder: accumulates geometry by (object, material) and finalizes into Blender objects
# --------------------------------------------------------------------------------------

@dataclass
class Part:
    verts: list
    faces: list
    smooth: bool


class Builder:
    def __init__(self, lod=0):
        self.lod = lod
        self.parts: dict[tuple[str, str], list[Part]] = {}
        self.obj_origin: dict[str, Vector] = {}
        self.obj_category: dict[str, str] = {}
        self.occupied: list[tuple[float, float, float]] = []
        self.slots: list[dict] = []
        self.vegetation: list[dict] = []
        self.label = Vector((0, 0, 4))
        self.sign = None
        self.extras: dict = {}

    # -- adding geometry -------------------------------------------------------------
    def add(self, bm, mat, M=None, obj="buildings", smooth=False, detail=0):
        if detail > 0 and self.lod >= detail:
            bm.free()
            return
        M = M or Matrix.Identity(4)
        origin = self.obj_origin.get(obj)
        if origin is not None:
            M = Matrix.Translation(-origin) @ M
        bm.verts.index_update()
        verts = [tuple(M @ v.co) for v in bm.verts]
        faces = [tuple(v.index for v in f.verts) for f in bm.faces]
        bm.free()
        self.parts.setdefault((obj, mat), []).append(Part(verts, faces, smooth))
        if obj not in self.obj_category:
            self.obj_category[obj] = obj.split("_")[0]

    def separate(self, name, origin, category="anim"):
        """Declare a standalone object (animated / interactive) with its own pivot."""
        self.obj_origin[name] = Vector(origin)
        self.obj_category[name] = category
        return name

    def occupy(self, x, y, r):
        self.occupied.append((x, y, r))

    def is_free(self, x, y, r):
        for ox, oy, orad in self.occupied:
            if (x - ox) ** 2 + (y - oy) ** 2 < (r + orad) ** 2:
                return False
        return True

    # -- convenience primitives -----------------------------------------------------
    def box(self, mat, size, loc, rz=0.0, bevel=0.03, obj="buildings", detail=0, occupy=False, rx=0.0, ry=0.0):
        sx, sy, sz = size
        self.add(bm_box(sx, sy, sz, bevel), mat, T(*loc, rz=rz, rx=rx, ry=ry), obj=obj, detail=detail)
        if occupy:
            self.occupy(loc[0], loc[1], 0.5 * math.hypot(sx, sy))

    def cyl(self, mat, r1, r2, h, loc, segs=24, obj="buildings", detail=0, smooth=True, rx=0.0, ry=0.0, rz=0.0):
        self.add(bm_cyl(r1, r2, h, segs), mat, T(*loc, rx=rx, ry=ry, rz=rz), obj=obj, smooth=smooth, detail=detail)

    def beam(self, mat, p0, p1, w, h=None, obj="buildings", detail=0, bevel=0.0, up=(0, 0, 1)):
        M, length = beam_matrix(p0, p1, up)
        self.add(bm_box(length, w, h or w, bevel, center=True), mat, M, obj=obj, detail=detail)

    def rod(self, mat, p0, p1, r, segs=8, obj="buildings", detail=0):
        self.add(bm_tube([p0, p1], r, segs), mat, None, obj=obj, smooth=True, detail=detail)

    def lathe(self, mat, profile, loc, segs=32, obj="buildings", smooth=True, detail=0, a0=0.0, a1=TAU, closed=False, rz=0.0):
        self.add(bm_lathe(profile, segs, a0, a1, closed), mat, T(*loc, rz=rz), obj=obj, smooth=smooth, detail=detail)

    def frame_box(self, mat, size, loc, t=0.06, rz=0.0, obj="buildings", detail=0):
        """12-edge structural frame around a box volume (base at loc)."""
        sx, sy, sz = size
        M = T(*loc, rz=rz)
        hx, hy = sx / 2, sy / 2
        for z in (t / 2, sz - t / 2):
            for (a, b) in [((-hx, -hy), (hx, -hy)), ((hx, -hy), (hx, hy)), ((hx, hy), (-hx, hy)), ((-hx, hy), (-hx, -hy))]:
                self.beam(mat, M @ Vector((a[0], a[1], z)), M @ Vector((b[0], b[1], z)), t, obj=obj, detail=detail)
        for (x, y) in [(-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy)]:
            self.beam(mat, M @ Vector((x, y, 0)), M @ Vector((x, y, sz)), t, obj=obj, detail=detail)

    def railing(self, mat, pts, h=0.55, post_every=0.6, r=0.025, obj="props", detail=1):
        pts = [Vector(p) for p in pts]
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            seg = (b - a)
            n = max(1, int(seg.length / post_every))
            for k in range(n + (1 if i == len(pts) - 2 else 0)):
                p = a + seg * (k / n)
                self.rod(mat, p, p + Vector((0, 0, h)), r, 6, obj=obj, detail=detail)
            self.rod(mat, a + Vector((0, 0, h)), b + Vector((0, 0, h)), r * 1.3, 6, obj=obj, detail=detail)
            self.rod(mat, a + Vector((0, 0, h * 0.5)), b + Vector((0, 0, h * 0.5)), r, 6, obj=obj, detail=detail + 1)

    def stairs(self, mat, loc, width, depth, rise, steps, rz=0.0, obj="buildings"):
        """Stair block centred on loc, ascending toward local +Y."""
        M = T(*loc, rz=rz)
        for i in range(steps):
            d = depth * (steps - i) / steps
            self.add(bm_box(width, d, rise / steps + 0.02, 0.01), mat,
                     M @ T(0, depth / 2 - d / 2, rise * i / steps - 0.02), obj=obj)

    def slot(self, x, y, z, facing, kind="content", **meta):
        self.occupy(x, y, 0.95)
        self.slots.append({"kind": kind, "pos": to_three((x, y, z)), "facing": facing_three(facing), **meta})

    # -- finalize -------------------------------------------------------------------
    def finalize(self, collection=None, ao=True, ao_rays=14, ao_dist=2.6, gradient=None):
        coll = collection or bpy.context.scene.collection
        objects = {}
        by_obj: dict[str, list[tuple[str, Part]]] = {}
        for (obj, mat), parts in self.parts.items():
            for p in parts:
                by_obj.setdefault(obj, []).append((mat, p))
        for obj, items in by_obj.items():
            mats = sorted({m for m, _ in items})
            verts, faces, mat_idx, smooth = [], [], [], []
            for mat, p in items:
                base = len(verts)
                verts.extend(p.verts)
                for f in p.faces:
                    faces.append(tuple(i + base for i in f))
                    mat_idx.append(mats.index(mat))
                    smooth.append(p.smooth)
            me = bpy.data.meshes.new(obj)
            me.from_pydata(verts, [], faces)
            me.validate(clean_customdata=False)
            for m in mats:
                me.materials.append(get_material(m))
            if len(me.polygons) == len(mat_idx):
                me.polygons.foreach_set("material_index", mat_idx)
                me.polygons.foreach_set("use_smooth", smooth)
            me.update()
            box_uv(me)
            ob = bpy.data.objects.new(obj, me)
            if obj in self.obj_origin:
                ob.location = self.obj_origin[obj]
            ob["category"] = self.obj_category.get(obj, "buildings")
            coll.objects.link(ob)
            objects[obj] = ob
        bpy.context.view_layer.update()
        if ao:
            solid = [o for n, o in objects.items() if not n.startswith("water")]
            bake_vertex_ao(solid, rays=ao_rays, max_dist=ao_dist, gradient=gradient)
        return objects


def box_uv(me, scale=0.5):
    """World-scale tri-planar box projection so tiling textures stay consistent."""
    uv = me.uv_layers.new(name="UVMap")
    co = [v.co for v in me.vertices]
    for poly in me.polygons:
        n = poly.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for li in poly.loop_indices:
            p = co[me.loops[li].vertex_index]
            if az >= ax and az >= ay:
                u, v = p.x, p.y
            elif ax >= ay:
                u, v = p.y, p.z
            else:
                u, v = p.x, p.z
            uv.data[li].uv = (u * scale, v * scale)


def _hemisphere(n):
    dirs = []
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        z = 1 - (i + 0.5) / n  # cosine-ish distribution toward the normal
        z = math.sqrt(z)
        r = math.sqrt(max(0.0, 1 - z * z))
        a = golden * i
        dirs.append(Vector((r * math.cos(a), r * math.sin(a), z)))
    return dirs


def bake_vertex_ao(objects, rays=14, max_dist=2.6, gradient=None):
    """Ray-traced per-vertex ambient occlusion written to a COLOR_0 attribute.
    `gradient` = (z_bottom, z_top, min_value) darkens geometry toward the bottom of the island."""
    all_v, all_f = [], []
    for ob in objects:
        mw = ob.matrix_world
        base = len(all_v)
        all_v.extend([mw @ v.co for v in ob.data.vertices])
        all_f.extend([tuple(i + base for i in p.vertices) for p in ob.data.polygons])
    if not all_f:
        return
    bvh = BVHTree.FromPolygons(all_v, all_f, epsilon=0.0)
    hemi = _hemisphere(rays)
    for ob in objects:
        me = ob.data
        mw = ob.matrix_world
        nm = mw.to_3x3().inverted_safe().transposed()
        values = []
        for v in me.vertices:
            p = mw @ v.co
            n = (nm @ v.normal).normalized()
            if n.length < 0.5:
                n = Vector((0, 0, 1))
            ref = Vector((0, 0, 1)) if abs(n.z) < 0.95 else Vector((1, 0, 0))
            t1 = n.cross(ref).normalized()
            t2 = n.cross(t1)
            origin = p + n * 0.025
            occ = 0.0
            for d in hemi:
                dirw = t1 * d.x + t2 * d.y + n * d.z
                hit = bvh.ray_cast(origin, dirw, max_dist)
                if hit[0] is not None:
                    occ += (1.0 - hit[3] / max_dist) ** 0.7
            a = 1.0 - 0.78 * (occ / len(hemi))
            a = max(0.3, min(1.0, a)) ** 1.1
            if gradient:
                zb, zt, mn = gradient
                a *= lerp(mn, 1.0, smoothstep(zb, zt, p.z))
            values.extend((a, a, a, 1.0))
        attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
        attr.data.foreach_set("color", values)
        try:
            me.color_attributes.active_color = attr
        except Exception:
            pass


# --------------------------------------------------------------------------------------
# Scene / export helpers
# --------------------------------------------------------------------------------------

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def export_glb(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_vertex_color="ACTIVE",
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_texcoords=True,
        export_normals=True,
    )


def save_blend(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)


def load_world():
    with open(os.path.join(ROOT, "config", "world.json")) as f:
        return json.load(f)


def world_to_blender(p):
    return Vector((p[0], -p[2], p[1]))
