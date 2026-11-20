"""
Asset pipeline entry point.

    .venv-blender/bin/python scripts/blender/export_assets.py            # everything
    .venv-blender/bin/python scripts/blender/export_assets.py about blogs # selected islands (+ bridges)

or, with the Blender app:

    blender -b -P scripts/blender/export_assets.py -- about

Outputs
  public/models/islands/<id>.glb        LOD0 (full detail)
  public/models/islands/<id>_lod1.glb   LOD1 (reduced terrain resolution, no small props)
  public/models/vegetation/vegetation.glb   instanced vegetation library
  public/models/bridges/<from>_<to>.glb      bridges in world space
  assets-src/blender/**.blend           editable Blender sources
  src/generated/world-manifest.json     slots, vegetation transforms, anchors, outlines
"""
from __future__ import annotations

import json
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

import bpy  # noqa: E402,F401  (must precede mathutils when using the bpy pip module)
from mathutils import Vector  # noqa: E402

from lib import ROOT, Builder, export_glb, load_world, reset_scene, save_blend, to_three, world_to_blender  # noqa: E402
from generate_islands import (Terrain, build_foundation, build_pads, build_paths, build_top, edge_trees, place_cliffs, place_drapes, place_props,  # noqa: E402
                              build_water, scatter_vegetation)
from generate_buildings import ISLANDS, place_sculpture  # noqa: E402
from generate_environment import build_bridge, build_vegetation  # noqa: E402

MODELS = os.path.join(ROOT, "public", "models")
SRC = os.path.join(ROOT, "assets-src", "blender")
MANIFEST = os.path.join(ROOT, "src", "generated", "world-manifest.json")


def compute_ports(world):
    pos = {i["id"]: world_to_blender(i["position"]) for i in world["islands"]}
    ports = {i["id"]: [] for i in world["islands"]}
    for br in world["bridges"]:
        a, b = br["from"], br["to"]
        d = pos[b] - pos[a]
        ports[a].append({"to": b, "angle": math.atan2(d.y, d.x)})
        ports[b].append({"to": a, "angle": math.atan2(-d.y, -d.x)})
    return pos, ports


def build_island(cfg, ports, lod):
    spec, build = ISLANDS[cfg["id"]]
    terrain = Terrain(cfg["radius"], cfg["seed"], cfg["depth"], spec, ports)
    b = Builder(lod=lod)
    rim, ns = build_top(b, terrain)
    b.rim = rim
    build_foundation(b, terrain, rim, ns)
    build_pads(b, terrain)
    build_water(b, terrain)
    build(b, terrain)
    hub = spec.get("hub", (0, 0))
    paths = []
    for p in terrain.ports:
        mid = ((p["x"] + hub[0]) / 2 + 0.3 * math.sin(p["angle"] * 3), (p["y"] + hub[1]) / 2 + 0.3 * math.cos(p["angle"] * 2))
        road = spec.get("road", False)
        paths.append({"pts": [(p["x"], p["y"]), mid, hub], "width": 1.15 if road else 0.95, "road": road,
                      "mat": "asphalt" if road else spec.get("path_mat", "paving")})
    build_paths(b, terrain, paths)
    sx, sy, sf = spec["sign"]
    b.sign = {"pos": to_three((sx, sy, terrain.h(sx, sy))), "facing": [round(math.cos(sf), 4), round(-math.sin(sf), 4)]}
    b.occupy(sx, sy, 2.4)  # wide: signs face outward near the rim, so trees beside them block the view
    place_sculpture(b, terrain, cfg["id"])
    place_props(b, terrain, paths, cfg["id"])
    veg = spec.get("veg", {"count": 20, "weights": {"broad_a": 1}})
    scatter_vegetation(b, terrain, veg["count"] if lod == 0 else veg["count"], veg["weights"])
    edge_trees(b, terrain, veg["weights"])
    return b, terrain


