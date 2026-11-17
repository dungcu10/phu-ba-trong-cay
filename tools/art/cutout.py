"""Background removal for the approved art sheets (chỉ thị 10 § 2.2): white backgrounds removed by
flood fill from the picture border with a low threshold (white clouds inside the picture are never
touched), then a 1–2 px soft alpha edge and white defringe.
"""
import numpy as np
from PIL import Image
from scipy import ndimage


def flood_background(rgb, tol=10.0, bg=None):
    """Mask of background pixels connected to the border whose colour is within `tol` of the paper colour."""
    h, w, _ = rgb.shape
    if bg is None:
        border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
        bg = np.median(border, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(2))
    near = dist < tol
    lab, n = ndimage.label(near)
    edge_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    mask = np.isin(lab, list(edge_labels))
    return mask, bg, dist


def enclosed_paper(rgb, bg, bgmask, tol=6.0, min_area=5000, max_std=2.5):
    """Paper enclosed by the subject (e.g. inside a cloud arch): large, flat, near-paper regions not
    reached from the border. Shaded white clouds are never this flat over this many pixels."""
    dist = np.sqrt(((rgb - bg) ** 2).sum(2))
    cand = (dist < tol) & ~bgmask
    lab, n = ndimage.label(cand)
    out = np.zeros_like(bgmask)
    if n == 0:
        return out
    lum = rgb.mean(2)
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        reg = lab[sl] == i
        area = reg.sum()
        if area < min_area:
            continue
        if lum[sl][reg].std() <= max_std:
            out[sl] |= reg
    if out.any() and min_area >= 5000:
        # the hole is a smooth opening; lobes reaching into flat highlights of the surrounding cloud
        # are narrower than this disk and are cut off
        r = 14
        yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
        disk = (xx * xx + yy * yy) <= r * r
        out = ndimage.binary_opening(out, structure=disk)
    return out


def cut_white(img, tol=10.0, soft=1.5, grow_tol=24.0, holes=True, passes=5, hole_area=5000):
    """RGBA cut-out. `grow_tol` lets the fill creep into the faint halo right at the border of the subject
    (pixels within grow_tol that touch the filled background), which removes the paper glow."""
    rgb = np.asarray(img.convert("RGB")).astype(np.float32)
    bgmask, bg, dist = flood_background(rgb, tol)
    holes_mask = enclosed_paper(rgb, bg, bgmask, min_area=hole_area) if holes else None
    if holes_mask is not None:
        bgmask |= holes_mask
    # creep: a few passes into neighbouring near-paper pixels (the paper glow at every edge)
    for _ in range(passes):
        ring = ndimage.binary_dilation(bgmask) & ~bgmask & (dist < grow_tol)
        if not ring.any():
            break
        bgmask |= ring
    # soft edge: distance into the subject, 0..soft px
    inside = ~bgmask
    d = ndimage.distance_transform_edt(inside)
    alpha = np.clip(d / soft, 0, 1)
    # defringe: un-mix the paper colour from edge pixels (a < 1)
    a3 = np.maximum(alpha, 1e-3)[:, :, None]
    fg = np.where(alpha[:, :, None] < 0.999, ((rgb - (1 - a3) * bg) / a3).clip(0, 255), rgb)
    # edge pixels that are still near-white after un-mixing are paper glow: fade them
    whiteish = (fg.min(2) > 235) & (alpha < 1)
    alpha = np.where(whiteish, alpha * 0.3, alpha)
    out = np.dstack([fg, alpha * 255]).round().astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def components(rgba, min_area=400, pad=2):
    """Separate pieces of a sheet: bounding boxes of opaque components, merged when they touch."""
    a = np.asarray(rgba)[:, :, 3] > 20
    a = ndimage.binary_dilation(a, iterations=pad)
    lab, n = ndimage.label(a)
    boxes = []
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        if sl is None:
            continue
        area = (lab[sl] == i).sum()
        if area >= min_area:
            boxes.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop, area))
    return boxes


def check_on(rgba, colour):
    """Preview on a plain sky colour (dark night / pink dusk) to spot white fringes and holes."""
    bg = Image.new("RGBA", rgba.size, colour + (255,))
    bg.alpha_composite(rgba)
    return bg.convert("RGB")


def paper_shadow_to_dark(rgba, sat_max=14, lum_min=196, color=(46, 30, 70), strength=2.6):
    """A soft shadow painted on white paper (under the pedestals) becomes a real translucent shadow:
    near-white grey pixels turn dark with alpha from how much darker than paper they were."""
    a = np.asarray(rgba).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3]
    sat = rgb.max(2) - rgb.min(2)
    lum = rgb.mean(2)
    paperish = (sat < sat_max) & (lum > lum_min)
    # the object itself = everything above the lowest coloured pixel of its column (per piece), so a
    # white moon-stone top stays; only what lies under the piece is shadow
    core = np.zeros_like(paperish)
    lab, n = ndimage.label(ndimage.binary_dilation(al > 20, iterations=3))
    coloured = (al > 0) & ~paperish
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        if sl is None:
            continue
        piece = (lab[sl] == i)
        col = coloured[sl] & piece
        h = col.shape[0]
        rows = np.arange(h)[:, None]
        has = col.any(0)
        lowest = np.where(has, h - 1 - np.argmax(col[::-1], axis=0), -1)
        core[sl] |= piece & (rows <= lowest[None, :])
    shadow = paperish & (al > 0) & ~core
    k = np.clip((255 - lum) * strength, 0, 200)
    a[..., :3] = np.where(shadow[..., None], np.array(color, np.float32), rgb)
    a[..., 3] = np.where(shadow, np.minimum(k, al), al)
    return Image.fromarray(a.round().astype(np.uint8), "RGBA")


def recolour_clouds(rgba, region, stops):
    """Clouds painted grey (under the vine root) take the floors' cloud gradient: luminance -> colour ramp.
    Only low-saturation pixels inside `region` (a bool mask) change; the bark is never touched."""
    a = np.asarray(rgba).astype(np.float32)
    rgb = a[..., :3]
    sat = rgb.max(2) - rgb.min(2)
    lum = rgb.mean(2) / 255
    cloud = region & (sat < 28) & (a[..., 3] > 0) & (lum > 0.45)
    pos = np.array([p for p, _ in stops])
    cols = np.array([c for _, c in stops], np.float32)
    out = np.stack([np.interp(lum, pos, cols[:, i]) for i in range(3)], -1)
    soft = ndimage.gaussian_filter(cloud.astype(np.float32), 1.0)[..., None]
    a[..., :3] = rgb * (1 - soft) + out * soft
    return Image.fromarray(a.clip(0, 255).round().astype(np.uint8), "RGBA")
