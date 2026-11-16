"""Render một dòng chậu: mỗi cấp một ảnh PNG nền trong suốt, kèm ảnh so sánh và manifest PixiJS.

Cách chạy (không cần mở giao diện Blender):
  blender -b --factory-startup -P render_line.py -- --line ../lines/phuong_hoang.json --out ../out
Tùy chọn:
  --levels milestones | 1-50 | 1,5,10    (mặc định: milestones)
  --samples 96   --res 1024   --game-res 512
"""
import json
import os
import sys
import time

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import importlib  # noqa: E402

import potlib as P  # noqa: E402

P = importlib.reload(P)  # chạy lại trong cùng phiên Blender vẫn nhận code mới


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    a = {"line": os.path.join(HERE, "..", "lines", "phuong_hoang.json"),
         "style": os.path.join(HERE, "..", "style", "studio.json"),
         "out": os.path.join(HERE, "..", "out"), "levels": "milestones",
         "samples": None, "res": None, "game_res": 512}
    i = 0
    while i < len(argv):
        k = argv[i].lstrip("-").replace("-", "_")
        a[k] = argv[i + 1]
        i += 2
    return a


def level_table(line):
    """Mỗi cấp 1..max ứng với (mốc tiến hóa, tiến độ p tới mốc kế tiếp)."""
    ms = sorted(line["milestones"], key=lambda m: m["level"])
    top = line["max_level"]
    table = {}
    for idx, m in enumerate(ms):
        a = m["level"]
        b = ms[idx + 1]["level"] if idx + 1 < len(ms) else top + 1
        for L in range(a, min(b, top + 1)):
            table[L] = (idx, m, (L - a) / max(1, b - a))
    return table


def parse_levels(spec, line, table):
    if spec == "milestones":
        return [m["level"] for m in line["milestones"]]
    out = []
    for chunk in spec.split(","):
        if "-" in chunk:
            x, y = chunk.split("-")
            out += list(range(int(x), int(y) + 1))
        else:
            out.append(int(chunk))
    return [L for L in out if L in table]


# ---------------------------------------------------------- xử lý ảnh (numpy) ---

