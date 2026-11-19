"""
Island terrain + geological foundation generator.

`Terrain` is an analytic height-field over an irregular polar footprint. Pads
(flattened plazas/terraces), ponds, waterfall channels and bridge ports are all
expressed as modifiers on that height-field, so architecture can be placed with
`terrain.h(x, y)` and always sits exactly on the ground.
"""
from __future__ import annotations

import math
import random

from mathutils import Vector, noise

from lib import (TAU, Builder, bm_box, bm_cyl, bm_from, bm_ico, displace, fbm, lerp,
                 smoothstep, T, to_three)


class Terrain:
    def __init__(self, R, seed, depth, spec, ports):
        self.R = R
        self.seed = seed
        self.depth = depth
        self.spec = spec
        rng = random.Random(seed)
        self.rng = rng
        self.harm = [(k, rng.uniform(0.025, 0.07) * (3.0 / (k + 1)), rng.uniform(0, TAU)) for k in range(2, 8)]
        self.off = (rng.uniform(-50, 50), rng.uniform(-50, 50), rng.uniform(-50, 50))
        self.pads = list(spec.get("pads", []))
        self.ponds = list(spec.get("ponds", []))
        self.ports = []
        port_h = spec.get("port_h", 0.35)
        for p in ports:
            th = p["angle"]
            rr = 0.84
            x, y = math.cos(th) * self.r(th) * rr, math.sin(th) * self.r(th) * rr
            self.ports.append({**p, "x": x, "y": y, "h": port_h})
            self.pads.append({"x": x, "y": y, "r": 1.5, "h": port_h, "blend": 1.6, "port": True})
        for pond in self.ponds:
            # automatic shoreline pad slightly above water level
            self.pads.insert(0, {"x": pond["x"], "y": pond["y"], "r": pond["r"] + 0.9,
                                 "h": pond["level"] + 0.18, "blend": 1.6})
        self.channels = []
        for pond in self.ponds:
            if pond.get("fall") is not None:
                th = pond["fall"]
                ex, ey = math.cos(th) * self.r(th) * 1.06, math.sin(th) * self.r(th) * 1.06
                self.channels.append({"a": (pond["x"], pond["y"]), "b": (ex, ey), "w": pond.get("fall_w", 1.1),
                                      "level": pond["level"], "pond": pond, "angle": th})

    # footprint ---------------------------------------------------------------------
    def r(self, th):
        return self.R * (1 + sum(a * math.sin(k * th + p) for k, a, p in self.harm))

    def rr(self, x, y):
        th = math.atan2(y, x)
        return math.hypot(x, y) / self.r(th)

    # height-field --------------------------------------------------------------------
    def base(self, x, y):
        rr = self.rr(x, y)
        z = self.spec.get("noise", 0.35) * fbm(x * 0.13, y * 0.13, 0, 4, self.off)
        z += self.spec.get("dome", 0.7) * (1 - rr * rr)
        for hill in self.spec.get("hills", []):
            d = math.hypot(x - hill["x"], y - hill["y"])
            z += hill["h"] * smoothstep(hill["r"], 0, d)
        return z

    def _pad_weight(self, pad, x, y):
        if pad.get("shape") == "rect":
            c, s = math.cos(-pad.get("rz", 0)), math.sin(-pad.get("rz", 0))
            lx = (x - pad["x"]) * c - (y - pad["y"]) * s
            ly = (x - pad["x"]) * s + (y - pad["y"]) * c
            qx, qy = abs(lx) - pad["w"] / 2, abs(ly) - pad["d"] / 2
            d = math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0)
        else:
            d = math.hypot(x - pad["x"], y - pad["y"]) - pad["r"]
        return smoothstep(pad.get("blend", 1.4), 0.0, d)

    def _channel_weight(self, ch, x, y):
        ax, ay = ch["a"]
        bx, by = ch["b"]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy
        t = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / L2))
        px, py = ax + dx * t, ay + dy * t
        d = math.hypot(x - px, y - py)
        return smoothstep(ch["w"] / 2 + 0.7, ch["w"] / 2 - 0.1, d), t

    def h(self, x, y, raw=False):
        z = self.base(x, y)
        for pad in self.pads:
            w = self._pad_weight(pad, x, y)
            if w > 0:
                z = lerp(z, pad["h"], w)
        rr = self.rr(x, y)
        drop = self.spec.get("edge_drop", 0.55) * smoothstep(0.82, 1.0, rr) ** 1.4
        for ch in self.channels:
            w, _ = self._channel_weight(ch, x, y)
            drop *= (1 - w)
        z -= drop
        if self.spec.get("sand"):
            z -= 0.45 * smoothstep(0.72, 0.95, rr)
        if raw:
            return z
        for pond in self.ponds:
            d = math.hypot(x - pond["x"], y - pond["y"])
            w = smoothstep(pond["r"] + 0.25, pond["r"] * 0.55, d)
            if w > 0:
                z = lerp(z, pond["level"] - pond.get("depth", 0.45), w)
        for ch in self.channels:
            w, t = self._channel_weight(ch, x, y)
            if w > 0:
                z = lerp(z, min(z, ch["level"] - 0.28), w)
        return z

    def in_water(self, x, y, margin=0.0):
        for pond in self.ponds:
            if math.hypot(x - pond["x"], y - pond["y"]) < pond["r"] + margin:
                return True
        for ch in self.channels:
            w, _ = self._channel_weight(ch, x, y)
            if w > 0.05 and margin >= 0:
                return True
        return False

    def outline(self, n=64):
        """Footprint polygon in three.js local XZ, for the mini-map."""
        pts = []
        for i in range(n):
            th = TAU * i / n
            r = self.r(th)
            pts.append([round(math.cos(th) * r, 3), round(-math.sin(th) * r, 3)])
        return pts


