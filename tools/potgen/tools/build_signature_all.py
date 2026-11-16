"""Sinh lines/signature_all.json — bộ 50 chậu đặc trưng đã duyệt (5 nhóm x 10).

Chạy: python tools/build_signature_all.py
6 mẫu đã duyệt trước (nấm, bánh kem, mèo, Thanh Hoa, trà sữa, cáo) lấy nguyên từ signature_l50.json.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OLD = json.load(open(os.path.join(ROOT, "lines", "signature_l50.json"), encoding="utf-8"))
OLD_BY = {p["id"]: p for p in OLD["pots"]}


def C(c, **k):
    d = {"color": c, "roughness": 0.35}
    d.update(k)
    return d


def G(a, b, **k):
    d = {"gradient": [[0.0, a], [1.0, b]], "roughness": 0.35}
    d.update(k)
    return d


GOLD = C("#E8B53C", metallic=1.0, roughness=0.22)
GLOW = lambda c, s=6: {"color": c, "emission": c, "emission_strength": s}
GLASS = lambda c, t=0.85: {"color": c, "roughness": 0.05, "transmission": t, "ior": 1.45}

ORB = [[0.22, 0.0], [0.4, 0.05], [0.58, 0.22], [0.63, 0.45], [0.58, 0.7], [0.45, 0.86], [0.43, 0.92], [0.46, 0.96]]
EGG = [[0.25, 0.0], [0.45, 0.05], [0.55, 0.3], [0.53, 0.6], [0.44, 0.82], [0.4, 0.88], [0.42, 0.92]]
URN = [[0.3, 0.0], [0.36, 0.04], [0.4, 0.12], [0.55, 0.35], [0.6, 0.55], [0.55, 0.78], [0.48, 0.88], [0.52, 0.95]]
CUP = [[0.36, 0.0], [0.4, 0.04], [0.5, 0.3], [0.56, 0.6], [0.58, 0.72], [0.6, 0.76]]


def face(z, **k):
    d = {"type": "face", "z": z, "eye": 0.07}
    d.update(k)
    return d


def body(prof, mat="body", scale=1.15, **k):
    d = {"type": "body", "profile": prof, "mat": mat, "scale": scale}
    d.update(k)
    return d


SOIL = {"type": "soil", "mat": "soil"}


def pot(id_, group, name, profiles, materials, parts, ref=None):
    return {"id": id_, "group": group, "name": name, "profiles": profiles, "materials": materials,
            "parts": parts, **({"ref_id": ref} if ref else {})}


def reuse(id_, group, old_id):
    o = dict(OLD_BY[old_id])
    used = {pt["profile"] for pt in o["parts"] if pt["type"] == "body"}
    return pot(id_, group, o["name"], {k: OLD["profiles"][k] for k in used}, o["materials"], o["parts"], old_id)


P = []
F, A, N, K, T = "Đồ ăn", "Linh vật", "Thiên nhiên", "Gốm Á Đông", "Thần thoại"

# ================================================================ ĐỒ ĂN ===
P.append(reuse(1, F, 45))
P.append(reuse(2, F, 37))
P.append(pot(3, F, "Kem Ốc Quế", {"waffle": [[0.3, 0.0], [0.33, 0.03], [0.5, 0.6], [0.56, 0.85], [0.58, 0.9]]},
    {"body": G("#C8863F", "#EAB66C", roughness=0.6), "grid": C("#A86A2C", roughness=0.6),
     "scoop": G("#F48FB1", "#FFC4D8", roughness=0.45, subsurface=0.25), "cherry": C("#D7192F", roughness=0.15, coat=0.8),
     "stem": C("#5C8A2E")},
    [body("waffle"), SOIL,
     {"type": "meridians", "mat": "grid", "count": 14, "twist": 0.9, "radius": 0.014, "z": [0.04, 0.86]},
     {"type": "meridians", "mat": "grid", "count": 14, "twist": -0.9, "radius": 0.014, "z": [0.04, 0.86]},
     {"type": "brim", "mat": "scoop", "width": 0.26, "height": 0.24, "below": 0.02},
     {"type": "drips", "mat": "scoop", "zs": [0.93], "count": 12},
     {"type": "prop", "items": [{"shape": "sphere", "mat": "cherry", "at": [0.38, 0.12, 1.13], "scale": 0.1}]},
     {"type": "path", "mat": "stem", "radius": 0.012, "points": [[0.38, 0.12, 1.22], [0.42, 0.12, 1.32], [0.5, 0.14, 1.38]]},
     face(0.42, eye=0.065)]))
P.append(pot(4, F, "Donut Cầu Vồng", {"donut": [[0.42, 0.0], [0.55, 0.06], [0.62, 0.28], [0.6, 0.5], [0.52, 0.62], [0.5, 0.64]]},
    {"body": G("#D08A45", "#F0C07E", roughness=0.65), "icing": C("#F06FA2", roughness=0.25, coat=0.5),
     "s1": C("#7FC8F8"), "s2": C("#FFD166"), "s3": C("#9EE07A"), "s4": C("#FFFFFF"), "s5": C("#B49CF7")},
    [body("donut"), SOIL, {"type": "drips", "mat": "icing", "zs": [0.9], "count": 18},
     *[{"type": "dots", "mat": m, "count": 6, "size": [0.014, 0.022], "z": [0.78, 0.95], "flat": 2.2, "seed": i}
       for i, m in enumerate(["s1", "s2", "s3", "s4", "s5"])],
     face(0.3, eye=0.065)]))
P.append(pot(5, F, "Bánh Bao", {"bun": [[0.3, 0.0], [0.5, 0.05], [0.62, 0.25], [0.58, 0.48], [0.44, 0.66], [0.26, 0.76], [0.24, 0.78]]},
    {"body": G("#F2E6D6", "#FFFBF4", roughness=0.7, subsurface=0.35), "pleat": C("#E3D2BA", roughness=0.7),
     "mark": C("#E8424E"), "steam": GLASS("#FFFFFF", 0.6)},
    [body("bun"), SOIL, {"type": "meridians", "mat": "pleat", "count": 14, "twist": 0.4, "radius": 0.022, "z": [0.56, 0.98]},
     {"type": "prop", "items": [{"shape": "sphere", "mat": "mark", "surf": [0, 0.62, 0.0], "flat": True, "scale": [0.04, 0.04, 0.012]}]},
     {"type": "path", "mat": "steam", "radius": 0.03, "taper": [1.0, 0.8, 0.2],
      "points": [[0.35, 0.2, 1.0], [0.45, 0.2, 1.2], [0.32, 0.2, 1.38], [0.42, 0.2, 1.55]]},
     face(0.32)]))
P.append(pot(6, F, "Dưa Hấu", {"melon": [[0.25, 0.0], [0.42, 0.04], [0.58, 0.25], [0.66, 0.55], [0.68, 0.68]]},
    {"body": G("#2E8B3E", "#55B85A", roughness=0.4, coat=0.4), "stripe": C("#1E5E2A", roughness=0.4),
     "white": C("#F4F7E8"), "flesh": C("#F2475A", roughness=0.5, subsurface=0.3), "seed": C("#2A1A1A", roughness=0.2)},
    [body("melon"), SOIL, {"type": "meridians", "mat": "stripe", "count": 11, "wave": 0.08, "radius": 0.034, "z": [0.06, 0.85]},
     {"type": "band", "mat": "white", "z": 0.91, "rr": 0.03},
     {"type": "rim", "mat": "flesh", "rr": 0.06},
     {"type": "dots", "mat": "seed", "count": 9, "size": [0.016, 0.02], "z": [0.97, 0.99], "ring": True, "arc": 200},
     face(0.4, eye=0.068)]))
P.append(pot(7, F, "Macaron", {"mac": [[0.5, 0.0], [0.6, 0.04], [0.64, 0.14], [0.6, 0.24], [0.56, 0.27], [0.56, 0.36],
                                       [0.6, 0.39], [0.64, 0.5], [0.6, 0.6], [0.54, 0.64]]},
    {"body": G("#B993EE", "#D9C2FA", roughness=0.5), "cream": C("#FFF4DE", roughness=0.6, subsurface=0.2),
     "feet": C("#A985E0", roughness=0.7)},
    [body("mac", smooth=False), SOIL, {"type": "band", "mat": "cream", "z": 0.49, "rr": 0.06},
     {"type": "band", "mat": "feet", "z": 0.4, "rr": 0.03}, {"type": "band", "mat": "feet", "z": 0.6, "rr": 0.03},
     face(0.78, eye=0.06)]))
P.append(pot(8, F, "Bánh Flan", {"flan": [[0.6, 0.0], [0.6, 0.08], [0.52, 0.52], [0.46, 0.6]]},
    {"body": G("#F2C94C", "#FBE38A", roughness=0.3, subsurface=0.4), "caramel": C("#A0521A", roughness=0.1, coat=1.0),
     "plate": C("#FFFFFF", roughness=0.15, coat=0.6), "mint": C("#58B85C")},
    [body("flan"), SOIL, {"type": "drips", "mat": "caramel", "zs": [0.98], "count": 14},
     {"type": "prop", "items": [{"shape": "cyl", "mat": "plate", "at": [0, 0, -0.01], "abs_z": True, "scale": [0.95, 0.95, 0.04], "ground": True},
                                {"shape": "leaf", "mat": "mint", "at": [0.3, 0.15, 0.95], "rot": [-30, 30, 0], "scale": 0.25}]},
     face(0.32)]))
P.append(pot(9, F, "Sushi Cá Hồi", {"roll": [[0.55, 0.0], [0.6, 0.03], [0.62, 0.1], [0.62, 0.6], [0.6, 0.66]]},
    {"body": C("#FAF7F0", roughness=0.85), "nori": C("#1F3326", roughness=0.6), "salmon": G("#F2793A", "#FFA46A", roughness=0.3, subsurface=0.3),
     "grain": C("#FFFFFF", roughness=0.8), "eye_w": C("#F4F1E8", roughness=0.2)},
    [body("roll"), SOIL,
     {"type": "prop", "items": [{"shape": "cyl", "mat": "nori", "at": [0, 0, 0.12], "scale": [0.73, 0.73, 0.3]}]},
     {"type": "tiles", "mat": "grain", "shape": "sphere", "rows": 2, "cols": 12, "z": [0.68, 0.84], "size": 0.032, "flat": 0.6, "arc": 200},
     {"type": "brim", "mat": "salmon", "width": 0.22, "height": 0.13, "below": 0.0},
     face(0.33, eye_mat="eye_w", eye=0.06)]))
P.append(pot(10, F, "Cupcake", {"wrap": [[0.38, 0.0], [0.4, 0.03], [0.52, 0.55], [0.54, 0.58]]},
    {"body": G("#5AAEE6", "#8FD0FF", roughness=0.5), "pleat": C("#3E8FCC"), "frost": G("#F7A8C4", "#FFE3EE", roughness=0.4, subsurface=0.3),
     "cherry": C("#D7192F", roughness=0.15, coat=0.8)},
    [body("wrap"), SOIL, {"type": "meridians", "mat": "pleat", "count": 18, "radius": 0.018, "z": [0.02, 0.98]},
     {"type": "puffs", "mat": "frost", "balls": [[0.5 * __import__("math").cos(a / 10 * 6.283), 0.5 * __import__("math").sin(a / 10 * 6.283), 1.06, 0.17] for a in range(10)]},
     {"type": "prop", "items": [{"shape": "sphere", "mat": "cherry", "at": [-0.2, 0.3, 1.25], "scale": 0.09}]},
     face(0.42, eye=0.06)]))

# ============================================================== LINH VẬT ===
# Chỉ thị 04 — sửa sau lần render đầu: vành quỹ đạo 1,8 tràn khỏi đáy khung (cắt hình) và xuống dưới mặt đất -> 1,3.
_cat = reuse(11, A, 38)
_cat["parts"] = [dict(pt, scale=1.3) if pt["type"] == "orbit" else pt for pt in _cat["parts"]]
P.append(_cat)
P.append(reuse(12, A, 46))
P.append(pot(13, A, "Thỏ Ngọc", {"orb": ORB},
    {"body": G("#EEF0F8", "#FFFFFF", roughness=0.4, subsurface=0.2), "pink": C("#F7A8C4", roughness=0.5), "moon": GLOW("#FFE08A", 3)},
    [body("orb"), SOIL,
     {"type": "prop", "items": [
         {"shape": "sphere", "mat": "body", "at": [0.2, 0.05, 1.3], "rot": [0, 12, 0], "scale": [0.11, 0.07, 0.36], "mirror": True},
         {"shape": "sphere", "mat": "pink", "at": [0.2, -0.01, 1.3], "rot": [0, 12, 0], "scale": [0.06, 0.04, 0.27], "mirror": True},
         {"shape": "sphere", "mat": "body", "at": [0.62, 0.1, 0.22], "scale": 0.12},
         {"shape": "sphere", "mat": "moon", "at": [-0.75, 0.3, 1.5], "scale": 0.07}]},
     face(0.5)]))
P.append(pot(14, A, "Rồng Con", {"orb": ORB},
    {"body": G("#3FA65A", "#6FCF7E", roughness=0.35, coat=0.4), "belly": C("#DDF2C4", roughness=0.5), "horn": C("#FFD166", roughness=0.3),
     "spike": C("#FF9F43", roughness=0.4), "wing": G("#8EDB8A", "#C8F2A8", roughness=0.4)},
    [body("orb"), SOIL,
     {"type": "prop", "items": [
         {"shape": "sphere", "mat": "belly", "surf": [0, 0.38, -0.02], "flat": True, "scale": [0.36, 0.34, 0.07]},
         {"shape": "horn", "mat": "horn", "at": [0.24, 0.05, 1.04], "rot": [0, 22, 0], "scale": [0.06, 0.06, 0.2], "mirror": True}]},
     {"type": "petals", "mat": "spike", "shape": "blade", "count": 5, "arc": 120, "center": 180, "z": 0.93, "length": 0.2, "width": 0.6, "tilt": -5},
     {"type": "wings", "mat": "wing", "shape": "membrane", "z": 0.65, "count": 3, "layers": 1, "length": 0.45, "spread": [20, 70], "width": 0.5},
     {"type": "path", "mat": "body", "radius": 0.07, "taper": [1.0, 0.7, 0.2],
      "points": [[0.5, 0.2, 0.15], [0.8, 0.15, 0.2], [0.85, 0.1, 0.4], [0.72, 0.05, 0.48]]},
     face(0.6)]))
P.append(pot(15, A, "Cá Koi", {"orb": ORB},
    {"body": C("#FFFFFF", roughness=0.25, coat=0.6), "orange": C("#FF6B2C", roughness=0.25, coat=0.6), "fin": GLASS("#FFB08A", 0.5)},
    [body("orb"), SOIL,
     {"type": "prop", "items": [
         {"shape": "sphere", "mat": "orange", "surf": [-30, 0.72, -0.03], "flat": True, "scale": [0.24, 0.16, 0.06]},
         {"shape": "sphere", "mat": "orange", "surf": [40, 0.2, -0.03], "flat": True, "scale": [0.2, 0.13, 0.06]},
         {"shape": "sphere", "mat": "orange", "surf": [120, 0.6, -0.03], "flat": True, "scale": [0.25, 0.18, 0.06]},
         {"shape": "fin", "mat": "fin", "at": [0.6, -0.05, 0.3], "rot": [0, 120, 0], "scale": 0.35, "mirror": True}]},
     {"type": "petals", "mat": "fin", "shape": "fin", "count": 2, "arc": 40, "center": 120, "z": 0.45, "length": 0.65, "width": 0.7, "tilt": 70},
     {"type": "path", "mat": "orange", "radius": 0.01, "mirror": True, "points": [[0.12, -0.6, 0.38], [0.28, -0.62, 0.3], [0.36, -0.58, 0.2]]},
     face(0.5)]))
P.append(pot(16, A, "Gấu Trúc", {"orb": ORB},
    {"body": C("#FAFAFA", roughness=0.6, subsurface=0.15), "black": C("#262626", roughness=0.5), "eye_w": C("#FFFFFF", roughness=0.1),
     "bamboo": G("#5E9E3A", "#8CCB5E", roughness=0.4), "leaf": C("#6CBF5A")},
    [body("orb"), SOIL,
     {"type": "prop", "items": [
         {"shape": "sphere", "mat": "black", "at": [0.4, 0.0, 1.0], "scale": 0.15, "mirror": True},
         {"shape": "sphere", "mat": "black", "surf": [17, 0.55, -0.01], "flat": True, "rot": None, "scale": [0.1, 0.13, 0.04], "mirror": True},
         {"shape": "sphere", "mat": "black", "surf": [0, 0.43, 0.0], "flat": True, "scale": [0.04, 0.03, 0.02]}]},
     {"type": "path", "mat": "bamboo", "radius": 0.04, "points": [[0.55, -0.1, 0.0], [0.62, -0.1, 0.6], [0.66, -0.08, 1.3]]},
     {"type": "prop", "items": [{"shape": "leaf", "mat": "leaf", "at": [0.66, -0.1, 1.15], "rot": [0, 50, 0], "scale": 0.3},
                                {"shape": "leaf", "mat": "leaf", "at": [0.65, -0.1, 0.9], "rot": [0, -40, 0], "scale": 0.25}]},
     face(0.55, eye_mat="eye_w", gap=17, eye=0.045)]))
P.append(pot(17, A, "Chim Cánh Cụt", {"egg": EGG},
    {"body": G("#1E2750", "#33407A", roughness=0.35), "belly": C("#FFFFFF", roughness=0.5), "beak": C("#FF9F1C", roughness=0.3),
     "scarf": C("#E8424E", roughness=0.6)},
    [body("egg"), SOIL,
     {"type": "prop", "items": [
         {"shape": "sphere", "mat": "belly", "surf": [0, 0.42, -0.03], "flat": True, "scale": [0.36, 0.44, 0.08]},
         {"shape": "cone", "mat": "beak", "surf": [0, 0.58, 0.0], "flat": True, "scale": [0.05, 0.05, 0.1]},
         {"shape": "sphere", "mat": "beak", "at": [0.17, -0.35, 0.02], "abs_z": True, "scale": [0.12, 0.17, 0.04], "mirror": True},
         {"shape": "petal", "mat": "body", "at": [0.5, 0.0, 0.62], "rot": [0, 155, 0], "scale": 0.42, "mirror": True}]},
     {"type": "band", "mat": "scarf", "z": 0.78, "rr": 0.045},
     face(0.67, gap=15, eye=0.06)]))
P.append(pot(18, A, "Ếch Lá Sen", {"squat": [[0.4, 0.0], [0.55, 0.05], [0.62, 0.25], [0.58, 0.45], [0.5, 0.55]]},
    {"body": G("#5DB35A", "#8ED87A", roughness=0.3, coat=0.5), "pad": C("#3E9B48", roughness=0.5), "eye_w": C("#FFFFFF", roughness=0.1),
     "pupil": C("#1F2A1A", roughness=0.05, coat=1.0), "lotus": G("#F48FB1", "#FFE0EC", roughness=0.4)},
    [body("squat"), SOIL,
     {"type": "prop", "items": [
         {"shape": "cyl", "mat": "pad", "at": [0, 0, 0.0], "abs_z": True, "scale": [1.05, 1.0, 0.03], "ground": True},
         {"shape": "sphere", "mat": "body", "at": [0.26, -0.18, 0.66], "scale": 0.17, "mirror": True},
         {"shape": "sphere", "mat": "eye_w", "at": [0.26, -0.3, 0.7], "scale": 0.1, "mirror": True},
         {"shape": "sphere", "mat": "pupil", "at": [0.26, -0.38, 0.7], "scale": 0.055, "mirror": True},
         {"shape": "sphere", "mat": "face_blush", "surf": [40, 0.32, -0.01], "flat": True, "scale": [0.06, 0.04, 0.02], "mirror": True},
         *[{"shape": "petal", "mat": "lotus", "at": [0.72, -0.35, 0.04], "abs_z": True, "rot": [r, 0, a], "scale": 0.22}
           for a, r in ((0, 35), (72, 35), (144, 35), (216, 35), (288, 35), (36, 12), (180, 12))]]},
     {"type": "path", "mat": "pupil", "radius": 0.012, "points": [[-0.16, -0.62, 0.32], [0.0, -0.66, 0.26], [0.16, -0.62, 0.32]]}]))
P.append(pot(19, A, "Cú Mèo", {"egg": EGG},
    {"body": G("#8B5A35", "#B07A4E", roughness=0.6), "feather": C("#D8B48A", roughness=0.6), "disc": C("#FFF3DD", roughness=0.5),
     "iris": C("#F2B33D", roughness=0.1, coat=1.0), "pupil": C("#1F150E", roughness=0.05, coat=1.0), "beak": C("#E08A2E")},
    [body("egg"), SOIL,
     {"type": "tiles", "mat": "feather", "shape": "feather", "rows": 3, "cols": 6, "z": [0.14, 0.4], "arc": 110, "size": 0.15, "width": 0.4},
     {"type": "prop", "items": [
         {"shape": "sphere", "mat": "disc", "surf": [19, 0.64, -0.02], "flat": True, "scale": [0.17, 0.17, 0.05], "mirror": True},
         {"shape": "sphere", "mat": "iris", "surf": [19, 0.64, 0.02], "flat": True, "scale": [0.09, 0.09, 0.04], "mirror": True},
         {"shape": "sphere", "mat": "pupil", "surf": [19, 0.64, 0.05], "flat": True, "scale": [0.05, 0.05, 0.03], "mirror": True},
         {"shape": "cone", "mat": "beak", "surf": [0, 0.52, 0.0], "flat": True, "scale": [0.05, 0.05, 0.09]},
         {"shape": "feather", "mat": "body", "at": [0.3, 0.0, 0.98], "rot": [0, 22, 0], "scale": 0.3, "mirror": True}]}]))
P.append(pot(20, A, "Heo Đất", {"pig": [[0.3, 0.0], [0.5, 0.05], [0.66, 0.3], [0.62, 0.55], [0.48, 0.72], [0.44, 0.76]]},
    {"body": G("#F48FB1", "#FFC2D6", roughness=0.25, coat=0.6), "snout": C("#F07AA0", roughness=0.3), "nostril": C("#A8405F"),
     "coin": GOLD},
    [body("pig"), SOIL,
     {"type": "prop", "items": [
         {"shape": "cyl", "mat": "snout", "surf": [0, 0.36, -0.03], "flat": True, "scale": [0.15, 0.11, 0.09]},
         {"shape": "sphere", "mat": "nostril", "surf": [5, 0.36, 0.06], "flat": True, "scale": [0.025, 0.035, 0.02], "mirror": True},
         {"shape": "blade", "mat": "body", "at": [0.3, 0.0, 0.94], "rot": [-15, 28, 0], "scale": 0.26, "mirror": True},
         {"shape": "cyl", "mat": "body", "at": [0.3, -0.18, 0.0], "abs_z": True, "scale": [0.1, 0.1, 0.08], "mirror": True},
         {"shape": "coin", "mat": "coin", "at": [-0.45, -0.1, 1.0], "rot": [0, 25, 0], "scale": 0.2}]},
     {"type": "path", "mat": "body", "radius": 0.02, "points": [[0.6, 0.25, 0.4], [0.75, 0.25, 0.42], [0.72, 0.28, 0.52], [0.8, 0.3, 0.5]]},
     face(0.56, gap=26, eye=0.06)]))

# =========================================================== THIÊN NHIÊN ===
P.append(reuse(21, N, 9))
P.append(pot(22, N, "Vỏ Sò Ngọc Trai", {"cup": CUP},
    {"body": G("#F8D5E0", "#FFF0F5", roughness=0.15, metallic=0.25, coat=1.0), "shell": G("#F2A7BE", "#FFE6EE", roughness=0.3, coat=0.6),
     "pearl": C("#FFFDF8", roughness=0.08, metallic=0.3, coat=1.0)},
    [body("cup"), SOIL,
     {"type": "petals", "mat": "shell", "shape": "petal", "count": 9, "arc": 170, "center": 180, "z": 0.25, "length": 1.0, "width": 0.5, "tilt": 12, "len_var": 0.2},
     {"type": "rim", "mat": "pearl", "rr": 0.04, "scallops": 9, "amp": 0.03},
     {"type": "prop", "items": [{"shape": "sphere", "mat": "pearl", "at": [0.0, -0.66, 0.1], "abs_z": True, "scale": 0.11},
                                {"shape": "sphere", "mat": "pearl", "at": [0.22, -0.62, 0.06], "abs_z": True, "scale": 0.06},
                                {"shape": "sphere", "mat": "pearl", "at": [-0.2, -0.63, 0.05], "abs_z": True, "scale": 0.05}]}]))
P.append(pot(23, N, "Tổ Ong", {"skep": [[0.4, 0.0], [0.55, 0.05], [0.62, 0.3], [0.56, 0.6], [0.42, 0.8], [0.3, 0.9], [0.31, 0.92]]},
    {"body": G("#E89A22", "#F7C24A", roughness=0.4), "hex": C("#C77A12", roughness=0.4), "honey": GLASS("#F2A81E", 0.6),
     "bee_y": C("#FFD23C"), "bee_k": C("#1E1A16"), "wingg": GLASS("#E6F4FF", 0.8)},
    [body("skep"), SOIL,
     {"type": "tiles", "mat": "hex", "shape": "hex", "rows": 5, "cols": 7, "z": [0.12, 0.72], "arc": 170, "size": 0.075, "flat": 0.25},
     {"type": "drips", "mat": "honey", "zs": [0.97], "count": 10},
     {"type": "prop", "items": [
         {"shape": "sphere", "mat": "bee_y", "at": [0.62, -0.25, 1.12], "scale": [0.09, 0.07, 0.07]},
         {"shape": "sphere", "mat": "bee_k", "at": [0.64, -0.25, 1.12], "scale": [0.025, 0.072, 0.072]},
         {"shape": "petal", "mat": "wingg", "at": [0.6, -0.22, 1.16], "rot": [0, 30, 0], "scale": 0.12, "mirror": False},
         {"shape": "petal", "mat": "wingg", "at": [0.6, -0.22, 1.16], "rot": [0, -20, 0], "scale": 0.12}]}]))
P.append(pot(24, N, "Hang Pha Lê", {"geode": [[0.42, 0.0], [0.6, 0.3], [0.6, 0.55], [0.48, 0.8]]},
    {"body": G("#5B3A9E", "#8E6BD8", roughness=0.15, coat=0.8), "amethyst": {**GLASS("#B79CFF", 0.7), "emission": "#9B7BFF", "emission_strength": 0.4},
     "aqua": {**GLASS("#7FE0FF", 0.7), "emission": "#6FD0FF", "emission_strength": 0.4}, "rose": GLASS("#FFB3D1", 0.7), "spark": GLOW("#FFFFFF", 5)},
    [body("geode", facets=7, smooth=False), SOIL,
     {"type": "prop", "items": [
         {"shape": "cone", "mat": "amethyst", "sides": 6, "at": [-0.35, 0.05, 0.85], "rot": [0, -20, 0], "scale": [0.12, 0.12, 0.45]},
         {"shape": "cone", "mat": "aqua", "sides": 6, "at": [0.33, 0.08, 0.85], "rot": [0, 25, 0], "scale": [0.1, 0.1, 0.55]},
         {"shape": "cone", "mat": "rose", "sides": 6, "at": [0.0, 0.25, 0.85], "rot": [-15, 0, 0], "scale": [0.09, 0.09, 0.35]},
         {"shape": "cone", "mat": "amethyst", "sides": 6, "at": [0.55, -0.3, 0.0], "abs_z": True, "rot": [0, 30, 0], "scale": [0.08, 0.08, 0.25], "ground": True}]},
     {"type": "gems", "mat": "aqua", "z": 0.45, "count": 3, "size": 0.08, "spread": 24},
     {"type": "embers", "mat": "spark", "count": 8, "size": [0.01, 0.018]}]))
P.append(pot(25, N, "Đám Mây Cầu Vồng", {"short": [[0.4, 0.0], [0.5, 0.04], [0.55, 0.3], [0.52, 0.5]]},
    {"body": C("#F7FAFF", roughness=0.7, subsurface=0.2), "red": C("#FF6B6B", roughness=0.4), "yel": C("#FFD166", roughness=0.4),
     "blu": C("#7FC8F8", roughness=0.4)},
    [body("short"), SOIL,
     {"type": "puffs", "mat": "body", "balls": [[-0.55, -0.05, 0.25, 0.3], [0.55, -0.05, 0.25, 0.3], [-0.35, 0.1, 0.65, 0.28],
                                               [0.35, 0.1, 0.65, 0.28], [0.0, 0.25, 0.7, 0.3], [-0.7, 0.1, 0.05, 0.22], [0.7, 0.1, 0.05, 0.22]]},
     *[{"type": "path", "mat": m, "radius": 0.045, "points": [[-r, 0.35, 0.3], [-r * 0.7, 0.35, 0.3 + r * 0.7], [0, 0.35, 0.3 + r],
                                                              [r * 0.7, 0.35, 0.3 + r * 0.7], [r, 0.35, 0.3]]}
       for m, r in (("red", 0.95), ("yel", 0.85), ("blu", 0.75))],
     face(0.3, sleepy=True)]))
P.append(pot(26, N, "Hoa Sen", {"cup": CUP},
    {"body": G("#F7C1D3", "#FFE6EE", roughness=0.4, subsurface=0.2), "petal": G("#F06292", "#FFD6E4", roughness=0.35, subsurface=0.3),
     "petal2": G("#F8A5C2", "#FFF0F5", roughness=0.35, subsurface=0.3), "pad": C("#3E9B48", roughness=0.5)},
    [body("cup"), SOIL,
     {"type": "petals", "mat": "petal", "count": 10, "z": 0.12, "length": 0.8, "width": 0.5, "tilt": 32},
     {"type": "petals", "mat": "petal2", "count": 8, "z": 0.42, "length": 0.55, "width": 0.5, "tilt": 14, "phase": 0.3},
     {"type": "prop", "items": [{"shape": "cyl", "mat": "pad", "at": [0, 0, 0], "abs_z": True, "scale": [1.1, 1.05, 0.03], "ground": True}]}]))
P.append(pot(27, N, "Bí Ngô", {"pumpkin": [[0.3, 0.0], [0.55, 0.06], [0.7, 0.3], [0.66, 0.55], [0.45, 0.72], [0.38, 0.75]]},
    {"body": G("#E9771A", "#FFA94D", roughness=0.4, coat=0.3), "stem": C("#6B7A2E", roughness=0.6), "leaf": C("#6DBE55", roughness=0.4)},
    [body("pumpkin", lobes=10, lobe_amp=0.07, lobe_sharp=0.7), SOIL,
     {"type": "path", "mat": "stem", "radius": 0.05, "taper": [1.0, 0.8, 0.6], "points": [[0.15, 0.2, 0.95], [0.2, 0.2, 1.12], [0.32, 0.2, 1.2]]},
     {"type": "path", "mat": "leaf", "radius": 0.012, "points": [[-0.3, -0.1, 1.0], [-0.55, -0.2, 1.05], [-0.6, -0.3, 0.9], [-0.7, -0.35, 1.0]]},
     {"type": "prop", "items": [{"shape": "leaf", "mat": "leaf", "at": [-0.35, -0.05, 1.0], "rot": [-60, -50, 0], "scale": 0.35}]},
     face(0.42, eye=0.075)]))
P.append(pot(28, N, "Quả Thông", {"egg": EGG},
    {"body": G("#6E4528", "#9C6B3F", roughness=0.6), "scale_m": G("#7A4E2E", "#B2814F", roughness=0.55), "berry": C("#D7192F", roughness=0.15, coat=0.8),
     "holly": C("#2F8A3E", roughness=0.3)},
    [body("egg"), SOIL,
     {"type": "tiles", "mat": "scale_m", "shape": "petal", "rows": 5, "cols": 11, "z": [0.1, 0.78], "arc": 360, "size": 0.2, "width": 0.55, "lift": 18},
     {"type": "prop", "items": [{"shape": "sphere", "mat": "berry", "at": [-0.35, -0.2, 1.0], "scale": 0.06},
                                {"shape": "sphere", "mat": "berry", "at": [-0.27, -0.25, 1.02], "scale": 0.06},
                                {"shape": "leaf", "mat": "holly", "at": [-0.32, -0.2, 1.0], "rot": [-50, -70, 0], "scale": 0.25},
                                {"shape": "leaf", "mat": "holly", "at": [-0.3, -0.2, 1.0], "rot": [-50, 60, 0], "scale": 0.25}]}]))
P.append(pot(29, N, "Bong Bóng Xà Phòng", {"bub": [[0.2, 0.0], [0.45, 0.08], [0.62, 0.35], [0.62, 0.6], [0.48, 0.85], [0.4, 0.9]]},
    {"body": {"color": "#EAF6FF", "roughness": 0.02, "transmission": 0.95, "ior": 1.33, "coat": 1.0},
     "tint": {**GLASS("#FFC6E8", 0.8), "emission": "#C6B2FF", "emission_strength": 0.3}, "ring": C("#C6B2FF", roughness=0.2, coat=1.0)},
    [body("bub", wall=0.02), SOIL,
     {"type": "band", "mat": "ring", "z": 0.08, "rr": 0.03},
     {"type": "prop", "items": [{"shape": "sphere", "mat": "tint", "at": [0.7, -0.1, 1.15], "scale": 0.12},
                                {"shape": "sphere", "mat": "body", "at": [-0.68, 0.0, 1.25], "scale": 0.08},
                                {"shape": "sphere", "mat": "tint", "at": [-0.8, -0.2, 0.6], "scale": 0.06}]}]))
P.append(pot(30, N, "Gốc Cây Rêu", {"stump": [[0.66, 0.0], [0.58, 0.08], [0.53, 0.3], [0.53, 0.62]]},
    {"body": G("#6B4428", "#8E5E38", roughness=0.8), "ring_w": C("#D9B38C", roughness=0.7), "moss": C("#6DBE55", roughness=0.9),
     "stem": C("#F3E3C3", roughness=0.6), "cap": C("#D9363E", roughness=0.3, coat=0.5)},
    [body("stump", lobes=14, lobe_amp=0.03, lobe_sharp=3), SOIL,
     {"type": "rim", "mat": "ring_w", "rr": 0.05},
     {"type": "puffs", "mat": "moss", "balls": [[-0.45, -0.25, 1.0, 0.13], [-0.3, -0.42, 0.96, 0.11], [0.5, -0.1, 0.98, 0.12], [0.25, 0.4, 1.0, 0.12]]},
     {"type": "path", "mat": "body", "radius": 0.06, "taper": [1.0, 0.7, 0.3], "mirror": True,
      "points": [[0.45, -0.2, 0.15], [0.7, -0.3, 0.05], [0.85, -0.35, 0.0]]},
     {"type": "minis", "stem_mat": "stem", "cap_mat": "cap", "spots": [[0.8, 0.8], [-0.7, 0.6]]}]))

# ============================================================ GỐM Á ĐÔNG ===
P.append(reuse(31, K, 7))
P.append(pot(32, K, "Sơn Mài Son Vàng", {"box": [[0.55, 0.0], [0.6, 0.03], [0.6, 0.62], [0.56, 0.66]]},
    {"body": G("#8E0F14", "#C2161E", roughness=0.08, coat=1.0), "black": C("#141010", roughness=0.08, coat=1.0), "gold": GOLD},
    [body("box", smooth=False, facets=0), SOIL,
     {"type": "band", "mat": "black", "z": 0.08, "rr": 0.05}, {"type": "band", "mat": "black", "z": 0.93, "rr": 0.05},
     {"type": "filigree", "mat": "gold", "z": 0.5, "amp": 0.07, "waves": 5, "spiral": 0.06},
     {"type": "dots", "mat": "gold", "count": 14, "size": [0.016, 0.02], "z": [0.82, 0.84], "ring": True, "arc": 220},
     {"type": "rim", "mat": "gold", "rr": 0.025}]))
P.append(pot(33, K, "Đèn Lồng Hội An", {"lantern": [[0.3, 0.0], [0.5, 0.1], [0.62, 0.35], [0.62, 0.5], [0.5, 0.75], [0.32, 0.86]]},
    {"body": {"color": "#E53935", "roughness": 0.5, "subsurface": 0.2, "emission": "#FF5A2E", "emission_strength": 0.6},
     "rib": C("#8E1B12", roughness=0.4), "gold": GOLD, "tassel": C("#F2B33D", roughness=0.6)},
    [body("lantern", lobes=8, lobe_amp=0.06, lobe_sharp=0.5), SOIL,
     {"type": "meridians", "mat": "rib", "count": 8, "radius": 0.016, "z": [0.08, 0.95], "off": 0.02},
     {"type": "rim", "mat": "gold", "rr": 0.045}, {"type": "foot", "mat": "gold", "rr": 0.045, "step": True},
     {"type": "path", "mat": "tassel", "radius": 0.02, "mirror": True, "points": [[0.62, -0.05, 0.45], [0.7, -0.05, 0.35], [0.72, -0.05, 0.12]]},
     {"type": "prop", "items": [{"shape": "sphere", "mat": "gold", "at": [0.66, -0.05, 0.46], "scale": 0.04, "mirror": True}]}]))
P.append(pot(34, K, "Trống Đồng", {"drum": [[0.55, 0.0], [0.5, 0.1], [0.48, 0.35], [0.56, 0.6], [0.64, 0.66]]},
    {"body": G("#7A5520", "#C49A4A", metallic=0.85, roughness=0.35), "dark": C("#5A3C14", metallic=0.7, roughness=0.5)},
    [body("drum"), SOIL,
     *[{"type": "band", "mat": "dark", "z": z, "rr": 0.014} for z in (0.15, 0.3, 0.62, 0.78, 0.9)],
     {"type": "tiles", "mat": "dark", "shape": "sphere", "rows": 1, "cols": 14, "z": [0.46, 0.46], "arc": 240, "size": 0.03, "flat": 0.5},
     {"type": "filigree", "mat": "dark", "z": 0.7, "amp": 0.025, "waves": 12, "spiral": 0, "depth": 0.009},
     {"type": "handles", "mat": "body", "z": 0.72, "r": 0.08, "rr": 0.022},
     {"type": "rim", "mat": "body", "rr": 0.03}]))
# Chỉ thị 04 — sửa sau lần render đầu: hồ sơ 4 điểm có góc gãy làm Solidify (even offset) đẩy thành rổ
# ra ±1684 đơn vị (tấm ván ngang khung). Thêm điểm trung gian, giữ dáng rổ loe miệng. Nón lá dựng nghiêng
# tựa sau miệng rổ cho thấy rõ hình nón (trước đó nằm ngang, nhìn như miếng nêm).
P.append(pot(35, K, "Rổ Tre Nón Lá", {"basket": [[0.4, 0.0], [0.46, 0.06], [0.52, 0.28], [0.57, 0.48], [0.61, 0.6], [0.62, 0.62]]},
    {"body": G("#C49A55", "#E2C48A", roughness=0.7), "weave": C("#A97F3E", roughness=0.7), "nonla": G("#E8D6A8", "#F7EBCB", roughness=0.7),
     "ribbon": C("#E8424E", roughness=0.5)},
    [body("basket"), SOIL,
     {"type": "meridians", "mat": "weave", "count": 18, "twist": 0.7, "radius": 0.013},
     {"type": "meridians", "mat": "weave", "count": 18, "twist": -0.7, "radius": 0.013},
     {"type": "rim", "mat": "weave", "rr": 0.04},
     {"type": "prop", "items": [{"shape": "cone", "mat": "nonla", "sides": 48, "at": [0.3, 0.42, 1.05], "rot": [62, 0, -20], "scale": [0.5, 0.5, 0.36]}]},
     {"type": "path", "mat": "ribbon", "radius": 0.012, "points": [[0.6, -0.05, 0.55], [0.55, -0.25, 0.4], [0.5, -0.3, 0.25]]}]))
P.append(pot(36, K, "Ấm Tử Sa", {"teapot": [[0.35, 0.0], [0.45, 0.03], [0.6, 0.3], [0.58, 0.55], [0.45, 0.66]]},
    {"body": G("#7E3F22", "#A85C36", roughness=0.55), "line": C("#5E2C16", roughness=0.6)},
    [body("teapot"), SOIL,
     {"type": "path", "mat": "body", "radius": 0.08, "taper": [1.0, 0.7, 0.5], "points": [[0.5, 0.0, 0.4], [0.72, 0.0, 0.55], [0.82, 0.0, 0.8], [0.9, 0.0, 0.9]]},
     {"type": "path", "mat": "body", "radius": 0.045, "points": [[-0.52, 0.0, 0.75], [-0.82, 0.0, 0.78], [-0.86, 0.0, 0.45], [-0.55, 0.0, 0.28]]},
     {"type": "band", "mat": "line", "z": 0.82, "rr": 0.012}, {"type": "rim", "mat": "body", "rr": 0.04},
     {"type": "filigree", "mat": "line", "z": 0.45, "amp": 0.03, "waves": 6, "spiral": 0.04, "depth": 0.008}]))
P.append(pot(37, K, "Hũ Men Nâu", {"jar": [[0.3, 0.0], [0.42, 0.05], [0.58, 0.3], [0.6, 0.55], [0.5, 0.78], [0.3, 0.86], [0.28, 0.96], [0.3, 1.0]]},
    {"body": G("#4A2612", "#7A4422", roughness=0.15, coat=0.8), "glaze": G("#C9884A", "#E2A96A", roughness=0.1, coat=1.0)},
    [body("jar"), SOIL, {"type": "drips", "mat": "glaze", "zs": [0.75], "count": 12},
     {"type": "handles", "mat": "body", "z": 0.8, "r": 0.06, "rr": 0.02}, {"type": "rim", "mat": "body", "rr": 0.04}]))
P.append(pot(38, K, "Bình Men Ngọc", {"celadon": [[0.24, 0.0], [0.3, 0.04], [0.5, 0.25], [0.55, 0.45], [0.46, 0.66], [0.3, 0.82], [0.24, 0.98], [0.28, 1.05]]},
    {"body": G("#8EC4A2", "#BFE3CC", roughness=0.12, coat=1.0, subsurface=0.15), "line": C("#6FA886", roughness=0.2), "wood": C("#5A2E1A", roughness=0.4, coat=0.5)},
    [body("celadon"), SOIL, {"type": "stand", "mat": "wood", "height": 0.16, "radius": 0.45, "sides": 8},
     {"type": "filigree", "mat": "line", "z": 0.35, "amp": 0.05, "waves": 4, "spiral": 0.05, "depth": 0.007},
     {"type": "band", "mat": "line", "z": 0.66, "rr": 0.012}, {"type": "rim", "mat": "body", "rr": 0.03}]))
P.append(pot(39, K, "Bát Tràng Men Lam", {"bowl": [[0.28, 0.0], [0.32, 0.03], [0.4, 0.08], [0.62, 0.35], [0.72, 0.58], [0.74, 0.6]]},
    {"body": C("#F6F8FC", roughness=0.08, coat=1.0), "blue": C("#2457B0", roughness=0.1, coat=1.0)},
    [body("bowl"), SOIL,
     {"type": "filigree", "mat": "blue", "z": 0.55, "amp": 0.09, "waves": 6, "spiral": 0.06},
     {"type": "band", "mat": "blue", "z": 0.88, "rr": 0.015}, {"type": "band", "mat": "blue", "z": 0.15, "rr": 0.015},
     {"type": "foot", "mat": "blue", "rr": 0.03}, {"type": "rim", "mat": "body", "rr": 0.025}]))
P.append(pot(40, K, "Bình Hồ Lô Đỏ", {"gourd": [[0.3, 0.0], [0.5, 0.08], [0.58, 0.3], [0.45, 0.55], [0.3, 0.65], [0.38, 0.8], [0.36, 0.95], [0.24, 1.05], [0.26, 1.1]]},
    {"body": G("#A3121A", "#D92B2B", roughness=0.08, coat=1.0), "gold": GOLD, "tassel": C("#F2B33D", roughness=0.6)},
    [body("gourd"), SOIL, {"type": "band", "mat": "gold", "z": 0.59, "rr": 0.035},
     {"type": "filigree", "mat": "gold", "z": 0.25, "amp": 0.05, "waves": 5, "spiral": 0.05},
     {"type": "path", "mat": "tassel", "radius": 0.018, "points": [[0.3, -0.12, 0.65], [0.5, -0.2, 0.5], [0.58, -0.25, 0.3], [0.6, -0.25, 0.12]]},
     {"type": "prop", "items": [{"shape": "sphere", "mat": "gold", "at": [0.6, -0.25, 0.14], "scale": 0.045}]},
     {"type": "rim", "mat": "gold", "rr": 0.025}]))

# ============================================================ THẦN THOẠI ===
P.append(pot(41, T, "Phượng Hoàng Lửa", {"urn": URN},
    {"body": G("#7E1414", "#D63B2B", roughness=0.15, coat=1.0), "wing": {"gradient": [[0.0, "#FF4A1C"], [0.6, "#FF8A2A"], [1.0, "#FFD24A"]], "roughness": 0.4,
     "emission_from_gradient": True, "emission_strength": 0.35}, "gold": GOLD, "ruby": {**GLASS("#FF2D4A", 0.4), "emission": "#FF2D4A", "emission_strength": 0.5},
     "spark": GLOW("#FFB43C", 8)},
    [body("urn"), SOIL, {"type": "rim", "mat": "gold", "rr": 0.045, "scallops": 10, "amp": 0.08, "power": 4},
     {"type": "wings", "mat": "wing", "shape": "feather", "z": 0.72, "count": 7, "layers": 2, "length": 0.95, "spread": [8, 80], "width": 0.34, "curl": 0.2},
     {"type": "tail", "mat": "wing", "shape": "flame", "z": 0.8, "count": 5, "length": 1.0, "spread": 50, "width": 0.34},
     {"type": "crest", "mat": "wing", "shape": "feather", "count": 5, "length": 0.4, "spread": 30, "width": 0.3, "gem": "ruby", "gem_size": 0.07},
     {"type": "filigree", "mat": "gold", "z": 0.3, "amp": 0.04, "waves": 6, "spiral": 0.045},
     {"type": "gems", "mat": "ruby", "z": 0.55, "count": 3, "size": 0.08, "spread": 22, "bezel": "gold"},
     {"type": "embers", "mat": "spark", "count": 14, "size": [0.01, 0.02]}]))
P.append(pot(42, T, "Kỳ Lân", {"urn": URN},
    {"body": G("#EEF0FA", "#FFFFFF", roughness=0.15, coat=1.0), "horn": {"gradient": [[0.0, "#F2C94C"], [1.0, "#FFF3C4"]], "roughness": 0.2, "metallic": 0.6},
     "mane1": G("#F7A8C4", "#FFE0EC", roughness=0.4), "mane2": G("#B49CF7", "#E6DCFF", roughness=0.4), "gold": GOLD, "spark": GLOW("#BFE6FF", 6)},
    [body("urn"), SOIL,
     {"type": "petals", "mat": "mane1", "shape": "petal", "count": 6, "arc": 150, "center": 180, "z": 0.86, "length": 0.55, "width": 0.45, "tilt": 25},
     {"type": "petals", "mat": "mane2", "shape": "petal", "count": 5, "arc": 120, "center": 180, "z": 0.7, "length": 0.5, "width": 0.45, "tilt": 35, "phase": 0.15},
     {"type": "prop", "items": [{"shape": "horn", "mat": "horn", "at": [0.0, -0.3, 0.98], "rot": [-12, 0, 0], "scale": [0.07, 0.07, 0.42]}]},
     {"type": "ears", "mat": "body", "inner_mat": "mane1", "length": 0.22, "angle": 40},
     {"type": "band", "mat": "gold", "z": 0.15, "rr": 0.025}, {"type": "rim", "mat": "gold", "rr": 0.03},
     {"type": "embers", "mat": "spark", "count": 10, "size": [0.01, 0.018]},
     face(0.5, sleepy=True)]))
P.append(pot(43, T, "Thiên Nga Ngọc", {"urn": URN},
    {"body": G("#EAF2FF", "#FFFFFF", roughness=0.12, coat=1.0), "feather": G("#E6EEFA", "#FFFFFF", roughness=0.45),
     "beak": C("#FF9F1C", roughness=0.3), "eyek": C("#141414", roughness=0.05), "gold": GOLD, "blue": C("#8FC4F5", roughness=0.2, coat=1.0)},
    [body("urn"), SOIL,
     {"type": "wings", "mat": "feather", "shape": "feather", "z": 0.7, "count": 7, "layers": 2, "length": 0.85, "spread": [10, 70], "width": 0.32, "curl": 0.25},
     {"type": "path", "mat": "feather", "radius": 0.06, "taper": [1.0, 0.8, 0.85],
      "points": [[0.0, -0.58, 0.35], [-0.15, -0.68, 0.7], [0.05, -0.62, 1.05], [0.12, -0.55, 1.2]]},
     {"type": "prop", "items": [{"shape": "sphere", "mat": "feather", "at": [0.12, -0.55, 1.22], "abs_z": False, "scale": 0.08},
                                {"shape": "cone", "mat": "beak", "at": [0.19, -0.56, 1.2], "rot": [0, 100, 0], "scale": [0.03, 0.03, 0.08]},
                                {"shape": "sphere", "mat": "eyek", "at": [0.14, -0.62, 1.25], "scale": 0.015},
                                {"shape": "cone", "mat": "gold", "sides": 5, "at": [0.1, -0.55, 1.29], "scale": [0.04, 0.04, 0.05]}]},
     {"type": "band", "mat": "blue", "z": 0.3, "rr": 0.02}, {"type": "rim", "mat": "gold", "rr": 0.03}]))
P.append(pot(44, T, "Rồng Ngọc", {"urn": URN},
    {"body": G("#1F6E54", "#3E9E7A", roughness=0.1, coat=1.0, subsurface=0.1), "dragon": G("#C9952A", "#F2C94C", metallic=1.0, roughness=0.25),
     "spine": C("#E8424E", roughness=0.3), "pearl": {"color": "#FFF6E0", "roughness": 0.1, "emission": "#FFE8A8", "emission_strength": 1.2}},
    [body("urn"), SOIL,
     {"type": "coil", "mat": "dragon", "scale_mat": "spine", "z": [0.08, 0.95], "turns": 1.0, "start": -270, "radius": 0.08, "off": 0.07},
     {"type": "prop", "items": [{"shape": "sphere", "mat": "dragon", "at": [0.7, -0.05, 1.12], "scale": [0.13, 0.1, 0.1]},
                                {"shape": "horn", "mat": "dragon", "at": [0.68, 0.0, 1.2], "rot": [0, 35, 0], "scale": [0.03, 0.03, 0.16], "mirror": False},
                                {"shape": "horn", "mat": "dragon", "at": [0.74, 0.04, 1.2], "rot": [0, 60, 0], "scale": [0.03, 0.03, 0.16]},
                                {"shape": "sphere", "mat": "spine", "at": [0.78, -0.13, 1.14], "scale": 0.02},
                                {"shape": "sphere", "mat": "pearl", "at": [-0.6, -0.3, 1.2], "scale": 0.1}]},
     {"type": "rim", "mat": "dragon", "rr": 0.035}]))
P.append(pot(45, T, "Long Cung", {"urn": URN},
    {"body": G("#0E4C92", "#2F8BD6", roughness=0.1, coat=1.0), "wave": C("#BFE6FF", roughness=0.2), "coral": G("#FF6F7A", "#FFB0A8", roughness=0.4),
     "pearl": C("#FFFDF8", roughness=0.08, metallic=0.3, coat=1.0), "bubble": GLASS("#DDF3FF", 0.9)},
    [body("urn"), SOIL,
     {"type": "filigree", "mat": "wave", "z": 0.35, "amp": 0.05, "waves": 7, "spiral": 0.05},
     {"type": "filigree", "mat": "wave", "z": 0.65, "amp": 0.04, "waves": 7, "spiral": 0},
     {"type": "path", "mat": "coral", "radius": 0.04, "taper": [1, 0.8, 0.5], "mirror": True, "points": [[0.42, 0.1, 0.9], [0.55, 0.1, 1.15], [0.5, 0.1, 1.35]]},
     {"type": "path", "mat": "coral", "radius": 0.03, "taper": [1, 0.8, 0.4], "mirror": True, "points": [[0.55, 0.1, 1.12], [0.72, 0.1, 1.25], [0.75, 0.1, 1.4]]},
     {"type": "prop", "items": [{"shape": "sphere", "mat": "pearl", "surf": [0, 0.5, 0.02], "scale": 0.08},
                                {"shape": "sphere", "mat": "bubble", "at": [-0.7, -0.2, 0.6], "scale": 0.06},
                                {"shape": "sphere", "mat": "bubble", "at": [0.75, -0.25, 0.4], "scale": 0.045}]},
     {"type": "rim", "mat": "pearl", "rr": 0.035, "scallops": 8, "amp": 0.04}]))
P.append(pot(46, T, "Cung Trăng", {"urn": URN},
    {"body": G("#F4EEDC", "#FFFFFF", roughness=0.12, coat=1.0), "moon": {"color": "#FFE08A", "roughness": 0.3, "emission": "#FFD45A", "emission_strength": 1.5},
     "gold": GOLD, "star": GLOW("#FFF3B0", 6)},
    [body("urn"), SOIL,
     {"type": "path", "mat": "moon", "radius": 0.16, "taper": [0.05, 1.0, 0.05], "per": 10,
      "points": [[0.45, 0.4, 1.75], [-0.1, 0.4, 1.68], [-0.55, 0.4, 1.3], [-0.6, 0.4, 0.8], [-0.3, 0.4, 0.45]]},
     {"type": "band", "mat": "gold", "z": 0.4, "rr": 0.025}, {"type": "rim", "mat": "gold", "rr": 0.03},
     {"type": "dots", "mat": "gold", "count": 3, "size": [0.03, 0.035], "z": [0.25, 0.25], "ring": True, "arc": 50},
     {"type": "embers", "mat": "star", "count": 10, "size": [0.012, 0.022]},
     face(0.6, sleepy=True)]))
P.append(pot(47, T, "Đèn Thần", {"lamp": [[0.4, 0.0], [0.5, 0.05], [0.62, 0.2], [0.6, 0.35], [0.48, 0.42]]},
    {"body": G("#C9952A", "#F2C94C", metallic=1.0, roughness=0.2), "ruby": {**GLASS("#E8203A", 0.4), "emission": "#E8203A", "emission_strength": 0.5},
     "smoke": {"color": "#B49CF7", "roughness": 0.5, "transmission": 0.5, "emission": "#C6B2FF", "emission_strength": 0.8}},
    [body("lamp"), SOIL,
     {"type": "path", "mat": "body", "radius": 0.07, "taper": [1.0, 0.6, 0.35], "points": [[0.5, 0.0, 0.2], [0.78, 0.0, 0.3], [0.95, 0.0, 0.48], [1.05, 0.0, 0.56]]},
     {"type": "path", "mat": "body", "radius": 0.035, "points": [[-0.55, 0.0, 0.32], [-0.85, 0.0, 0.34], [-0.85, 0.0, 0.1], [-0.55, 0.0, 0.12]]},
     {"type": "path", "mat": "smoke", "radius": 0.06, "taper": [0.4, 1.0, 0.3],
      "points": [[1.05, 0.0, 0.6], [0.95, 0.0, 0.9], [1.1, 0.0, 1.15], [0.9, 0.0, 1.4], [1.0, 0.0, 1.6]]},
     {"type": "gems", "mat": "ruby", "z": 0.5, "count": 1, "size": 0.08, "bezel": "body"},
     {"type": "rim", "mat": "body", "rr": 0.04}, {"type": "foot", "mat": "body", "rr": 0.04, "step": True}]))
P.append(pot(48, T, "Ngai Vàng Thiên Giới", {"urn": URN},
    {"body": G("#B07A1C", "#F2C94C", metallic=1.0, roughness=0.2), "ray": G("#FFD54F", "#FFF3C4", metallic=0.6, roughness=0.25),
     "disc": {"color": "#FFF3C4", "roughness": 0.4, "emission": "#FFE8A0", "emission_strength": 0.6},
     "ruby": {**GLASS("#E8203A", 0.4), "emission": "#E8203A", "emission_strength": 0.5}, "sapph": {**GLASS("#2F7FC1", 0.4), "emission": "#2F7FC1", "emission_strength": 0.4},
     "jade": C("#2E7D5B", roughness=0.15, coat=1.0), "spark": GLOW("#FFF3B0", 6)},
    [body("urn"), SOIL, {"type": "stand", "mat": "jade", "height": 0.18, "radius": 0.55, "sides": 8},
     {"type": "halo", "mat": "ray", "ring_mat": "body", "disc_mat": "disc", "styles": ["rays", "disc"], "shape": "spike", "radius": 1.0, "length": 0.5, "z": 0.75, "count": 24},
     {"type": "rim", "mat": "body", "rr": 0.05, "scallops": 8, "amp": 0.12, "power": 4},
     {"type": "gems", "mat": "ruby", "z": 0.5, "count": 1, "size": 0.1, "bezel": "body"},
     {"type": "gems", "mat": "sapph", "z": 0.42, "count": 2, "size": 0.065, "spread": 34, "bezel": "body"},
     {"type": "filigree", "mat": "body", "z": 0.2, "amp": 0.03, "waves": 8, "spiral": 0.04},
     {"type": "embers", "mat": "spark", "count": 12, "size": [0.01, 0.02]}]))
P.append(pot(49, T, "Thiên Thần", {"urn": URN},
    {"body": G("#F7EEDC", "#FFFDF8", roughness=0.15, coat=1.0, subsurface=0.15), "feather": G("#EEF2FA", "#FFFFFF", roughness=0.45),
     "gold": GOLD, "halo": {"color": "#FFE08A", "metallic": 0.6, "roughness": 0.2, "emission": "#FFD45A", "emission_strength": 2.0}, "spark": GLOW("#FFF3B0", 6)},
    [body("urn"), SOIL,
     {"type": "wings", "mat": "feather", "shape": "feather", "z": 0.72, "count": 8, "layers": 3, "length": 1.0, "spread": [5, 85], "width": 0.34, "curl": 0.22},
     {"type": "prop", "items": [{"shape": "torus", "mat": "halo", "at": [0.0, 0.0, 1.42], "rot": [14, 0, 0], "scale": [0.32, 0.32, 0.12]}]},
     {"type": "band", "mat": "gold", "z": 0.18, "rr": 0.025}, {"type": "rim", "mat": "gold", "rr": 0.03},
     {"type": "embers", "mat": "spark", "count": 10, "size": [0.01, 0.018]},
     face(0.55, sleepy=True)]))
P.append(pot(50, T, "Hồ Điệp Tiên", {"urn": URN},
    {"body": G("#C7B2F2", "#EFE6FF", roughness=0.15, coat=1.0), "wingA": {"gradient": [[0.0, "#7FC8F8"], [0.5, "#C6B2FF"], [1.0, "#FFB0D8"]],
     "roughness": 0.1, "transmission": 0.55, "ior": 1.4, "emission_from_gradient": True, "emission_strength": 0.4},
     "dark": C("#3A2A5E", roughness=0.3), "gold": GOLD, "spark": GLOW("#FFE6FF", 6)},
    [body("urn"), SOIL,
     {"type": "wings", "mat": "wingA", "shape": "membrane", "z": 0.75, "count": 2, "layers": 1, "length": 1.05, "spread": [25, 60], "width": 0.85, "len_min": 0.7},
     {"type": "wings", "mat": "wingA", "shape": "petal", "z": 0.45, "count": 2, "layers": 1, "length": 0.65, "spread": [100, 125], "width": 0.6, "len_min": 0.8},
     {"type": "path", "mat": "dark", "radius": 0.012, "mirror": True, "points": [[0.12, 0.05, 1.0], [0.2, 0.0, 1.25], [0.32, -0.05, 1.38]]},
     {"type": "prop", "items": [{"shape": "sphere", "mat": "gold", "at": [0.32, -0.05, 1.4], "scale": 0.035, "mirror": True}]},
     {"type": "filigree", "mat": "gold", "z": 0.3, "amp": 0.04, "waves": 6, "spiral": 0.04},
     {"type": "rim", "mat": "gold", "rr": 0.03}, {"type": "embers", "mat": "spark", "count": 12, "size": [0.01, 0.018]},
     face(0.58, eye=0.06)]))

assert [p["id"] for p in P] == list(range(1, 51)), [p["id"] for p in P]
out = {"name": "Bộ 50 chậu đặc trưng (đã duyệt bản phác 17/11/2026)", "out_name": "signature_all",
       "profiles": {}, "groups": [F, A, N, K, T], "pots": P}
json.dump(out, open(os.path.join(ROOT, "lines", "signature_all.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ok", len(P))
