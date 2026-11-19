"""
Architecture for the seven islands.

Each island has a SPEC (terrain modifiers: pads, ponds, hills, sign/label anchors)
and a BUILD function that places architecture on the analytic terrain.
Coordinates are Blender-local (Z up, island centred at origin, -Y faces the
overview camera).
"""
from __future__ import annotations

import math
import random

from mathutils import Vector

from lib import (TAU, Builder, T, bm_box, bm_cyl, bm_from, bm_ico, bm_lathe, bm_prism, bm_uvsphere,
                 bm_profile_extrude, bm_torus, bm_tube, displace, to_three)

D2R = math.pi / 180


# --------------------------------------------------------------------------------------
# Small reusable props
# --------------------------------------------------------------------------------------

def bench(b, x, y, z, rz=0.0, mat="wood"):
    M = T(x, y, z, rz=rz)
    b.add(bm_box(1.1, 0.36, 0.06, 0.015), mat, M @ T(0, 0, 0.36), obj="props", detail=1)
    b.add(bm_box(1.1, 0.06, 0.3, 0.015), mat, M @ T(0, 0.17, 0.42), obj="props", detail=1)
    for sx in (-0.45, 0.45):
        b.add(bm_box(0.08, 0.34, 0.36, 0.01), "concrete_dark", M @ T(sx, 0, 0), obj="props", detail=1)


def lamp(b, x, y, z, h=1.5):
    b.cyl("metal_dark", 0.035, 0.03, h, (x, y, z), segs=6, obj="props", detail=1)
    b.add(bm_box(0.16, 0.16, 0.12, 0.02), "emit_warm", T(x, y, z + h), obj="props", detail=1)
    b.add(bm_box(0.22, 0.22, 0.03, 0.0), "metal_dark", T(x, y, z + h + 0.12), obj="props", detail=1)


def column(b, x, y, z, h, r=0.16, mat="stone_light"):
    b.add(bm_box(r * 2.7, r * 2.7, 0.16, 0.02), mat, T(x, y, z), obj="buildings")
    b.cyl(mat, r, r * 0.88, h - 0.32, (x, y, z + 0.16), segs=14, obj="buildings")
    b.add(bm_box(r * 2.9, r * 2.9, 0.16, 0.02), mat, T(x, y, z + h - 0.16), obj="buildings")


def planter(b, x, y, z, w, d, h=0.45, rz=0.0):
    b.box("concrete", (w, d, h), (x, y, z), rz=rz, bevel=0.03)
    b.box("grass", (w - 0.12, d - 0.12, 0.05), (x, y, z + h - 0.02), rz=rz, bevel=0, obj="props")


def plant(b, terrain, v, x, y, s=1.0, r=None, z=None):
    rng = random.Random(int(x * 1000 + y * 77))
    zz = terrain.h(x, y) if z is None else z
    b.vegetation.append({"v": v, "p": to_three((x, y, zz - 0.03)), "r": round(r if r is not None else rng.uniform(0, TAU), 3),
                         "s": round(s, 3)})
    b.occupy(x, y, 0.5 * s)


def water_box(b, name, x, y, z, w, d, rz=0.0):
    """Rectangular water surface as its own node (reflecting pools)."""
    nm = b.separate(name, (x, y, z), "water")
    verts = [(-w / 2, -d / 2, 0), (w / 2, -d / 2, 0), (w / 2, d / 2, 0), (-w / 2, d / 2, 0)]
    b.add(bm_from(verts, [(0, 1, 2, 3)]), "water", T(x, y, z, rz=rz), obj=nm)


def basin(b, name, x, y, z, w, d, rim=0.18, h=0.3, rz=0.0, mat="concrete_light"):
    M = T(x, y, z, rz=rz)
    b.add(bm_box(w, d, 0.06, 0), "concrete_dark", M, obj="buildings")
    for (sx, sy, px, py) in [(w, rim, 0, -d / 2 + rim / 2), (w, rim, 0, d / 2 - rim / 2),
                             (rim, d - 2 * rim, -w / 2 + rim / 2, 0), (rim, d - 2 * rim, w / 2 - rim / 2, 0)]:
        b.add(bm_box(sx, sy, h, 0.02), mat, M @ T(px, py, 0), obj="buildings")
    c = M @ Vector((0, 0, h - 0.06))
    water_box(b, name, c.x, c.y, c.z, w - 2 * rim + 0.02, d - 2 * rim + 0.02, rz)
    b.occupy(x, y, 0.5 * math.hypot(w, d))


def paraboloid(f, R, t=0.05, n=10):
    outer = [(R * i / n, (R * i / n) ** 2 / (4 * f)) for i in range(n + 1)]
    inner = [(r, z + t) for r, z in reversed(outer)]
    return outer + inner


def pergola(b, x, y, z, w, d, h=2.0, rz=0.0):
    M = T(x, y, z, rz=rz)
    for sx in (-w / 2, w / 2):
        for sy in (-d / 2, d / 2):
            b.add(bm_box(0.14, 0.14, h, 0.02), "wood_dark", M @ T(sx, sy, 0), obj="buildings")
    for sy in (-d / 2, d / 2):
        b.add(bm_box(w + 0.4, 0.12, 0.16, 0.02), "wood", M @ T(0, sy, h), obj="buildings")
    n = int(w / 0.35)
    for i in range(n + 1):
        b.add(bm_box(0.07, d + 0.5, 0.1, 0.01), "wood", M @ T(-w / 2 + i * w / n, 0, h + 0.16), obj="props", detail=1)


# --------------------------------------------------------------------------------------
# ABOUT — brutalist headquarters
# --------------------------------------------------------------------------------------

SPEC_ABOUT = {
    "noise": 0.4, "dome": 0.9, "port_h": 0.45, "hub": (0, -0.5), "path_mat": "paving",
    "pads": [
        {"shape": "rect", "x": 0, "y": 0.6, "w": 8.0, "d": 7.0, "h": 0.7, "paved": "paving", "blend": 2.0},
        {"x": -5.0, "y": -3.3, "r": 2.1, "h": 1.25, "blend": 1.6},
        {"x": 5.3, "y": -2.7, "r": 1.6, "h": 0.9, "paved": "concrete_light", "blend": 1.4},
    ],
    "ponds": [{"x": -5.5, "y": 3.3, "r": 1.5, "level": 0.55, "depth": 0.5, "fall": 150 * D2R, "fall_w": 1.1}],
    "sign": (0.0, -7.0, -90 * D2R),
    "veg": {"count": 46, "weights": {"broad_a": 3, "broad_b": 2, "cypress": 2, "bush": 3, "rock": 1}},
}


