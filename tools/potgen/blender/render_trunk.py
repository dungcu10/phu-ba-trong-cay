"""Chỉ thị 08 · A — cây leo cổ thụ: một đoạn thân lặp liền + các mảnh rời (lá, cành, tua, nụ, đèn).

  python render_trunk.py -- --out ../out/c08/trunk [--samples 64] [--what tile,pieces]

Thân: 4 sợi xoắn quanh trục, mỗi sợi quay đúng 360° trong một đoạn H, kèm một dây leo xanh mảnh quay
ngược chiều. Bán kính, vân vỏ (nhiễu 4D trên UV tuần hoàn) và rêu đều tuần hoàn theo H, đèn là
"mặt trời" cùng hướng/màu với preset world, camera trực giao cùng góc nghiêng với chậu
=> ảnh đoạn thân khớp từng pixel khi xếp chồng. Render cao gấp đôi rồi cắt khúc giữa để mép ảnh
không chịu ảnh hưởng của khử nhiễu ở biên.

Mảnh rời: render từng mảnh với cùng camera/đèn, gốc gắn (chỗ dính vào thân) đặt ở gốc tọa độ;
ghi tọa độ điểm gắn trong pieces.json. Mỗi mảnh có hai hướng (vươn trái / vươn phải) dựng bằng
cách quay quanh trục đứng, KHÔNG lật ảnh (lật ảnh sẽ đảo hướng nắng).
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import worldlib as W  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

P = W.P
TILT_DEG = None  # read from the style
TILE_PX = 768     # screen period of one trunk segment, in master pixels
TILE_W = 640


def bark_material(H, shift):
    nt = W.NT(f"bark_{shift:.2f}")
    vec, w = W.periodic_coords(nt, H, R_u=0.75, R_v=H / (2 * math.pi) * 0.32, shift=shift)
    grain = W.noise4(nt, vec, w, scale=2.6, detail=10.0, rough=0.65)
    fine = W.noise4(nt, vec, w, scale=11.0, detail=4.0, rough=0.55)
    patch = W.noise4(nt, vec, w, scale=1.3, detail=2.0, rough=0.4)
    vor = nt.n("ShaderNodeTexVoronoi", Scale=2.4, Randomness=0.9)
    vor.voronoi_dimensions = "4D"
    vor.feature = "DISTANCE_TO_EDGE"
    nt.l(vec, vor.inputs["Vector"])
    nt.l(w, vor.inputs["W"])
    crack = nt.n("ShaderNodeMapRange")
    crack.inputs["From Min"].default_value = 0.0
    crack.inputs["From Max"].default_value = 0.045
    nt.l(vor.outputs["Distance"], crack.inputs["Value"])  # 0 in the crack, 1 on the plate
    col = nt.ramp(grain.outputs["Fac"], [(0.28, "#5A3A3A"), (0.45, "#835238"), (0.6, "#A06A45"), (0.76, "#C28E5E")])
    col = nt.mix(nt.math("MULTIPLY", patch.outputs["Fac"], 0.5), col, "#8E6A5A")
    col = nt.mix(nt.math("MULTIPLY", nt.math("SUBTRACT", 1.0, crack.outputs[0]), 0.75), col, "#5A3844")
    ao = nt.n("ShaderNodeAmbientOcclusion", Distance=0.22)
    ao.samples = 8
    occl = nt.math("SUBTRACT", 1.0, ao.outputs["AO"])
    geo = nt.n("ShaderNodeNewGeometry")
    nz = nt.n("ShaderNodeSeparateXYZ")
    nt.l(geo.outputs["Normal"], nz.inputs[0])
    up = nt.math("MAXIMUM", nz.outputs["Z"], 0.0)
    moss_amt = nt.math("ADD", nt.math("MULTIPLY", occl, 2.2), nt.math("MULTIPLY", up, 0.8))
    moss_amt = nt.math("MULTIPLY", moss_amt, nt.math("ADD", fine.outputs["Fac"], nt.math("MULTIPLY", patch.outputs["Fac"], 0.6)))
    mr = nt.n("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.55
    mr.inputs["From Max"].default_value = 0.8
    nt.l(moss_amt, mr.inputs["Value"])
    moss_col = nt.ramp(fine.outputs["Fac"], [(0.3, "#3F7F4C"), (0.55, "#62A657"), (0.75, "#9AD46E")])
    color = nt.mix(mr.outputs[0], col, moss_col)
    b = nt.principled(color, rough=0.8, sheen=0.3)
    bump = nt.n("ShaderNodeBump", Strength=0.7, Distance=0.05)
    hgt = nt.math("ADD", nt.math("MULTIPLY", crack.outputs[0], 0.8), nt.math("ADD", nt.math("MULTIPLY", grain.outputs["Fac"], 0.5),
                  nt.math("MULTIPLY", mr.outputs[0], 0.35)))
    nt.l(hgt, bump.inputs["Height"])
    nt.l(bump.outputs["Normal"], b.inputs["Normal"])
    return nt.done(b)


def vine_material():
    nt = W.NT("vine")
    b = nt.principled("#5E9E4E", rough=0.5, sss=0.15, sss_radius=(0.3, 0.6, 0.15))
    return nt.done(b)


def helix_tube(name, H, r_path, phase, turns, rho_fn, z0, z1, mat, sides=40, per_H=120, wobble=0.0):
    """Tube around a helix. Everything is periodic in z with period H, UV v = z/H, u around."""
    verts, faces, uvs = [], [], []
    n = int(round((z1 - z0) / H * per_H))
    for k in range(n + 1):
        z = z0 + (z1 - z0) * k / n
        a = phase + turns * 2 * math.pi * z / H + 0.35 * math.sin(2 * math.pi * z / H + phase * 2.3)
        rp = r_path * (1.0 + wobble * math.sin(4 * math.pi * z / H + phase * 1.7))
        c = Vector((rp * math.cos(a), rp * math.sin(a), z))
        # tangent of the helix
        dz = 1e-3
        a2 = phase + turns * 2 * math.pi * (z + dz) / H + 0.35 * math.sin(2 * math.pi * (z + dz) / H + phase * 2.3)
        rp2 = r_path * (1.0 + wobble * math.sin(4 * math.pi * (z + dz) / H + phase * 1.7))
        t = (Vector((rp2 * math.cos(a2), rp2 * math.sin(a2), z + dz)) - c).normalized()
        nx = Vector((math.cos(a), math.sin(a), 0.0))
        nx = (nx - t * nx.dot(t)).normalized()
        ny = t.cross(nx)
        rho = rho_fn(z)
        for s in range(sides):
            th = 2 * math.pi * s / sides
            verts.append(c + (nx * math.cos(th) + ny * math.sin(th)) * rho(th) if callable(rho) else c + (nx * math.cos(th) + ny * math.sin(th)) * rho)
            uvs.append((s / sides, z / H))
    for k in range(n):
        for s in range(sides):
            a_ = k * sides + s
            b_ = k * sides + (s + 1) % sides
            faces.append((a_, b_, b_ + sides, a_ + sides))
    ob = W.mesh_from(name, verts, faces, uvs=None, mat=mat)
    # UVs: seam-free per-vertex mapping is fine, the u wrap is handled by the periodic noise
    uv = ob.data.uv_layers.new(name="UVMap")
    for poly in ob.data.polygons:
        loops = list(poly.loop_indices)
        us = [uvs[ob.data.loops[li].vertex_index][0] for li in loops]
        wrap = max(us) - min(us) > 0.5
        for li in loops:
            u, v = uvs[ob.data.loops[li].vertex_index]
            if wrap and u < 0.5:
                u += 1.0
            uv.data[li].uv = (u, v)
    return ob


def build_trunk(H, z0, z1):
    strands = []
    for i in range(4):
        ph = i * math.pi / 2 + 0.3 * math.sin(i * 2.1)
        base = (0.26, 0.21, 0.245, 0.19)[i]

        def rho_fn(z, i=i, base=base):
            def rho(th):
                f = 2 * math.pi * z / H
                bulge = (1.0 + 0.13 * math.sin(2 * f + i * 1.3) + 0.07 * math.sin(3 * f + i * 2.2)
                         + 0.16 * math.exp(-((math.sin((f - i * 1.9) / 2)) / 0.16) ** 2))  # one knot per strand
                # slightly flattened strands with a ridge, so they read as fibrous wood
                return base * bulge * (1.0 + 0.06 * math.cos(3 * th + i) + 0.03 * math.cos(7 * th + 2 * i))
            return rho
        strands.append(helix_tube(f"strand{i}", H, (0.27, 0.22, 0.26, 0.24)[i], ph, 1, rho_fn, z0, z1,
                                  bark_material(H, 0.13 * i), wobble=0.05))
    # inner core fills the gaps between strands
    helix_tube("core", H, 0.0, 0.0, 1, lambda z: (lambda th: 0.24), z0, z1, bark_material(H, 0.71), sides=24, per_H=24)
    # a young green vine winding the other way, one turn per segment
    vm = vine_material()
    helix_tube("vine", H, 0.5, 1.1, -1, lambda z: (lambda th: 0.026 * (1 + 0.25 * math.sin(6 * math.pi * z / H + 1.0))),
               z0, z1, vm, sides=12, per_H=160, wobble=0.07)
    return strands


def render_tile(out, st):
    tgt = W.scene(st)
    W.directional_lights(st)
    tilt = math.radians(st.get("tilt_deg", 12))
    H = TILE_PX / W.PX_PER_UNIT / math.cos(tilt)  # world height of one segment
    build_trunk(H, -1.6 * H, 2.6 * H)
    # Render 2 periods + margins, centred on z = H/2 .. 1.5H, then cut exactly one period.
    pad = 96
    W.camera_frame((0.0, 0.0, H), TILE_W, 2 * TILE_PX + 2 * pad)
    raw = os.path.join(out, "_trunk_raw.png")
    W.render(raw)
    _, y_top = W.pixel_of((0.0, 0.0, 1.5 * H))
    _, y_bot = W.pixel_of((0.0, 0.0, 0.5 * H))
    print("[world08] period px", y_bot - y_top, "expected", TILE_PX, flush=True)
    import numpy as np
    from PIL import Image
    im = np.array(Image.open(raw))
    y0 = int(round(y_top))
    tile = im[y0:y0 + TILE_PX]
    Image.fromarray(tile).save(os.path.join(out, "trunk_tile.png"))
    W.save_json(os.path.join(out, "trunk.json"), {
        "tile": {"w": TILE_W, "h": TILE_PX, "period_px": TILE_PX, "px_per_unit": W.PX_PER_UNIT,
                 "segment_height_units": H, "axis_x": TILE_W / 2},
        "style": "world", "lights": "preset world, đổi sang đèn mặt trời cùng hướng để lặp liền"})


# ----------------------------------------------------------------------------- pieces

def leaf_outline(kind):
    """Polar outline r(t) for t in [0, 2pi], blade from x=0 (stalk) to x=1 (tip); returns xy points."""
    pts = []
    N = 72
    for k in range(N):
        t = 2 * math.pi * k / N
        s = math.sin(t)
        x = (1 - math.cos(t)) / 2  # 0..1 along the blade, both edges
        side = 1 if t < math.pi else -1
        if kind == "ovate":
            w = 0.36 * math.sin(math.pi * x ** 0.8) * (1 - 0.15 * x)
        elif kind == "lance":
            w = 0.18 * math.sin(math.pi * x ** 0.65)
        elif kind == "heart":
            w = 0.42 * math.sin(math.pi * x ** 0.9) + 0.10 * math.exp(-((x - 0.08) / 0.07) ** 2)
        elif kind == "ivy":
            w = 0.30 * math.sin(math.pi * x ** 0.85) + 0.17 * math.exp(-((x - 0.42) / 0.12) ** 2)
            w *= 1 + 0.12 * math.cos(x * 9)
        elif kind == "round":
            w = 0.44 * math.sin(math.pi * x)
        elif kind == "serrate":
            w = 0.27 * math.sin(math.pi * x ** 0.75) * (1 + 0.07 * max(0, math.sin(x * 46)))
        else:
            raise ValueError(kind)
        pts.append((x, side * w * abs(s) ** 0.05))
    return pts


def leaf_mesh(name, kind, L, mat, curl=0.18, fold=0.12, twist=0.0, seed=0):
    rnd = random.Random(seed)
    outline = leaf_outline(kind)
    rings = 9
    verts, faces, uvs = [(0.0, 0.0, 0.0)], [], [(0.0, 0.5)]
    cx = 0.5
    for r in range(1, rings + 1):
        f = r / rings
        for (x, y) in outline:
            px = cx + (x - cx) * f if r < rings else x
            py = y * f
            # keep the stalk end pinned at x = 0
            px = px * (1 - (1 - f) * 0.0)
            z = curl * px ** 2 - fold * abs(py) * 1.6 + 0.02 * math.sin(px * 7 + seed)
            yy = py * (1 + twist * px)
            verts.append((px * L, yy * L, z * L))
            uvs.append((px, 0.5 + py))
    N = len(outline)
    for k in range(N):
        faces.append((0, 1 + k, 1 + (k + 1) % N))
    for r in range(rings - 1):
        for k in range(N):
            a = 1 + r * N + k
            b = 1 + r * N + (k + 1) % N
            faces.append((a, b, b + N, a + N))
    # centre ring vertex sits at blade middle; move it to keep a nice midrib
    verts[0] = (cx * L, 0.0, (curl * cx ** 2) * L)
    ob = W.mesh_from(name, verts, faces, mat=mat)
    uv = ob.data.uv_layers.new(name="UVMap")
    for poly in ob.data.polygons:
        for li in poly.loop_indices:
            uv.data[li].uv = uvs[ob.data.loops[li].vertex_index]
    sol = ob.modifiers.new("t", "SOLIDIFY")
    sol.thickness = 0.012 * L
    sub = ob.modifiers.new("s", "SUBSURF")
    sub.levels = sub.render_levels = 1
    # stalk
    st = W.mesh_from(name + "_stalk", *stalk(L), mat=mat)
    return [ob, st]


def stalk(L):
    verts, faces = [], []
    n, s = 6, 8
    for k in range(n + 1):
        x = -0.16 * L * (1 - k / n)
        z = -0.02 * L * (1 - k / n) ** 2
        for j in range(s):
            a = 2 * math.pi * j / s
            r = 0.012 * L
            verts.append((x, r * math.cos(a), z + r * math.sin(a)))
    for k in range(n):
        for j in range(s):
            a = k * s + j
            b = k * s + (j + 1) % s
            faces.append((a, b, b + s, a + s))
    return verts, faces


def leaf_material(name, base, tip, vein):
    nt = W.NT(name)
    uvn = nt.n("ShaderNodeUVMap")
    sep = nt.n("ShaderNodeSeparateXYZ")
    nt.l(uvn.outputs[0], sep.inputs[0])
    u, v = sep.outputs[0], sep.outputs[1]
    dv = nt.math("ABSOLUTE", nt.math("SUBTRACT", v, 0.5))
    col = nt.ramp(u, [(0.0, base), (1.0, tip)])
    # pinnate veins: lines along u - k*|v|, plus the midrib
    vl = nt.math("FRACT", nt.math("MULTIPLY", nt.math("SUBTRACT", u, nt.math("MULTIPLY", dv, 1.1)), 5.0))
    vline = nt.math("MULTIPLY", nt.math("LESS_THAN", nt.math("ABSOLUTE", nt.math("SUBTRACT", vl, 0.5)), 0.05), nt.math("LESS_THAN", dv, 0.3))
    mid = nt.math("LESS_THAN", dv, 0.012)
    veins = nt.math("MAXIMUM", vline, mid)
    col = nt.mix(nt.math("MULTIPLY", veins, 0.55), col, vein)
    # lighter rim on the edge of the blade
    edge = nt.math("GREATER_THAN", dv, 0.0)
    b = nt.principled(col, rough=0.38, spec=0.45, coat=0.15)
    tr = nt.n("ShaderNodeBsdfTranslucent")
    nt.l(nt.mix(0.4, col, "#E8F57A"), tr.inputs["Color"])
    mixs = nt.n("ShaderNodeMixShader")
    mixs.inputs[0].default_value = 0.22
    nt.l(b.outputs[0], mixs.inputs[1])
    nt.l(tr.outputs[0], mixs.inputs[2])
    bump = nt.n("ShaderNodeBump", Strength=0.25, Distance=0.01)
    nt.l(veins, bump.inputs["Height"])
    nt.l(bump.outputs["Normal"], b.inputs["Normal"])
    del edge
    nt.l(mixs.outputs[0], nt.out.inputs["Surface"])
    return nt.m


def simple_mat(name, color, rough=0.5, **kw):
    nt = W.NT(name)
    return nt.done(nt.principled(color, rough=rough, **kw))


def tube_path(name, pts, radius, mat, taper=True, sides=10):
    verts, faces = [], []
    n = len(pts)
    for k, p in enumerate(pts):
        p = Vector(p)
        t = (Vector(pts[min(k + 1, n - 1)]) - Vector(pts[max(k - 1, 0)])).normalized()
        ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        nx = t.cross(ref).normalized()
        ny = t.cross(nx)
        r = radius * ((1 - 0.75 * k / (n - 1)) if taper else 1.0)
        for j in range(sides):
            a = 2 * math.pi * j / sides
            verts.append(p + (nx * math.cos(a) + ny * math.sin(a)) * r)
    for k in range(n - 1):
        for j in range(sides):
            a = k * sides + j
            b = k * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    return W.mesh_from(name, verts, faces, mat=mat)


LEAVES = [  # kind, length, base colour, tip colour, vein colour
    ("ovate", 0.50, "#3F8A4A", "#7CC55E", "#C6E98A"),
    ("lance", 0.58, "#4E9A50", "#9AD86A", "#D3F09A"),
    ("heart", 0.46, "#357D48", "#6DB85A", "#BEE58A"),
    ("ivy", 0.48, "#2F7444", "#5FAE58", "#B5E08A"),
    ("round", 0.34, "#5BAA55", "#A6DE72", "#E0F5A8"),
    ("serrate", 0.54, "#3C8448", "#86CB62", "#CBEC92"),
]


def place_leaf(kind, L, mats, side, seed, tilt=0.0):
    obs = leaf_mesh(f"leaf_{kind}", kind, L, mats, seed=seed)
    root = bpy.data.objects.new("leafroot", None)
    W.link(root)
    for o in obs:
        o.parent = root
    # Blade pointing outward-and-up, facing the camera a bit, turned 180° about Z for the other side.
    root.rotation_euler = W.eul(-62 + tilt, 0.0, 28.0 if side > 0 else 180.0 - 28.0)
    return root


def build_piece(kind, idx, side):
    rnd = random.Random(idx * 31 + (1 if side > 0 else 0))
    if kind == "leaf":
        k, L, c0, c1, cv = LEAVES[idx]
        m = leaf_material(f"leafmat{idx}", c0, c1, cv)
        root = place_leaf(k, L, m, side, idx)
        root.rotation_euler.y = math.radians(rnd.uniform(-12, 12))
        return
    if kind == "branch":
        wood = simple_mat("twig", "#7A5038", rough=0.75)
        length = (0.75, 0.95, 1.15)[idx]
        pts = []
        for k in range(14):
            f = k / 13
            x = side * length * f
            z = 0.32 * length * f ** 1.6 + 0.05 * math.sin(f * 6 + idx)
            pts.append((x, -0.05 * f, z))
        tube_path("twig", pts, 0.045, wood)
        mats = [leaf_material(f"bl{i}", *LEAVES[i][2:]) for i in range(3)]
        nleaf = (3, 4, 5)[idx]
        for i in range(nleaf):
            f = 0.35 + 0.65 * i / max(1, nleaf - 1)
            px, py, pz = pts[int(f * 13)]
            kd = LEAVES[(i + idx) % 3]
            r = place_leaf(kd[0], kd[1] * rnd.uniform(0.55, 0.75), mats[(i + idx) % 3], side, i + idx * 5)
            r.location = (px, py - 0.02, pz)
            up = 1 if i % 2 == 0 else -1
            r.rotation_euler = W.eul(-60 + up * 25, rnd.uniform(-15, 15),
                                     (35 * up + 10 if side > 0 else 180 - 35 * up - 10))
        if idx == 2:  # one small bud on the longest twig
            bud(Vector(pts[-1]), 0.06, side=side)
        return
    if kind == "tendril":
        green = simple_mat("tendril", "#7CC055", rough=0.45, sss=0.2, sss_radius=(0.3, 0.6, 0.15))
        pts = []
        turns = (2.6, 3.4)[idx]
        for k in range(120):
            f = k / 119
            ang = turns * 2 * math.pi * f
            rad = 0.13 * (1 - f) ** 0.6 + 0.012
            x = side * (0.25 * f + rad * (1 - math.cos(ang)) * 0.9)
            z = 0.18 * f + rad * math.sin(ang) * (1 if idx == 0 else -0.8)
            pts.append((x, -0.03 * math.sin(ang), z))
        tube_path("tendril", pts, 0.016, green)
        return
    if kind == "bud":
        if idx == 0:
            bud(Vector((0, 0, 0)), 0.09, open_=False, side=side)
        else:
            flower_cluster(side)
        return
    if kind == "lantern":
        lantern(idx)
        return
    raise ValueError(kind)


def bud(at, size, open_=True, side=1):
    pink = simple_mat("bud", "#FF8FB0", rough=0.4, sss=0.3, sss_radius=(1.0, 0.4, 0.4))
    sepal = simple_mat("sepal", "#5E9E4E", rough=0.5)
    tube_path("budstem", [tuple(Vector(q) + at) for q in [(0, 0, 0), (side * 0.04, -0.01, 0.07), (side * 0.06, -0.02, 0.14)]], 0.012, sepal, taper=False)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=size, location=Vector((side * 0.06, -0.02, 0.14 + size * 0.9)) + at, segments=24, ring_count=12)
    b = bpy.context.active_object
    b.scale = (0.75, 0.75, 1.25)
    b.data.materials.append(pink)
    for p in b.data.polygons:
        p.use_smooth = True
    for i in range(4):
        a = i * math.pi / 2 + 0.4
        bpy.ops.mesh.primitive_uv_sphere_add(radius=size * 0.55, segments=16, ring_count=8,
                                             location=Vector((side * 0.06 + math.cos(a) * size * 0.45, -0.02 + math.sin(a) * size * 0.45, 0.14 + size * 0.35)) + at)
        s = bpy.context.active_object
        s.scale = (0.5, 0.5, 1.2)
        s.rotation_euler = (math.sin(a) * 0.5, -math.cos(a) * 0.5, 0)
        s.data.materials.append(sepal)
        for p in s.data.polygons:
            p.use_smooth = True


def flower_cluster(side):
    petal = simple_mat("petal", "#FF7FA3", rough=0.35, sss=0.35, sss_radius=(1.0, 0.35, 0.4))
    centre = simple_mat("centre", "#FFD24A", rough=0.4)
    stem = simple_mat("fstem", "#5E9E4E", rough=0.5)
    spots = [(0.0, 0.0, 0.10, 1.0), (side * 0.10, -0.02, 0.05, 0.75), (side * -0.04, -0.03, 0.17, 0.6)]
    tube_path("fstem", [(0, 0, 0), (side * 0.03, -0.01, 0.06), (0.0, 0.0, 0.10)], 0.01, stem, taper=False)
    for (x, y, z, s) in spots:
        for i in range(5):
            a = i * 2 * math.pi / 5 + s
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.045 * s, segments=16, ring_count=8,
                                                 location=(x + math.cos(a) * 0.04 * s, y - 0.01, z + math.sin(a) * 0.04 * s))
            p = bpy.context.active_object
            p.scale = (1.0, 0.35, 0.65)
            p.rotation_euler = (0, -a, 0)
            p.data.materials.append(petal)
            for f in p.data.polygons:
                f.use_smooth = True
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022 * s, location=(x, y - 0.03, z), segments=12, ring_count=6)
        c = bpy.context.active_object
        c.data.materials.append(centre)


def lantern(idx):
    """Silk lantern: round (idx 0) or diamond 'quả trám' (idx 1); anchor = top of the cord."""
    nt = W.NT(f"silk{idx}")
    b = nt.principled("#F0582A" if idx == 0 else "#E8364A", rough=0.5, sss=0.5,
                      sss_radius=(1.0, 0.45, 0.2), emit="#FF9A3A", emit_str=0.35)
    silk = nt.done(b)
    wood = simple_mat("lwood", "#6B3A24", rough=0.6, coat=0.3)
    gold = simple_mat("lgold", "#E9B44C", rough=0.3)
    tassel = simple_mat("tassel", "#D8342C", rough=0.7)
    cord = simple_mat("cord", "#5A3020", rough=0.8)
    tube_path("cord", [(0, 0, 0), (0.0, -0.01, -0.08), (0.0, 0.0, -0.16)], 0.008, cord, taper=False)
    top = -0.16
    h = 0.30 if idx == 0 else 0.36
    prof = []
    for k in range(17):
        f = k / 16
        if idx == 0:
            r = 0.16 * math.sin(math.pi * (0.08 + 0.84 * f)) + 0.03
        else:
            r = 0.15 * (1 - abs(2 * f - 1)) ** 0.9 + 0.035
        prof.append((r, top - 0.03 - h * f))
    verts, faces = [], []
    S = 48
    for (r, z) in prof:
        for j in range(S):
            a = 2 * math.pi * j / S
            rr = r * (1 - 0.06 * (math.cos(a * 8) ** 2))  # ribs
            verts.append((rr * math.cos(a), rr * math.sin(a), z))
    for k in range(len(prof) - 1):
        for j in range(S):
            a = k * S + j
            bb = k * S + (j + 1) % S
            faces.append((a, bb, bb + S, a + S))
    W.mesh_from("lantern_silk", verts, faces, mat=silk)
    for z, r in ((top - 0.02, 0.06), (top - 0.03 - h - 0.01, 0.06)):
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=0.035, location=(0, 0, z), vertices=32)
        c = bpy.context.active_object
        c.data.materials.append(wood)
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.008, location=(0, 0, z))
        bpy.context.active_object.data.materials.append(gold)
    tz = top - 0.03 - h - 0.03
    for i in range(9):
        a = i * 2 * math.pi / 9
        tube_path("tassel", [(0.012 * math.cos(a), 0.012 * math.sin(a), tz),
                             (0.02 * math.cos(a), 0.02 * math.sin(a), tz - 0.09 - 0.01 * (i % 3))], 0.006, tassel, taper=False)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, location=(0, 0, tz + 0.005), segments=12, ring_count=6)
    bpy.context.active_object.data.materials.append(gold)


PIECES = ([("leaf", i) for i in range(6)] + [("branch", i) for i in range(3)] +
          [("tendril", i) for i in range(2)] + [("bud", i) for i in range(2)] + [("lantern", i) for i in range(2)])


def render_pieces(out, st):
    W.scene(st)
    W.directional_lights(st)  # same light as the trunk tile
    meta = []
    pdir = os.path.join(out, "pieces")
    for kind, idx in PIECES:
        sides = (1,) if kind == "lantern" else (-1, 1)
        for side in sides:
            W.clear_objects()
            build_piece(kind, idx, side)
            size = {"leaf": 320, "branch": 448, "tendril": 224, "bud": 192, "lantern": 224}[kind]
            hh = {"lantern": 384}.get(kind, size)
            # frame: the anchor (0,0,0) placed so the piece grows into the frame
            cx = {1: 0.38, -1: -0.38}[side] * size / W.PX_PER_UNIT if kind not in ("lantern", "bud") else 0.0
            cz = (0.12 * size / W.PX_PER_UNIT) if kind != "lantern" else -0.28
            W.camera_frame((cx, 0.0, cz), size, hh)
            name = f"{kind}{idx}_{'R' if side > 0 else 'L'}" if kind != "lantern" else f"lantern{idx}"
            path = os.path.join(pdir, name + ".png")
            W.render(path)
            ax, ay = W.pixel_of((0.0, 0.0, 0.0))
            meta.append({"name": name, "kind": kind, "variant": idx, "side": "R" if side > 0 else "L",
                         "w": size, "h": hh, "anchor": [round(ax, 1), round(ay, 1)]})
    W.save_json(os.path.join(out, "pieces.json"), {"px_per_unit": W.PX_PER_UNIT, "pieces": meta})


def main():
    a = W.args({"out": os.path.join(W.HERE, "..", "out", "c08", "trunk"), "samples": 64, "what": "tile,pieces"})
    st = W.style("world", a["samples"])
    os.makedirs(a["out"], exist_ok=True)
    if "tile" in a["what"]:
        render_tile(a["out"], st)
    if "pieces" in a["what"]:
        render_pieces(a["out"], st)


if __name__ == "__main__":
    main()
