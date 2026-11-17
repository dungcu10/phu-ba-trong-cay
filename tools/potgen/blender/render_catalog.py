"""Render mẫu cấp 50 cho cả danh mục dòng chậu (catalog_l50.json).

Mỗi dòng chậu dùng CHUNG một bộ khung cấp 50 (template_l50):
  đế mây (cloud_base) + hào quang sau (back_halo) + thân bầu (pot_body) + hệ cánh đối xứng (wings_system)
  + viền, chân, dải trang trí, đá quý, mào, đuôi, tia sáng.
Khác nhau ở: dáng thân, chất liệu, màu, kiểu phần tử cánh, kiểu hào quang, phụ kiện.

  blender -b --factory-startup -P render_catalog.py -- --line ../lines/catalog_l50.json --levels 1-50
"""
import json
import os
import sys
import time

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import importlib  # noqa: E402

import potlib as P  # noqa: E402
import render_line as RL  # noqa: E402

P = importlib.reload(P)

METALS = {"#F2B830", "#FFD36B", "#D9DDE3", "#C8743C", "#C9A13B", "#C9971E", "#8A6A26", "#9A7426"}
FEATHERY = {"feather", "leaf", "fern", "petal", "flame", "fin", "blade", "spike", "ribbon", "membrane"}
TAILED = {"feather", "flame", "leaf", "fern", "ribbon"}


def grad(colors):
    if len(colors) == 1:
        colors = colors * 2
    n = len(colors) - 1
    return [[round(i / n, 3), c] for i, c in enumerate(colors)]


def metal_or_glaze(color, glow=False):
    if glow:
        return {"color": color, "emission": color, "emission_strength": 2.5, "roughness": 0.3}
    if color.upper() in METALS:
        return {"color": color, "metallic": 1.0, "roughness": 0.22}
    return {"color": color, "roughness": 0.3, "coat": 0.4}


FACE_MATS = {
    "face_eye": {"color": "#24151C", "roughness": 0.08, "coat": 1.0},
    "face_hi": {"color": "#FFFFFF", "emission": "#FFFFFF", "emission_strength": 2.0},
    "face_blush": {"color": "#FF8FAB", "roughness": 0.7},
    "soil": {"color": "#3A2416", "roughness": 0.95},
}


