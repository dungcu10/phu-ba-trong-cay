"""Post-processing of the AI images (ART_STYLE_GUIDE 10). The developer does NOT create art:
this only removes the flat background, cuts sheets into frames, resizes and packs atlases.

Input:  assets/art-src/*.jpg  (originals from Leonardo AI, unchanged)
Output: assets/art/*.png + *.json (PixiJS spritesheets) and assets/art/sky.jpg
Run:    python3 tools/process_art.py [--preview DIR]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "art-src"
OUT = ROOT / "assets" / "art"


# ---------------------------------------------------------------- background removal

def background_model(rgb: np.ndarray, border: int = 24) -> np.ndarray:
    """Fits a smooth quadratic colour surface to the image border (the flat grey backdrop)."""
    h, w, _ = rgb.shape
    ys, xs = np.mgrid[0:h, 0:w]
    mask = np.zeros((h, w), bool)
    mask[:border] = mask[-border:] = True
    mask[:, :border] = mask[:, -border:] = True
    x, y = xs[mask] / w, ys[mask] / h
    A = np.stack([np.ones_like(x), x, y, x * x, y * y, x * y], 1)
    xf, yf = xs / w, ys / h
    full = np.stack([np.ones_like(xf), xf, yf, xf * xf, yf * yf, xf * yf], -1)
    bg = np.empty_like(rgb)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(A, rgb[..., c][mask], rcond=None)
        bg[..., c] = full @ coef
    return bg


def cutout(img: Image.Image, t0: float = 16, t1: float = 34, shadow_weight: float = 0.25, min_area: int = 400, fill_solid: bool = False) -> Image.Image:
    """RGBA with the backdrop and soft ground shadows removed.

    Colour difference to the backdrop decides opacity. Pixels that are only DARKER than the
    backdrop with the same hue (ground shadows) count much less, so shadows drop out; the
    engine draws its own shadows (ART_STYLE_GUIDE 2).
    """
    rgb = np.asarray(img.convert("RGB"), dtype=np.float32)
    bg = background_model(rgb)
    diff = rgb - bg
    lum = diff.mean(-1, keepdims=True)
    chroma = diff - lum
    darker = np.minimum(lum, 0)
    brighter = np.maximum(lum, 0)
    d = np.sqrt((chroma ** 2).sum(-1) * 2.2 + (brighter[..., 0] * 1.0) ** 2 + (darker[..., 0] * shadow_weight) ** 2)
    alpha = np.clip((d - t0) / (t1 - t0), 0, 1)
    solid = alpha > 0.5
    solid = ndimage.binary_opening(solid, iterations=1)
    labels, n = ndimage.label(solid)
    sizes = ndimage.sum(solid, labels, range(1, n + 1))
    keep = np.isin(labels, [i + 1 for i, s in enumerate(sizes) if s >= min_area])
    keep = ndimage.binary_dilation(keep, iterations=2)
    # Fill only small holes (specular spots inside an object); large enclosed gaps, such as
    # sky between leaves and trunk, stay transparent.
    holes = ndimage.binary_fill_holes(keep) & ~keep
    hl, hn = ndimage.label(holes)
    if hn:
        hs = ndimage.sum(holes, hl, range(1, hn + 1))
        keep |= np.isin(hl, [i + 1 for i, s in enumerate(hs) if s < 300])
    if fill_solid:
        # Objects with pale, backdrop-coloured areas inside (cloud underside): fill fully.
        keep = ndimage.binary_fill_holes(keep)
        alpha = np.maximum(alpha, ndimage.binary_erosion(keep, iterations=4).astype(np.float32))
    alpha = np.where(keep, alpha, 0)
    # Un-mix the backdrop colour from semi-transparent edge pixels (no grey halo).
    a = alpha[..., None]
    fg = np.where(a > 0.02, (rgb - bg * (1 - a)) / np.maximum(a, 0.02), rgb)
    out = np.dstack([np.clip(fg, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


# ---------------------------------------------------------------- slicing

def segments(rgba: Image.Image, min_gap: int = 6, min_width: int = 20, splits: tuple[int, ...] = ()) -> list[tuple[int, int]]:
    """Horizontal extents of separate objects in a sheet (columns with no opaque pixels split).
    `splits` forces a cut at given x positions where two drawings touch."""
    a = np.asarray(rgba)[..., 3] > 40
    cols = a.any(0)
    segs, start, gap = [], None, 0
    for x, c in enumerate(cols):
        if c:
            if start is None:
                start = x
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                segs.append((start, x - gap + 1))
                start, gap = None, 0
    if start is not None:
        segs.append((start, len(cols)))
    for cut in splits:
        segs = [p for s0, s1 in segs for p in (((s0, cut), (cut, s1)) if s0 < cut < s1 else ((s0, s1),))]
    return [s for s in segs if s[1] - s[0] >= min_width]


def crop_x(rgba: Image.Image, x0: int, x1: int) -> Image.Image:
    part = rgba.crop((x0, 0, x1, rgba.height))
    bbox = part.getbbox()
    return part.crop(bbox) if bbox else part


def fit(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    k = min(max_w / img.width, max_h / img.height, 1.0)
    return img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)


def bottom_canvas(img: Image.Image, w: int, h: int, scale: float) -> Image.Image:
    """Places img (scaled) bottom-centred on a w×h transparent canvas: anchor = base centre."""
    im = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
    if im.width > w or im.height > h:
        im = fit(im, w, h)
    c = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    c.alpha_composite(im, ((w - im.width) // 2, h - im.height))
    return c


# ---------------------------------------------------------------- what to cut from each source

# Crop sheets have 5–6 drawings; these are the indexes used for stages 0..4
# (seed mound, sprout, young plant, flowering/fruiting, ripe). Chosen by eye, see report.
CROPS = {
    "cherry-tomato": ("C2_ca-chua-bi.jpg", [0, 1, 3, 4, 5], (962,)),
    "cloud-mint": ("C3_bac-ha-may_a.jpg", [0, 1, 2, 3, 5], ()),
    "sky-carrot": ("C4_ca-rot-may.jpg", [0, 1, 2, 3, 4], ()),
    "cloud-strawberry": ("C5_dau-tay-may.jpg", [0, 1, 3, 4, 5], ()),
    "golden-gerbera": ("C6_hoa-dong-tien-vang.jpg", [0, 1, 2, 3, 4], ()),
    "cotton-daisy": ("C1_cuc-bong-gon.jpg", [0, 1, 2, 4, 5], (790,)),
}
CROP_FRAME = (192, 240)

# Background-cut thresholds per sheet: pale pots (porcelain, jade) sit close to the grey backdrop.
POT_CUT = {"porcelain": (7, 15), "jade-lotus": (7, 15), "bronze-tripod": (16, 32)}

POT_SHEETS = {
    "terracotta": "P15_dat-nung_3bac.jpg",
    "porcelain": "P10_bo-gom-su_3bac.jpg",
    "jade-lotus": "P11_sen-ngoc_3bac.jpg",
    "bronze-tripod": "P12_dinh-dong_3bac.jpg",
}  # @2x frame, anchor at bottom centre (plant base)


def crop_frames(previews: list[tuple[str, Image.Image]]) -> dict[str, tuple[Image.Image, tuple[float, float]]]:
    frames = {}
    for key, (fname, pick, splits) in CROPS.items():
        path = SRC / fname
        if not path.exists():
            print(f"  ! thiếu ảnh gốc {fname} — bỏ qua {key}")
            continue
        sheet = cutout(Image.open(path))
        previews.append((key, sheet))
        segs = segments(sheet, splits=splits)
        if len(segs) <= max(pick):
            raise SystemExit(f"{fname}: tìm thấy {len(segs)} hình, cần chỉ số {pick}")
        parts = [crop_x(sheet, *segs[i]) for i in pick]
        # One scale for all stages of a crop so growth reads as real size change.
        scale = min(CROP_FRAME[0] / max(p.width for p in parts), CROP_FRAME[1] / max(p.height for p in parts))
        for stage, p in enumerate(parts):
            frames[f"crops/{key}/{stage}"] = (bottom_canvas(p, *CROP_FRAME, scale), (0.5, 1.0))
        frames[f"items/{key}"] = (fit(parts[-1], 128, 128), (0.5, 0.5))
    return frames


def world_frames(previews: list[tuple[str, Image.Image]]) -> dict[str, tuple[Image.Image, tuple[float, float]]]:
    frames = {}
    # Pot lines (docs/POT_SYSTEM.md): each sheet holds one line's evolution looks, left to right,
    # cut into pots/<line>/<look index>. All looks of a line share one scale so they read as one pot.
    for line, fname in POT_SHEETS.items():
        path = SRC / fname
        if not path.exists():
            print(f"  ! thiếu ảnh gốc {fname} — bỏ qua {line}")
            continue
        sheet = cutout(Image.open(path), shadow_weight=0.0, t0=POT_CUT.get(line, (20, 40))[0], t1=POT_CUT.get(line, (20, 40))[1], fill_solid=True)
        previews.append((f"pot-{line}", sheet))
        segs = segments(sheet, min_gap=10, min_width=120)
        assert len(segs) == 3, f"{fname}: {len(segs)} hình"
        parts = [crop_x(sheet, *s) for s in segs]
        pscale = 200 / max(p.width for p in parts)
        for i, part in enumerate(parts):
            frames[f"pots/{line}/{i}"] = (bottom_canvas(part, 220, 220, pscale), (0.5, 1.0))

    bug = cutout(Image.open(SRC / "B1_bo-rua-may.jpg"))
    previews.append(("bug", bug))
    bsegs = segments(bug)
    assert len(bsegs) == 3, f"bọ: {len(bsegs)} hình"
    bparts = [crop_x(bug, *s) for s in bsegs]
    bscale = 120 / max(p.width for p in bparts[1:])
    # Side view, wings closed (frame 0) / open (frame 1).
    frames["bugs/ladybird/0"] = (bottom_canvas(bparts[1], 120, 100, bscale), (0.5, 0.5))
    frames["bugs/ladybird/1"] = (bottom_canvas(bparts[2], 120, 100, bscale), (0.5, 0.5))
    frames["items/ladybird"] = (fit(bparts[0], 128, 128), (0.5, 0.5))
    return frames


def floor_frames(previews: list[tuple[str, Image.Image]]) -> dict[str, tuple[Image.Image, tuple[float, float]]]:
    frames = {}
    # The ground shadow lies below y = 575 in the 1344×768 original: replace that band with
    # backdrop taken from the bottom rows, so only the cloud and its lanterns remain.
    arr = np.asarray(Image.open(SRC / "F1_tang-may.jpg").convert("RGB")).copy()
    arr[575:] = arr[-12:-11]
    floor = cutout(Image.fromarray(arr), shadow_weight=0.0, t0=14, t1=30, fill_solid=True)
    previews.append(("floor", floor))
    f = floor.crop(floor.getbbox())
    frames["floors/cloud-meadow"] = (fit(f, 2000, 600), (0.5, 0.18))
    trunk = cutout(Image.open(SRC / "V1_than-cay-leo_a.jpg"))
    previews.append(("trunk", trunk))
    t = trunk.crop(trunk.getbbox())
    frames["trunk"] = (fit(t, 700, 1300), (0.5, 1.0))
    return frames


# ---------------------------------------------------------------- packing

def pack(images: dict[str, tuple[Image.Image, tuple[float, float]]], max_w: int, name: str) -> None:
    pad = 2
    items = sorted(images.items(), key=lambda kv: -kv[1][0].height)
    x = y = shelf = 0
    places = {}
    for key, (img, _) in items:
        if x + img.width + pad > max_w:
            x, y, shelf = 0, y + shelf + pad, 0
        places[key] = (x, y)
        x += img.width + pad
        shelf = max(shelf, img.height)
    h = 1
    while h < y + shelf:
        h *= 2
    sheet = Image.new("RGBA", (max_w, h), (0, 0, 0, 0))
    frames = {}
    for key, (img, anchor) in images.items():
        px, py = places[key]
        sheet.alpha_composite(img, (px, py))
        frames[key] = {
            "frame": {"x": px, "y": py, "w": img.width, "h": img.height},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": img.width, "h": img.height},
            "sourceSize": {"w": img.width, "h": img.height},
            "anchor": {"x": anchor[0], "y": anchor[1]},
        }
    sheet.save(OUT / f"{name}.png", optimize=True)
    meta = {"image": f"{name}.png", "format": "RGBA8888", "size": {"w": max_w, "h": h}, "scale": "2"}
    (OUT / f"{name}.json").write_text(json.dumps({"frames": frames, "meta": meta}, indent=1))
    print(f"  {name}: {max_w}x{h}, {len(frames)} khung, {(OUT / f'{name}.png').stat().st_size // 1024} KB")


def make_icons(sky: Image.Image) -> None:
    """Home-screen icons: a square of the sky art with the ripe golden gerbera on it."""
    icons = ROOT / "public" / "icons"
    icons.mkdir(parents=True, exist_ok=True)
    side = sky.height
    base = sky.crop(((sky.width - side) // 2, 0, (sky.width + side) // 2, side)).convert("RGBA")
    sheet = cutout(Image.open(SRC / "C6_hoa-dong-tien-vang.jpg"))
    flower = crop_x(sheet, *segments(sheet)[-1])
    flower = fit(flower, int(side * 0.78), int(side * 0.78))
    base.alpha_composite(flower, ((side - flower.width) // 2, (side - flower.height) // 2 + side // 20))
    for size in (180, 192, 512):
        base.convert("RGB").resize((size, size), Image.LANCZOS).save(icons / f"icon-{size}.png", optimize=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    previews: list[tuple[str, Image.Image]] = []
    pack(crop_frames(previews) | world_frames(previews), 2048, "sprites")
    pack(floor_frames(previews), 2048, "scene")
    sky = Image.open(SRC / "F2_bau-troi.jpg").convert("RGB")
    sky.save(OUT / "sky.jpg", quality=85, optimize=True)
    make_icons(sky)
    if "--preview" in sys.argv:
        pdir = Path(sys.argv[sys.argv.index("--preview") + 1])
        pdir.mkdir(parents=True, exist_ok=True)
        for name, im in previews:
            bgc = Image.new("RGBA", im.size, (40, 170, 120, 255))
            bgc.alpha_composite(im)
            bgc.convert("RGB").resize((im.width // 2, im.height // 2)).save(pdir / f"{name}.jpg")


if __name__ == "__main__":
    main()
