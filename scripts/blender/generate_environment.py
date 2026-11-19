"""
Environment assets: the instanced vegetation library and the architectural
bridges that connect islands (generated in world space from config/world.json).
"""
from __future__ import annotations

import math
import random

from mathutils import Vector

from lib import (TAU, Builder, T, bm_box, bm_cyl, bm_ico, bm_tube, displace, lerp)


# --------------------------------------------------------------------------------------
# Vegetation library — each variant becomes one node; runtime renders them instanced.
# --------------------------------------------------------------------------------------

def _canopy(b, obj, centers, mat, seed, subdiv=2):
    for i, (x, y, z, r) in enumerate(centers):
        bm = bm_ico(r, subdiv)
        displace(bm, r * 0.22, 1.8 / r, seed=seed + i)
        b.add(bm, mat, T(x, y, z, s=(1.0, 1.0, 0.85)), obj=obj, smooth=False)


def build_vegetation(b: Builder):
    rng = random.Random(5)
    # broadleaf A — rounded clustered crown
    o = "veg_broad_a"
    trunk = [(0, 0, 0), (0.05, 0.0, 0.8), (0.0, 0.06, 1.5)]
    b.add(bm_tube(trunk, 0.13, 8), "bark", None, obj=o, smooth=True)
    b.add(bm_tube([(0.02, 0.02, 1.0), (0.5, 0.1, 1.6)], 0.06, 6), "bark", None, obj=o, smooth=True)
    _canopy(b, o, [(0, 0, 2.0, 0.85), (0.5, 0.15, 1.75, 0.6), (-0.4, -0.2, 1.8, 0.6), (0.1, 0.35, 2.45, 0.55),
                   (-0.15, -0.3, 2.4, 0.5)], "foliage", 1)
    # broadleaf B — warm, taller and lighter
    o = "veg_broad_b"
    b.add(bm_tube([(0, 0, 0), (-0.05, 0.03, 1.1), (0.04, 0.0, 1.9)], 0.11, 8), "bark", None, obj=o, smooth=True)
    _canopy(b, o, [(0, 0, 2.3, 0.7), (0.35, 0.2, 2.0, 0.5), (-0.3, 0.1, 2.05, 0.5), (0.0, -0.1, 2.8, 0.45)],
            "foliage_warm", 7)
    # conifer — stacked displaced cones
    o = "veg_conifer"
    b.add(bm_cyl(0.1, 0.07, 0.8, 8), "bark", None, obj=o, smooth=True)
    for i, (r, h, z) in enumerate([(0.85, 1.2, 0.5), (0.68, 1.1, 1.1), (0.5, 1.0, 1.7), (0.3, 0.8, 2.3)]):
        bm = bm_cyl(r, 0.02, h, 9)
        displace(bm, 0.06, 2.5, seed=20 + i)
        b.add(bm, "foliage_dark", T(0, 0, z, rz=i * 0.6), obj=o)
    # cypress — tall narrow ellipsoid
    o = "veg_cypress"
    b.add(bm_cyl(0.08, 0.06, 0.5, 6), "bark", None, obj=o, smooth=True)
    bm = bm_ico(0.5, 2)
    displace(bm, 0.07, 3.0, seed=31)
    b.add(bm, "foliage_dark", T(0, 0, 1.75, s=(0.75, 0.75, 3.0)), obj=o)
    # bush
    o = "veg_bush"
    _canopy(b, o, [(0, 0, 0.25, 0.42), (0.3, 0.1, 0.2, 0.3), (-0.25, 0.15, 0.18, 0.3)], "foliage_mint", 41, subdiv=1)
    # rock
    o = "veg_rock"
    bm = bm_ico(0.45, 1)
    displace(bm, 0.14, 1.7, seed=51)
    b.add(bm, "stone_mid", T(0, 0, 0.12, s=(1.3, 1.0, 0.7)), obj=o)
    bm = bm_ico(0.22, 1)
    displace(bm, 0.06, 3.0, seed=52)
    b.add(bm, "stone_light", T(0.45, 0.2, 0.05, s=(1.2, 1.0, 0.8)), obj=o)
    # palm — curved trunk and drooping fronds
    o = "veg_palm"
    pts = [(math.sin(t * 1.2) * 0.45 * t, 0, t * 2.6) for t in [i / 10 for i in range(11)]]
    b.add(bm_tube(pts, 0.1, 8), "bark", None, obj=o, smooth=True)
    tip = Vector(pts[-1])
    for k in range(7):
        a = TAU * k / 7 + rng.uniform(-0.2, 0.2)
        d = Vector((math.cos(a), math.sin(a), 0))
        frond = [tip, tip + d * 0.6 + Vector((0, 0, 0.25)), tip + d * 1.15 + Vector((0, 0, 0.05)),
                 tip + d * 1.5 + Vector((0, 0, -0.35))]
        for i in range(len(frond) - 1):
            b.beam("foliage", tuple(frond[i]), tuple(frond[i + 1]), 0.32 - i * 0.07, 0.04, obj=o)
    b.add(bm_ico(0.16, 1), "wood_dark", T(*tip), obj=o)


