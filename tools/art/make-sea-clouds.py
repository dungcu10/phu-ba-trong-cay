#!/usr/bin/env python3
"""Chỉ thị 10 § 3.7: cloud clumps for the Biển Mây map, cut from the approved art (L7: crop + code
effects only, nothing drawn). Windows are slid over the cloud rings and the cloud undersides of the
four floors (@2x atlases in assets/art); the densest non-overlapping windows are kept, given a soft
oval edge so they read as puffs, and packed into assets/art/sea_clouds.{webp,json}.

Run: python3 tools/art/make-sea-clouds.py
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "assets" / "art"
W, H = 220, 180  # clump size in @2x pixels
STEP = 24
KEEP_PER_FRAME = 4
COLS = 6


def frames(atlas: str):
    data = json.loads((ART / f"{atlas}@2x.json").read_text())
    img = Image.open(ART / f"{atlas}@2x.webp").convert("RGBA")
    for name, f in data["frames"].items():
        r = f["frame"]
        yield name, img.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]))


def best_windows(im: Image.Image):
    """Densest windows of the alpha channel, not overlapping each other by more than a third."""
    a = im.getchannel("A")
    found = []
    for y in range(0, max(1, im.height - H), STEP):
        for x in range(0, max(1, im.width - W), STEP):
            box = (x, y, x + W, y + H)
            small = im.crop(box).resize((22, 18))
            px = list(small.get_flattened_data()) if hasattr(small, "get_flattened_data") else list(small.getdata())
            cover = sum(p[3] for p in px) / (len(px) * 255)
            # Clouds only: no grass, flowers or straw (green or saturated yellow-brown pixels), no dark
            # lantern hooks or night grass.
            grassy = sum(1 for r, g, b, al in px if al > 128 and (g > r + 8 and g > b + 8 or (r - b > 90 and g - b > 60))) / len(px)
            dark = sum(1 for r, g, b, al in px if al > 128 and r + g + b < 330) / len(px)
            if grassy < 0.03 and dark < 0.01:
                found.append((cover, box))
    found.sort(reverse=True)
    kept = []
    for cover, (x, y, x1, y1) in found:
        if cover < 0.9:
            break
        if all(abs(x - k[0]) > W * 0.66 or abs(y - k[1]) > H * 0.66 for _, k in kept):
            kept.append((cover, (x, y, x1, y1)))
        if len(kept) >= KEEP_PER_FRAME:
            break
    return [b for _, b in kept]


def puff(crop: Image.Image) -> Image.Image:
    """Soft oval edge so a rectangular crop reads as a cloud clump."""
    mask = Image.new("L", crop.size, 0)
    ImageDraw.Draw(mask).ellipse((10, 8, crop.width - 10, crop.height - 8), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(12))
    out = crop.copy()
    alpha = Image.composite(crop.getchannel("A"), Image.new("L", crop.size, 0), mask)
    out.putalpha(alpha)
    return out


def main():
    clumps = []
    sources = [("world10_rings", n) for n in ("ring/sun/front", "ring/moon/front", "ring/sun/back", "ring/moon/back")]
    sources += [(f"world10_floor_{t}_{s}", None) for t in ("t1", "t2", "t4") for s in ("L", "R")]  # t3 (night) has grass all along its clouds
    for atlas, only in sources:
        if not (ART / f"{atlas}@2x.json").exists():
            continue
        for name, im in frames(atlas):
            if only and name != only:
                continue
            for box in best_windows(im):
                clumps.append(puff(im.crop(box)))
    rows = (len(clumps) + COLS - 1) // COLS
    sheet = Image.new("RGBA", (COLS * (W + 2), rows * (H + 2)), (0, 0, 0, 0))
    meta = {"frames": {}, "meta": {"size": {"w": sheet.width, "h": sheet.height}, "scale": "2"}}
    for i, c in enumerate(clumps):
        x, y = (i % COLS) * (W + 2), (i // COLS) * (H + 2)
        sheet.paste(c, (x, y))
        meta["frames"][f"sea/cloud{i}"] = {"frame": {"x": x, "y": y, "w": W, "h": H}}
    sheet.save(ART / "sea_clouds.webp", "WEBP", quality=82, method=6)
    (ART / "sea_clouds.json").write_text(json.dumps(meta, indent=1) + "\n")
    print(f"{len(clumps)} cụm mây → assets/art/sea_clouds.webp ({sheet.width}×{sheet.height})")


if __name__ == "__main__":
    main()
