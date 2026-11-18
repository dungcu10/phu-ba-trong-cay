"""Chỉ thị 10 · M1 — art pipeline for PhuBa_BoHinh_v1 (tools/art/src). Re-runnable:

  /tmp/aienv/bin/python tools/art/build.py            # needs torch + spandrel for the upscaler
  (weights: tools/art/weights/anime6b.pth = Real-ESRGAN x4 anime 6B, downloaded once, not committed)

Allowed processing only (§ 2.2.5): white background removal, cutting sheets, upscaling, recolouring the
grey cloud under the vine root, a little saturation on the vine top, and the seam fix of the trunk.

Output: assets/art/world10_<name>@2x.webp/.json and @1x, plus assets/art/world10.json (anchors, slot rows).
Sizes are in game points; @2x = 2 px per point.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from cutout import components, cut_white, paper_shadow_to_dark, recolour_clouds  # noqa: E402
import trunk_tile  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(HERE, "src")
OUT = os.path.join(ROOT, "assets", "art")
WORK = os.path.join(HERE, "out")
MAX = 2048
PAD = 2

# ------------------------------------------------------------------ sizes and names (points)
FLOOR_W = 1300  # every floor is shown this wide (§ 2.3 Tỉ lệ)
FLOORS = [  # file, id, pedestal row in source px: (y, x0, x1), pedestal style
    ("tang1_dong-may-ngoc", "t1", (335, 300, 1330), "grey"),
    ("tang2_vuon-tra-suong-som", "t2", (425, 300, 1340), "sand"),
    ("tang3_ruong-bac-thang-hoang-kim", "t3", (300, 255, 860), "sand"),
    ("tang4_vuon-trang-lo-lung", "t4", (492, 380, 1560), "moon"),
]
TRUNK_W = 150  # bark width of the vine in points
PEDESTAL_W = 150
BUG_SIZE = 62
BIRD_SIZE = 84
XUXU_H = 130
BUGS = ["ladybird", "leaf-worm", "pink-moth", "jade-beetle", "dew-hopper", "gold-scarab", "star-firefly", "jade-cicada"]
BIRDS = ["sky-sparrow", "leaf-robin", "kingfisher", "night-owl"]
XUXU = ["happy", "wave", "sleep", "surprised"]
PIECES = ["leaf0", "leaf1", "leaf2", "leaf3", "leaf4", "leaf5", "bud0", "bud1", "bud2", "tendril0", "tendril1", "lantern0", "lantern1"]

_model = None


def esrgan_x4(rgb):
    global _model
    import torch
    from spandrel import ModelLoader
    torch.set_num_threads(2)
    if _model is None:
        _model = ModelLoader().load_from_file(os.path.join(HERE, "weights", "anime6b.pth")).eval()
    x = torch.from_numpy(np.asarray(rgb).astype(np.float32) / 255).permute(2, 0, 1)[None]
    T, P, S = 192, 16, 4
    _, _, H, W = x.shape
    out = torch.zeros(1, 3, H * S, W * S)
    with torch.no_grad():
        for y0 in range(0, H, T):
            for x0 in range(0, W, T):
                ya, xa, yb, xb = max(0, y0 - P), max(0, x0 - P), min(H, y0 + T + P), min(W, x0 + T + P)
                o = _model(x[:, :, ya:yb, xa:xb])
                oy, ox = (y0 - ya) * S, (x0 - xa) * S
                h, w = min(T, H - y0) * S, min(T, W - x0) * S
                out[:, :, y0 * S:y0 * S + h, x0 * S:x0 * S + w] = o[:, :, oy:oy + h, ox:ox + w]
    return Image.fromarray((out[0].permute(1, 2, 0).clamp(0, 1).numpy() * 255).round().astype(np.uint8))


def resize_rgba(img, size):
    """Resize an RGBA cut-out. Enlarging uses the ESRGAN upscaler on the colour (transparent pixels filled
    with the nearest colour first, so edges do not pick up black) and Lanczos on the alpha."""
    w, h = img.size
    tw, th = size
    a = np.asarray(img).astype(np.float32)
    if tw <= w * 1.05:
        pm = a.copy()
        pm[..., :3] *= pm[..., 3:4] / 255
        r = np.asarray(Image.fromarray(pm.round().astype(np.uint8), "RGBA").resize((tw, th), Image.LANCZOS)).astype(np.float32)
        al = r[..., 3:4] / 255
        r[..., :3] = np.where(al > 1e-3, r[..., :3] / np.maximum(al, 1e-3), 0)
        return Image.fromarray(r.clip(0, 255).round().astype(np.uint8), "RGBA")
    alpha = a[..., 3] > 8
    idx = ndimage.distance_transform_edt(~alpha, return_distances=False, return_indices=True)
    filled = a[..., :3][idx[0], idx[1]]
    up = esrgan_x4(Image.fromarray(filled.round().astype(np.uint8)))
    rgb = up.resize((tw, th), Image.LANCZOS)
    al = Image.fromarray(a[..., 3].astype(np.uint8)).resize((tw, th), Image.LANCZOS)
    out = Image.merge("RGBA", (*rgb.split(), al))
    return out


def scale_to(img, width=None, height=None, box=None):
    bw, bh = img.size if box is None else box
    k = width / bw if width else height / bh
    return resize_rgba(img, (max(1, round(img.width * k)), max(1, round(img.height * k)))), k


# ------------------------------------------------------------------ atlases

def shelf_pack(items, width=MAX):
    order = sorted(items, key=lambda it: -it[1].height)
    x = y = row_h = used = 0
    pos = {}
    for name, im in order:
        if x + im.width + PAD > width:
            x, y, row_h = 0, y + row_h + PAD, 0
        pos[name] = (x, y)
        x += im.width + PAD
        used = max(used, x)
        row_h = max(row_h, im.height)
    if y + row_h > MAX:
        raise SystemExit(f"atlas too tall ({y + row_h})")
    return pos, (used, y + row_h)


def write_atlas(name, entries):
    """entries: {frame: (image @2x, (ax, ay) px @2x)}. Writes @2x and @1x."""
    for res in (2, 1):
        ents = {}
        for k, (im, anc) in entries.items():
            if res == 1:
                im1 = resize_rgba(im, (max(1, round(im.width / 2)), max(1, round(im.height / 2))))
                ents[k] = (im1, (anc[0] * im1.width / im.width, anc[1] * im1.height / im.height))
            else:
                ents[k] = (im, anc)
        pos, (w, h) = shelf_pack([(k, v[0]) for k, v in ents.items()])
        sheet = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        frames = {}
        for k, (im, anc) in ents.items():
            x, y = pos[k]
            sheet.alpha_composite(im, (x, y))
            frames[k] = {"frame": {"x": x, "y": y, "w": im.width, "h": im.height}, "rotated": False, "trimmed": False,
                         "spriteSourceSize": {"x": 0, "y": 0, "w": im.width, "h": im.height}, "sourceSize": {"w": im.width, "h": im.height},
                         "anchor": {"x": round(anc[0] / im.width, 5), "y": round(anc[1] / im.height, 5)}}
        img_name = f"world10_{name}@{res}x.webp"
        sheet.save(os.path.join(OUT, img_name), "WEBP", quality=90, method=6)
        meta = {"app": "tools/art/build.py", "version": "1", "image": img_name, "format": "RGBA8888", "size": {"w": w, "h": h}, "scale": str(res)}
        json.dump({"frames": frames, "meta": meta}, open(os.path.join(OUT, f"world10_{name}@{res}x.json"), "w"), separators=(",", ":"))
        print(f"  atlas {name}@{res}x {w}x{h} ({len(frames)})", flush=True)


def save_work(name, im):
    os.makedirs(WORK, exist_ok=True)
    im.save(os.path.join(WORK, name + ".png"))


def lowest_point(im, frac=0.5):
    """Bottom-centre of the opaque part (feet, stems, perch)."""
    a = np.asarray(im)[..., 3] > 128
    rows = np.where(a.sum(1) > 2)[0]
    y = rows.max()
    xs = np.where(a[max(0, y - 6):y + 1])[1]
    return float(xs.mean()), float(y)


# ------------------------------------------------------------------ builders

def build_floors(meta):
    for fname, fid, (ry, rx0, rx1), style in FLOORS:
        img = cut_white(Image.open(os.path.join(SRC, "1_tang-may", fname + ".png")))
        bb = img.getbbox()
        img = img.crop(bb)
        ry, rx0, rx1 = ry - bb[1], rx0 - bb[0], rx1 - bb[0]
        big, k = scale_to(img, width=FLOOR_W * 2)
        save_work(f"floor_{fid}", big)
        # anchor = middle of the pedestal row
        ax, ay = (rx0 + rx1) / 2 * k, ry * k
        half = big.width // 2
        # one atlas per half: a whole floor at @2x does not fit 2048×2048
        write_atlas(f"floor_{fid}_L", {f"floor/{fid}/L": (big.crop((0, 0, half, big.height)), (ax, ay))})
        write_atlas(f"floor_{fid}_R", {f"floor/{fid}/R": (big.crop((half, 0, big.width, big.height)), (ax - half, ay))})
        meta["floors"][fid] = {"row": {"x0": round((rx0 * k - ax) / 2, 1), "x1": round((rx1 * k - ax) / 2, 1)},
                               "left": round(-ax / 2, 1), "right": round((big.width - ax) / 2, 1),
                               "top": round(-ay / 2, 1), "bottom": round((big.height - ay) / 2, 1), "pedestal": style}


def build_vine(meta):
    entries = {}
    tile, axis = trunk_tile.build(os.path.join(SRC, "2_cay-leo", "than-cay.png"))
    a = np.asarray(tile)[..., 3]
    bark_w = float(np.median([(float(np.ptp(np.where(r > 200)[0])) if (r > 200).any() else 0) for r in a]))
    k = TRUNK_W * 2 / bark_w
    big = resize_rgba(tile, (round(tile.width * k), round(tile.height * k)))
    # keep the period exact so stacked copies still meet: height is rounded, the stack uses this height
    entries["vine/tile"] = (big, (axis * k, big.height))
    meta["vine"] = {"segment": round(big.height / 2, 2), "width": round(big.width / 2, 1), "axis": round(axis * k / 2, 1), "scale": k}
    save_work("vine_tile", big)
    # root: grey clouds recoloured to the floors' cloud gradient (allowed § 2.1)
    root = cut_white(Image.open(os.path.join(SRC, "2_cay-leo", "goc-cay.png")), hole_area=200)
    H = root.height
    region = np.zeros((H, root.width), bool)
    region[int(H * 0.55):] = True
    root = recolour_clouds(root, region, [(0.45, (170, 150, 205)), (0.7, (236, 184, 200)), (0.88, (255, 214, 196)), (1.0, (255, 244, 232))])
    root = root.crop(root.getbbox())
    # top: a little more saturation to match the trunk (allowed § 2.1)
    top = cut_white(Image.open(os.path.join(SRC, "2_cay-leo", "ngon-cay.png")), hole_area=90)
    top = top.crop(top.getbbox())
    rgb, al = top.convert("RGB"), top.getchannel("A")
    top = Image.merge("RGBA", (*ImageEnhance.Color(rgb).enhance(1.12).split(), al))
    ends = {}
    for name, im, end in (("root", root, "top"), ("top", top, "bottom")):
        a = np.asarray(im)[..., 3] > 200
        y = 30 if end == "top" else im.height - 30
        xs = np.where(a[y])[0]
        r = (xs.min(), xs.max())  # whole bark width at the joining end (strands may show gaps)
        w_end = r[-1] - r[0]
        kk = TRUNK_W * 2 / max(w_end, 1)
        big = resize_rgba(im, (round(im.width * kk), round(im.height * kk)))
        anc = ((r[0] + r[-1]) / 2 * kk, 0 if end == "top" else big.height)
        ends[f"vine/{name}"] = (big, anc)
        save_work(f"vine_{name}", big)
    write_atlas("vine_ends", ends)
    # leaves, buds, tendrils, lanterns: anchored at the stem / hook
    sheet = cut_white(Image.open(os.path.join(SRC, "2_cay-leo", "la-nu-tua-den-roi.png")))
    boxes = components(sheet, min_area=1500, pad=4)
    top_row = sorted([b for b in boxes if b[1] < 300], key=lambda b: b[0])
    bottom = sorted([b for b in boxes if b[1] >= 300], key=lambda b: b[0])
    leaves = top_row  # 6
    lanterns = [b for b in bottom if b[3] - b[1] > 230]
    rest = [b for b in bottom if b not in lanterns]  # 3 buds then 2 tendrils, left to right
    order = list(zip(["leaf0", "leaf1", "leaf2", "leaf3", "leaf4", "leaf5"], leaves)) + \
        list(zip(["bud0", "bud1", "bud2", "tendril0", "tendril1"], rest)) + list(zip(["lantern0", "lantern1"], lanterns))
    for name, (x0, y0, x1, y1, _) in order:
        im = sheet.crop((x0, y0, x1, y1))
        im = im.crop(im.getbbox())
        im = resize_rgba(im, (round(im.width * k), round(im.height * k)))
        if name.startswith("lantern"):
            a = np.asarray(im)[..., 3] > 128
            xs = np.where(a[:4].any(0))[0]
            anc = (float(xs.mean()) if len(xs) else im.width / 2, 0.0)
        else:
            anc = lowest_point(im)
        entries[f"vine/{name}"] = (im, anc)
    write_atlas("vine", entries)


def build_rings(meta):
    img = cut_white(Image.open(os.path.join(SRC, "1_tang-may", "vong-may-om-cay_nang-va-trang.png")))
    boxes = sorted(components(img, min_area=5000, pad=4), key=lambda b: b[0])
    entries = {}
    for name, (x0, y0, x1, y1, _) in zip(["sun", "moon"], boxes):
        im = img.crop((x0, y0, x1, y1))
        # ring sized so its hole fits the trunk with some cloud overlap
        a = np.asarray(im)[..., 3] > 128
        cy = im.height // 2
        row = a[cy]
        xs = np.where(~row[im.width // 4: 3 * im.width // 4])[0]
        hole = (xs.max() - xs.min()) if len(xs) else im.width * 0.4
        k = TRUNK_W * 2 * 1.05 / hole
        big = resize_rgba(im, (round(im.width * k), round(im.height * k)))
        # hole centre: centroid of the enclosed transparent area
        a = np.asarray(big)[..., 3] < 60
        lab, n = ndimage.label(a)
        border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
        cand = [i for i in range(1, n + 1) if i not in border]
        sizes = {i: (lab == i).sum() for i in cand}
        hid = max(sizes, key=sizes.get)
        hy, hx = [float(v.mean()) for v in np.where(lab == hid)]
        hy_i = int(round(hy))
        back = big.copy()
        front = big.copy()
        ba = np.asarray(back).copy()
        fa = np.asarray(front).copy()
        ba[hy_i:, :, 3] = 0  # back half = behind the trunk
        fa[:hy_i, :, 3] = 0
        entries[f"ring/{name}/back"] = (Image.fromarray(ba, "RGBA"), (hx, hy))
        entries[f"ring/{name}/front"] = (Image.fromarray(fa, "RGBA"), (hx, hy))
        save_work(f"ring_{name}", big)
    write_atlas("rings", entries)


def build_sheet(path, names, size_pt, anchor, extra=None, fixer=None, by="max", rows=None, cut_kw=None, grid=None):
    img = cut_white(Image.open(path), **(cut_kw or {}))
    if fixer:
        img = fixer(img)
    boxes = components(img, min_area=1500, pad=4)
    if grid:
        # (cols, rows): name order is by grid cell of each piece's centre (pieces of one cell merge)
        gc, gr = grid
        cells = {}
        for b in boxes:
            cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
            key = (int(cy / img.height * gr), int(cx / img.width * gc))
            o = cells.get(key)
            cells[key] = b if o is None else (min(o[0], b[0]), min(o[1], b[1]), max(o[2], b[2]), max(o[3], b[3]), o[4] + b[4])
        boxes = [cells[k] for k in sorted(cells)]
    elif rows:
        # sort into rows by y, then x
        boxes.sort(key=lambda b: b[1])
        out = []
        for i in range(0, len(boxes), rows):
            out += sorted(boxes[i:i + rows], key=lambda b: b[0])
        boxes = out
    else:
        boxes.sort(key=lambda b: b[0])
    if len(boxes) != len(names):
        raise SystemExit(f"{os.path.basename(path)}: {len(boxes)} pieces, expected {len(names)}")
    res = {}
    for name, (x0, y0, x1, y1, _) in zip(names, boxes):
        im = img.crop((x0, y0, x1, y1))
        im = im.crop(im.getbbox())
        d = max(im.size) if by == "max" else (im.width if by == "w" else im.height)
        k = size_pt * 2 / d
        big = resize_rgba(im, (round(im.width * k), round(im.height * k)))
        res[name] = (big, anchor(big, name))
    return res


def centre(im, _name=None):
    a = np.asarray(im)[..., 3] > 128
    ys, xs = np.where(a)
    return float(xs.mean()), float(ys.mean())


def pedestal_anchor(im, _name=None):
    """Centre of the top face: x = centre of the stone, y = middle of the upper flat part."""
    a = np.asarray(im)[..., 3] > 200
    rows = np.where(a.sum(1) > 0)[0]
    y = rows.min() + (rows.max() - rows.min()) * 0.42
    xs = np.where(a[int(y)])[0]
    return float((xs.min() + xs.max()) / 2), float(y)


ICON_PT = 64  # UI item icons (chỉ thị 10/11 § CẦN HÌNH: 7_bieu-tuong)
ICON_SHEETS = [
    ("to1_che-bien-va-vat-pham.png", ["dried-flowers", "jam", "juice", "cloud-gem",
                                      "cloud-thread", "sky-dew", "cloud-millet", "wind-energy"], 4, None),
    # The minerals sheet has an English caption under every picture: blank those bands first.
    ("to2_khoang-moi-trung-rong.png", ["cloud-stone", "copper-ore", "silver-ore", "gold-nugget",
                                       "raw-jade", "bait", "sweet-bait", "dragon-egg-shard"], 4, [(214, 268), (474, 530)]),
    ("to3_ca-va-phao.png", ["fish-cloud", "fish-pink", "fish-gold", "fish-moon", "fish-dragon", "float"], 3, None),
    ("to4_huy-hieu-diem-su-kien-ruong.png", ["badge-kitten", "badge-fox", "badge-sparrow", "badge-dragon",
                                             "event-point", "drift-chest"], 3, None),
    ("to5_huy-chuong-do-cao.png", ["medal-low-sky", "medal-golden-sky", "medal-sunset", "medal-night"], 2, None),
]


def blank_bands(bands):
    def fix(im):
        a = np.asarray(im).copy()
        for y0, y1 in bands:
            a[y0:y1, :, 3] = 0
        return Image.fromarray(a)
    return fix


def crystal_icon():
    """Decor "pha lê": the crystal hanging under floor 1 (cut out; the cloud behind its hanger removed),
    upscaled ×4 like the rest of the art. Not in 7_bieu-tuong, so it is cut from the approved floor."""
    src = Image.open(os.path.join(SRC, "1_tang-may", "tang1_dong-may-ngoc.png")).convert("RGB").crop((560, 522, 660, 632))
    big = esrgan_x4(src)
    mask = np.asarray(cut_white(src)).copy()
    rgb = mask[..., :3].astype(int)
    mask[(rgb[..., 0] > 170) & (rgb[..., 2] > 150) & (rgb[..., 1] < rgb[..., 0] - 5), 3] = 0
    lab, n = ndimage.label(mask[..., 3] > 40)
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    mask[lab != 1 + int(np.argmax(sizes)), 3] = 0
    alpha = Image.fromarray(mask[..., 3]).resize(big.size, Image.LANCZOS)
    im = big.convert("RGBA")
    im.putalpha(alpha)
    im = im.crop(im.getbbox())
    k = ICON_PT * 2 / max(im.size)
    im = resize_rgba(im, (round(im.width * k), round(im.height * k)))
    return im, centre(im)


def build_icons():
    ent = {"icon/crystal": crystal_icon()}
    for fname, names, rows, bands in ICON_SHEETS:
        got = build_sheet(os.path.join(SRC, "7_bieu-tuong", fname), names, ICON_PT, centre,
                          fixer=blank_bands(bands) if bands else None, rows=rows)
        ent.update({f"icon/{k}": v for k, v in got.items()})
    write_atlas("icons", ent)


def main():
    only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else None
    want = lambda k: only is None or k in only  # noqa: E731
    mp = os.path.join(OUT, "world10.json")
    meta = json.load(open(mp)) if os.path.exists(mp) else {"floors": {}, "scale": 2}
    os.makedirs(OUT, exist_ok=True)
    if want("floors"):
        print("floors", flush=True)
        build_floors(meta)
        json.dump(meta, open(mp, "w"), indent=1)
    if want("vine"):
        print("vine", flush=True)
        build_vine(meta)
        json.dump(meta, open(mp, "w"), indent=1)
    if want("rings"):
        print("rings", flush=True)
        build_rings(meta)
    if want("icons"):
        print("icons", flush=True)
        build_icons()
    if not want("chars"):
        return
    print("pedestals", flush=True)
    peds = build_sheet(os.path.join(SRC, "3_be-chau", "be-chau_3-kieu-x2.png"),
                       ["grey/0", "sand/0", "moon/0", "grey/1", "sand/1", "moon/1"], PEDESTAL_W, pedestal_anchor,
                       fixer=lambda im: paper_shadow_to_dark(im, sat_max=36, lum_min=188), by="w", rows=3)
    write_atlas("pedestals", {f"pedestal/{k}": v for k, v in peds.items()})
    print("characters", flush=True)
    bugs = build_sheet(os.path.join(SRC, "4_nhan-vat", "bo_8-loai.png"), BUGS, BUG_SIZE, centre, rows=4)
    birds = build_sheet(os.path.join(SRC, "4_nhan-vat", "chim_4-loai_dau-va-bay.png"),
                        [f"{b}/perch" for b in BIRDS] + [f"{b}/fly" for b in BIRDS], BIRD_SIZE,
                        lambda im, n: lowest_point(im) if n.endswith("perch") else centre(im), rows=4)
    xu = build_sheet(os.path.join(SRC, "4_nhan-vat", "xu-xu_4-dang.png"), XUXU, XUXU_H, lambda im, n: lowest_point(im), by="h")
    ent = {f"bug/{k}": v for k, v in bugs.items()}
    ent.update({f"bird/{k}": v for k, v in birds.items()})
    ent.update({f"xuxu/{k}": v for k, v in xu.items()})
    write_atlas("chars", ent)
    json.dump(meta, open(os.path.join(OUT, "world10.json"), "w"), indent=1)
    print("done", flush=True)


if __name__ == "__main__":
    main()