def load_rgba(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    arr = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(arr)
    bpy.data.images.remove(img)
    return arr.reshape(h, w, 4)


def save_rgba(path, arr):
    h, w, _ = arr.shape
    img = bpy.data.images.new("tmp_save", w, h, alpha=True)
    img.pixels.foreach_set(np.clip(arr, 0, 1).astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def downscale(arr, f):
    """Thu nhỏ theo hệ số nguyên, lọc hộp trên màu đã nhân alpha (không viền đen)."""
    if f == 1:
        return arr
    h, w, _ = arr.shape
    a = arr[: h - h % f, : w - w % f]
    pre = a.copy()
    pre[..., :3] *= pre[..., 3:4]
    small = pre.reshape(h // f, f, w // f, f, 4).mean(axis=(1, 3))
    alpha = small[..., 3:4]
    small[..., :3] = np.where(alpha > 1e-4, small[..., :3] / np.maximum(alpha, 1e-4), 0.0)
    return small


def over_bg(arr, bg):
    out = np.empty_like(arr)
    out[..., :3] = arr[..., :3] * arr[..., 3:4] + np.array(bg) * (1 - arr[..., 3:4])
    out[..., 3] = 1.0
    return out


def contact_sheet(tiles, cols, cell, bg, gap=8):
    """tiles: danh sách mảng RGBA cùng kích thước `cell`. Thứ tự: trái→phải, trên→dưới."""
    rows = (len(tiles) + cols - 1) // cols
    W = cols * cell + (cols + 1) * gap
    H = rows * cell + (rows + 1) * gap
    sheet = np.ones((H, W, 4), dtype=np.float32)
    sheet[..., :3] = bg
    for k, t in enumerate(tiles):
        r, c = divmod(k, cols)
        y0 = H - (gap + (r + 1) * cell + r * gap)  # ảnh Blender đếm hàng từ dưới lên
        x0 = gap + c * (cell + gap)
        sheet[y0:y0 + cell, x0:x0 + cell] = over_bg(t, bg)
    return sheet


# ------------------------------------------------------------------- chính ---

def main():
    a = parse_args()
    line = json.load(open(a["line"], encoding="utf-8"))
    style = json.load(open(a["style"], encoding="utf-8"))
    if a["samples"]:
        style["samples"] = int(a["samples"])
    if a["res"]:
        style["resolution"] = int(a["res"])
    res = style.get("resolution", 1024)
    game_res = int(a["game_res"])
    out = os.path.abspath(os.path.join(a["out"], line["id"]))
    dirs = {k: os.path.join(out, k) for k in ("master", "game", "preview")}
    for d in dirs.values():
        os.makedirs(d, exist_ok=True)

    table = level_table(line)
    levels = parse_levels(a["levels"], line, table)
    device = P.setup_scene(style)
    mats = P.build_materials(line)
    status_path = os.path.join(out, "status.json")
    print(f"[potgen] dòng={line['id']} cấp={levels} thiết bị={device}", flush=True)

    done = []
    t_all = time.time()
    for L in levels:
        idx, m, p = table[L]
        t0 = time.time()
        n = P.build_pot(line, mats, m, p, seed=L)
        path = os.path.join(dirs["master"], f"lvl_{L:02d}.png")
        bpy.context.scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        dt = time.time() - t0
        done.append({"level": L, "milestone": m["level"], "tier": idx + 1, "title": m["title"],
                     "progress": round(p, 3), "objects": n, "seconds": round(dt, 1)})
        print(f"[potgen] cấp {L:>2} (mốc {m['level']} {m['title']}, p={p:.2f}) "
              f"{n} vật thể, {dt:.1f}s", flush=True)
        json.dump({"state": "rendering", "done": len(done), "total": len(levels),
                   "device": device, "last": done[-1]}, open(status_path, "w", encoding="utf-8"),
                  ensure_ascii=False)

    anchor = P.anchor_of_ground(bpy.context.scene)

    # Bản dùng trong game + ảnh so sánh
    bg = [1.0, 0.965, 0.89]  # nền kem #FFF6E3 (giá trị sRGB, cùng không gian với ảnh PNG)
    f_game = max(1, res // game_res)
    tiles_all, tiles_ms = [], []
    for d in done:
        L = d["level"]
        full = load_rgba(os.path.join(dirs["master"], f"lvl_{L:02d}.png"))
        game = downscale(full, f_game)
        save_rgba(os.path.join(dirs["game"], f"lvl_{L:02d}.png"), game)
        tiles_all.append(downscale(full, max(1, res // 256)))
        if L == d["milestone"]:
            tiles_ms.append(downscale(full, max(1, res // 512)))
    if tiles_ms:
        save_rgba(os.path.join(dirs["preview"], "milestones.png"),
                  contact_sheet(tiles_ms, min(5, len(tiles_ms)), tiles_ms[0].shape[0], bg))
    if len(tiles_all) > len(tiles_ms):
        save_rgba(os.path.join(dirs["preview"], "all_levels.png"),
                  contact_sheet(tiles_all, 10, tiles_all[0].shape[0], bg))

    # Manifest cho PixiJS (Assets.init({ manifest })) + siêu dữ liệu cho game
    rel = f"assets/pots/{line['id']}"
    manifest = {
        "schema": "phuba.pot-line/1",
        "id": line["id"], "name": line["name"], "max_level": line["max_level"],
        "frame": {"width": game_res, "height": game_res, "anchor": {"x": anchor[0], "y": anchor[1]}},
        "render": {"engine": "CYCLES", "device": device, "samples": style.get("samples"),
                   "resolution": res, "camera": "ortho", "ortho_scale": style.get("ortho_scale"),
                   "tilt_deg": style.get("tilt_deg"), "style": os.path.basename(a["style"])},
        "levels": [{"level": d["level"], "tier": d["tier"], "milestone": d["milestone"],
                    "title": d["title"], "alias": f"pot.{line['id']}.{d['level']}",
                    "src": f"{rel}/lvl_{d['level']:02d}.png"} for d in done],
        "pixi": {"bundles": [{"name": f"pot-{line['id']}",
                              "assets": [{"alias": f"pot.{line['id']}.{d['level']}",
                                          "src": f"{rel}/lvl_{d['level']:02d}.png"} for d in done]}]},
    }
    json.dump(manifest, open(os.path.join(out, "manifest.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    json.dump({"state": "done", "done": len(done), "total": len(levels), "device": device,
               "seconds": round(time.time() - t_all, 1), "levels": done},
              open(status_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"[potgen] XONG {len(done)} cấp trong {time.time() - t_all:.0f}s → {out}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception:  # in đầy đủ lỗi ra log để đọc được khi chạy nền
        import traceback
        traceback.print_exc()
        sys.stdout.flush()
        sys.exit(1)