def build_about(b: Builder, t):
    z0 = 0.7
    cx, cy = 0.0, 2.0
    # podium
    b.box("concrete", (6.6, 4.0, 0.55), (cx, cy, z0), bevel=0.04, occupy=True)
    b.stairs("concrete_light", (cx, cy - 2.35, z0), 3.0, 0.7, 0.55, 4)
    floors = [
        (5.6, 3.0, 0.0, 0.0), (3.4, 4.6, 0.0, -0.35), (6.0, 2.6, 0.5, 0.0),
        (3.8, 3.8, -0.2, 0.1), (5.0, 2.8, -0.6, 0.0), (2.8, 2.8, 0.3, 0.2),
    ]
    z = z0 + 0.55
    for i, (w, d, ox, oy) in enumerate(floors):
        gh, sh = 0.64, 0.34
        b.box("glass", (w - 0.4, d - 0.4, gh), (cx + ox, cy + oy, z), bevel=0.0)
        if i % 2 == 0:
            b.box("emit_warm", (w - 0.6, d - 0.6, gh - 0.08), (cx + ox, cy + oy, z + 0.04), bevel=0.0, detail=1)
        else:
            b.box("concrete_dark", (w - 0.6, d - 0.6, gh - 0.04), (cx + ox, cy + oy, z + 0.02), bevel=0.0, detail=1)
        # vertical fins along the long faces
        if b.lod == 0:
            n = int(w / 0.42)
            for k in range(n + 1):
                fx = cx + ox - (w - 0.5) / 2 + k * (w - 0.5) / n
                for fy in (cy + oy - (d - 0.4) / 2 - 0.05, cy + oy + (d - 0.4) / 2 + 0.05):
                    b.box("concrete", (0.06, 0.22, gh), (fx, fy, z), bevel=0.0, obj="props", detail=1)
        z += gh
        b.box("concrete", (w, d, sh), (cx + ox, cy + oy, z), bevel=0.05)
        # parapet up-stand on cantilevers
        b.box("concrete_light", (w, 0.08, 0.12), (cx + ox, cy + oy - d / 2 + 0.04, z + sh), bevel=0.0, detail=1)
        z += sh
    top = z
    # service core
    b.box("concrete_dark", (1.4, 1.4, top - z0 + 1.6), (cx + 1.6, cy + 0.9, z0), bevel=0.04)
    b.box("lime", (1.46, 1.46, 0.28), (cx + 1.6, cy + 0.9, top + 1.05), bevel=0.0)
    b.box("concrete_dark", (0.9, 3.0, 0.2), (cx - 0.6, cy + 0.2, top), bevel=0.02)
    # roof garden + mast
    b.box("grass", (2.2, 2.2, 0.08), (cx + 0.3, cy + 0.2, top), bevel=0.0, obj="props")
    b.cyl("metal", 0.05, 0.02, 2.4, (cx + 1.6, cy + 0.9, top + 1.6), segs=6, obj="props")
    b.add(bm_box(0.12, 0.12, 0.12, 0), "emit_lime", T(cx + 1.6, cy + 0.9, top + 4.0), obj="props")
    b.label = Vector((cx, cy, top + 2.6))
    # entrance canopy
    b.box("concrete_light", (3.2, 1.4, 0.16), (cx, cy - 2.6, z0 + 1.55), bevel=0.02)
    for sx in (-1.4, 1.4):
        b.cyl("metal_dark", 0.05, 0.05, 1.55, (cx + sx, cy - 3.1, z0), segs=8)

    # reflecting pool on plaza
    basin(b, "water_reflect", 0.0, -1.9, z0, 5.0, 1.5)
    # benches + lamps around plaza
    for x in (-3.3, 3.3):
        bench(b, x, -1.9, z0, rz=math.pi / 2)
        lamp(b, x, -3.0, z0)
        lamp(b, x, 2.8, z0)

    # monument: tilted orange ring that slowly rotates, pierced by a lime rod
    mx, my, mz = 5.3, -2.7, 0.9
    b.box("stone_dark", (1.7, 1.7, 0.5), (mx, my, mz), bevel=0.05, occupy=True)
    b.box("stone_mid", (1.1, 1.1, 0.25), (mx, my, mz + 0.5), bevel=0.03)
    ring = b.separate("anim_spin_monument", (mx, my, mz + 2.3))
    b.add(bm_torus(1.15, 0.15, 48, 12), "orange", T(mx, my, mz + 2.3, rx=math.pi / 2, ry=0.35), obj=ring, smooth=True)
    b.add(bm_box(0.5, 0.5, 0.5, 0.04), "lime", T(mx, my, mz + 2.05, rx=0.6, ry=0.6), obj=ring)
    b.rod("ink", (mx - 0.1, my, mz + 0.75), (mx + 0.25, my + 0.2, mz + 3.8), 0.05, 8)
    b.box("concrete_dark", (0.45, 0.45, 2.8), (mx + 1.0, my + 0.6, mz), bevel=0.02, rz=0.3)

    # terraced garden with retaining wall
    gx, gy, gh = -5.0, -3.3, 1.25
    b.lathe("stone_light", [(1.95, gh - 0.9), (2.2, gh - 0.9), (2.2, gh + 0.12), (1.95, gh + 0.12)], (gx, gy, 0),
            segs=40, closed=True, smooth=False)
    planter(b, gx - 0.6, gy + 0.5, gh, 1.2, 0.6, rz=0.4)
    planter(b, gx + 0.7, gy - 0.5, gh, 1.0, 0.6, rz=-0.3)
    pergola(b, gx + 0.2, gy + 0.2, gh, 2.0, 1.2, h=1.7, rz=0.4)
    bench(b, gx - 0.2, gy - 0.9, gh, rz=0.4)
    for (x, y, v, s) in [(-6.2, -2.2, "bush", 0.9), (-4.0, -4.6, "bush", 0.8), (-6.0, -4.4, "cypress", 1.0),
                         (-3.0, 4.6, "broad_a", 1.2), (3.4, 5.0, "broad_b", 1.1), (5.8, 1.6, "cypress", 1.1),
                         (6.2, 3.2, "cypress", 0.9), (-4.4, 0.6, "broad_a", 1.0)]:
        plant(b, t, v, x, y, s)


# --------------------------------------------------------------------------------------
# PROJECTS — industrial technology district
# --------------------------------------------------------------------------------------

SPEC_PROJECTS = {
    "noise": 0.3, "dome": 0.5, "port_h": 0.4, "hub": (0.6, -1.1), "path_mat": "concrete",
    "pads": [
        {"shape": "rect", "x": 0.8, "y": 0.8, "w": 7.0, "d": 5.2, "h": 0.45, "paved": "concrete", "blend": 1.6},
        {"x": -3.2, "y": 2.5, "r": 1.9, "h": 0.6, "paved": "concrete_dark", "blend": 1.3},
        {"x": 3.8, "y": -2.7, "r": 1.6, "h": 0.45, "blend": 1.3},
    ],
    "ponds": [{"x": -3.6, "y": -2.4, "r": 1.1, "level": 0.3, "depth": 0.4, "fall": 230 * D2R, "fall_w": 0.9}],
    "strata": ["stone_cool", "stone_mid", "stone_dark", "stone_cool", "stone_mid", "stone_dark"],
    "sign": (2.2, -5.6, -75 * D2R),
    "veg": {"count": 22, "weights": {"conifer": 3, "bush": 2, "rock": 3, "broad_b": 1}},
}


def server_hall(b, x, y, z, w, d, h, rz=0.0):
    M = T(x, y, z, rz=rz)
    b.add(bm_box(w, d, 0.2, 0.02), "concrete_dark", M, obj="buildings")
    b.add(bm_box(w - 0.1, d - 0.1, h, 0.03), "metal", M @ T(0, 0, 0.2), obj="buildings")
    # cladding ribs
    n = int(w / 0.28)
    for k in range(n + 1):
        px = -w / 2 + 0.1 + k * (w - 0.2) / n
        for py in (-d / 2 + 0.02, d / 2 - 0.02):
            b.add(bm_box(0.05, 0.06, h - 0.1), "metal_dark", M @ T(px, py, 0.25), obj="props", detail=1)
    # status light strip + louvres
    b.add(bm_box(w * 0.86, 0.04, 0.06, 0), "emit_lime", M @ T(0, -d / 2 - 0.02, 0.2 + h * 0.78), obj="props")
    b.add(bm_box(w * 0.5, 0.04, 0.35, 0), "metal_dark", M @ T(-w * 0.15, -d / 2 - 0.03, 0.4), obj="props")
    # roof plant
    b.add(bm_box(w, d, 0.12, 0.02), "concrete_dark", M @ T(0, 0, 0.2 + h), obj="buildings")
    for k in range(3):
        px = -w / 3 + k * w / 3
        b.add(bm_cyl(0.3, 0.3, 0.32, 16), "metal", M @ T(px, 0, 0.32 + h), obj="props", smooth=True)
        b.add(bm_cyl(0.26, 0.26, 0.04, 16), "metal_dark", M @ T(px, 0, 0.64 + h), obj="props")
    b.occupy(x, y, 0.5 * math.hypot(w, d))


def cooling_tower(b, x, y, z, h=2.8, r0=0.85):
    prof = []
    n = 10
    for i in range(n + 1):
        tt = i / n
        r = r0 * (1 - 0.32 * math.sin(math.pi * min(1, tt * 1.15)) ** 1.3) - 0.1 * tt
        prof.append((r, tt * h))
    inner = [(r - 0.07, zz) for r, zz in reversed(prof)]
    b.lathe("concrete_light", prof + inner, (x, y, z), segs=40, closed=True)
    for k in range(8):
        a = TAU * k / 8
        b.beam("concrete_dark", (x + math.cos(a) * r0 * 1.05, y + math.sin(a) * r0 * 1.05, z - 0.05),
               (x + math.cos(a + 0.35) * r0 * 0.98, y + math.sin(a + 0.35) * r0 * 0.98, z + 0.45), 0.08)
    b.occupy(x, y, r0)


