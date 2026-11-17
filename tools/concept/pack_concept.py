"""Atlases from the owner's concept pictures (Gemini): cloud floors, the vine, Mèo Mây and the three pets.

Pipeline (tools/concept/):
  upscale.py      Real-ESRGAN x4 (anime 6B weights) of the two pictures
  cut_concept.py  floors, vine, cat: segmentation + colour distance from a locally estimated sky
  cut_pets.py     fox, dragon, sparrow from the pet sheet (checkerboard baked in the picture)
  pack_concept.py this file: seamless vine segment, floor halves, pet frames -> assets/art/world_*.{webp,json}
                  (world_floor_house/falls/bridge, world_vine, world_misc = pets)

  python3 tools/concept/pack_concept.py --cut /tmp/sr/out/cut
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets", "art")
MAX = 2048
PAD = 2
FLOOR_SCALE = 0.9  # floor halves fit a 2048 atlas; 1.8 px per point = the iPad's own density
# where the pots stand on each floor picture (full cut px): lawn line, measured from the grass
FLOORS = {"house": ("floor-house", 505, 1441), "falls": ("floor-falls", 495, 1280), "bridge": ("floor-bridge", 264, 1408)}
PET_HEIGHT = 210  # px @2x of the standing pose (105 points)


def load(p):
    return Image.open(p).convert("RGBA")


def shelf_pack(items):
    order = sorted(items, key=lambda it: -it[1].height)
    x = y = row_h = used_w = 0
    pos = {}
    for name, im in order:
        if x + im.width + PAD > MAX:
            x, y, row_h = 0, y + row_h + PAD, 0
        pos[name] = (x, y)
        x += im.width + PAD
        used_w = max(used_w, x)
        row_h = max(row_h, im.height)
    if y + row_h > MAX:
        raise SystemExit("atlas too tall")
    return pos, (used_w, y + row_h)


def write_atlas(name, entries, scale):
    pos, (w, h) = shelf_pack([(k, v[0]) for k, v in entries.items()])
    sheet = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    frames = {}
    for k, (im, anc) in entries.items():
        x, y = pos[k]
        sheet.alpha_composite(im, (x, y))
        frames[k] = {"frame": {"x": x, "y": y, "w": im.width, "h": im.height}, "rotated": False, "trimmed": False,
                     "spriteSourceSize": {"x": 0, "y": 0, "w": im.width, "h": im.height}, "sourceSize": {"w": im.width, "h": im.height},
                     "anchor": {"x": round(anc[0] / im.width, 5), "y": round(anc[1] / im.height, 5)}}
    sheet.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=90, method=6)
    meta = {"app": "concept/pack_concept.py", "version": "1", "image": f"{name}.webp", "format": "RGBA8888", "size": {"w": w, "h": h}, "scale": str(scale)}
    json.dump({"frames": frames, "meta": meta}, open(os.path.join(OUT, f"{name}.json"), "w"), separators=(",", ":"))
    print(name, w, h, len(frames))


def scaled(im, k):
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def seamless_vine(im, start=80, length=2200, overlap=320):
    """Vertical segment that repeats without a joint: the first `overlap` rows cross-fade (premultiplied)
    from the picture just below the segment into the segment itself."""
    a = np.asarray(im).astype(np.float32) / 255.0
    rgb, al = a[..., :3] * a[..., 3:4], a[..., 3:4]
    s = start
    seg_rgb = rgb[s + overlap: s + overlap + length].copy()
    seg_al = al[s + overlap: s + overlap + length].copy()
    for i in range(overlap):
        w = (i / overlap) ** 1.0
        lo = s + overlap + length + i  # continues from the bottom of the segment
        seg_rgb[i] = (1 - w) * rgb[lo] + w * seg_rgb[i]
        seg_al[i] = (1 - w) * al[lo] + w * seg_al[i]
    out_rgb = np.where(seg_al > 1e-4, seg_rgb / np.maximum(seg_al, 1e-4), 0)
    out = np.concatenate([out_rgb, seg_al], axis=2)
    return Image.fromarray((out.clip(0, 1) * 255).round().astype(np.uint8), "RGBA")


def main():
    cut = sys.argv[sys.argv.index("--cut") + 1] if "--cut" in sys.argv else "/tmp/sr/out/cut"
    data = {"floors": {}}
    # floors: two halves each, own atlas (scale 1.8 px / point)
    for key, (fname, line_y, cx) in FLOORS.items():
        src = load(os.path.join(cut, f"{fname}.png"))
        fs = min(FLOOR_SCALE, (MAX - 2 * PAD) / (2 * src.height), (MAX - PAD) / (src.width / 2))
        im = scaled(src, fs)
        oy, ox = line_y * fs, cx * fs
        half = im.width // 2
        entries = {f"world/floor/{key}/L": (im.crop((0, 0, half, im.height)), (ox, oy)),
                   f"world/floor/{key}/R": (im.crop((half, 0, im.width, im.height)), (ox - half, oy))}
        write_atlas(f"world_floor_{key}", entries, round(2 * fs, 4))
    # vine segment + pets in one atlas
    entries = {}
    vine = load(os.path.join(cut, "vine-b-clean.png"))
    tile = scaled(seamless_vine(vine), 0.84)
    al = np.asarray(tile)[..., 3]
    cols = np.where((al > 230).sum(0) > tile.height * 0.6)[0]
    axis = float((cols.min() + cols.max()) / 2) if len(cols) else tile.width / 2
    entries["world/trunk/tile"] = (tile, (axis, tile.height))
    data["tile"] = {"w": tile.width, "h": tile.height, "axis": axis}
    write_atlas("world_vine", entries, 2)
    entries = {}
    pets = {"cloud-cat": ("cloud-cat", ["idle", "run", "sleep", "happy"]), "ember-fox": ("ember-fox", ["idle", "run", "sleep", "happy"]),
            "jade-dragon": ("jade-dragon", ["idle", "run", "sleep", "happy"]), "cloud-sparrow": ("cloud-sparrow", ["idle", "run", "sleep", "happy"])}
    for slug, (fname, states) in pets.items():
        idle = load(os.path.join(cut, f"{fname}_idle.png"))
        k = PET_HEIGHT / idle.height
        for stt in states:
            im = scaled(load(os.path.join(cut, f"{fname}_{stt}.png")), k)
            # ground point: bottom centre of the opaque body (lowest rows with real coverage)
            a = np.asarray(im)[..., 3]
            rows = np.where((a > 128).sum(1) > 4)[0]
            bottom = rows.max() if len(rows) else im.height
            xs = np.where(a[max(0, bottom - 12): bottom + 1] > 128)[1]
            gx = float(xs.mean()) if len(xs) else im.width / 2
            entries[f"world/pet/{slug}/{stt}"] = (im, (gx, bottom))
    write_atlas("world_misc", entries, 2)
    json.dump(data, open(os.path.join(OUT, "world_trunk.json"), "w"), separators=(",", ":"))


if __name__ == "__main__":
    main()
