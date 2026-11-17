"""Chỉ thị 08 bước 1: ghép ảnh kiểm tra từ các render trong out/c08 (chỉ để duyệt, chưa tích hợp game).

  python3 tools/potgen/compose_c08.py [--out docs/reviews/renders/c08]

Bố cục theo đúng hằng số của src/render/scene.ts (WORLD): floorCenterX 650, floorGap 430, potRowSpan 940,
potScale10 0.9 / potScaleStep 0.085 / potScaleMax 1.25, trunk.x 40. Màn iPad 1194×834 điểm = 2388×1668 px.
Rải lá/cành/tua/nụ/đèn dọc thân bằng seed cố định theo tầng (cùng thuật toán sẽ viết trong game).
"""
import json
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT08 = os.path.join(ROOT, "tools", "potgen", "out", "c08")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
WORLD = {"floorCenterX": 650, "floorGap": 430, "potRowSpan": 940, "potScale10": 0.9, "potScaleStep": 0.085,
         "potScaleMax": 1.25, "trunkX": 40}
SCREEN = (2388, 1668)
POT_PX2_PER_UNIT = 112.8
TRUNK_SCALE = 2.0  # the trunk is drawn twice the pot scale: an ancient tree next to the pots
TRUNK_K = POT_PX2_PER_UNIT * TRUNK_SCALE / 256.0  # master trunk px -> @2x px


def font(n):
    return ImageFont.truetype(FONT, n)


def load(p):
    return Image.open(p).convert("RGBA")


def scaled(im, k):
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def sky(size=SCREEN):
    s = load(os.path.join(ROOT, "assets", "art", "sky.jpg"))
    k = max(size[0] / s.width, size[1] / s.height)
    s = scaled(s, k)
    x, y = (s.width - size[0]) // 2, (s.height - size[1]) // 2
    return s.crop((x, y, x + size[0], y + size[1]))


# ------------------------------------------------------------------ pots from the approved atlas