def pipe_run(b, pts, z_of, r=0.11, offset=0.26):
    """Two parallel pipes on portal supports."""
    P = [Vector((x, y, 0)) for x, y in pts]
    for side, mat in ((-1, "orange"), (1, "metal")):
        path = []
        for i, p in enumerate(P):
            a = P[max(0, i - 1)]
            c = P[min(len(P) - 1, i + 1)]
            d = (c - a)
            d.normalize()
            n = Vector((-d.y, d.x, 0))
            q = p + n * (offset / 2 * side)
            path.append((q.x, q.y, z_of))
        # chamfer corners
        sm = [path[0]]
        for i in range(1, len(path) - 1):
            a, p, c = Vector(path[i - 1]), Vector(path[i]), Vector(path[i + 1])
            sm.append(tuple(p + (a - p).normalized() * 0.3))
            sm.append(tuple(p + (c - p).normalized() * 0.3))
        sm.append(path[-1])
        b.add(bm_tube(sm, r, 12), mat, None, obj="landmarks", smooth=True)
    # supports
    for i in range(len(P) - 1):
        a, c = P[i], P[i + 1]
        L = (c - a).length
        n = max(1, int(L / 1.4))
        d = (c - a).normalized()
        nrm = Vector((-d.y, d.x, 0))
        for k in range(n + 1):
            p = a + (c - a) * (k / n)
            for s in (-1, 1):
                q = p + nrm * 0.32 * s
                b.beam("metal_dark", (q.x, q.y, b._terrain.h(q.x, q.y) - 0.1), (q.x, q.y, z_of - 0.12), 0.08,
                       obj="landmarks")
            q1, q2 = p + nrm * 0.36, p - nrm * 0.36
            b.beam("metal_dark", (q1.x, q1.y, z_of - 0.14), (q2.x, q2.y, z_of - 0.14), 0.09, obj="landmarks")
            b.occupy(p.x, p.y, 0.4)


def build_projects(b: Builder, t):
    b._terrain = t
    z0 = 0.45
    server_hall(b, 1.2, 2.3, z0, 4.4, 1.7, 1.5)
    server_hall(b, 1.6, -0.3, z0, 3.6, 1.5, 1.15)
    # catwalk bridge between the halls
    b.beam("metal_dark", (0.2, 1.45, z0 + 1.6), (0.2, 0.45, z0 + 1.35), 0.6, 0.08)
    b.railing("metal", [(-0.08, 1.45, z0 + 1.62), (-0.08, 0.45, z0 + 1.37)], h=0.45, post_every=0.5)
    b.railing("metal", [(0.48, 1.45, z0 + 1.62), (0.48, 0.45, z0 + 1.37)], h=0.45, post_every=0.5)
    cooling_tower(b, -3.9, 3.0, 0.6, 2.7, 0.82)
    cooling_tower(b, -2.4, 2.0, 0.6, 2.3, 0.72)
    # chimney stack with bands
    cx, cy = 3.7, 3.1
    for i in range(6):
        b.cyl("cream" if i % 2 == 0 else "orange", 0.24 - i * 0.012, 0.24 - (i + 1) * 0.012, 0.75,
              (cx, cy, z0 + i * 0.75), segs=18)
    b.cyl("metal_dark", 0.2, 0.2, 0.15, (cx, cy, z0 + 4.5), segs=18)
    b.label = Vector((0.8, 1.0, 5.6))
    pipe_run(b, [(-2.4, 2.0), (-1.4, 0.95), (4.45, 0.95), (4.45, -1.8), (3.9, -2.5)], z0 + 1.95)

    # raised industrial platform with gantry crane
    px, py, pz = 3.8, -2.7, 0.45
    deck = pz + 1.8
    for sx in (-1.2, 0, 1.2):
        for sy in (-0.9, 0.9):
            b.beam("metal_dark", (px + sx, py + sy, pz - 0.2), (px + sx, py + sy, deck), 0.14)
    b.box("metal", (2.8, 2.2, 0.14), (px, py, deck), bevel=0.02)
    b.railing("orange", [(px - 1.4, py - 1.1, deck + 0.14), (px + 1.4, py - 1.1, deck + 0.14),
                         (px + 1.4, py + 1.1, deck + 0.14)], h=0.5, post_every=0.45)
    for sx in (-1.15, 1.15):
        b.beam("lime", (px + sx, py - 0.8, deck), (px + sx, py - 0.8, deck + 1.6), 0.14)
        b.beam("lime", (px + sx, py + 0.8, deck), (px + sx, py + 0.8, deck + 1.6), 0.14)
        b.beam("lime", (px + sx, py - 0.8, deck + 1.6), (px + sx, py + 0.8, deck + 1.6), 0.14)
    b.beam("ink", (px - 1.3, py, deck + 1.75), (px + 1.3, py, deck + 1.75), 0.22)
    b.box("ink", (0.36, 0.36, 0.3), (px + 0.3, py, deck + 1.35))
    b.rod("metal", (px + 0.3, py, deck + 1.35), (px + 0.3, py, deck + 0.6), 0.02, 6, obj="props")
    b.box("orange", (0.7, 0.5, 0.45), (px - 0.4, py + 0.2, deck + 0.14), bevel=0.03, obj="props")
    # ladder
    for k in range(9):
        b.beam("metal", (px - 1.45, py - 0.2, pz + k * 0.2), (px - 1.45, py + 0.2, pz + k * 0.2), 0.03, obj="props",
               detail=1)
    b.occupy(px, py, 1.7)

    # content plaques promenade (front of hall B) + east edge
    for x in (-2.2, -1.0, 0.2, 1.4, 2.6):
        b.slot(x, -1.45, z0, -90 * D2R)
        b.occupy(x, -1.45, 0.4)
    for (x, y) in [(5.6, 0.4), (5.4, 1.9), (5.1, 3.3)]:
        b.slot(x, y, t.h(x, y), -20 * D2R)
        b.occupy(x, y, 0.4)
    for (x, y) in [(-5.6, 0.6), (-4.6, -0.4), (-1.6, 4.6), (1.4, 4.4), (5.6, -1.4)]:
        plant(b, t, "conifer", x, y, 1.0)


# --------------------------------------------------------------------------------------
# BLOGS — monumental library and archive
# --------------------------------------------------------------------------------------

SPEC_BLOGS = {
    "noise": 0.32, "dome": 0.7, "port_h": 0.4, "hub": (0.5, -1.5), "path_mat": "stone_light",
    "pads": [
        {"shape": "rect", "x": 0.5, "y": 1.6, "w": 7.2, "d": 4.6, "h": 0.95, "paved": "stone_light", "blend": 1.6},
        {"x": -4.4, "y": -2.6, "r": 1.4, "h": 0.35, "paved": "wood", "blend": 1.2},
    ],
    "ponds": [{"x": -3.0, "y": 5.0, "r": 1.05, "level": 0.6, "depth": 0.4, "fall": 112 * D2R, "fall_w": 0.9}],
    "strata": ["stone_light", "stone_mid", "stone_light", "stone_mid", "stone_dark", "stone_mid"],
    "sign": (2.5, -5.2, -70 * D2R),
    "veg": {"count": 34, "weights": {"broad_a": 3, "broad_b": 3, "bush": 2, "cypress": 1, "rock": 1}},
}


def bookshelf(b, x, y, z, w=3.0, d=0.7, h=3.2, rz=0.0, seed=0):
    rng = random.Random(seed)
    M = T(x, y, z, rz=rz)
    b.add(bm_box(w, d, 0.14, 0.02), "wood_dark", M, obj="landmarks")
    for sx in (-w / 2 + 0.07, w / 2 - 0.07):
        b.add(bm_box(0.14, d, h, 0.02), "wood_dark", M @ T(sx, 0, 0), obj="landmarks")
    b.add(bm_box(w, 0.06, h, 0.0), "wood_dark", M @ T(0, d / 2 - 0.03, 0), obj="landmarks")
    shelves = 5
    for s in range(shelves + 1):
        zz = 0.14 + s * (h - 0.28) / shelves
        b.add(bm_box(w - 0.1, d, 0.07, 0.01), "wood", M @ T(0, 0, zz), obj="landmarks")
        if s == shelves:
            break
        xx = -w / 2 + 0.2
        while xx < w / 2 - 0.25:
            bw = rng.uniform(0.07, 0.15)
            bh = rng.uniform(0.32, 0.5) * ((h - 0.28) / shelves / 0.58)
            mat = rng.choice(["cream", "cream", "orange", "blue", "mint", "ink", "wood", "stone_mid", "lime"])
            lean = rng.uniform(-0.12, 0.12) if rng.random() < 0.12 else 0.0
            b.add(bm_box(bw, d * 0.75, bh, 0.008), mat, M @ T(xx + bw / 2, -0.03, zz + 0.07, ry=lean), obj="props",
                  detail=1)
            xx += bw + 0.012
    # carved cornice
    b.add(bm_box(w + 0.2, d + 0.15, 0.18, 0.03), "stone_light", M @ T(0, 0, h), obj="landmarks")
    b.occupy(x, y, 0.5 * w)


