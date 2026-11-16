"""Đóng ảnh chậu render từ Blender thành atlas PixiJS cho game.

- Thu nhỏ mỗi ảnh sao cho THÂN chậu rộng bằng chậu đất nung hiện có (BODY_PX px trong atlas @2x),
  nên mọi dòng chậu đặt vào ô đều cân nhau; cánh, hào quang được phép tràn ra ngoài ô.
- Cắt bỏ vùng trong suốt thừa, đặt anchor = điểm đáy chậu (mặt đất), như frame "pots/terracotta/*".
- Ghi thêm "soil": khoảng cách (px atlas) từ anchor lên mặt đất trồng trong miệng chậu,
  để game đặt cây đúng chỗ với chậu cao/thấp khác nhau.

Dùng:  python pack_pots.py <potgen_dir> <dir_ảnh_master_phuong_hoang> <dir_ảnh_master_catalog> <out_dir>
"""
import json
import math
import os
import sys

from PIL import Image

BODY_PX = 168          # bề rộng thân chậu trong atlas (@2x) ≈ chậu đất nung 200×180
ATLAS_MAX = 4096
PAD = 2


def smooth_profile(pts, per=6):
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(per):
            t = k / per
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2
                                    + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3) for d in (0, 1)))
    out.append(tuple(pts[-1]))
    return out


def V(x, p):
    return x["from"] + (x["to"] - x["from"]) * p if isinstance(x, dict) else x


class Cam:
    """Phép chiếu trực giao của style (ortho_scale, tilt_deg, target_z) → pixel ảnh master."""

    def __init__(self, style, res):
        self.res = res
        self.ppu = res / style["ortho_scale"]
        self.cz = style["target_z"]
        self.ct = math.cos(math.radians(style["tilt_deg"]))

    def y(self, z):
        return self.res / 2 - (z - self.cz) * self.ct * self.ppu


def geometry(profile_pts, scale, ped_h, soil_depth=0.07):
    prof = smooth_profile(profile_pts)
    H = prof[-1][1]
    rmax = max(r for r, _ in prof)
    return {"body_w": 2 * rmax * scale, "soil_z": ped_h + scale * (H - soil_depth)}


def phoenix_jobs(potgen, master_dir):
    line = json.load(open(os.path.join(potgen, "lines", "phuong_hoang.json"), encoding="utf-8"))
    ms = sorted(line["milestones"], key=lambda m: m["level"])
    jobs = []
    for i, m in enumerate(ms):
        a = m["level"]
        b = ms[i + 1]["level"] if i + 1 < len(ms) else line["max_level"] + 1
        for L in range(a, min(b, line["max_level"] + 1)):
            p = (L - a) / max(1, b - a)
            body = next(pt for pt in m["parts"] if pt["type"] == "body")
            ped = next((pt for pt in m["parts"] if pt["type"] == "pedestal"), None)
            g = geometry(line["profiles"][body["profile"]], V(body.get("scale", 1.0), p),
                         V(ped.get("height", 0.28), p) if ped else 0.0)
            jobs.append((f"pots/phoenix/{L}", os.path.join(master_dir, f"lvl_{L:02d}.png"), g))
    return jobs


def catalog_jobs(potgen, master_dir):
    cat = json.load(open(os.path.join(potgen, "lines", "catalog_l50.json"), encoding="utf-8"))
    jobs = []
    for pot in cat["pots"]:
        path = os.path.join(master_dir, f"pot_{pot['id']:02d}.png")
        if not os.path.exists(path):
            continue
        scale = 1.1 if pot["profile"] == "cauldron" else 1.15
        g = geometry(cat["profiles"][pot["profile"]], scale, 0.32)
        jobs.append((f"pots/catalog/{pot['id']:02d}/50", path, g))
    return jobs