def export_islands(world, ids):
    pos, ports = compute_ports(world)
    manifest = {"islands": {}, "bridges": []}
    if os.path.exists(MANIFEST):
        with open(MANIFEST) as f:
            manifest = json.load(f)
    port_world = {}
    for cfg in world["islands"]:
        iid = cfg["id"]
        for lod in (0, 1):
            if iid not in ids:
                # still need port positions for bridges
                _, terrain = (None, Terrain(cfg["radius"], cfg["seed"], cfg["depth"], ISLANDS[iid][0], ports[iid]))
                break
            t0 = time.time()
            reset_scene()
            b, terrain = build_island(cfg, ports[iid], lod)
            objs = b.finalize(ao=True, ao_rays=14 if lod == 0 else 8,
                              gradient=(-cfg["depth"], 0.0, 0.32))
            suffix = "" if lod == 0 else "_lod1"
            export_glb(os.path.join(MODELS, "islands", f"{iid}{suffix}.glb"))
            if lod == 0:
                save_blend(os.path.join(SRC, "islands", f"{iid}.blend"))
                manifest["islands"][iid] = {
                    "slots": b.slots,
                    "vegetation": b.vegetation,
                    "props": b.props,
                    "cliffs": place_cliffs(terrain, b.rim, cfg["seed"]),
                    "drapes": place_drapes(terrain, b.rim, b.lip, cfg["seed"]),
                    "label": to_three(b.label),
                    "sign": b.sign,
                    "outline": terrain.outline(),
                    "radius": cfg["radius"],
                    "depth": cfg["depth"],
                    "objects": sorted(objs.keys()),
                    "extras": b.extras,
                }
            nverts = sum(len(o.data.vertices) for o in objs.values())
            print(f"[island] {iid}{suffix}: {len(objs)} objects, {nverts} verts, {time.time() - t0:.1f}s", flush=True)
        for p in terrain.ports:
            port_world[(iid, p["to"])] = pos[iid] + Vector((p["x"], p["y"], p["h"] + 0.07))
    return manifest, port_world


def export_bridges(world, port_world, manifest):
    manifest["bridges"] = []
    for i, br in enumerate(world["bridges"]):
        a, c = br["from"], br["to"]
        A, B = port_world[(a, c)], port_world[(c, a)]
        reset_scene()
        b = Builder(lod=0)
        build_bridge(b, br["type"], A, B, seed=i)
        b.finalize(ao=True, ao_rays=8, ao_dist=1.5)
        name = f"{a}_{c}"
        export_glb(os.path.join(MODELS, "bridges", f"{name}.glb"))
        save_blend(os.path.join(SRC, "bridges", f"{name}.blend"))
        manifest["bridges"].append({"id": name, "from": a, "to": c, "type": br["type"],
                                    "a": to_three(A), "b": to_three(B)})
        print(f"[bridge] {name} ({br['type']})", flush=True)


def export_vegetation():
    # realistic library from Poly Haven scans when the sources are present (npm run assets:vegetation
    # also compresses its textures); otherwise the stylised procedural fallback below
    if os.path.isdir(os.path.join(ROOT, "assets-src", "polyhaven", "models")):
        import build_vegetation
        build_vegetation.main()
        print("[vegetation] realistic library exported; run `npm run assets:vegetation` to compress textures", flush=True)
        return
    reset_scene()
    b = Builder(lod=0)
    build_vegetation(b)
    b.finalize(ao=True, ao_rays=10, ao_dist=1.2)
    export_glb(os.path.join(MODELS, "vegetation", "vegetation.glb"))
    save_blend(os.path.join(SRC, "vegetation", "vegetation.blend"))
    print("[vegetation] library exported", flush=True)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    world = load_world()
    all_ids = [i["id"] for i in world["islands"]]
    ids = [a for a in argv if a in all_ids] or all_ids
    manifest, port_world = export_islands(world, ids)
    export_bridges(world, port_world, manifest)
    if not argv or "vegetation" in argv:
        export_vegetation()
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, "w") as f:
        json.dump(manifest, f, indent=1)
    print("[manifest]", MANIFEST)


if __name__ == "__main__":
    main()