def build_blogs(b: Builder, t):
    z0 = 0.95
    cx, cy = 0.5, 2.5
    # plinth + main block + stepped attic
    b.box("stone_mid", (6.6, 3.6, 0.35), (cx, cy, z0), bevel=0.04, occupy=True)
    b.stairs("stone_light", (cx, cy - 2.05, z0), 3.4, 0.5, 0.35, 3)
    b.box("stone_light", (5.6, 2.3, 2.7), (cx, cy + 0.55, z0 + 0.35), bevel=0.04)
    # clerestory + warm interior
    b.box("glass", (4.8, 0.08, 0.55), (cx, cy - 0.62, z0 + 2.15), bevel=0.0)
    b.box("emit_warm", (4.6, 0.04, 0.45), (cx, cy - 0.56, z0 + 2.2), bevel=0.0, detail=1)
    b.box("ink", (1.1, 0.06, 1.7), (cx, cy - 0.62, z0 + 0.35), bevel=0.0)
    b.box("emit_warm", (0.9, 0.04, 1.5), (cx, cy - 0.6, z0 + 0.4), bevel=0.0)
    # colonnade
    for i in range(8):
        x = cx - 2.55 + i * (5.1 / 7)
        column(b, x, cy - 1.25, z0 + 0.35, 2.75, 0.15)
    b.box("stone_light", (6.2, 0.75, 0.42), (cx, cy - 1.05, z0 + 3.1), bevel=0.03)
    b.box("stone_mid", (6.2, 0.06, 0.12), (cx, cy - 1.45, z0 + 3.2), bevel=0.0, detail=1)
    tiers = [(6.0, 3.1, 0.3), (4.8, 2.4, 0.32), (3.2, 1.6, 0.36)]
    zz = z0 + 3.05
    for w, d, h in tiers:
        b.box("stone_light", (w, d, h), (cx, cy + 0.2, zz), bevel=0.03)
        zz += h
    b.box("lime", (1.2, 0.08, 0.2), (cx, cy - 0.62, zz - 0.25), bevel=0.0)
    b.label = Vector((cx, cy, zz + 1.6))
    # terrace furniture
    for x in (-2.4, 3.4):
        lamp(b, x, 0.0, z0)
    # archive rotunda with verdigris dome
    rx, ry = 4.4, 3.0
    rz0 = t.h(rx, ry)
    b.cyl("stone_mid", 1.5, 1.5, 0.3, (rx, ry, rz0 - 0.1), segs=32, smooth=False)
    b.cyl("stone_light", 1.25, 1.25, 2.0, (rx, ry, rz0 + 0.2), segs=32)
    for k in range(12):
        a = TAU * k / 12
        b.add(bm_box(0.16, 0.12, 2.0, 0.01), "stone_mid", T(rx + math.cos(a) * 1.28, ry + math.sin(a) * 1.28, rz0 + 0.2,
                                                             rz=a), obj="props", detail=1)
    dome = [(1.38 * math.cos(a), 1.38 * math.sin(a)) for a in [i * math.pi / 2 / 10 for i in range(11)]]
    b.lathe("mint", [(r, z) for r, z in dome], (rx, ry, rz0 + 2.2), segs=32)
    b.cyl("stone_light", 1.42, 1.42, 0.14, (rx, ry, rz0 + 2.15), segs=32, smooth=False)
    b.cyl("metal_dark", 0.06, 0.02, 0.6, (rx, ry, rz0 + 3.55), segs=6)
    b.occupy(rx, ry, 1.6)
    # monumental bookshelves
    bookshelf(b, -4.6, 2.4, t.h(-4.6, 2.4) - 0.05, rz=-45 * D2R, seed=3)
    bookshelf(b, 5.4, 0.4, t.h(5.4, 0.4) - 0.05, w=2.6, h=2.8, rz=-75 * D2R, seed=9)
    # reading deck with pergola, benches and lamp
    gx, gy, gz = -4.4, -2.6, 0.35
    pergola(b, gx, gy, gz, 1.8, 1.4, h=1.8, rz=0.5)
    bench(b, gx - 0.3, gy + 0.3, gz, rz=0.5)
    bench(b, gx + 0.4, gy - 0.4, gz, rz=0.5 + math.pi)
    b.box("wood", (0.7, 0.7, 0.42), (gx, gy, gz), rz=0.5, bevel=0.03, obj="props")
    for k in range(4):
        b.box(["cream", "orange", "blue", "ink"][k], (0.24, 0.32, 0.05), (gx + 0.05 * k, gy, gz + 0.42 + k * 0.05),
              rz=0.5 + k * 0.4, bevel=0.005, obj="props", detail=1)
    # stepping stones in the pond
    for k, (x, y) in enumerate([(-3.6, 4.6), (-3.0, 5.0), (-2.4, 5.3)]):
        bm = bm_cyl(0.26, 0.24, 0.3, 9)
        displace(bm, 0.03, 4.0, seed=k)
        b.add(bm, "stone_light", T(x, y, 0.42), obj="props")

    # content slots — signboards & slabs
    for (x, y, z, f) in [(-3.4, -1.4, None, -90), (-1.9, -1.6, None, -90), (2.4, -1.5, None, -90),
                         (3.9, -1.3, None, -90), (-2.7, 0.15, z0, -90), (3.8, 0.15, z0, -90),
                         (-3.4, -3.6, None, -120), (-5.4, -1.6, None, -150)]:
        zz = t.h(x, y) if z is None else z
        b.slot(x, y, zz, f * D2R)
        b.occupy(x, y, 0.45)
    for (x, y, v) in [(-5.6, 0.2, "broad_a"), (4.6, -3.4, "broad_b"), (-1.2, 5.6, "broad_a"), (1.4, 5.4, "broad_b"),
                      (-5.8, -4.0, "cypress"), (5.4, -1.0, "cypress")]:
        plant(b, t, v, x, y, 1.1)


# --------------------------------------------------------------------------------------
# RESEARCH — observatory, labs and experimental structures
# --------------------------------------------------------------------------------------

SPEC_RESEARCH = {
    "noise": 0.35, "dome": 0.6, "port_h": 0.45, "hub": (1.3, -1.9), "path_mat": "concrete_light",
    "hills": [{"x": -2.6, "y": 2.6, "r": 3.2, "h": 1.0}],
    "pads": [
        {"x": -2.6, "y": 2.6, "r": 1.9, "h": 1.7, "paved": "concrete_light", "blend": 1.5},
        {"shape": "rect", "x": 1.4, "y": 0.0, "w": 5.4, "d": 3.0, "h": 0.5, "paved": "paving", "blend": 1.4},
    ],
    "ponds": [{"x": -4.8, "y": -0.4, "r": 0.95, "level": 0.35, "depth": 0.4, "fall": 192 * D2R, "fall_w": 0.8}],
    "strata": ["stone_cool", "stone_light", "stone_cool", "stone_mid", "stone_dark", "stone_cool"],
    "sign": (-1.5, -5.2, -100 * D2R),
    "veg": {"count": 26, "weights": {"conifer": 2, "cypress": 2, "bush": 2, "rock": 2, "broad_a": 1}},
}