def signature_jobs(potgen, master_dir, line_file="signature_all.json"):
    """Bộ 50 chậu đặc trưng: mỗi chậu có hồ sơ + tỉ lệ riêng, có thể đứng trên đế (stand)."""
    cat = json.load(open(os.path.join(potgen, "lines", line_file), encoding="utf-8"))
    jobs = []
    for pot in cat["pots"]:
        path = os.path.join(master_dir, f"pot_{pot['id']:02d}.png")
        if not os.path.exists(path):
            continue
        body = next(pt for pt in pot["parts"] if pt["type"] == "body")
        stand = next((pt for pt in pot["parts"] if pt["type"] in ("stand", "pedestal")), None)
        lift = stand.get("height", 0.22 if stand["type"] == "stand" else 0.28) if stand else 0.0
        profs = {**cat.get("profiles", {}), **pot.get("profiles", {})}
        g = geometry(profs[body["profile"]], body.get("scale", 1.0), lift)
        jobs.append((f"pots/sig/{pot['id']:02d}/50", path, g))
    return jobs


def prepare(jobs, cam):
    frames = []
    for name, path, g in jobs:
        im = Image.open(path).convert("RGBA")
        k = BODY_PX / (g["body_w"] * cam.ppu)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        gx, gy = im.width / 2, cam.y(0.0) * k
        soil_y = cam.y(g["soil_z"]) * k
        bbox = im.getchannel("A").point(lambda a: 255 if a > 3 else 0).getbbox()
        im = im.crop(bbox)
        x0, y0 = bbox[0], bbox[1]
        frames.append({"name": name, "img": im,
                       "anchor": {"x": round((gx - x0) / im.width, 4), "y": round((gy - y0) / im.height, 4)},
                       "soil": round(gy - soil_y, 1)})
    return frames


def pack(frames, page_name, out_dir):
    """Xếp kệ (shelf) theo chiều cao giảm dần; trả về danh sách trang atlas."""
    frames = sorted(frames, key=lambda f: -f["img"].height)
    pages, cur, x, y, row_h, width = [], [], PAD, PAD, 0, PAD
    for f in frames:
        w, h = f["img"].size
        if x + w + PAD > ATLAS_MAX:
            x, y, row_h = PAD, y + row_h + PAD, 0
        if y + h + PAD > ATLAS_MAX:
            pages.append(cur)
            cur, x, y, row_h = [], PAD, PAD, 0
        f["x"], f["y"] = x, y
        cur.append(f)
        x += w + PAD
        row_h = max(row_h, h)
    if cur:
        pages.append(cur)
    written = []
    for pi, page in enumerate(pages):
        W = max(f["x"] + f["img"].width for f in page) + PAD
        H = max(f["y"] + f["img"].height for f in page) + PAD
        sheet = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        data = {"frames": {}, "meta": {"app": "potgen/pack_pots.py", "version": "1",
                                        "image": f"{page_name}{'' if len(pages) == 1 else '_' + str(pi)}.png",
                                        "format": "RGBA8888", "size": {"w": W, "h": H}, "scale": "2"}}
        for f in sorted(page, key=lambda f: f["name"]):
            sheet.paste(f["img"], (f["x"], f["y"]))
            w, h = f["img"].size
            data["frames"][f["name"]] = {"frame": {"x": f["x"], "y": f["y"], "w": w, "h": h}, "rotated": False,
                                         "trimmed": False, "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
                                         "sourceSize": {"w": w, "h": h}, "anchor": f["anchor"], "soil": f["soil"]}
        base = os.path.join(out_dir, data["meta"]["image"][:-4])
        sheet.save(base + ".png", optimize=True)
        json.dump(data, open(base + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        written.append((base, W, H, len(page)))
    return written


def main():
    potgen, ph_dir, cat_dir, out = sys.argv[1:5]
    os.makedirs(out, exist_ok=True)
    style = json.load(open(os.path.join(potgen, "style", "studio.json"), encoding="utf-8"))
    cam = Cam(style, 1024)
    results = []
    if ph_dir != "-":
        results += pack(prepare(phoenix_jobs(potgen, ph_dir), cam), "pots_phoenix", out)
    if cat_dir != "-":
        results += pack(prepare(catalog_jobs(potgen, cat_dir), cam), "pots_catalog", out)
    if len(sys.argv) > 5 and sys.argv[5] != "-":
        results += pack(prepare(signature_jobs(potgen, sys.argv[5]), cam), "pots_signature", out)
    for base, W, H, n in results:
        print(f"{os.path.basename(base)}: {n} hình, {W}×{H}, {os.path.getsize(base + '.png') // 1024} KB")


if __name__ == "__main__":
    main()
