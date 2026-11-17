"""Seamless vine segment from 2_cay-leo/than-cay.png (chỉ thị 10 § 2.3).

1. White background removed (cutout.cut_white).
2. The trunk silhouette (left/right edge per row) is estimated from clean rows and smoothed; leaves,
   buds and the lantern sticking out of it are cut away.
3. Where those attachments overlap the bark inside the silhouette, the hole is patched with the trunk's
   own bark from another height (same columns), chosen by the best match of the surrounding ring.
4. The segment [START, START+LEN) is taken; its top 12 % is cross-faded with the rows that continue below
   its bottom, so stacked copies join without a seam.
"""
import numpy as np
from PIL import Image
from scipy import ndimage

from cutout import cut_white

START, LEN, BLEND = 670, 330, 0.3
PERIOD = 330  # one twist of the strands, measured by correlation of the bark (tools/art/README)
# attachments overlapping the bark: (x0, y0, x1, y1) in source px
PATCHES = [(420, 606, 470, 668), (396, 660, 452, 808), (216, 690, 262, 808)]


# rows where leaves, buds or the lantern touch the bark: the edge there is interpolated from clean rows
EXCLUDE_R = [(140, 315), (400, 570), (595, 815)]
EXCLUDE_L = [(245, 430), (680, 815)]


def silhouette(alpha):
    H = alpha.shape[0]
    L = np.full(H, np.nan)
    R = np.full(H, np.nan)
    for y in range(H):
        xs = np.where(alpha[y] > 200)[0]
        if len(xs) == 0:
            continue
        runs = np.split(xs, np.where(np.diff(xs) > 2)[0] + 1)
        r = max(runs, key=len)
        if 150 <= len(r) <= 250:  # a clean row: one bark run of normal width
            L[y], R[y] = r[0], r[-1]
    for y0, y1 in EXCLUDE_R:
        R[y0:y1] = np.nan
    for y0, y1 in EXCLUDE_L:
        L[y0:y1] = np.nan
    idx = np.arange(H)
    okL, okR = ~np.isnan(L), ~np.isnan(R)
    L = np.interp(idx, idx[okL], L[okL])
    R = np.interp(idx, idx[okR], R[okR])
    L = ndimage.median_filter(L, 21)
    R = ndimage.median_filter(R, 21)
    return ndimage.gaussian_filter1d(L, 6), ndimage.gaussian_filter1d(R, 6)


