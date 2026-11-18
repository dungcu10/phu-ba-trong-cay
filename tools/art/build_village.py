"""Chỉ thị 11 TỔNG · N1 — village, sky and pet art from PhuBa_BoHinh_v1 (tools/art/src). Re-runnable:

  /tmp/aienv/bin/python tools/art/build_village.py [--only sky,houses,pets,misc]

Allowed processing only (chỉ thị 11 § C1, § L): background removal by flood fill from the edges, soft
edges and defringing, cutting sheets, upscaling (Real-ESRGAN for cut-outs, Lanczos for the sky),
smoothstep alpha where two sky pictures overlap. Nothing is drawn.

Output (assets/art):
  village_sky<N>.webp  N = 0..4: the village ground (0) and the four skies, 1600 px wide. Skies 1..4 carry
                       a smoothstep alpha over their bottom 12 % so each one fades into the one below.
  village.json         sky sizes and overlap, house anchors.
  world10_houses@2x/@1x  8 houses (bottom-centre of the grass block as anchor).
  world10_pets@2x/@1x    fox, dragon, sparrow × stand, run, sleep, happy (the kitten is world/pet/cloud-cat).
  world10_village@2x/@1x wooden sign, scaffold, fishing rod, Xu Xu builder and fisher.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build import OUT, SRC, build_sheet, centre, lowest_point, write_atlas  # noqa: E402

SKY_W = 1600  # px; the world is drawn 1300 pt wide, the sky a little wider for parallax
OVERLAP = 0.12
SKIES = [
    "nen0_mat-dat-lang",
    "nen1_troi-thap_tang1-5",
    "nen2_troi-vang_tang6-10",
    "nen3_hoang-hon-tim_tang11-15",
    "nen4_thien-gioi-dem_tang16-20",
]
HOUSE_PT = 250  # widest side of a house, points
PET_PT = 150  # widest side of a pet, points (the garden draws them smaller; the pet window uses it whole)
HOUSES = [
    ("nha_to1_cho-lo-xuong-tram.png", ["market", "kiln", "workshop", "balloon"]),
    ("nha_to2_thap-chim-thu-cung-dinh-cong.png", ["birds", "pets", "hall", "gate"]),
]
# White paper seen through gaps (scaffold poles, sign boards, birdcages) is enclosed: remove smaller holes.
HOLES = {"hole_area": 40}
PETS = ["fire-fox", "jade-dragon", "sprout-sparrow"]
POSES = ["stand", "run", "sleep", "happy"]


def bottom_anchor(im, _name=None):
    return lowest_point(im)


def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def build_sky(meta):
    sizes = []
    for i, name in enumerate(SKIES):
        im = Image.open(os.path.join(SRC, "6_lang-va-bau-troi", name + ".png")).convert("RGB")
        k = SKY_W / im.width
        big = im.resize((SKY_W, round(im.height * k)), Image.LANCZOS)
        if im.width < 1000:
            # nen3 and nen4 are only 687 px wide: a light blur hides the enlarged grain (far sky may be soft)
            big = big.filter(ImageFilter.GaussianBlur(0.8))
        rgba = big.convert("RGBA")
        if i > 0:
            # fade the bottom 12 % into the picture below (smoothstep)
            h = rgba.height
            band = round(h * OVERLAP)
            a = np.full(h, 255.0)
            t = np.linspace(1, 0, band)
            a[h - band:] = 255 * smoothstep(t)
            alpha = Image.fromarray(np.repeat(a[:, None], rgba.width, 1).round().astype(np.uint8), "L")
            rgba.putalpha(alpha)
        out = f"village_sky{i}.webp"
        rgba.save(os.path.join(OUT, out), "WEBP", quality=86, method=6)
        sizes.append({"image": out, "w": rgba.width, "h": rgba.height})
        print(f"  sky{i} {rgba.width}x{rgba.height}", flush=True)
    meta["sky"] = {"overlap": OVERLAP, "pictures": sizes, "scale": 1}


def build_houses(meta):
    ents = {}
    for fname, names in HOUSES:
        got = build_sheet(os.path.join(SRC, "6_lang-va-bau-troi", fname), names, HOUSE_PT, bottom_anchor, by="w", grid=(2, 2), cut_kw=HOLES)
        ents.update({f"house/{k}": v for k, v in got.items()})
    write_atlas("houses", ents)
    meta["houses"] = sorted(k[6:] for k in ents)


def build_pets(meta):
    names = [f"{p}/{q}" for p in PETS for q in POSES]
    got = build_sheet(os.path.join(SRC, "4_nhan-vat", "thu-cung_cao-rong-se.png"), names, PET_PT, bottom_anchor, grid=(4, 3), cut_kw={"tol": 26.0, "grow_tol": 40.0, "hole_area": 600})
    write_atlas("pets", {f"pet/{k}": v for k, v in got.items()})
    meta["pets"] = PETS


def build_misc(meta):
    ents = {}
    signs = build_sheet(os.path.join(SRC, "7_bieu-tuong", "to6_bien-go-gian-giao-can-cau.png"), ["sign", "scaffold", "rod"], 200, bottom_anchor, cut_kw=HOLES)
    ents.update({f"village/{k}": v for k, v in signs.items()})
    xx = build_sheet(os.path.join(SRC, "4_nhan-vat", "xu-xu_tho-xay-va-cau-ca.png"), ["builder", "fisher"], 130, bottom_anchor, by="h", cut_kw={"hole_area": 300})
    ents.update({f"xuxu/{k}": v for k, v in xx.items()})
    write_atlas("village", ents)


def main():
    only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else None
    want = lambda k: only is None or k in only  # noqa: E731
    mp = os.path.join(OUT, "village.json")
    meta = json.load(open(mp)) if os.path.exists(mp) else {}
    for key, fn in (("sky", build_sky), ("houses", build_houses), ("pets", build_pets), ("misc", build_misc)):
        if want(key):
            print(key, flush=True)
            fn(meta)
            json.dump(meta, open(mp, "w"), indent=1)


if __name__ == "__main__":
    main()
