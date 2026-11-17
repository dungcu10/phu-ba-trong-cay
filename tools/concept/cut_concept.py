"""Cut-outs from the concept: segmentation + colour distance from a locally estimated sky (the pink
clouds of the floors are close to the sky colour, so the model alone makes them see-through)."""
import json, sys
import numpy as np
from PIL import Image
from rembg import remove, new_session
from scipy import ndimage

S = 4
sess = new_session('isnet-general-use')
src = Image.open('out/concept_x4.png').convert('RGB')

def cut(box, out, t0=10.0, t1=34.0, min_comp=4000, drop_edge=False, close=6, fill_holes=True):
    x0, y0, x1, y1 = [v * S for v in box]
    c = src.crop((x0, y0, x1, y1))
    img = np.asarray(c).astype(np.float32)
    seg = np.array(remove(c, session=sess, only_mask=True)).astype(np.float32) / 255
    h, w = seg.shape
    f = 8
    sm = lambda a: np.asarray(Image.fromarray(a).resize((w // f, h // f), Image.BILINEAR)) if a.ndim == 2 else None
    img_s = np.asarray(c.resize((w // f, h // f), Image.LANCZOS)).astype(np.float32)
    seg_s = np.asarray(Image.fromarray((seg * 255).astype(np.uint8)).resize((w // f, h // f), Image.BILINEAR)).astype(np.float32) / 255
    wgt = ndimage.binary_erosion(seg_s < 0.02, iterations=2).astype(np.float32)
    bg_s = np.zeros_like(img_s)
    for ch in range(3):
        acc = np.zeros(img_s.shape[:2]); den = np.zeros(img_s.shape[:2])
        for sg in (6, 14, 30):  # fill holes from near to far
            n = ndimage.gaussian_filter(img_s[:, :, ch] * wgt, sg); d = ndimage.gaussian_filter(wgt, sg)
            fill = den < 0.05
            acc = np.where(fill, n, acc); den = np.where(fill, d, den)
        bg_s[:, :, ch] = acc / (den + 1e-6)
    bg = np.asarray(Image.fromarray(bg_s.clip(0, 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)).astype(np.float32)
    dist = np.sqrt(((img - bg) ** 2).sum(2))
    a_diff = ((dist - t0) / t1).clip(0, 1)
    alpha = np.maximum(seg, a_diff)
    # remove sparkles / far bits: keep components of size >= min_comp
    lab, n = ndimage.label(alpha > 0.25)
    if n:
        sizes = ndimage.sum(np.ones_like(alpha), lab, range(1, n + 1))
        small = np.isin(lab, np.where(sizes < min_comp)[0] + 1)
        grow = ndimage.binary_dilation(small, iterations=3)
        alpha[grow & ~ndimage.binary_dilation(np.isin(lab, np.where(sizes >= min_comp)[0] + 1), iterations=2)] = 0
    # solid inside: shaded cloud bellies are close to the sky colour but are never see-through
    solid = ndimage.binary_closing(alpha > 0.35, iterations=close)
    if fill_holes:
        solid = ndimage.binary_fill_holes(solid)
    solid = ndimage.binary_erosion(solid, iterations=2)
    alpha = np.maximum(alpha, solid.astype(np.float32))
    if drop_edge:  # pieces of neighbours cut by the crop border
        lab, n = ndimage.label(alpha > 0.1)
        if n > 1:
            sizes = ndimage.sum(np.ones_like(alpha), lab, range(1, n + 1))
            main = int(np.argmax(sizes)) + 1
            border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0, main}
            for b in border:
                alpha[lab == b] = 0
    alpha = ndimage.gaussian_filter(alpha, 0.7)
    a3 = np.maximum(alpha, 1e-3)[:, :, None]
    fg = ((img - (1 - a3) * bg) / a3).clip(0, 255)
    fg = np.where(alpha[:, :, None] > 0.98, img, fg)
    out_a = np.dstack([fg, alpha * 255]).astype(np.uint8)
    im = Image.fromarray(out_a, 'RGBA')
    bb = im.getbbox()
    im.crop(bb).save(out)
    return {'crop': [x0 + bb[0], y0 + bb[1]], 'size': im.crop(bb).size}

job = json.load(open(sys.argv[1]))
meta = {}
for name, (box, args) in job.items():
    meta[name] = cut(box, f'out/cut/{name}.png', **args)
    print(name, meta[name], flush=True)
import os
old = json.load(open('out/cut/meta2.json')) if os.path.exists('out/cut/meta2.json') else {}
old.update(meta)
json.dump(old, open('out/cut/meta2.json', 'w'), indent=1)