# --------------------------------------------------------------------------------------
# Mesh generation
# --------------------------------------------------------------------------------------

def build_top(b: Builder, terrain: Terrain):
    lod = b.lod
    NR = 34 if lod == 0 else 16
    NS = 120 if lod == 0 else 60
    R = terrain.R
    verts, faces, mats = [], [], []
    verts.append((0.0, 0.0, terrain.h(0, 0)))
    ring_rr = [((i / NR) ** 0.85) for i in range(1, NR + 1)]
    for rr in ring_rr:
        for j in range(NS):
            th = TAU * j / NS
            r = terrain.r(th) * rr
            x, y = math.cos(th) * r, math.sin(th) * r
            verts.append((x, y, terrain.h(x, y)))

    def vid(i, j):
        return 1 + i * NS + (j % NS)

    def face_mat(cx, cy, cz, rr):
        if terrain.in_water(cx, cy, -0.05) and cz < max([p["level"] for p in terrain.ponds] + [-99]) - 0.05:
            return "sand"
        if terrain.spec.get("sand") and rr > 0.8:
            return "sand"
        n = fbm(cx * 0.35, cy * 0.35, 3.0, 2, terrain.off)
        if n > 0.22:
            return "grass_dry"
        return "grass"

    for j in range(NS):
        faces.append((0, vid(0, j), vid(0, j + 1)))
    for i in range(NR - 1):
        for j in range(NS):
            faces.append((vid(i, j), vid(i + 1, j), vid(i + 1, j + 1), vid(i, j + 1)))
    for f in faces:
        cx = sum(verts[k][0] for k in f) / len(f)
        cy = sum(verts[k][1] for k in f) / len(f)
        cz = sum(verts[k][2] for k in f) / len(f)
        mats.append(face_mat(cx, cy, cz, terrain.rr(cx, cy)))

    # split by material so each bucket is a material primitive
    for mat in set(mats):
        sub_faces = [f for f, m in zip(faces, mats) if m == mat]
        used = sorted({k for f in sub_faces for k in f})
        remap = {k: n for n, k in enumerate(used)}
        bm = bm_from([verts[k] for k in used], [tuple(remap[k] for k in f) for f in sub_faces])
        b.add(bm, mat, obj="terrain", smooth=True)

    # rim band (grass lip -> soil) connecting top to foundation
    rim = [verts[vid(NR - 1, j)] for j in range(NS)]
    return rim, NS