def lab(b, x, y, z, w, d, h, rz=0.0, warm=True):
    M = T(x, y, z, rz=rz)
    b.add(bm_box(w + 0.3, d + 0.3, 0.16, 0.02), "concrete_light", M, obj="buildings")
    b.add(bm_box(w, d, h, 0.0), "glass", M @ T(0, 0, 0.16), obj="buildings")
    if warm:
        b.add(bm_box(w * 0.5, d * 0.4, 0.5, 0.02), "emit_warm", M @ T(-w * 0.15, 0, 0.16), obj="props", detail=1)
    b.add(bm_box(w * 0.3, d * 0.3, 0.8, 0.02), "metal", M @ T(w * 0.25, d * 0.1, 0.16), obj="props", detail=1)
    b.add(bm_box(w + 0.5, d + 0.5, 0.18, 0.03), "concrete_light", M @ T(0, 0, 0.16 + h), obj="buildings")
    sx, sy = w, d
    # mullions
    n = int(w / 0.5)
    for k in range(n + 1):
        px = -sx / 2 + k * sx / n
        for py in (-sy / 2, sy / 2):
            b.add(bm_box(0.05, 0.05, h, 0), "metal_dark", M @ T(px, py, 0.16), obj="props")
    m = int(d / 0.5)
    for k in range(m + 1):
        py = -sy / 2 + k * sy / m
        for px in (-sx / 2, sx / 2):
            b.add(bm_box(0.05, 0.05, h, 0), "metal_dark", M @ T(px, py, 0.16), obj="props")
    b.occupy(x, y, 0.5 * math.hypot(w, d))


def build_research(b: Builder, t):
    # observatory
    ox, oy, oz = -2.6, 2.6, 1.7
    b.cyl("concrete", 1.55, 1.5, 1.5, (ox, oy, oz), segs=40)
    b.cyl("concrete_dark", 1.62, 1.62, 0.14, (ox, oy, oz + 1.45), segs=40, smooth=False)
    b.cyl("ink", 0.45, 0.45, 0.06, (ox, oy - 1.48, oz + 0.0), segs=4, detail=1)
    b.box("ink", (0.7, 0.06, 1.0), (ox, oy - 1.52, oz), bevel=0.0)
    b.box("emit_warm", (0.55, 0.04, 0.85), (ox, oy - 1.5, oz + 0.05), bevel=0.0)
    dome = b.separate("anim_spin_dome", (ox, oy, oz + 1.59))
    slit = 0.2
    outer = [(1.5 * math.cos(a), 1.5 * math.sin(a)) for a in [i * math.pi / 2 / 12 for i in range(13)]]
    inner = [(r * 0.95, z * 0.95) for r, z in reversed(outer)]
    b.add(bm_lathe(outer + inner, 40, slit, TAU - slit, closed=True), "metal", T(ox, oy, oz + 1.59), obj=dome,
          smooth=True)
    b.add(bm_tube([(ox + 0.1, oy, oz + 1.7), (ox + 1.35, oy, oz + 2.75)], 0.2, 16), "cream", None, obj=dome, smooth=True)
    b.add(bm_cyl(0.24, 0.24, 0.12, 16), "ink", T(ox + 1.35, oy, oz + 2.75, ry=-0.88 + math.pi / 2), obj=dome)
    b.label = Vector((ox, oy, oz + 4.5))
    b.occupy(ox, oy, 1.7)
    b.stairs("concrete_light", (ox, oy - 2.15, oz - 0.6), 1.2, 0.8, 0.6, 4)

    # labs
    lab(b, 0.3, 0.3, 0.5, 2.4, 1.7, 1.35)
    lab(b, 2.6, 0.6, 0.5, 1.7, 1.5, 1.0, warm=False)
    lab(b, 2.6, 0.6, 1.84, 1.9, 1.5, 0.9)
    b.box("concrete_dark", (0.5, 0.5, 0.5), (0.9, 0.5, 2.03), bevel=0.02, obj="props")
    b.cyl("metal", 0.18, 0.18, 0.5, (-0.2, 0.6, 2.03), segs=12, obj="props")

    # radio dish (rotating)
    dx, dy = 3.4, 3.0
    dz = t.h(dx, dy)
    b.cyl("concrete", 0.7, 0.55, 0.4, (dx, dy, dz - 0.1), segs=24)
    b.cyl("metal_dark", 0.18, 0.18, 1.4, (dx, dy, dz + 0.3), segs=12)
    dish = b.separate("anim_spin_dish", (dx, dy, dz + 1.7))
    M = T(dx, dy, dz + 1.75, rx=-0.75)
    b.add(bm_lathe(paraboloid(0.7, 1.3, 0.05), 36, closed=True), "cream", M, obj=dish, smooth=True)
    b.add(bm_box(0.5, 0.25, 0.25, 0.03), "metal", T(dx, dy, dz + 1.62), obj=dish)
    for a in (0, TAU / 3, 2 * TAU / 3):
        p0 = M @ Vector((math.cos(a) * 1.1, math.sin(a) * 1.1, 1.1 ** 2 / 2.8))
        p1 = M @ Vector((0, 0, 0.75))
        b.rod("metal", tuple(p0), tuple(p1), 0.025, 6, obj=dish)
    b.add(bm_cyl(0.08, 0.06, 0.2, 8), "ink", M @ T(0, 0, 0.7), obj=dish)
    b.occupy(dx, dy, 1.3)

    # twisted experimental tower
    tx, ty = 0.6, 3.3
    tz = t.h(tx, ty)
    b.cyl("glass", 0.28, 0.28, 5.0, (tx, ty, tz), segs=16)
    for i in range(16):
        b.box("concrete_light" if i % 3 else "orange", (1.3, 0.55, 0.16), (tx, ty, tz + 0.2 + i * 0.3),
              rz=i * 11 * D2R, bevel=0.02)
    b.add(bm_ico(0.22, 2), "emit_lime", T(tx, ty, tz + 5.25), obj="props", smooth=True)
    b.occupy(tx, ty, 0.8)

    # particle accelerator ring on pylons
    ax, ay = -2.0, -2.4
    az = t.h(ax, ay) + 0.95
    b.add(bm_torus(1.6, 0.2, 56, 12), "blue", T(ax, ay, az), obj="landmarks", smooth=True)
    for k in range(6):
        a = TAU * k / 6
        px, py = ax + math.cos(a) * 1.6, ay + math.sin(a) * 1.6
        b.beam("concrete_dark", (px, py, t.h(px, py) - 0.2), (px, py, az - 0.1), 0.18, obj="landmarks")
        b.add(bm_box(0.36, 0.5, 0.5, 0.03), "metal", T(px, py, az - 0.25, rz=a), obj="landmarks")
        b.add(bm_box(0.1, 0.52, 0.1, 0), "emit_lime", T(px, py, az + 0.2, rz=a), obj="props")
    b.occupy(ax, ay, 1.9)

    # glass installations (content)
    for (x, y, z, f) in [(-0.9, -1.05, 0.5, -90), (0.5, -1.05, 0.5, -90), (2.3, -1.05, 0.5, -90),
                         (3.7, -1.05, 0.5, -90), (-1.8, 0.35, None, -90), (-3.3, 0.45, None, -100)]:
        zz = t.h(x, y) if z is None else z
        b.slot(x, y, zz, f * D2R)
        b.occupy(x, y, 0.4)
    for (x, y, v) in [(-5.0, 2.6, "conifer"), (-4.6, 4.2, "cypress"), (5.0, 1.4, "cypress"), (4.8, -1.8, "conifer")]:
        plant(b, t, v, x, y, 1.0)


# --------------------------------------------------------------------------------------
# PLAYGROUND — workshops, prototypes and installations
# --------------------------------------------------------------------------------------

SPEC_PLAYGROUND = {
    "noise": 0.4, "dome": 0.6, "port_h": 0.35, "hub": (0.4, 0.2), "path_mat": "paving",
    "pads": [{"x": 0.3, "y": 0.3, "r": 2.6, "h": 0.4, "paved": "paving", "blend": 1.4}],
    "ponds": [{"x": 0.6, "y": 4.4, "r": 1.0, "level": 0.45, "depth": 0.4, "fall": 86 * D2R, "fall_w": 0.85}],
    "strata": ["stone_mid", "stone_light", "stone_mid", "stone_dark", "stone_light"],
    "sign": (0.2, -5.0, -90 * D2R),
    "veg": {"count": 22, "weights": {"broad_b": 2, "broad_a": 2, "bush": 3, "rock": 1}},
}


