#!/usr/bin/env python3
"""Fetch the CC0 Poly Haven sources (1k glTF models + 1k PBR textures) into assets-src/polyhaven/.
Raw files are git-ignored; run `python3 scripts/fetch-polyhaven.py` to restore them, then
`npm run assets:vegetation` / `node scripts/convert-textures.mjs`."""
import json, os, sys, urllib.request
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "assets-src", "polyhaven")
MODELS = ["island_tree_02","fir_sapling","shrub_02","shrub_04","fern_02","grass_medium_02","rock_moss_set_01","rock_07","rock_09","namaqualand_boulder_02",
          # cliffs for island undersides
          "namaqualand_cliff_01","namaqualand_cliff_02","rock_face_01","rock_face_02","mountainside","coastal_cliff_01",
          # props
          "modular_wooden_pier","modular_industrial_pipes_01","flood_lights","utility_box_01","street_lamp_01",
          "modular_street_seating","painted_wooden_bench","wooden_picnic_table","outdoor_table_chair_set_01",
          "stone_fire_pit","planter_box_01","potted_plant_02","wooden_lantern_01","Lantern_01"]
TEX = ["white_plaster_rough_01","concrete_wall_008","clay_roof_tiles","corrugated_iron_02","metal_plate","marble_01","cliff_side","forest_ground_04","sandstone_cracks"]
UA = {"User-Agent": "asset-pipeline"}
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
def save(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path): return
    open(path, "wb").write(get(url))
for m in MODELS:
    f = json.loads(get(f"https://api.polyhaven.com/files/{m}"))
    g = f["gltf"]["1k"]["gltf"]
    base = os.path.join(OUT, "models", m)
    save(g["url"], os.path.join(base, f"{m}.gltf"))
    for rel, v in g.get("include", {}).items():
        save(v["url"], os.path.join(base, rel))
    print("model", m, flush=True)
for t in TEX:
    f = json.loads(get(f"https://api.polyhaven.com/files/{t}"))
    base = os.path.join(OUT, "textures", t)
    for kind, keys in {"color": ["Diffuse"], "normal": ["nor_gl"], "roughness": ["Rough", "arm"]}.items():
        for k in keys:
            if k in f and "1k" in f[k]:
                fmt = f[k]["1k"]
                v = fmt.get("jpg") or fmt.get("png")
                save(v["url"], os.path.join(base, f"{kind}_{k}.{'jpg' if 'jpg' in fmt else 'png'}"))
                break
        else:
            print("missing", t, kind, list(f.keys()))
    print("tex", t, flush=True)
print("done")