def build_foundation(b: Builder, terrain: Terrain, rim, NS):
    rng = random.Random(terrain.seed * 7 + 1)
    R, D = terrain.R, terrain.depth
    lod = b.lod
    layers = terrain.spec.get("layers", 6) if lod == 0 else 4
    palette = terrain.spec.get("strata", ["stone_light", "stone_mid", "stone_light", "stone_cool", "stone_mid", "stone_dark", "stone_mid"])
    # layer thicknesses
    weights = [rng.uniform(0.7, 1.3) for _ in range(layers)]
    total = sum(weights)
    body = D * 0.78
    th = [w / total * body for w in weights]
    tip_off = Vector((rng.uniform(-0.15, 0.15) * R, rng.uniform(-0.15, 0.15) * R, 0))

    rings = []  # list of (verts list, material for band below)

    def ring(factor, z_abs, jitter_r, jitter_z, follow_rim, key):
        pts = []
        for j in range(NS):
            ang = TAU * j / NS
            rx, ry, rz = rim[j]
            base_r = math.hypot(rx, ry)
            n = noise.noise(Vector((math.cos(ang) * 2.1 + key * 1.7, math.sin(ang) * 2.1, key * 0.37 + terrain.seed)))
            jit = rng.uniform(-1, 1)
            rad = base_r * factor * (1 + 0.07 * n) + jit * jitter_r
            z = z_abs + (rz * follow_rim) + rng.uniform(-1, 1) * jitter_z
            c = Vector((math.cos(ang) * rad, math.sin(ang) * rad, z))
            # drift toward the asymmetric tip as we go down
            t = min(1.0, -z_abs / D)
            c += tip_off * (t ** 2)
            pts.append(tuple(c))
        return pts

    # soil lip right below grass
    rings.append((ring(1.0, -0.32, 0.03, 0.05, 1.0, 0.1), "soil"))
    z = -0.32
    for k in range(layers):
        t = (-z) / D
        f = max(0.12, (1 - t) ** 0.62)
        mat = palette[k % len(palette)]
        z_lip = z - 0.06
        z_mid = z - th[k] * 0.5
        z_rec = z - th[k]
        f2 = max(0.1, (1 - (-z_rec) / D) ** 0.62)
        follow = max(0.0, 1 - k * 0.45)
        rings.append((ring(f * 1.045, z_lip, 0.06, 0.04, follow, k + 0.3), mat))
        rings.append((ring(lerp(f, f2, 0.5) * 1.0, z_mid, 0.12, 0.12, follow * 0.5, k + 0.6), mat))
        rings.append((ring(f2 * 0.95, z_rec, 0.08, 0.08, 0.0, k + 0.9), mat))
        z = z_rec
    # taper to tip
    rem = max(0.5, D - (-z))
    f_end = max(0.12, (1 - min(0.95, (-z) / D)) ** 0.62)
    z_end = z
    for i, (fac, frac) in enumerate([(0.75, 0.3), (0.45, 0.6), (0.2, 0.85)]):
        z = z_end - rem * frac
        rings.append((ring(f_end * fac + 0.02, z, 0.1, 0.15, 0, 20 + i), "stone_dark"))
    tip = (tip_off.x, tip_off.y, -D - 0.6)

    # connect rim -> rings
    all_rings = [(rim, "soil")] + rings
    for i in range(len(all_rings) - 1):
        top_r, _ = all_rings[i]
        bot_r, mat = all_rings[i + 1]
        verts = list(top_r) + list(bot_r)
        faces = []
        for j in range(NS):
            j2 = (j + 1) % NS
            faces.append((j, NS + j, NS + j2, j2))
        b.add(bm_from(verts, faces), mat, obj="foundation", smooth=False)
    last, _ = all_rings[-1]
    verts = list(last) + [tip]
    faces = [(j, NS, (j + 1) % NS) for j in range(NS)]
    b.add(bm_from(verts, faces), "stone_dark", obj="foundation", smooth=False)

    # hanging rock spikes
    for i in range(rng.randint(4, 7) if lod == 0 else 3):
        ang = rng.uniform(0, TAU)
        depth_t = rng.uniform(0.35, 0.75)
        zz = -D * depth_t
        rad = R * max(0.12, (1 - depth_t) ** 0.62) * rng.uniform(0.55, 0.85)
        x, y = math.cos(ang) * rad + tip_off.x * depth_t ** 2, math.sin(ang) * rad + tip_off.y * depth_t ** 2
        length = rng.uniform(1.4, 3.2) * (R / 8)
        width = rng.uniform(0.45, 0.9) * (R / 8)
        bm = bm_cyl(width, 0.03, length, 7, center=False)
        displace(bm, 0.18, 1.3, seed=i + terrain.seed)
        b.add(bm, rng.choice(["stone_dark", "stone_mid"]), T(x, y, zz + 0.4, rx=math.pi + rng.uniform(-0.2, 0.2)),
              obj="foundation")
    # outcrops along upper lips
    if lod == 0:
        for i in range(10):
            ang = rng.uniform(0, TAU)
            zz = -rng.uniform(0.6, D * 0.45)
            f = max(0.12, (1 - (-zz) / D) ** 0.62)
            rad = terrain.r(ang) * f * 1.0
            x, y = math.cos(ang) * rad, math.sin(ang) * rad
            bm = bm_ico(rng.uniform(0.35, 0.8), 1)
            displace(bm, 0.18, 1.6, seed=i * 3 + terrain.seed)
            b.add(bm, rng.choice(["stone_mid", "stone_light", "stone_cool"]),
                  T(x, y, zz, rz=rng.uniform(0, TAU), s=(1.3, 1.0, 0.7)), obj="foundation")