def build_playground(b: Builder, t):
    # sawtooth workshop
    wx, wy, wrz = -2.6, 3.0, 0.2
    wz = t.h(wx, wy)
    M = T(wx, wy, wz - 0.1, rz=wrz)
    b.add(bm_box(3.4, 2.4, 0.3, 0.03), "concrete_dark", M, obj="buildings")
    b.add(bm_box(3.2, 2.2, 1.2, 0.03), "cream", M @ T(0, 0, 0.3), obj="buildings")
    b.add(bm_box(3.22, 2.22, 0.3, 0.0), "blue", M @ T(0, 0, 0.3), obj="buildings")
    b.add(bm_box(1.0, 0.05, 0.8, 0), "glass", M @ T(-0.6, -1.11, 0.62), obj="buildings")
    b.add(bm_box(0.9, 0.03, 0.7, 0), "emit_warm", M @ T(-0.6, -1.08, 0.66), obj="props")
    for k in range(4):
        x0 = -1.6 + k * 0.8
        prof = [(x0, 0), (x0 + 0.8, 0), (x0, 0.62)]
        b.add(bm_profile_extrude(prof, 2.2), "ink", M @ T(0, 0, 1.5), obj="buildings")
        b.add(bm_box(0.04, 2.1, 0.55, 0), "glass", M @ T(x0 + 0.03, 0, 1.52), obj="buildings")
    b.occupy(wx, wy, 2.0)
    # prototype stack
    sx, sy = 3.0, 2.7
    sz = t.h(sx, sy)
    blocks = [((1.6, 1.2, 0.9), (0, 0), 0.0, "orange"), ((1.2, 1.9, 0.8), (0.2, 0.3), 0.3, "blue"),
              ((2.2, 0.8, 0.7), (-0.3, -0.1), -0.2, "cream"), ((0.9, 0.9, 0.9), (0.3, 0.2), 0.5, "lime")]
    z = sz - 0.05
    for size, (ox, oy), rz, mat in blocks:
        b.box(mat, size, (sx + ox, sy + oy, z), rz=rz, bevel=0.05)
        z += size[2]
    b.box("glass", (0.6, 0.05, 0.4), (sx - 0.3, sy - 0.62, sz + 0.25), bevel=0.0)
    b.occupy(sx, sy, 1.4)
    b.label = Vector((0.3, 0.3, 5.2))
    # cantilever box on a pylon
    cx, cy = -4.2, 0.2
    cz = t.h(cx, cy)
    b.cyl("ink", 0.24, 0.24, 1.7, (cx, cy, cz - 0.1), segs=16)
    b.box("cream", (2.3, 1.0, 0.9), (cx + 0.5, cy, cz + 1.6), rz=0.5, bevel=0.05)
    b.box("orange", (2.32, 1.02, 0.14), (cx + 0.5, cy, cz + 1.95), rz=0.5, bevel=0.0)
    b.box("glass", (0.05, 0.8, 0.5), (cx + 0.5 + math.cos(0.5) * 1.16, cy + math.sin(0.5) * 1.16, cz + 1.78), rz=0.5,
          bevel=0.0)
    b.occupy(cx, cy, 1.0)
    # gateway arch over the path from the main bridge
    gx, gy = 3.5, -0.25
    gz = t.h(gx, gy)
    b.add(bm_torus(1.4, 0.17, 40, 12, arc=math.pi), "orange", T(gx, gy, gz, rz=math.pi / 2 - 0.1, rx=math.pi / 2),
          obj="landmarks", smooth=True)
    # spiral sculpture
    hx, hy = 1.4, -3.0
    hz = t.h(hx, hy)
    pts = [(hx + math.cos(a) * 0.5, hy + math.sin(a) * 0.5, hz + 0.2 + a / TAU * 0.85) for a in [i * 0.2 for i in range(95)]]
    b.add(bm_tube(pts, 0.09, 10), "lime", None, obj="landmarks", smooth=True)
    b.cyl("ink", 0.62, 0.62, 0.2, (hx, hy, hz - 0.05), segs=24)
    b.occupy(hx, hy, 0.7)
    # sphere on cone
    kx, ky = 2.7, -2.2
    kz = t.h(kx, ky)
    b.cyl("ink", 0.5, 0.05, 1.2, (kx, ky, kz - 0.05), segs=24)
    b.add(bm_uvsphere(0.55, 32, 16), "blue", T(kx, ky, kz + 1.65), obj="landmarks", smooth=True)
    b.occupy(kx, ky, 0.6)
    # kinetic sculpture at the plaza centre
    mz = 0.4
    b.cyl("ink", 0.12, 0.09, 2.6, (0.3, 0.3, mz), segs=12)
    b.cyl("concrete_dark", 0.6, 0.6, 0.25, (0.3, 0.3, mz), segs=24, smooth=False)
    kin = b.separate("anim_spin_kinetic", (0.3, 0.3, mz + 2.6))
    for k, mat in enumerate(["orange", "blue", "lime"]):
        a = TAU * k / 3
        p = (0.3 + math.cos(a) * 1.1, 0.3 + math.sin(a) * 1.1, mz + 2.6 + (k - 1) * 0.15)
        b.add(bm_tube([(0.3, 0.3, mz + 2.6), p], 0.035, 8), "metal", None, obj=kin, smooth=True)
        b.add(bm_uvsphere(0.22, 20, 10), mat, T(*p), obj=kin, smooth=True)
    b.occupy(0.3, 0.3, 0.8)
    # interactive pylons (runtime: hover/click to bounce)
    k = 0
    rng = random.Random(4)
    for i in range(3):
        for j in range(3):
            px, py = -2.5 + i * 0.7, -3.3 + j * 0.7
            pz = t.h(px, py)
            name = b.separate(f"anim_bounce_{k}", (px, py, pz))
            h = rng.uniform(0.6, 1.15)
            b.add(bm_cyl(0.2, 0.2, h, 16), "cream", T(px, py, pz - 0.05), obj=name, smooth=True)
            b.add(bm_cyl(0.22, 0.22, 0.12, 16), ["orange", "blue", "lime", "mint"][k % 4], T(px, py, pz + h - 0.05), obj=name,
                  smooth=False)
            b.occupy(px, py, 0.3)
            k += 1
    # colourful paving inlays
    for k in range(10):
        a = TAU * k / 10
        b.cyl(["orange", "blue", "lime", "mint", "cream"][k % 5], 0.22, 0.22, 0.03,
              (0.3 + math.cos(a) * 1.9, 0.3 + math.sin(a) * 1.9, 0.46), segs=16, obj="props", smooth=False, detail=1)
    for (x, y) in [(-1.8, 1.2), (1.8, 1.4)]:
        bench(b, x, y, 0.4, rz=math.atan2(y - 0.3, x - 0.3) + math.pi / 2)
    # experiment slots (grass-grown / sculptural typography)
    for a in (205, 245, 285, 325):
        x, y = 0.3 + math.cos(a * D2R) * 2.35, 0.3 + math.sin(a * D2R) * 2.35
        b.slot(x, y, 0.4, a * D2R)
    for (x, y, f) in [(4.6, 1.6, -20), (5.1, -1.7, -50)]:
        b.slot(x, y, t.h(x, y), f * D2R)
        b.occupy(x, y, 0.45)


# --------------------------------------------------------------------------------------
# RESUME — exhibition architecture and achievement monuments
# --------------------------------------------------------------------------------------

SPEC_RESUME = {
    "noise": 0.3, "dome": 0.6, "port_h": 0.5, "hub": (0.0, 0.6), "path_mat": "stone_light",
    "pads": [
        {"shape": "rect", "x": 0.0, "y": 0.9, "w": 6.0, "d": 4.0, "h": 0.8, "paved": "stone_light", "blend": 1.6},
        {"shape": "rect", "x": 2.0, "y": -2.1, "w": 3.8, "d": 1.2, "h": 0.35, "paved": "stone_mid", "blend": 1.2},
    ],
    "ponds": [{"x": -4.6, "y": 3.4, "r": 0.9, "level": 0.42, "depth": 0.4, "fall": 140 * D2R, "fall_w": 0.8}],
    "strata": ["stone_light", "stone_light", "stone_mid", "stone_light", "stone_dark"],
    "sign": (-1.6, -5.2, -95 * D2R),
    "veg": {"count": 26, "weights": {"cypress": 4, "broad_a": 1, "bush": 3, "rock": 1}},
}