def build(src_path):
    rgba = np.asarray(cut_white(Image.open(src_path))).astype(np.float32)
    H, W = rgba.shape[:2]
    L, R = silhouette(rgba[..., 3])
    xx = np.arange(W)[None, :]
    inside = np.clip(np.minimum(xx - (L[:, None] - 1.5), (R[:, None] + 1.5) - xx), 0, 1)
    rgba[..., 3] *= inside
    # patch overlaps with bark from another height
    hole = np.zeros((H, W), bool)
    for x0, y0, x1, y1 in PATCHES:
        hole[y0:y1, x0:x1] = True
    hole &= inside > 0.5
    # each hole is filled from the same columns one twist above or below (same phase of the braid),
    # with a wide feather so no rectangle edge shows
    for x0, y0, x1, y1 in PATCHES:
        m = hole[y0:y1, x0:x1]
        if not m.any():
            continue
        for dy in ((-2 * PERIOD, PERIOD, -PERIOD) if y0 >= 2 * PERIOD else (PERIOD, -PERIOD)):
            if 0 <= y0 + dy and y1 + dy <= H and not hole[y0 + dy:y1 + dy, x0:x1].any():
                break
        else:
            raise SystemExit(f"no clean source for {x0, y0, x1, y1}")
        # feather inward from the patch border so the patch fades into the original bark over 10 px
        inner = ndimage.distance_transform_edt(np.pad(m, 1, constant_values=False))[1:-1, 1:-1]
        feather = np.clip(inner / 10.0, 0, 1)[..., None]
        src = rgba[y0 + dy:y1 + dy, x0:x1].copy()
        cur = rgba[y0:y1, x0:x1]
        mixed = cur * (1 - feather) + src * feather
        mixed[..., 3] = (cur[..., 3] * (1 - feather[..., 0]) + src[..., 3] * feather[..., 0]) * (inside[y0:y1, x0:x1] > 0.5)
        rgba[y0:y1, x0:x1] = mixed
        print("patch", (x0, y0, x1, y1), "from dy", dy)
    # match the silhouette at the joint: each row of the segment is stretched horizontally by a linear
    # ramp (0 at the top, full at the bottom) so the bottom row has the edges of the row that continues it
    dl = L[START - 1] - L[START + LEN - 1]
    dr = R[START - 1] - R[START + LEN - 1]
    xs = np.arange(W, dtype=np.float32)
    for i in range(LEN):
        y = START + i
        f = i / (LEN - 1)
        l0, r0 = L[y], R[y]
        l1, r1 = l0 + dl * f, r0 + dr * f
        srcx = l0 + (xs - l1) * (r0 - l0) / (r1 - l1)  # where each output x comes from
        row = rgba[y].copy()
        for ch in range(4):
            rgba[y, :, ch] = np.interp(srcx, xs, row[:, ch], left=0, right=0)
    print("edge ramp", round(float(dl), 1), round(float(dr), 1))
    # take the segment; join its bottom to the rows just above its top (what really continues it, one
    # twist earlier) along a minimum-error cut per column (image quilting), 3 px feather
    seg = rgba[START:START + LEN].copy()
    k = int(LEN * BLEND)
    a_ = seg[-k:]
    b_ = rgba[START - k:START]
    pa_rgb = a_[..., :3] * a_[..., 3:4] / 255
    pb_rgb = b_[..., :3] * b_[..., 3:4] / 255
    err = ((pa_rgb - pb_rgb) ** 2).sum(2) + ((a_[..., 3] - b_[..., 3]) ** 2) * 0.5
    ga = np.abs(np.gradient(pa_rgb.mean(2), axis=0)) + np.abs(np.gradient(pb_rgb.mean(2), axis=0))
    err = err + 4.0 * ga ** 2
    # horizontal seam through the overlap: DP from left to right, one row per column, moving <= 1 row
    Wd = err.shape[1]
    cost = err.copy()
    back = np.zeros_like(err, dtype=np.int32)
    for x in range(1, Wd):
        prev = cost[:, x - 1]
        up = np.r_[np.inf, prev[:-1]]
        dn = np.r_[prev[1:], np.inf]
        stack = np.vstack([up, prev, dn])
        arg = stack.argmin(0)
        cost[:, x] += stack.min(0)
        back[:, x] = arg - 1
    path = np.zeros(Wd, dtype=np.int32)
    path[-1] = int(cost[:, -1].argmin())
    for x in range(Wd - 1, 0, -1):
        path[x - 1] = path[x] + back[path[x], x]
    rows = np.arange(k)[:, None]
    w = np.clip((rows - path[None, :] + 2.5) / 5.0, 0, 1)[..., None]  # 0 above the cut -> 1 below it
    pa, pb = a_[..., 3:4] / 255, b_[..., 3:4] / 255
    rgb = (1 - w) * a_[..., :3] * pa + w * b_[..., :3] * pb
    al = (1 - w) * pa + w * pb
    seg[-k:, :, :3] = np.where(al > 1e-3, rgb / np.maximum(al, 1e-3), 0)
    seg[-k:, :, 3:4] = al * 255
    print("seam rows", int(path.min()), int(path.max()), "of", k)
    # final clean-up: paper-white specks and tiny islands left at the edge
    whiteish = seg[..., :3].min(2) > 215
    sat = seg[..., :3].max(2) - seg[..., :3].min(2)
    edge = ndimage.binary_dilation(seg[..., 3] < 10, iterations=4)
    pale_edge = edge & (sat < 30) & (seg[..., :3].mean(2) > 160)
    seg[..., 3] = np.where(whiteish | pale_edge, 0, seg[..., 3])
    lab, n = ndimage.label(seg[..., 3] > 10)
    if n > 1:
        sizes = ndimage.sum(np.ones(lab.shape), lab, range(1, n + 1))
        keep = np.isin(lab, np.where(sizes >= 200)[0] + 1)
        seg[..., 3] = np.where(keep, seg[..., 3], 0)
    img = Image.fromarray(seg.clip(0, 255).round().astype(np.uint8), "RGBA")
    bb = img.getbbox()
    img = img.crop((bb[0], 0, bb[2], LEN))
    axis = float(np.median((L + R)[START:START + LEN] / 2)) - bb[0]
    return img, axis