def build_pads(b: Builder, terrain: Terrain):
    """Paved plazas: real slabs with bevelled edges set into the terrain."""
    for pad in terrain.pads:
        mat = pad.get("paved")
        if not mat:
            continue
        thick = 0.42
        if pad.get("shape") == "rect":
            b.box(mat, (pad["w"], pad["d"], thick), (pad["x"], pad["y"], pad["h"] - thick + 0.07),
                  rz=pad.get("rz", 0), bevel=0.05, obj="terrain")
            # paving joints: thin dark inlays
            if b.lod == 0 and pad.get("joints", True):
                n = int(pad["w"] / 1.2)
                for i in range(1, n):
                    off = -pad["w"] / 2 + i * pad["w"] / n
                    c, s = math.cos(pad.get("rz", 0)), math.sin(pad.get("rz", 0))
                    b.box("concrete_dark", (0.04, pad["d"] - 0.2, 0.02),
                          (pad["x"] + c * off, pad["y"] + s * off, pad["h"] + 0.07), rz=pad.get("rz", 0),
                          bevel=0, obj="terrain", detail=1)
            b.occupy(pad["x"], pad["y"], 0.5 * min(pad["w"], pad["d"]))
        else:
            b.cyl(mat, pad["r"], pad["r"], thick, (pad["x"], pad["y"], pad["h"] - thick + 0.07), segs=48,
                  obj="terrain", smooth=False)
            b.cyl("concrete_dark", pad["r"] + 0.08, pad["r"] + 0.08, 0.12, (pad["x"], pad["y"], pad["h"] - 0.12),
                  segs=48, obj="terrain", smooth=False, detail=1)
            b.occupy(pad["x"], pad["y"], pad["r"] * 0.9)


def build_paths(b: Builder, terrain: Terrain, paths):
    for path in paths:
        pts = [Vector((x, y, 0)) for x, y in path["pts"]]
        width = path.get("width", 0.9)
        mat = path.get("mat", "paving")
        # resample
        samples = []
        for i in range(len(pts) - 1):
            a, c = pts[i], pts[i + 1]
            n = max(1, int((c - a).length / 0.35))
            for k in range(n):
                samples.append(a.lerp(c, k / n))
        samples.append(pts[-1])
        left, right = [], []
        for i, p in enumerate(samples):
            a = samples[max(0, i - 1)]
            c = samples[min(len(samples) - 1, i + 1)]
            t = (c - a)
            t.z = 0
            t.normalize()
            nrm = Vector((-t.y, t.x, 0)) * (width / 2)
            for side, arr in ((nrm, left), (-nrm, right)):
                q = p + side
                arr.append((q.x, q.y, terrain.h(q.x, q.y) + 0.05))
            b.occupy(p.x, p.y, width * 0.6)
        n = len(samples)
        verts = left + right + [(x, y, z - 0.14) for x, y, z in left] + [(x, y, z - 0.14) for x, y, z in right]
        faces = []
        for i in range(n - 1):
            faces.append((i, n + i, n + i + 1, i + 1))
            faces.append((2 * n + i, 2 * n + i + 1, i + 1, i))  # left skirt
            faces.append((n + i, n + i + 1, 3 * n + i + 1, 3 * n + i))  # right skirt
        b.add(bm_from(verts, faces), mat, obj="terrain", smooth=False)