def pot_frames():
    m = json.load(open(os.path.join(ROOT, "assets", "art", "pots_signature.json")))
    sheet = load(os.path.join(ROOT, "assets", "art", "pots_signature.webp"))
    out = {}
    for k, f in m["frames"].items():
        r = f["frame"]
        out[k] = (sheet.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"])), f["anchor"])
    return out


# ------------------------------------------------------------------ trunk + scattered pieces

def pieces():
    meta = json.load(open(os.path.join(OUT08, "trunk", "pieces.json")))
    out = {}
    for p in meta["pieces"]:
        im = load(os.path.join(OUT08, "trunk", "pieces", p["name"] + ".png"))
        out[p["name"]] = (im, p)
    return out


_EDGES = None


def trunk_edges():
    """Left/right bark edge (alpha > 200) for every row of the master tile, relative to the axis."""
    global _EDGES
    if _EDGES is None:
        t = load(os.path.join(OUT08, "trunk", "trunk_tile.png"))
        a = t.getchannel("A").load()
        ax = t.width / 2
        rows = []
        for y in range(t.height):
            xs = [x for x in range(t.width) if a[x, y] > 200]
            rows.append((ax - xs[0], xs[-1] - ax))
        _EDGES = rows
    return _EDGES


def attach_x(side, y_master, inset_px):
    """Distance from the axis where a piece is pinned: just inside the bark edge at that height."""
    e = trunk_edges()[int(y_master) % len(trunk_edges())]
    return side * ((e[1] if side > 0 else e[0]) - inset_px)


def branch_tip(im, side):
    """Point on a branch picture to hang a lantern from: on the twig about 70 % of the way out."""
    bb = im.getbbox()
    a = im.getchannel("A").load()
    x = int(bb[0] + 0.3 * (bb[2] - bb[0])) if side < 0 else int(bb[2] - 0.3 * (bb[2] - bb[0]))
    ys = [y for y in range(bb[1], bb[3]) if a[x, y] > 200]
    return x, (ys[-1] if ys else bb[3])


def scatter_plan(floor_index, seg_px, n_segments):
    """Deterministic decoration list for one floor's stretch of trunk (the game will use the same)."""
    rnd = random.Random(1000 + floor_index * 7919)
    plan = []
    H = seg_px * n_segments
    y = rnd.uniform(20, 60)
    side = rnd.choice((-1, 1))
    leaf_bag = []
    while y < H - 30:
        if not leaf_bag:
            leaf_bag = list(range(6))
            rnd.shuffle(leaf_bag)
        roll = rnd.random()
        if roll < 0.13:
            kind = f"branch{rnd.randrange(3)}"
        elif roll < 0.21:
            kind = f"tendril{rnd.randrange(2)}"
        elif roll < 0.30:
            kind = f"bud{rnd.randrange(2)}"
        else:
            kind = f"leaf{leaf_bag.pop()}"
        plan.append({"name": f"{kind}_{'R' if side > 0 else 'L'}", "y": y, "side": side,
                     "inset": rnd.uniform(6, 26), "scale": rnd.uniform(0.82, 1.08)})
        y += rnd.uniform(34, 92)
        if rnd.random() < 0.7:
            side = -side
    # one lantern per floor, hung from its own branch on the side away from the pots,
    # lantern type and branch alternate by floor so neighbours never repeat
    ly = rnd.uniform(0.3, 0.55) * H
    plan = [it for it in plan if abs(it["y"] - ly) > 70 or it["side"] < 0]
    plan.append({"name": f"branch{1 + floor_index % 2}_R", "y": ly, "side": 1, "inset": 10, "scale": 1.0,
                 "lantern": f"lantern{floor_index % 2}"})
    return plan


def draw_trunk_column(canvas, x_axis, y_top, y_bottom, floor_bands, pcs, front=True):
    tile = load(os.path.join(OUT08, "trunk", "trunk_tile.png"))
    tile_h_master = tile.height
    tile = scaled(tile, TRUNK_K)
    tj = json.load(open(os.path.join(OUT08, "trunk", "trunk.json")))
    half_w = 0.60 * POT_PX2_PER_UNIT * TRUNK_SCALE  # visible half width of the bark, @2x px
    y = y_bottom - tile.height
    # tile upward from a fixed phase so every segment joint lands on the period
    while y + tile.height > y_top:
        canvas.alpha_composite(tile, (int(round(x_axis - tile.width / 2)), int(round(y))))
        y -= tile.height
    del tj
    for fi, (band_top, band_bottom) in enumerate(floor_bands):
        seg = band_bottom - band_top
        for it in scatter_plan(fi, seg, 1):
            im, p = pcs[it["name"]]
            im = scaled(im, TRUNK_K * it["scale"])
            ax, ay = p["anchor"][0] * TRUNK_K * it["scale"], p["anchor"][1] * TRUNK_K * it["scale"]
            py = band_bottom - it["y"]
            y_master = (y_bottom - py) / TRUNK_K
            px = x_axis + attach_x(it["side"], tile_h_master - 1 - (y_master % tile_h_master), it["inset"]) * TRUNK_K
            canvas.alpha_composite(im, (int(round(px - ax)), int(round(py - ay))))
            if "lantern" in it:
                lim, lp = pcs[it["lantern"]]
                lim = scaled(lim, TRUNK_K)
                tx, ty = branch_tip(im, it["side"])
                canvas.alpha_composite(lim, (int(round(px - ax + tx - lp["anchor"][0] * TRUNK_K)),
                                             int(round(py - ay + ty - 4 - lp["anchor"][1] * TRUNK_K))))


# ------------------------------------------------------------------ floors

def floor_assets(theme="meadow"):
    fl = load(os.path.join(OUT08, "floor", f"floor_{theme}.png"))
    fm = json.load(open(os.path.join(OUT08, "floor", f"floor_{theme}.json")))
    pm = json.load(open(os.path.join(OUT08, "floor", f"pedestals_{theme}.json")))
    peds = [(load(os.path.join(OUT08, "floor", p["name"] + ".png")), p) for p in pm["pedestals"]]
    return fl, fm, peds


def slot_xs(n):
    span = WORLD["potRowSpan"]
    sp = span / (n - 1) if n > 1 else 0
    return [-span / 2 + i * sp for i in range(n)]


def draw_floor(canvas, origin, k, n_slots, fl, fm, peds, pots, pot_keys, seed=0, show_pots=True):
    """origin = screen px of the floor container origin; k = screen px per game point."""
    im = scaled(fl, k / 2)
    ox, oy = fm["origin_px"][0] * k / 2, fm["origin_px"][1] * k / 2
    canvas.alpha_composite(im, (int(round(origin[0] - ox)), int(round(origin[1] - oy))))
    scale = min(WORLD["potScaleMax"], WORLD["potScale10"] + (10 - n_slots) * WORLD["potScaleStep"])
    rnd = random.Random(seed)
    for i, x in enumerate(slot_xs(n_slots)):
        ped, pm = peds[(i + seed) % len(peds)] if rnd.random() < 2 else peds[0]
        pk = k / 2 * scale
        pim = scaled(ped, pk)
        cx, cy = origin[0] + x * k, origin[1] + 4 * k
        canvas.alpha_composite(pim, (int(round(cx - pm["anchor_px"][0] * pk)), int(round(cy - pm["anchor_px"][1] * pk))))
        if show_pots:
            lift = (pm["anchor_px"][1] - pm["pot_base_px"][1]) * pk
            pim2, anc = pots[pot_keys[i % len(pot_keys)]]
            p2 = scaled(pim2, k / 2 * scale)
            canvas.alpha_composite(p2, (int(round(cx - anc["x"] * p2.width)), int(round(cy - lift - anc["y"] * p2.height))))


def label(canvas, text, xy, size=40, fill=(255, 255, 255, 255), stroke=(22, 26, 46, 255)):
    d = ImageDraw.Draw(canvas)
    d.text(xy, text, font=font(size), fill=fill, stroke_width=max(2, size // 12), stroke_fill=stroke)


# ------------------------------------------------------------------ outputs

def scene_ipad(out, pots, pcs):
    fl, fm, peds = floor_assets()
    # same fit as Scene.layout(): the view band (world x -100..1180) fills 97 % of the width
    k = 2 * (SCREEN[0] / 2 * 0.97) / (1180 - (-100))
    canvas = sky()
    margin = (SCREEN[0] - (1180 + 100) * k) / 2
    cx = margin + (WORLD["floorCenterX"] + 100) * k
    y0 = SCREEN[1] - 330
    floors = [(cx, y0), (cx, y0 - WORLD["floorGap"] * k)]
    trunk_x = cx + (WORLD["trunkX"] - WORLD["floorCenterX"]) * k
    bands = [(y - WORLD["floorGap"] * k, y) for (_, y) in floors]
    draw_trunk_column(canvas, trunk_x, -50, SCREEN[1] + 50, bands, pcs)
    keys = ["pots/sig/01/50", "pots/sig/11/50", "pots/sig/16/50", "pots/sig/38/50", "pots/sig/41/50", "pots/sig/48/50"]
    for i, (fx, fy) in enumerate(floors):
        draw_floor(canvas, (fx, fy), k, (8, 6)[i], fl, fm, peds, pots, keys[i:] + keys[:i], seed=i)
    print('k', round(k, 3), 'trunk_x', round(trunk_x))
    cat = load(os.path.join(OUT08, "pet", "cloud_cat_idle.png"))
    cm = json.load(open(os.path.join(OUT08, "pet", "cloud_cat.json")))
    ck = POT_PX2_PER_UNIT / cm["px_per_unit"] * k / 2 * 1.6
    c2 = scaled(cat, ck)
    gx, gy = cm["frames"][0]["ground_px"]
    px, py = floors[1][0] - 376 * k, floors[1][1] + 8 * k
    canvas.alpha_composite(c2, (int(round(px - gx * ck)), int(round(py - gy * ck))))
    label(canvas, "BẢN THỬ BƯỚC 1 · ghép tĩnh trên nền trời thật · 2388×1668", (40, 30), 38)
    canvas.convert("RGB").save(os.path.join(out, "ipad-2388x1668.jpg"), quality=92)
    scaled(canvas, 0.25).convert("RGB").save(os.path.join(out, "ipad-thu-nho-25.jpg"), quality=92)
    return canvas


def trunk_seams(out, pcs):
    tile = load(os.path.join(OUT08, "trunk", "trunk_tile.png"))
    h = tile.height
    col = Image.new("RGBA", (tile.width, 3 * h), (0, 0, 0, 0))
    for i in range(3):
        col.alpha_composite(tile, (0, i * h))
    bg = sky((tile.width + 400, 3 * h))
    bg.alpha_composite(col, (200, 0))
    # decorations scattered on the joined segments (unscaled master size)
    for it in scatter_plan(0, 3 * h, 1):
        im, p = pcs[it["name"]]
        im = scaled(im, it["scale"])
        py = 3 * h - it["y"]
        px = 200 + tile.width / 2 + attach_x(it["side"], int(py) % h, it["inset"])
        ox, oy = int(round(px - p["anchor"][0] * it["scale"])), int(round(py - p["anchor"][1] * it["scale"]))
        bg.alpha_composite(im, (ox, oy))
        if "lantern" in it:
            lim, lp = pcs[it["lantern"]]
            tx, ty = branch_tip(im, it["side"])
            bg.alpha_composite(lim, (int(round(ox + tx - lp["anchor"][0])), int(round(oy + ty - 4 - lp["anchor"][1]))))
    bg.convert("RGB").save(os.path.join(out, "cay-leo-3-doan.jpg"), quality=92)
    # bare trunk joints at 200 % (no decorations, so nothing hides a seam)
    bare = sky((tile.width, 3 * h))
    bare.alpha_composite(col)
    crops = []
    for j in (h, 2 * h):
        c = bare.crop((tile.width // 2 - 150, j - 60, tile.width // 2 + 150, j + 60)).resize((600, 240), Image.NEAREST)
        d = ImageDraw.Draw(c)
        d.line((0, 120, 14, 120), fill=(255, 40, 40), width=3)
        d.line((586, 120, 600, 120), fill=(255, 40, 40), width=3)
        crops.append(c)
    sheet = Image.new("RGB", (620, 520), (251, 243, 230))
    for i, c in enumerate(crops):
        sheet.paste(c.convert("RGB"), (10, 10 + i * 255))
    sheet.save(os.path.join(out, "cay-leo-cho-noi-200.png"))
    # pixel check: last row of a tile vs first row continuity measured as max colour jump
    import statistics
    a = tile.load()
    jumps = []
    inner = []
    for x in range(tile.width):
        if a[x, h - 1][3] > 250 and a[x, 0][3] > 250:
            jumps.append(sum(abs(a[x, h - 1][c] - a[x, 0][c]) for c in range(3)))
            inner.append(sum(abs(a[x, h // 2][c] - a[x, h // 2 + 1][c]) for c in range(3)))
    return {"seam_mean_jump": round(statistics.mean(jumps), 2), "inner_mean_jump": round(statistics.mean(inner), 2),
            "alpha_rows_equal": all((a[x, h - 1][3] > 0) == (a[x, 0][3] > 0) for x in range(tile.width))}


def pots_two_presets(out):
    keys = (1, 11, 16, 38, 41, 48)
    W_, H_ = 2388, 1100
    canvas = sky((W_, H_))
    d = ImageDraw.Draw(canvas)
    for row, st in enumerate(("studio_cream", "world")):
        y = 120 + row * 500
        label(canvas, {"studio_cream": "studio_cream (mặc định chậu, đã duyệt)", "world": "world (preset mới của chỉ thị 08)"}[st], (60, y - 90), 40)
        for i, pid in enumerate(keys):
            im = load(os.path.join(OUT08, f"pots_{st}", "signature_all", "master", f"pot_{pid:02d}.png"))
            im = im.crop(im.getbbox())
            im = scaled(im, 380 / im.height)
            x = 80 + i * 380 + (380 - im.width) // 2
            canvas.alpha_composite(im, (x, y))
    del d
    canvas.convert("RGB").save(os.path.join(out, "chau-hai-preset.jpg"), quality=92)


def pedestal_checks(out, pots):
    fl, fm, peds = floor_assets()
    keys = ["pots/sig/01/50", "pots/sig/11/50", "pots/sig/16/50", "pots/sig/38/50", "pots/sig/41/50", "pots/sig/48/50"]
    k = 1.0
    rows = []
    for n in (3, 6, 10):
        w = int(fl.width * k / 2) + 80
        h = int(fl.height * k / 2) + 220
        c = sky((w, h))
        origin = (fm["origin_px"][0] * k / 2 + 40, fm["origin_px"][1] * k / 2 + 180)
        draw_floor(c, origin, k, n, fl, fm, peds, pots, keys, seed=n)
        label(c, f"{n} ô", (30, 20), 44)
        rows.append(c)
    sheet = Image.new("RGB", (rows[0].width, sum(r.height for r in rows)))
    y = 0
    for r in rows:
        sheet.paste(r.convert("RGB"), (0, y))
        y += r.height
    sheet.save(os.path.join(out, "be-chau-3-6-10-o.jpg"), quality=90)
    # numeric check: every pedestal footprint inside the grass along the slot line
    left, right = fm["grass_line_px"]
    res = {}
    for n in (3, 6, 10):
        scale = min(WORLD["potScaleMax"], WORLD["potScale10"] + (10 - n) * WORLD["potScaleStep"])
        half = max(p["w"] for _, p in peds) / 2 * scale * 0.86  # visible stone half-width ≈ 86 % of frame
        xs = [fm["origin_px"][0] + x * 2 for x in slot_xs(n)]
        res[n] = {"min_margin_px": round(min(min(x - half - left, right - (x + half)) for x in xs), 1)}
    return res


def main():
    out = os.path.join(ROOT, "docs", "reviews", "renders", "c08")
    if "--out" in sys.argv:
        out = sys.argv[sys.argv.index("--out") + 1]
    os.makedirs(out, exist_ok=True)
    pots = pot_frames()
    pcs = pieces()
    seams = trunk_seams(out, pcs)
    pots_two_presets(out)
    checks = pedestal_checks(out, pots)
    scene_ipad(out, pots, pcs)
    json.dump({"seams": seams, "pedestals": checks}, open(os.path.join(out, "kiem-tra.json"), "w"), indent=1, ensure_ascii=False)
    print(json.dumps({"seams": seams, "pedestals": checks}, ensure_ascii=False))


if __name__ == "__main__":
    main()