def template_l50(pot):
    """Bộ khung chuẩn cấp 50 → (line, milestone) dùng được với potlib.build_pot.
    Chậu có khóa "parts" là thiết kế riêng (món đặc trưng): dùng nguyên bộ phận của nó."""
    if "parts" in pot:
        mats = dict(FACE_MATS)
        mats.update(pot["materials"])
        line = {"id": f"pot{pot['id']:02d}", "name": pot["name"], "materials": mats,
                "profiles": {**CATALOG["profiles"], **pot.get("profiles", {})}, "max_level": 50}
        return line, {"level": 50, "title": pot["name"], "parts": pot["parts"]}
    ex = pot.get("extras", {})
    w, h = pot["wing"], pot["halo"]
    body = {"gradient": grad(pot["body"]), "roughness": 0.3}
    body.update(pot.get("body_opts", {}))
    if "transmission" in body:
        body.setdefault("ior", 1.45)
    wing = {"gradient": grad(w["colors"]), "roughness": 0.45}
    if ex.get("wing_metal"):
        wing.update({"metallic": 1.0, "roughness": 0.25})
    if ex.get("wing_trans"):
        wing.update({"transmission": ex["wing_trans"], "ior": 1.4, "roughness": 0.15})
    if w.get("glow"):
        wing.update({"emission_from_gradient": True, "emission_strength": 0.35})
    halo_el = {"gradient": grad(h["colors"]), "roughness": 0.4}
    if ex.get("halo_glow"):
        halo_el.update({"emission_from_gradient": True, "emission_strength": 1.2})
    if ex.get("halo_metal"):
        halo_el.update({"metallic": 1.0, "roughness": 0.22})
    mats = {
        "body": body, "rim": metal_or_glaze(pot["rim"]), "wing": wing, "halo_el": halo_el,
        "ring": metal_or_glaze(h["ring"], ex.get("ring_glow")),
        "ring2": metal_or_glaze(ex.get("ring2", h["ring"]), ex.get("ring2_glow")),
        "gem": {"color": pot["gem"], "roughness": 0.04, "transmission": 0.45, "ior": 1.7,
                "emission": pot["gem"], "emission_strength": 0.5},
        "soil": {"color": "#3A2416", "roughness": 0.95},
        "cloud": {"color": "#FFF4E4", "roughness": 0.8, "subsurface": 0.15},
        "orb": ex.get("orb", {"color": h["colors"][0], "roughness": 0.3}),
        "disc": ex.get("disc", {"color": h["colors"][0], "roughness": 0.3}),
        "spark": {"color": h["colors"][-1], "emission": h["colors"][-1], "emission_strength": 6.0},
    }
    for k, b in enumerate(ex.get("bands", [])):
        mats[f"band{k}"] = metal_or_glaze(b[0], ex.get("band_glow"))
    for key in ("dots", "dots2", "dots3"):
        if key in ex:
            spec = metal_or_glaze(ex[key][0], ex.get("dots_glow") and key == "dots")
            mats[key] = spec

    shape = w["shape"]
    flat = shape in ("coin", "gear")
    rim_parts = {"type": "rim", "mat": "rim", "rr": 0.05, "bead": "rim"}
    if pot.get("rim_style") == "crown":
        rim_parts.update({"scallops": 10, "amp": 0.1, "power": 4})
    parts = [
        {"type": "pedestal", "mat": "cloud", "plate": "rim", "height": 0.32, "radius": 0.85},
        {"type": "halo", "mat": "halo_el", "ring_mat": "ring", "ring2_mat": "ring2", "orb_mat": "orb",
         "disc_mat": "disc", "styles": h["styles"], "shape": h["shape"], "radius": 1.05, "length": 0.45,
         "z": 0.85, "count": ex.get("halo_count", {"rays": 24, "wreath": 18}.get(h["styles"][0], 14)),
         "orb_count": 10, "orb_size": 0.075},
        {"type": "body", "profile": pot["profile"], "mat": "body",
         "scale": 1.1 if pot["profile"] == "cauldron" else 1.15},
        {"type": "soil", "mat": "soil"},
        rim_parts,
        {"type": "foot", "mat": "rim", "rr": 0.045, "step": True},
        {"type": "filigree", "mat": "rim", "z": 0.18, "amp": 0.022, "waves": 7, "spiral": 0},
        {"type": "gems", "mat": "gem", "z": 0.46, "count": 5, "size": 0.09, "spread": 22, "arc": 0.01,
         "bezel": "rim"},
        {"type": "wings", "mat": "wing", "shape": shape, "z": 0.72, "count": w["count"],
         "layers": ex.get("layers", 1 if flat else 2), "length": 0.55 if flat else 1.0,
         "spread": [8, 80], "width": ex.get("wing_width", 0.3 if flat else 0.34), "curl": 0.2},
        {"type": "embers", "mat": "spark", "count": 14, "size": [0.008, 0.016]},
    ]
    if shape in FEATHERY:
        parts.append({"type": "crest", "mat": "wing", "shape": shape, "count": 5, "length": 0.45,
                      "spread": 34, "width": 0.3, "gem": "gem", "gem_size": 0.08})
    if shape in TAILED:
        parts.append({"type": "tail", "mat": "wing", "shape": shape, "z": 0.8, "count": 5,
                      "length": 1.1, "spread": 60, "width": 0.34})
    for k, b in enumerate(ex.get("bands", [])):
        parts.append({"type": "band", "mat": f"band{k}", "z": b[1], "rr": 0.02})
    for key in ("dots", "dots2", "dots3"):
        if key in ex:
            d = ex[key]
            parts.append({"type": "dots", "mat": key, "count": d[1],
                          "size": d[2] if len(d) > 2 else [0.03, 0.05],
                          "z": ex.get("dots_z", [0.15, 0.85]), "seed": 7 + len(key)})
    line = {"id": f"pot{pot['id']:02d}", "name": pot["name"], "materials": mats,
            "profiles": CATALOG["profiles"], "max_level": 50}
    return line, {"level": 50, "title": pot["name"], "parts": parts}


def parse_ids(spec):
    out = []
    for chunk in str(spec).split(","):
        if "-" in chunk:
            a, b = chunk.split("-")
            out += list(range(int(a), int(b) + 1))
        elif chunk.strip():
            out.append(int(chunk))
    return out


