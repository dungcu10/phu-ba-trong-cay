"""Chỉ thị 08: đóng gói ảnh 3D thế giới (thân cây, mảnh rời, tầng mây, bệ chậu, Mèo Mây) thành atlas @2x.

  python3 tools/potgen/pack_world.py [--src tools/potgen/out/c08v2]

Ra assets/art/:
  world_floor_a.webp/.json, world_floor_b.webp/.json  — mỗi tầng cắt 2 nửa (trái/phải) để atlas <= 2048,
                                                         kèm 2 bệ chậu ở atlas a
  world_misc.webp/.json                               — đoạn thân, 28 mảnh rời, 8 khung Mèo Mây
  world_trunk.json                                    — mép vỏ cây từng hàng (để ghim mảnh rời), chu kỳ đoạn,
                                                         điểm gắn của mảnh, chỗ thân xuyên tầng
Tỉ lệ: tầng, bệ theo đúng tỉ lệ chậu (112,8 px @2x / đơn vị); thân và mảnh rời gấp đôi (cây cổ thụ).
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets", "art")
POT_PX2 = 112.8
TRUNK_K = POT_PX2 * 2.0 / 256.0
CAT_K = 0.45  # 640 px master -> 288 px @2x (144 pt)
MAX = 2048
PAD = 2


def load(p):
    return Image.open(p).convert("RGBA")


def shelf_pack(items, width=MAX):
    """items: list of (name, image). Returns placements {name: (x, y)} and atlas size."""
    order = sorted(items, key=lambda it: -it[1].height)
    x = y = row_h = 0
    pos = {}
    used_w = 0
    for name, im in order:
        if x + im.width + PAD > width:
            x, y, row_h = 0, y + row_h + PAD, 0
        pos[name] = (x, y)
        x += im.width + PAD
        used_w = max(used_w, x)
        row_h = max(row_h, im.height)
    h = y + row_h
    if h > MAX:
        raise SystemExit(f"atlas quá cao: {h}")
    return pos, (min(width, used_w), h)


def write_atlas(name, entries):
    """entries: {frame: (image, anchor_px or None, extra dict)}"""
    pos, (w, h) = shelf_pack([(k, v[0]) for k, v in entries.items()])
    sheet = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    frames = {}
    for k, (im, anc, extra) in entries.items():
        x, y = pos[k]
        sheet.alpha_composite(im, (x, y))
        f = {"frame": {"x": x, "y": y, "w": im.width, "h": im.height}, "rotated": False, "trimmed": False,
             "spriteSourceSize": {"x": 0, "y": 0, "w": im.width, "h": im.height}, "sourceSize": {"w": im.width, "h": im.height}}
        if anc is not None:
            f["anchor"] = {"x": round(anc[0] / im.width, 5), "y": round(anc[1] / im.height, 5)}
        f.update(extra or {})
        frames[k] = f
    sheet.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=92, method=6)
    meta = {"app": "potgen/pack_world.py", "version": "1", "image": f"{name}.webp", "format": "RGBA8888",
            "size": {"w": w, "h": h}, "scale": "2"}
    json.dump({"frames": frames, "meta": meta}, open(os.path.join(OUT, f"{name}.json"), "w"), separators=(",", ":"))
    print(name, w, h, len(frames))


def crop(im, anchor):
    bb = im.getbbox()
    return im.crop(bb), (anchor[0] - bb[0], anchor[1] - bb[1])


def scaled(im, k):
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def main():
    src = os.path.join(ROOT, "tools", "potgen", "out", "c08v2")
    if "--src" in sys.argv:
        src = sys.argv[sys.argv.index("--src") + 1]
    trunk_meta = {}
    # ---------------------------------------------------------------- floors (+ pedestals in atlas a)
    floors = {}
    for v in "ab":
        im = load(os.path.join(src, "floor", f"floor_meadow_{v}.png"))
        fm = json.load(open(os.path.join(src, "floor", f"floor_meadow_{v}.json")))
        ox, oy = fm["origin_px"]
        half = im.width // 2
        entries = {
            f"world/floor/meadow-{v}/L": (im.crop((0, 0, half, im.height)), (ox, oy), {}),
            f"world/floor/meadow-{v}/R": (im.crop((half, 0, im.width, im.height)), (ox - half, oy), {}),
        }
        if v == "a":
            pm = json.load(open(os.path.join(src, "floor", "pedestals_meadow.json")))
            for i, p in enumerate(pm["pedestals"]):
                pim = load(os.path.join(src, "floor", p["name"] + ".png"))
                pim, anc = crop(pim, p["anchor_px"])
                lift = p["anchor_px"][1] - p["pot_base_px"][1]
                entries[f"world/pedestal/meadow/{i}"] = (pim, anc, {"lift": round(lift, 1)})
        write_atlas(f"world_floor_{v}", entries)
        floors[v] = {"trunk_px": fm["trunk"], "origin_px": fm["origin_px"], "grass_line_px": fm["grass_line_px"]}
    trunk_meta["floors"] = floors
    # ---------------------------------------------------------------- trunk, pieces, cat
    entries = {}
    tile = scaled(load(os.path.join(src, "trunk", "trunk_tile.png")), TRUNK_K)
    entries["world/trunk/tile"] = (tile, (tile.width / 2, tile.height), {})
    a = tile.getchannel("A").load()
    edges = []
    for y in range(tile.height):
        xs = [x for x in range(tile.width) if a[x, y] > 200]
        edges.append([round(tile.width / 2 - xs[0], 1), round(xs[-1] - tile.width / 2, 1)] if xs else [0, 0])
    trunk_meta["tile"] = {"w": tile.width, "h": tile.height, "edges": edges}
    pm = json.load(open(os.path.join(src, "trunk", "pieces.json")))
    pieces = {}
    for p in pm["pieces"]:
        im = scaled(load(os.path.join(src, "trunk", "pieces", p["name"] + ".png")), TRUNK_K)
        anc = (p["anchor"][0] * TRUNK_K, p["anchor"][1] * TRUNK_K)
        im, anc = crop(im, anc)
        frame = f"world/piece/{p['name']}"
        entries[frame] = (im, anc, {})
        info = {"kind": p["kind"], "side": p["side"]}
        if p["kind"] == "branch":  # where a lantern hangs: on the twig about 70 % of the way out
            bb = (0, 0, im.width, im.height)
            alpha = im.getchannel("A").load()
            x = int(0.3 * im.width) if p["side"] == "L" else int(0.7 * im.width)
            ys = [y for y in range(im.height) if alpha[x, y] > 200]
            info["hang"] = [round(x - anc[0], 1), round((ys[-1] if ys else im.height) - anc[1], 1)]
            del bb
        pieces[p["name"]] = info
    trunk_meta["pieces"] = pieces
    cm = json.load(open(os.path.join(src, "pet", "cloud_cat.json")))
    for fr in cm["frames"]:
        im = scaled(load(os.path.join(src, "pet", f"cloud_cat_{fr['name']}.png")), CAT_K)
        anc = (fr["ground_px"][0] * CAT_K, fr["ground_px"][1] * CAT_K)
        im, anc = crop(im, anc)
        entries[f"world/pet/cloud-cat/{fr['name']}"] = (im, anc, {})
    write_atlas("world_misc", entries)
    trunk_meta["scale"] = 2
    json.dump(trunk_meta, open(os.path.join(OUT, "world_trunk.json"), "w"), separators=(",", ":"))
    print("world_trunk.json", len(edges), "rows")


if __name__ == "__main__":
    main()