# --------------------------------------------------------------------------------------
# Bridges
# --------------------------------------------------------------------------------------

def _frame(A, B):
    d = B - A
    flat = Vector((d.x, d.y, 0))
    u = flat.normalized()
    s = Vector((-u.y, u.x, 0))
    return d, u, s, flat.length


def build_bridge(b: Builder, kind, A, B, seed=0):
    rng = random.Random(seed)
    d, u, s, L = _frame(A, B)
    W = 1.5
    sag = {"plank": -0.9, "suspension": -0.15, "arch": 0.55, "truss": 0.1}[kind]

    def deck(t):
        return A.lerp(B, t) + Vector((0, 0, sag * math.sin(math.pi * t)))

    n = max(8, int(L / 0.6))
    samples = [deck(i / n) for i in range(n + 1)]

    if kind == "plank":
        for i in range(int(L / 0.26)):
            t = (i + 0.5) / int(L / 0.26)
            p = deck(t)
            q = deck(min(1, t + 0.01))
            pitch = math.atan2(q.z - p.z, 0.01 * L)
            b.add(bm_box(0.2, W, 0.06, 0.01), rng.choice(["wood", "wood", "wood_dark"]),
                  T(p.x, p.y, p.z, rz=math.atan2(u.y, u.x) + rng.uniform(-0.04, 0.04), ry=-pitch), obj="bridge")
        for side in (-1, 1):
            rope_lo = [tuple(p + s * side * (W / 2) - Vector((0, 0, 0.04))) for p in samples]
            rope_hi = [tuple(p + s * side * (W / 2 + 0.05) + Vector((0, 0, 0.9 - 0.25 * math.sin(math.pi * i / n))))
                       for i, p in enumerate(samples)]
            b.add(bm_tube(rope_lo, 0.04, 6, caps=True), "wood_dark", None, obj="bridge", smooth=True)
            b.add(bm_tube(rope_hi, 0.045, 6, caps=True), "wood_dark", None, obj="bridge", smooth=True)
            for i in range(0, n + 1, 1):
                b.rod("wood_dark", rope_lo[i], rope_hi[i], 0.018, 5, obj="bridge")
            for end in (A, B):
                p = end + s * side * (W / 2 + 0.1)
                b.cyl("wood_dark", 0.12, 0.1, 1.4, (p.x, p.y, p.z - 0.3), segs=8, obj="bridge")
                b.cyl("orange", 0.13, 0.13, 0.1, (p.x, p.y, p.z + 1.05), segs=8, obj="bridge")

    elif kind == "truss":
        H = 1.25
        for i in range(n):
            p0, p1 = samples[i], samples[i + 1]
            b.beam("concrete", tuple(p0), tuple(p1), W, 0.16, obj="bridge")
            b.beam("metal_dark", tuple(p0 - Vector((0, 0, 0.12))), tuple(p1 - Vector((0, 0, 0.12))), W - 0.2, 0.1,
                   obj="bridge")
        for side in (-1, 1):
            off = s * side * (W / 2 + 0.06)
            bot = [p + off for p in samples]
            top = [p + off + Vector((0, 0, H)) for p in samples]
            for i in range(n):
                b.beam("orange", tuple(bot[i]), tuple(bot[i + 1]), 0.12, obj="bridge")
                b.beam("orange", tuple(top[i]), tuple(top[i + 1]), 0.12, obj="bridge")
                b.beam("metal_dark", tuple(bot[i]), tuple(top[i]), 0.08, obj="bridge")
                a, c = (bot[i], top[i + 1]) if i % 2 == 0 else (top[i], bot[i + 1])
                b.beam("metal_dark", tuple(a), tuple(c), 0.06, obj="bridge")
            b.beam("metal_dark", tuple(bot[n]), tuple(top[n]), 0.08, obj="bridge")
        for i in range(0, n + 1, 2):
            p = samples[i] + Vector((0, 0, H))
            b.beam("metal_dark", tuple(p - s * (W / 2 + 0.06)), tuple(p + s * (W / 2 + 0.06)), 0.07, obj="bridge")
        # central pier dropping into the void
        mid = deck(0.5)
        b.beam("concrete_dark", tuple(mid - Vector((0, 0, 0.2))), tuple(mid - Vector((0, 0, 5.5))), 0.7, 0.9, obj="bridge")
        b.add(bm_cyl(0.55, 0.05, 1.4, 6), "concrete_dark", T(mid.x, mid.y, mid.z - 5.5, rx=math.pi), obj="bridge")

    elif kind == "arch":
        for i in range(n):
            p0, p1 = samples[i], samples[i + 1]
            b.beam("stone_light", tuple(p0), tuple(p1), W, 0.3, obj="bridge")
            for side in (-1, 1):
                off = s * side * (W / 2 - 0.08)
                b.beam("stone_mid", tuple(p0 + off + Vector((0, 0, 0.28))), tuple(p1 + off + Vector((0, 0, 0.28))), 0.16,
                       0.4, obj="bridge")
        # arch ring beneath the deck
        rise = 2.6
        m = 22
        arc = []
        for i in range(m + 1):
            t = 0.04 + 0.92 * i / m
            p = A.lerp(B, t)
            crown = deck(t).z - 0.3
            z = lerp(p.z - rise, crown, math.sin(math.pi * (t - 0.04) / 0.92))
            arc.append(Vector((p.x, p.y, z)))
        for i in range(m):
            b.beam("stone_mid", tuple(arc[i]), tuple(arc[i + 1]), W * 0.85, 0.42, obj="bridge", bevel=0.03)
        # spandrel posts
        for i in range(1, m, 2):
            top = deck(0.04 + 0.92 * i / m)
            if top.z - arc[i].z > 0.5:
                for side in (-1, 1):
                    q = arc[i] + s * side * (W * 0.32)
                    b.beam("stone_light", tuple(q), (q.x, q.y, top.z - 0.15), 0.22, obj="bridge")
        for t in (0.2, 0.5, 0.8):
            p = deck(t)
            for side in (-1, 1):
                q = p + s * side * (W / 2 - 0.08) + Vector((0, 0, 0.68))
                b.cyl("metal_dark", 0.03, 0.03, 0.9, tuple(q), segs=6, obj="bridge", detail=1)
                b.add(bm_box(0.14, 0.14, 0.12, 0), "emit_warm", T(q.x, q.y, q.z + 0.9), obj="bridge", detail=1)

    elif kind == "suspension":
        for i in range(n):
            p0, p1 = samples[i], samples[i + 1]
            b.beam("metal", tuple(p0), tuple(p1), W, 0.12, obj="bridge")
            b.beam("wood", tuple(p0 + Vector((0, 0, 0.07))), tuple(p1 + Vector((0, 0, 0.07))), W - 0.2, 0.03,
                   obj="bridge")
        TH = 3.4
        towers = [0.06, 0.94]
        tops = {}
        for tt in towers:
            p = deck(tt)
            for side in (-1, 1):
                q = p + s * side * (W / 2 + 0.15)
                b.beam("concrete_light", (q.x, q.y, q.z - 1.2), (q.x, q.y, q.z + TH), 0.24, obj="bridge", bevel=0.02)
                tops[(tt, side)] = Vector((q.x, q.y, q.z + TH - 0.2))
            b.beam("concrete_light", tuple(tops[(tt, -1)] + Vector((0, 0, 0.1))), tuple(tops[(tt, 1)] + Vector((0, 0, 0.1))),
                   0.24, obj="bridge")
            b.beam("lime", tuple(tops[(tt, -1)] - Vector((0, 0, 0.6))), tuple(tops[(tt, 1)] - Vector((0, 0, 0.6))), 0.12,
                   obj="bridge")
        for side in (-1, 1):
            a, c = tops[(towers[0], side)], tops[(towers[1], side)]
            cable = []
            m = 24
            for i in range(m + 1):
                t = i / m
                p = a.lerp(c, t)
                low = deck(lerp(towers[0], towers[1], t)).z + 0.55
                z = lerp(lerp(a.z, c.z, t), low, math.sin(math.pi * t) ** 0.8)
                cable.append(Vector((p.x, p.y, z)))
            b.add(bm_tube([tuple(v) for v in cable], 0.05, 8), "metal_dark", None, obj="bridge", smooth=True)
            for i in range(1, m):
                t = lerp(towers[0], towers[1], i / m)
                dp = deck(t) + s * side * (W / 2 + 0.05)
                b.rod("metal_dark", tuple(dp), tuple(cable[i]), 0.015, 5, obj="bridge")
            b.railing("metal", [tuple(p + s * side * (W / 2 - 0.05)) for p in samples[::2]], h=0.6, post_every=0.8,
                      obj="bridge", detail=1)

    # landing abutments
    for end, sign in ((A, 1), (B, -1)):
        p = end + u * sign * 0.2
        b.beam("concrete_dark", tuple(p - Vector((0, 0, 0.2))), tuple(p - Vector((0, 0, 0.9))), W + 0.4, 0.6,
               obj="bridge")