def build_resume(b: Builder, t):
    z0 = 0.8
    # pavilion: floating roof on chrome columns, onyx + travertine walls
    b.box("concrete_light", (5.4, 3.1, 0.22), (0.0, 1.3, z0 + 2.05), bevel=0.02)
    for x in (-2.2, -0.75, 0.75, 2.2):
        for y in (0.1, 2.5):
            b.cyl("chrome", 0.06, 0.06, 2.05, (x, y, z0), segs=10)
    b.box("stone_dark", (1.7, 0.12, 2.05), (-0.9, 1.4, z0), bevel=0.0)
    b.box("stone_light", (3.0, 0.16, 2.05), (1.1, 2.75, z0), bevel=0.0)
    b.box("glass", (2.4, 0.05, 2.0), (-1.3, 2.2, z0), bevel=0.0)
    b.box("glass", (0.05, 1.6, 2.0), (2.6, 1.4, z0), bevel=0.0)
    b.box("emit_warm", (1.2, 0.04, 0.12), (-0.9, 1.33, z0 + 1.9), bevel=0.0, detail=1)
    basin(b, "water_reflect", 1.4, -0.1 + 0.0, z0, 2.0, 0.9, h=0.18, mat="stone_mid")
    b.label = Vector((0.0, 1.3, z0 + 4.2))
    # gallery hall with pilasters and clerestory
    hx, hy, hrz = -3.9, -2.2, 0.35
    hz = t.h(hx, hy)
    M = T(hx, hy, hz - 0.1, rz=hrz)
    b.add(bm_box(3.6, 1.8, 0.25, 0.03), "stone_mid", M, obj="buildings")
    b.add(bm_box(3.3, 1.5, 1.5, 0.02), "concrete", M @ T(0, 0, 0.25), obj="buildings")
    b.add(bm_box(3.0, 1.52, 0.25, 0.0), "glass", M @ T(0, 0, 1.45), obj="buildings")
    b.add(bm_box(3.6, 1.8, 0.16, 0.02), "concrete_light", M @ T(0, 0, 1.75), obj="buildings")
    for k in range(8):
        b.add(bm_box(0.12, 0.08, 1.5, 0.0), "concrete_light", M @ T(-1.55 + k * 3.1 / 7, -0.77, 0.25), obj="props")
    b.add(bm_box(0.8, 0.04, 1.0, 0.0), "emit_warm", M @ T(0, -0.76, 0.3), obj="props")
    b.occupy(hx, hy, 1.9)
    # achievement pillars (stepped obelisks)
    for i, h in enumerate([1.4, 2.0, 2.6, 3.2, 3.9]):
        x, y, z = 0.55 + i * 0.75, -2.1, 0.35
        b.box("stone_mid", (0.56, 0.56, 0.25), (x, y, z), bevel=0.03)
        b.box("stone_light", (0.36, 0.36, h), (x, y, z + 0.25), bevel=0.02)
        b.add(bm_cyl(0.27, 0.0, 0.32, 4), "lime" if i % 2 else "orange", T(x, y, z + 0.25 + h, rz=math.pi / 4), obj="landmarks")
    b.occupy(2.0, -2.1, 1.9)
    # triumphal gate across the bridge path
    port = t.ports[0]
    hub = SPEC_RESUME["hub"]
    gx, gy = (port["x"] * 0.55 + hub[0] * 0.45), (port["y"] * 0.55 + hub[1] * 0.45)
    ang = math.atan2(port["y"] - hub[1], port["x"] - hub[0]) - math.pi / 2
    gz = t.h(gx, gy) - 0.1
    M = T(gx, gy, gz, rz=ang)
    for sx in (-1.15, 1.15):
        b.add(bm_box(0.8, 0.9, 2.5, 0.03), "stone_light", M @ T(sx, 0, 0), obj="landmarks")
    b.add(bm_box(3.1, 1.0, 0.65, 0.03), "stone_light", M @ T(0, 0, 2.5), obj="landmarks")
    b.add(bm_box(2.4, 0.8, 0.35, 0.03), "stone_mid", M @ T(0, 0, 3.15), obj="landmarks")
    b.add(bm_box(1.8, 1.02, 0.12, 0.0), "lime", M @ T(0, 0, 2.75), obj="landmarks")
    b.add(bm_torus(0.75, 0.12, 24, 8, arc=math.pi), "stone_mid", M @ T(0, 0, 1.75, rx=math.pi / 2), obj="landmarks")
    b.occupy(gx, gy, 0.3)
    # low stone walls
    for (x, y, w, rz) in [(-3.2, 1.6, 2.2, math.pi / 2), (3.3, 0.2, 2.0, math.pi / 2)]:
        b.box("stone_mid", (w, 0.3, 0.6), (x, y, t.h(x, y) - 0.1), rz=rz, bevel=0.03, detail=1)
    # experience plaques (resume slots)
    for (x, y, z, f) in [(-2.0, -0.6, z0, -90), (0.4, -0.6, z0, -90), (-1.5, -3.6, None, -95), (1.3, -3.7, None, -85)]:
        b.slot(x, y, t.h(x, y) if z is None else z, f * D2R, kind="resume")
    for (x, y, v) in [(-2.9, -0.4, "cypress"), (3.2, 2.4, "cypress"), (3.4, -0.6, "cypress"), (-5.0, 0.4, "cypress"),
                      (4.6, -2.6, "cypress")]:
        plant(b, t, v, x, y, 1.1)


# --------------------------------------------------------------------------------------
# CONTACT — coastal island, lighthouse, communications and sky harbour
# --------------------------------------------------------------------------------------

SPEC_CONTACT = {
    "noise": 0.3, "dome": 0.4, "port_h": 0.3, "hub": (0.6, 1.0), "path_mat": "wood", "sand": True,
    "edge_drop": 0.25,
    "hills": [{"x": -3.2, "y": -1.6, "r": 2.8, "h": 1.4}],
    "pads": [
        {"x": -3.2, "y": -1.6, "r": 1.3, "h": 2.0, "paved": "stone_light", "blend": 1.4},
        {"x": 2.0, "y": -2.2, "r": 1.3, "h": 0.25, "blend": 1.2},
    ],
    "ponds": [{"x": -2.2, "y": 1.8, "r": 1.25, "level": 0.32, "depth": 0.45, "fall": 168 * D2R, "fall_w": 0.9}],
    "strata": ["stone_light", "stone_mid", "stone_cool", "stone_light", "stone_dark"],
    "sign": (0.4, -4.4, -90 * D2R),
    "veg": {"count": 20, "weights": {"palm": 4, "bush": 2, "rock": 2, "broad_b": 1}},
}