def main():
    global CATALOG
    a = RL.parse_args()
    if a["line"].endswith("phuong_hoang.json"):
        a["line"] = os.path.join(HERE, "..", "lines", "catalog_l50.json")
    if a["style"].endswith("studio.json"):
        a["style"] = os.path.join(HERE, "..", "style", "studio_cream.json")
    CATALOG = json.load(open(a["line"], encoding="utf-8"))
    style = P.load_style(a["style"])
    if a["samples"]:
        style["samples"] = int(a["samples"])
    ids = parse_ids(a["levels"]) if a["levels"] != "milestones" else list(range(1, 51))
    pots = [p for p in CATALOG["pots"] if p["id"] in ids]
    out = os.path.abspath(os.path.join(a["out"], CATALOG.get("out_name", "catalog_l50")))
    dirs = {k: os.path.join(out, k) for k in ("master", "game", "preview")}
    for d in dirs.values():
        os.makedirs(d, exist_ok=True)
    device = P.setup_scene(style)
    res = style.get("resolution", 1024)
    status_path = os.path.join(out, "status.json")
    done = []
    t_all = time.time()
    for pot in pots:
        t0 = time.time()
        try:
            line, ms = template_l50(pot)
            mats = P.build_materials(line)
            n = P.build_pot(line, mats, ms, 0.0, seed=pot["id"])
            path = os.path.join(dirs["master"], f"pot_{pot['id']:02d}.png")
            bpy.context.scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            done.append({"id": pot["id"], "name": pot["name"], "category": pot.get("category", pot.get("group", "")),
                         "objects": n, "seconds": round(time.time() - t0, 1)})
            print(f"[potgen] chậu {pot['id']:>2} {pot['name']}: {n} vật thể, {time.time() - t0:.1f}s", flush=True)
        except Exception as e:  # một chậu lỗi không làm hỏng cả loạt
            import traceback
            traceback.print_exc()
            done.append({"id": pot["id"], "name": pot["name"], "error": repr(e)})
        json.dump({"state": "rendering", "done": len(done), "total": len(pots), "device": device,
                   "last": done[-1]}, open(status_path, "w", encoding="utf-8"), ensure_ascii=False)

    anchor = P.anchor_of_ground(bpy.context.scene)
    bg = [0.992, 0.961, 0.902]  # #FDF5E6
    tiles = []
    ok = [d for d in done if "error" not in d]
    for d in ok:
        full = RL.load_rgba(os.path.join(dirs["master"], f"pot_{d['id']:02d}.png"))
        RL.save_rgba(os.path.join(dirs["game"], f"pot_{d['id']:02d}.png"), RL.downscale(full, max(1, res // 512)))
        tiles.append(RL.downscale(full, max(1, res // 256)))
    if tiles:
        RL.save_rgba(os.path.join(dirs["preview"], CATALOG.get("out_name", "catalog_l50") + ".png"),
                     RL.contact_sheet(tiles, 10, tiles[0].shape[0], bg))
    manifest = {
        "schema": "phuba.pot-catalog/1", "level": 50,
        "frame": {"width": 512, "height": 512, "anchor": {"x": anchor[0], "y": anchor[1]}},
        "render": {"device": device, "samples": style.get("samples"), "resolution": res,
                   "style": os.path.basename(a["style"])},
        "pots": [{"id": d["id"], "name": d["name"], "category": d.get("category", ""),
                  "alias": f"pot.catalog.{d['id']}.l50", "src": f"assets/pots/catalog/pot_{d['id']:02d}_l50.png"}
                 for d in ok],
        "pixi": {"bundles": [{"name": "pots-catalog-l50", "assets": [
            {"alias": f"pot.catalog.{d['id']}.l50", "src": f"assets/pots/catalog/pot_{d['id']:02d}_l50.png"}
            for d in ok]}]},
    }
    json.dump(manifest, open(os.path.join(out, "manifest.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    json.dump({"state": "done", "done": len(done), "errors": [d for d in done if "error" in d],
               "device": device, "seconds": round(time.time() - t_all, 1), "pots": done},
              open(status_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"[potgen] XONG {len(ok)}/{len(done)} chậu trong {time.time() - t_all:.0f}s", flush=True)


CATALOG = {}

if __name__ == "__main__":
    main()