def build_water(b: Builder, terrain: Terrain):
    """Pond surfaces, channels and waterfall ribbons (separate nodes for runtime shaders)."""
    for i, pond in enumerate(terrain.ponds):
        name = b.separate(f"water_pond{i}", (pond["x"], pond["y"], pond["level"]), "water")
        segs = 40
        verts = [(0, 0, 0)] + [(math.cos(TAU * k / segs) * (pond["r"] + 0.25), math.sin(TAU * k / segs) * (pond["r"] + 0.25), 0)
                               for k in range(segs)]
        faces = [(0, 1 + k, 1 + (k + 1) % segs) for k in range(segs)]
        b.add(bm_from(verts, faces), "water", T(pond["x"], pond["y"], pond["level"]), obj=name, smooth=True)
        # stone rim stones
        if b.lod == 0:
            rng = random.Random(i + terrain.seed)
            for k in range(int(pond["r"] * 7)):
                a = rng.uniform(0, TAU)
                rr = pond["r"] + rng.uniform(0.05, 0.4)
                x, y = pond["x"] + math.cos(a) * rr, pond["y"] + math.sin(a) * rr
                if any(terrain._channel_weight(ch, x, y)[0] > 0.1 for ch in terrain.channels):
                    continue
                bm = bm_ico(rng.uniform(0.12, 0.28), 1)
                displace(bm, 0.05, 3.0, seed=k)
                b.add(bm, rng.choice(["stone_light", "stone_mid"]), T(x, y, terrain.h(x, y) + 0.02, s=(1.2, 1.0, 0.6)),
                      obj="props", detail=1)

    for i, ch in enumerate(terrain.channels):
        ax, ay = ch["a"]
        bx, by = ch["b"]
        L = math.hypot(bx - ax, by - ay)
        dirv = Vector(((bx - ax) / L, (by - ay) / L, 0))
        side = Vector((-dirv.y, dirv.x, 0)) * (ch["w"] / 2)
        lvl = ch["level"] - 0.02
        start = Vector((ax, ay, lvl))
        # channel surface
        end_t = (terrain.r(ch["angle"]) * 1.0 - math.hypot(ax, ay)) / L * 1.0
        endp = Vector((ax, ay, lvl)) + dirv * (L * max(0.2, min(1.0, end_t + 0.02)))
        name = b.separate(f"water_channel{i}", tuple(start), "water")
        verts = [start + side, start - side, endp - side, endp + side]
        b.add(bm_from([tuple(v) for v in verts], [(0, 1, 2, 3)]), "water", None, obj=name)
        # waterfall ribbon
        fall_h = terrain.depth * 0.85
        wname = b.separate(f"waterfall_{i}", tuple(endp), "waterfall")
        rows, cols = 26, 6
        verts, faces = [], []
        for r_ in range(rows + 1):
            t = r_ / rows
            out = 0.15 + 1.4 * math.sqrt(t) * (terrain.R / 8)
            down = (t ** 1.15) * fall_h
            widen = 1 + 0.6 * t
            for c in range(cols + 1):
                s = (c / cols - 0.5) * 2
                p = endp + dirv * out + side * s * widen - Vector((0, 0, down))
                verts.append(tuple(p))
        for r_ in range(rows):
            for c in range(cols):
                a = r_ * (cols + 1) + c
                faces.append((a, a + 1, a + cols + 2, a + cols + 1))
        b.add(bm_from(verts, faces), "water", None, obj=wname, smooth=True)
        b.extras.setdefault("waterfalls", []).append({"top": to_three(endp), "height": fall_h})


def scatter_vegetation(b: Builder, terrain: Terrain, count, weights, min_spacing=1.0, seed=0):
    rng = random.Random(terrain.seed * 31 + seed)
    names = list(weights.keys())
    w = list(weights.values())
    placed = []
    tries = 0
    while len(placed) < count and tries < count * 60:
        tries += 1
        ang = rng.uniform(0, TAU)
        rr = math.sqrt(rng.uniform(0.02, 1)) * 0.9
        r = terrain.r(ang) * rr
        x, y = math.cos(ang) * r, math.sin(ang) * r
        variant = rng.choices(names, w)[0]
        rad = {"rock": 0.4, "bush": 0.45, "cypress": 0.55}.get(variant, 0.8)
        if not b.is_free(x, y, rad) or terrain.in_water(x, y, 0.5):
            continue
        if any((x - px) ** 2 + (y - py) ** 2 < min_spacing ** 2 for px, py in placed):
            continue
        z = terrain.h(x, y)
        placed.append((x, y))
        s = rng.uniform(0.68, 1.05) * {"rock": 0.9}.get(variant, 1.0)
        b.vegetation.append({"v": variant, "p": to_three((x, y, z - 0.05)), "r": round(rng.uniform(0, TAU), 3),
                             "s": round(s, 3)})
    return placed