def build_contact(b: Builder, t):
    # lighthouse
    lx, ly, lz = -3.2, -1.6, 2.0
    b.cyl("stone_mid", 1.0, 1.0, 0.45, (lx, ly, lz - 0.05), segs=8, smooth=False)
    H, n = 4.6, 6
    for i in range(n):
        r0 = 0.74 - 0.22 * i / n
        r1 = 0.74 - 0.22 * (i + 1) / n
        b.cyl("cream" if i % 2 == 0 else "orange", r0, r1, H / n, (lx, ly, lz + 0.4 + i * H / n), segs=32)
    top = lz + 0.4 + H
    b.cyl("metal_dark", 0.85, 0.85, 0.12, (lx, ly, top), segs=32, smooth=False)
    b.railing("metal_dark", [(lx + math.cos(a) * 0.8, ly + math.sin(a) * 0.8, top + 0.12) for a in
                             [k * TAU / 20 for k in range(21)]], h=0.4, post_every=0.3)
    b.cyl("glass", 0.45, 0.45, 0.75, (lx, ly, top + 0.12), segs=16)
    for k in range(8):
        a = TAU * k / 8
        b.rod("metal_dark", (lx + math.cos(a) * 0.46, ly + math.sin(a) * 0.46, top + 0.12),
              (lx + math.cos(a) * 0.46, ly + math.sin(a) * 0.46, top + 0.87), 0.02, 6)
    b.cyl("metal_dark", 0.58, 0.06, 0.5, (lx, ly, top + 0.87), segs=16)
    b.cyl("metal", 0.03, 0.01, 0.5, (lx, ly, top + 1.35), segs=6)
    lamp_obj = b.separate("anim_spin_lamp", (lx, ly, top + 0.5))
    b.add(bm_cyl(0.18, 0.18, 0.4, 12), "emit_warm", T(lx, ly, top + 0.3), obj=lamp_obj, smooth=True)
    b.add(bm_box(0.06, 0.5, 0.3, 0.0), "metal_dark", T(lx + 0.2, ly, top + 0.35), obj=lamp_obj)
    b.add(bm_box(0.08, 0.4, 0.4, 0.0), "emit_warm", T(lx - 0.2, ly, top + 0.3), obj=lamp_obj)
    b.label = Vector((lx, ly, top + 2.2))
    b.extras["lighthouse"] = to_three((lx, ly, top + 0.5))
    b.occupy(lx, ly, 1.2)
    # keeper's house
    hx, hy = -2.0, -2.6
    hz = t.h(hx, hy)
    b.box("cream", (1.2, 0.9, 0.85), (hx, hy, hz - 0.1), rz=0.4, bevel=0.03)
    b.add(bm_profile_extrude([(-0.7, 0), (0.7, 0), (0, 0.5)], 1.05), "orange", T(hx, hy, hz + 0.75, rz=0.4), obj="buildings")
    b.occupy(hx, hy, 0.8)

    # lattice communication tower
    cx, cy = 3.4, 2.0
    cz = t.h(cx, cy) - 0.1
    H = 7.2
    base, topw = 0.75, 0.16

    def leg(sx, sy, z):
        w = base + (topw - base) * (z / H)
        return (cx + sx * w, cy + sy * w, cz + z)

    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for sx, sy in corners:
        b.beam("metal", leg(sx, sy, 0), leg(sx, sy, H), 0.09)
    levels = 8
    for lv in range(levels):
        z0, z1 = H * lv / levels, H * (lv + 1) / levels
        mat = "orange" if lv >= levels - 2 else "metal"
        for k in range(4):
            a, c = corners[k], corners[(k + 1) % 4]
            b.beam(mat, leg(*a, z1), leg(*c, z1), 0.05)
            b.beam("metal", leg(*a, z0), leg(*c, z1), 0.035, detail=1)
            b.beam("metal", leg(*c, z0), leg(*a, z1), 0.035, detail=1)
    b.rod("metal", (cx, cy, cz + H), (cx, cy, cz + H + 1.4), 0.04, 6)
    b.add(bm_ico(0.12, 1), "emit_lime", T(cx, cy, cz + H + 1.45), obj="props")
    for (z, a) in [(4.0, -0.6), (5.4, 2.2), (2.8, 3.6)]:
        w = base + (topw - base) * (z / H)
        p = (cx + math.cos(a) * (w + 0.35), cy + math.sin(a) * (w + 0.35), cz + z)
        b.add(bm_lathe(paraboloid(0.25, 0.42, 0.04, 6), 20, closed=True), "cream",
              T(*p, rz=a, ry=math.pi / 2), obj="landmarks", smooth=True)
    b.occupy(cx, cy, 1.2)
    # communications hut
    ux, uy = 4.8, 0.2
    uz = t.h(ux, uy)
    b.box("concrete_light", (1.3, 1.0, 0.95), (ux, uy, uz - 0.1), rz=-0.2, bevel=0.04)
    b.box("blue", (1.32, 1.02, 0.18), (ux, uy, uz + 0.55), rz=-0.2, bevel=0.0)
    b.box("emit_warm", (0.5, 0.04, 0.45), (ux - 0.1, uy - 0.52, uz + 0.05), rz=-0.2, bevel=0.0)
    b.occupy(ux, uy, 0.9)

    # sky harbour: piers cantilevered off the beach into the void
    ang = -38 * D2R
    for k, (off, length) in enumerate([(0.0, 5.0), (1.5, 3.4)]):
        dirv = Vector((math.cos(ang), math.sin(ang), 0))
        side = Vector((-dirv.y, dirv.x, 0))
        start = Vector((2.2, -2.4, 0)) + side * off + dirv * (0.6 * k)
        z = 0.32
        end = start + dirv * length
        n = int(length / 0.28)
        for i in range(n):
            p = start + dirv * (i * length / n)
            b.add(bm_box(0.22, 1.2, 0.06, 0.01), "wood", T(p.x, p.y, z, rz=ang), obj="props")
        b.beam("wood_dark", tuple(start + side * 0.45 + Vector((0, 0, z - 0.06))), tuple(end + side * 0.45 + Vector((0, 0, z - 0.06))), 0.12)
        b.beam("wood_dark", tuple(start - side * 0.45 + Vector((0, 0, z - 0.06))), tuple(end - side * 0.45 + Vector((0, 0, z - 0.06))), 0.12)
        for i in range(int(length / 1.2) + 1):
            p = start + dirv * (i * 1.2)
            for s in (-0.52, 0.52):
                q = p + side * s
                b.beam("wood_dark", (q.x, q.y, z + 0.5), (q.x, q.y, z - 2.6 - 0.3 * i), 0.13)
                b.cyl("metal_dark", 0.06, 0.06, 0.32, (q.x, q.y, z + 0.03), segs=8, obj="props", detail=1)
        if k == 0:
            lamp(b, end.x, end.y, z + 0.03, 1.2)
            b.add(bm_box(1.6, 2.4, 0.08, 0.01), "wood", T(end.x, end.y, z, rz=ang), obj="props")
        # moored boat (bobbing)
        bp = start + dirv * (length * 0.65) - side * (1.25 if k == 0 else -1.2)
        boat = b.separate(f"anim_bob_boat{k}", (bp.x, bp.y, z - 0.25))
        hull = [(-0.9, -0.32), (0.55, -0.34), (1.0, 0.0), (0.55, 0.34), (-0.9, 0.32)]
        bm = bm_prism(hull, 0.42)
        b.add(bm, "cream" if k == 0 else "blue", T(bp.x, bp.y, z - 0.55, rz=ang), obj=boat)
        b.add(bm_prism([(x * 0.9, y * 0.82) for x, y in hull], 0.06), "wood", T(bp.x, bp.y, z - 0.14, rz=ang), obj=boat)
        b.add(bm_box(0.5, 0.42, 0.32, 0.03), "concrete_light", T(bp.x - dirv.x * 0.25, bp.y - dirv.y * 0.25, z - 0.12, rz=ang),
              obj=boat)
        b.rod("wood_dark", (bp.x + dirv.x * 0.25, bp.y + dirv.y * 0.25, z - 0.1),
              (bp.x + dirv.x * 0.25, bp.y + dirv.y * 0.25, z + 1.6), 0.03, obj=boat)
        b.add(bm_prism([(0, 0), (0.9, 0), (0, 1.3)], 0.02), "cream",
              T(bp.x + dirv.x * 0.22, bp.y + dirv.y * 0.22, z + 0.2, rz=ang + math.pi, rx=math.pi / 2), obj=boat)
    b.occupy(2.8, -3.0, 1.4)
    # boathouse
    bx, by = 1.0, -2.9
    bz = t.h(bx, by)
    b.box("wood", (1.4, 1.1, 0.9), (bx, by, bz - 0.1), rz=ang, bevel=0.02)
    b.add(bm_profile_extrude([(-0.8, 0), (0.8, 0), (0, 0.55)], 1.3), "ink", T(bx, by, bz + 0.8, rz=ang + math.pi / 2),
          obj="buildings")
    b.occupy(bx, by, 0.9)
    # contact signboards
    for (x, y) in [(-1.1, -0.9), (0.6, -1.4), (2.3, -0.8)]:
        b.slot(x, y, t.h(x, y), -95 * D2R, kind="contact")
        b.occupy(x, y, 0.45)
    for (x, y) in [(-4.8, 2.2), (4.8, 3.4), (-1.0, 4.8), (5.4, -1.6)]:
        plant(b, t, "palm", x, y, 1.0)


ISLANDS = {
    "about": (SPEC_ABOUT, build_about),
    "projects": (SPEC_PROJECTS, build_projects),
    "blogs": (SPEC_BLOGS, build_blogs),
    "research": (SPEC_RESEARCH, build_research),
    "playground": (SPEC_PLAYGROUND, build_playground),
    "resume": (SPEC_RESUME, build_resume),
    "contact": (SPEC_CONTACT, build_contact),
}
