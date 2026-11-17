"""Chỉ thị 08 · B — tầng mây (Đồng Mây Ngọc trước) và bệ chậu rời.

  python render_floor.py -- --what floor,pedestals --theme meadow --out ../out/c08/floor [--samples 64]

Đơn vị: 1 đơn vị Blender = 1 đơn vị chậu (pots_signature: 112,8 px @2x / đơn vị = 56,4 điểm).
Tầng được dựng đúng kích thước trong game: tâm tầng ở x = 0, các ô chậu nằm trên đường y = 0,
x = -470..470 điểm; thân cây leo xuyên qua tầng ở x = -610 điểm (WORLD.trunk.x - floorCenterX).

Thân mây: metaball nhiều cỡ -> lưới -> làm mịn; màu theo độ cao: đỉnh ngà, thân đào, đáy lavender;
có tua mây rủ. Mặt trên: một khối đất phẳng có độ dày, cỏ, hoa nhỏ, đá rêu, ngọc theo chủ đề.
Ống "holdout" đúng chỗ thân cây: phần mây/cỏ nằm sau thân bị khoét trong suốt để thân cây (vẽ phía sau
tầng trong game) lộ ra, phần nằm trước vẫn che thân => thân xuyên qua mép tầng, có vòng mây ôm quanh.
Mặt tầng KHÔNG có bệ; bệ là ảnh rời (--what pedestals).
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import worldlib as W  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
from mathutils.noise import noise as pnoise  # noqa: E402

P = W.P
PT_PER_UNIT = 56.4          # game points per pot unit
PX2_PER_UNIT = 2 * PT_PER_UNIT  # @2x atlas pixels per unit
TRUNK_X = -610 / PT_PER_UNIT
TRUNK_R = 1.05              # holdout radius; the trunk sprite is ~1.16 units wide on each side
SLOT_SPAN = 940 / PT_PER_UNIT

THEMES = {
    "meadow": {  # Đồng Mây Ngọc
        "grass": ["#3F8A4A", "#5FAE58", "#8BCF6A", "#B7E37E"],
        "flowers": ["#FFFFFF", "#FFF2A8", "#FF9EBB", "#C9B5FF"],
        "soil": ["#6E4A3E", "#8A5E46"],
        "rock": "#B8A99A", "gem": "#2BC4A0",
    },
}


def plateau_outline(x0, x1, half_d, seed):
    """Organic outline of the flat top, counter-clockwise points (x, y)."""
    rnd = random.Random(seed)
    cx, ax = (x0 + x1) / 2, (x1 - x0) / 2
    pts = []
    N = 220
    for k in range(N):
        t = 2 * math.pi * k / N
        c, s = math.cos(t), math.sin(t)
        # superellipse, flatter at the sides
        e = 0.55
        x = cx + ax * math.copysign(abs(c) ** e, c)
        y = half_d * math.copysign(abs(s) ** 0.9, s)
        wob = 0.34 * pnoise(Vector((x * 0.22, y * 0.4, seed))) + 0.09 * pnoise(Vector((x * 1.1, y, seed + 3)))
        nrm = Vector((c * half_d / ax, s, 0)).normalized()
        pts.append((x + nrm.x * wob, y + nrm.y * wob * 1.4))
    del rnd
    return pts


def inside(pt, poly):
    x, y = pt
    c = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi:
            c = not c
        j = i
    return c


def earth(outline, thick, mats):
    """Flat top with thickness: top cap (fan), side wall with an uneven bottom."""
    n = len(outline)
    cx = sum(p[0] for p in outline) / n
    cy = sum(p[1] for p in outline) / n
    verts = [(cx, cy, 0.0)] + [(x, y, 0.0) for x, y in outline]
    faces = [(0, 1 + k, 1 + (k + 1) % n) for k in range(n)]
    base = len(verts)
    for k, (x, y) in enumerate(outline):
        d = thick * (1.0 + 0.45 * pnoise(Vector((x * 0.8, y * 0.8, 7.0))))
        verts.append((x * 0.985 + cx * 0.015, y * 0.97, -d))
    for k in range(n):
        a, b = 1 + k, 1 + (k + 1) % n
        faces.append((a, base + k, base + (k + 1) % n, b))
    ob = W.mesh_from("earth", verts, faces, mat=mats["soil"], smooth=False)
    ob.data.polygons[0].use_smooth = False
    bev = ob.modifiers.new("b", "BEVEL")
    bev.width = 0.05
    bev.segments = 3
    return ob


def soil_mat(th):
    """Side of the earth slab: a turf band under the lawn, then soil strata with small pebbles."""
    nt = W.NT("soil")
    tc = nt.n("ShaderNodeTexCoord")
    sep = nt.n("ShaderNodeSeparateXYZ")
    nt.l(tc.outputs["Object"], sep.inputs[0])
    n = nt.n("ShaderNodeTexNoise", Scale=3.0, Detail=6.0)
    nt.l(tc.outputs["Object"], n.inputs["Vector"])
    wave = nt.n("ShaderNodeTexWave", Scale=1.2, Distortion=6.0, Detail=3.0)
    wave.wave_type = "BANDS"
    wave.bands_direction = "Z"
    nt.l(tc.outputs["Object"], wave.inputs["Vector"])
    col = nt.ramp(nt.math("ADD", nt.math("MULTIPLY", n.outputs["Fac"], 0.6), nt.math("MULTIPLY", wave.outputs["Fac"], 0.4)),
                  [(0.3, "#5A3A3A"), (0.5, th["soil"][0]), (0.7, th["soil"][1]), (0.85, "#A27458")])
    vor = nt.n("ShaderNodeTexVoronoi", Scale=6.0, Randomness=1.0)
    nt.l(tc.outputs["Object"], vor.inputs["Vector"])
    peb = nt.math("LESS_THAN", vor.outputs["Distance"], 0.1)
    col = nt.mix(nt.math("MULTIPLY", peb, 0.6), col, "#B79A8A")
    turf = nt.n("ShaderNodeMapRange")
    turf.inputs["From Min"].default_value = -0.11
    turf.inputs["From Max"].default_value = -0.05
    nt.l(nt.math("ADD", sep.outputs["Z"], nt.math("MULTIPLY", n.outputs["Fac"], 0.06)), turf.inputs["Value"])
    col = nt.mix(turf.outputs[0], col, "#3F7F45")
    geo = nt.n("ShaderNodeNewGeometry")
    nz = nt.n("ShaderNodeSeparateXYZ")
    nt.l(geo.outputs["Normal"], nz.inputs[0])
    col = nt.mix(nt.math("GREATER_THAN", nz.outputs["Z"], 0.6), col, th["grass"][1])
    b = nt.principled(col, rough=0.9)
    bump = nt.n("ShaderNodeBump", Strength=0.5)
    nt.l(nt.math("ADD", n.outputs["Fac"], nt.math("MULTIPLY", peb, 0.4)), bump.inputs["Height"])
    nt.l(bump.outputs["Normal"], b.inputs["Normal"])
    return nt.done(b)


def rim_overhang(outline, th, seed):
    """Lawn spilling over the edge of the slab: blades rooted at the rim leaning out and down."""
    rnd = random.Random(seed + 5)
    pal = [P.hex_rgb(c) for c in th["grass"]]
    n = len(outline)
    cx = sum(p[0] for p in outline) / n
    verts, faces, cols = [], [], []
    for k in range(n):
        x, y = outline[k]
        x2, y2 = outline[(k + 1) % n]
        tx, ty = x2 - x, y2 - y
        L = math.hypot(tx, ty) or 1
        nx, ny = ty / L, -tx / L  # outward normal (outline is counter-clockwise)
        for j in range(int(L / 0.012)):
            f = j * 0.012 / L
            px, py = x + tx * f - nx * 0.03, y + ty * f - ny * 0.03
            h = rnd.uniform(0.06, 0.16)
            out = rnd.uniform(0.08, 0.2)
            droop = rnd.uniform(-0.2, -0.02)
            w = 0.018
            b = len(verts)
            verts += [(px - tx / L * w, py - ty / L * w, 0.0), (px + tx / L * w, py + ty / L * w, 0.0),
                      (px + nx * out * 0.6, py + ny * out * 0.6, h * 0.5 + droop * 0.3), (px + nx * out, py + ny * out, h * 0.45 + droop)]
            faces += [(b, b + 1, b + 2), (b, b + 2, b + 3)]
            t = rnd.randrange(3)
            cols += [pal[t], pal[t], pal[t + 1], pal[min(3, t + 1)]]
    del cx
    W.mesh_from("rim_grass", verts, faces, mat=grass_mat(), smooth=False, colors=cols)


def roots(outline, seed):
    """A few fine roots hanging from the underside of the slab, mostly hidden by the cloud."""
    rnd = random.Random(seed + 9)
    m = W.NT("root")
    m = m.done(m.principled("#7A5038", rough=0.8))
    for k in range(0, len(outline), 9):
        x, y = outline[k]
        if y > 0 or rnd.random() < 0.45:
            continue
        L = rnd.uniform(0.15, 0.45)
        pts = []
        for j in range(10):
            f = j / 9
            pts.append((x + 0.06 * math.sin(f * 5 + k), y * 0.98 - 0.02 * f, -0.22 - L * f))
        verts, faces = [], []
        for i, pnt in enumerate(pts):
            r = 0.018 * (1 - 0.8 * i / 9)
            for a in range(6):
                ang = 2 * math.pi * a / 6
                verts.append((pnt[0] + r * math.cos(ang), pnt[1] + r * math.sin(ang), pnt[2]))
        for i in range(9):
            for a in range(6):
                faces.append((i * 6 + a, i * 6 + (a + 1) % 6, (i + 1) * 6 + (a + 1) % 6, (i + 1) * 6 + a))
        W.mesh_from("root", verts, faces, mat=m)


def mushrooms(spots, seed):
    """Tiny cream mushrooms with pink spots: a point of interest, a few per floor."""
    rnd = random.Random(seed + 13)
    cap = W.NT("mcap")
    tc = cap.n("ShaderNodeTexCoord")
    vor = cap.n("ShaderNodeTexVoronoi", Scale=22.0)
    cap.l(tc.outputs["Object"], vor.inputs["Vector"])
    col = cap.mix(cap.math("LESS_THAN", vor.outputs["Distance"], 0.22), "#F7A3A8", "#FFF3E2")
    capm = cap.done(cap.principled(col, rough=0.45, sss=0.3, sss_radius=(1, 0.6, 0.5), coat=0.3))
    stem = W.NT("mstem")
    stemm = stem.done(stem.principled("#FFF6EA", rough=0.6, sss=0.3, sss_radius=(1, 0.8, 0.6)))
    for (x, y) in spots:
        for i in range(rnd.randint(2, 3)):
            s = rnd.uniform(0.6, 1.0)
            px, py = x + rnd.uniform(-0.12, 0.12), y + rnd.uniform(-0.08, 0.08)
            bpy.ops.mesh.primitive_cylinder_add(radius=0.025 * s, depth=0.12 * s, location=(px, py, 0.06 * s), vertices=12)
            bpy.context.active_object.data.materials.append(stemm)
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07 * s, location=(px, py, 0.12 * s), segments=24, ring_count=12)
            c = bpy.context.active_object
            c.scale = (1.0, 1.0, 0.6)
            for v in c.data.vertices:
                if v.co.z < 0:
                    v.co.z *= 0.25
            for poly in c.data.polygons:
                poly.use_smooth = True
            c.data.materials.append(capm)


def cloud_mat():
    """Soft but defined: shallow subsurface, lavender in the creases between billows, fine fluff bump."""
    nt = W.NT("cloud")
    tc = nt.n("ShaderNodeTexCoord")
    sep = nt.n("ShaderNodeSeparateXYZ")
    nt.l(tc.outputs["Object"], sep.inputs[0])
    n = nt.n("ShaderNodeTexNoise", Scale=0.9, Detail=3.0)
    nt.l(tc.outputs["Object"], n.inputs["Vector"])
    zz = nt.math("ADD", sep.outputs["Z"], nt.math("MULTIPLY", nt.math("SUBTRACT", n.outputs["Fac"], 0.5), 0.6))
    f = nt.n("ShaderNodeMapRange")
    f.inputs["From Min"].default_value = -3.4
    f.inputs["From Max"].default_value = 0.3
    nt.l(zz, f.inputs["Value"])
    col = nt.ramp(f.outputs[0], [(0.0, "#B4A2D4"), (0.30, "#D6B6D8"), (0.55, "#F7C7B6"), (0.82, "#FFE2D0"), (1.0, "#FFF7EA")])
    ao = nt.n("ShaderNodeAmbientOcclusion", Distance=0.6)
    ao.samples = 8
    crease = nt.n("ShaderNodeMapRange")
    crease.inputs["From Min"].default_value = 0.35
    crease.inputs["From Max"].default_value = 0.95
    nt.l(ao.outputs["AO"], crease.inputs["Value"])
    col = nt.mix(nt.math("MULTIPLY", nt.math("SUBTRACT", 1.0, crease.outputs[0]), 1.0), col, "#9C84C6")
    # each billow: sunlit ivory on top, cool lavender underneath (reads as a cloud, not a bubble)
    geo = nt.n("ShaderNodeNewGeometry")
    nz = nt.n("ShaderNodeSeparateXYZ")
    nt.l(geo.outputs["Normal"], nz.inputs[0])
    up = nt.math("POWER", nt.math("MAXIMUM", nz.outputs["Z"], 0.0), 1.5)
    dn = nt.math("MAXIMUM", nt.math("SUBTRACT", 0.0, nz.outputs["Z"]), 0.0)
    col = nt.mix(nt.math("MULTIPLY", up, 0.65), col, "#FFF6EA")
    col = nt.mix(nt.math("MULTIPLY", dn, 0.6), col, "#A893D2")
    b = nt.principled(col, rough=0.72, sss=0.6, sss_radius=(1.0, 0.8, 0.7), sss_scale=0.05, sheen=0.9, spec=0.35)
    fluff = nt.n("ShaderNodeTexNoise", Scale=14.0, Detail=6.0, Roughness=0.6)
    nt.l(tc.outputs["Object"], fluff.inputs["Vector"])
    bump = nt.n("ShaderNodeBump", Strength=0.18, Distance=0.02)
    nt.l(fluff.outputs["Fac"], bump.inputs["Height"])
    nt.l(bump.outputs["Normal"], b.inputs["Normal"])
    return nt.done(b)


def holdout_mat():
    nt = W.NT("holdout")
    h = nt.n("ShaderNodeHoldout")
    nt.l(h.outputs[0], nt.out.inputs["Surface"])
    return nt.m


def connected(balls):
    """Keep only puffs joined (overlapping) to the largest group, so no puff floats on its own."""
    n = len(balls)
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for i in range(n):
        xi, yi, zi, ri = balls[i][:4]
        for j in range(i + 1, n):
            xj, yj, zj, rj = balls[j][:4]
            if (xi - xj) ** 2 + (yi - yj) ** 2 + (zi - zj) ** 2 < (0.8 * (ri + rj)) ** 2:
                parent[find(i)] = find(j)
    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)
    keep = max(groups.values(), key=lambda g: sum(balls[i][3] ** 3 for i in g))
    print(f"[world08] puffs {n} -> {len(keep)} connected", flush=True)
    return [balls[i] for i in sorted(keep)]


def sphere_cloud(name, balls, voxel=0.04, mat=None, keep_all=False):
    """Many spheres of many sizes -> one voxel remesh -> smoothing: billowy, no seams between puffs."""
    import bmesh as _bm
    balls = balls if keep_all else connected(balls)
    bm = _bm.new()
    for (x, y, z, r, sx, sy, sz) in balls:
        m = _bm.ops.create_icosphere(bm, subdivisions=3, radius=r)
        for v in m["verts"]:
            v.co.x = v.co.x * sx + x
            v.co.y = v.co.y * sy + y
            v.co.z = v.co.z * sz + z
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    W.link(ob)
    rm = ob.modifiers.new("remesh", "REMESH")
    rm.mode = "VOXEL"
    rm.voxel_size = voxel
    sm = ob.modifiers.new("smooth", "CORRECTIVE_SMOOTH")
    sm.factor, sm.iterations, sm.use_only_smooth = 0.75, 8, True
    sm.smooth_type = "LENGTH_WEIGHTED"
    for poly in me.polygons:
        poly.use_smooth = True
    rm.use_smooth_shade = True
    if mat:
        me.materials.append(mat)
    return ob


metaball_cloud = sphere_cloud


def cloud_balls(outline, seed):
    """Three levels of billows: big masses, medium puffs on their surface, small curls on the front."""
    rnd = random.Random(seed)
    xs = [p[0] for p in outline]
    x0, x1 = min(xs), max(xs)
    mid, half = (x0 + x1) / 2, (x1 - x0) / 2
    big = []
    x = x0 + 0.9
    while x < x1 - 0.6:
        edge = max(0.0, 1 - ((x - mid) / half) ** 2)
        r = rnd.uniform(1.0, 1.7) * (0.55 + 0.55 * edge)
        z = -0.55 - r * 0.55 - rnd.uniform(0.0, 0.9) * edge
        y = rnd.uniform(-0.9, 0.9)
        big.append((x, y, z, r))
        x += r * rnd.uniform(0.75, 1.05)
    balls = [(x, y, z, r, 1, 1, 1) for x, y, z, r in big]
    # medium puffs on the surface of the masses, mostly front, sides and below
    for (bx, by, bz, br) in big:
        for k in range(rnd.randint(8, 12)):
            th = rnd.uniform(-math.pi * 0.95, -math.pi * 0.05) if rnd.random() < 0.8 else rnd.uniform(0, math.pi)
            ph = rnd.uniform(-1.1, 0.35)
            d = Vector((math.cos(th) * math.cos(ph), math.sin(th) * math.cos(ph) * 1.0, math.sin(ph))).normalized()
            r = br * rnd.uniform(0.35, 0.55)
            c = Vector((bx, by, bz)) + d * (br * 0.82)
            if c.z + r > -0.12:
                continue  # would poke through the lawn; dropping it keeps every puff attached
            st_ = rnd.uniform(1.05, 1.35)
            balls.append((c.x, c.y, c.z, r, st_, 1.0, 1.0 / st_ ** 0.6))
            # small curls on every visible side of the medium puffs (front, sides, underneath)
            if d.y < 0.3:
                for j in range(rnd.randint(2, 4)):
                    d2 = (d + Vector((rnd.uniform(-0.6, 0.6), rnd.uniform(-0.3, 0.1), rnd.uniform(-0.5, 0.5)))).normalized()
                    r2 = r * rnd.uniform(0.32, 0.5)
                    c2 = c + d2 * r * 0.85
                    if c2.z + r2 < -0.12:
                        balls.append((c2.x, c2.y, c2.z, r2, 1.2, 1.0, 0.85))
    # rim: the earth sinks into the cloud. Irregular clusters (not a bead string): a run of puffs of
    # mixed size, then a gap, each cluster bridged down into the body by a bigger puff below it.
    k = 0
    n = len(outline)
    while k < n:
        x, y = outline[k]
        side = abs(x - mid) > half * 0.86
        if y > 0.6 and not side:
            k += rnd.randint(3, 8)
            continue
        run = rnd.randint(2, 4)
        for j in range(run):
            xx, yy = outline[(k + j * 2) % n]
            r = rnd.choice((0.3, 0.38, 0.5, 0.62, 0.8)) * rnd.uniform(0.85, 1.15)
            z = rnd.uniform(-0.5, -0.2) - r * 0.45
            cx_, cy_ = xx + rnd.uniform(-0.15, 0.15), yy * 1.0 + rnd.uniform(-0.1, 0.05)
            balls.append((cx_, cy_, z, r, 1, 1, 1))
            for q in range(rnd.randint(2, 4)):  # small curls so a puff is never a plain ball
                a_ = rnd.uniform(0, 2 * math.pi)
                r2 = r * rnd.uniform(0.3, 0.48)
                balls.append((cx_ + math.cos(a_) * r * 0.75, cy_ - r * 0.45, z + math.sin(a_) * r * 0.7, r2, 1, 1, 1))
        xx, yy = outline[(k + run) % n]
        rb = rnd.uniform(0.7, 1.05)
        balls.append((xx, yy * 0.85, -0.5 - rb * 0.7, rb, 1, 1, 1))
        balls.append((x, y * 0.85, -0.5 - rb * 0.7, rb * 0.9, 1, 1, 1))
        k += run * 2 + rnd.randint(4, 14)
    # a few soft tendrils hanging down, each fused to the body (overlapping, gently tapered)
    for i in range(3):
        bx, by, bz, br = big[rnd.randrange(1, len(big) - 1)]
        x, y, z = bx + rnd.uniform(-0.4, 0.4), by - 0.2, bz - br * 0.7
        r = br * 0.55
        L = rnd.uniform(0.7, 1.2)
        steps = 7
        for j in range(steps):
            f = j / (steps - 1)
            balls.append((x + 0.45 * math.sin(f * 2.0 + i) * f, y, z - L * f, r * (1 - 0.5 * f), 1, 1, 1))
    return balls


def collar_balls(cx, cy, seed):
    rnd = random.Random(seed)
    out = []
    for k in range(17):
        a = 2 * math.pi * k / 17 + rnd.uniform(-0.12, 0.12)
        r = rnd.uniform(0.33, 0.6)
        rad = TRUNK_R + 0.25 + r * 0.4
        out.append((cx + rad * math.cos(a), cy + rad * math.sin(a) * 0.9, rnd.uniform(-0.15, 0.08), r, 1, 1, 1))
    return out


def grass(outline, th, seed, density=420, avoid=()):
    rnd = random.Random(seed)
    xs = [p[0] for p in outline]
    ys = [p[1] for p in outline]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    area = (x1 - x0) * (y1 - y0)
    verts, faces, cols = [], [], []
    pal = [P.hex_rgb(c) for c in th["grass"]]
    n = int(area * density)
    for i in range(n):
        x, y = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
        if not inside((x, y), outline):
            continue
        if any((x - ax) ** 2 + (y - ay) ** 2 < ar * ar for ax, ay, ar in avoid):
            continue
        # detail where the player looks: front half denser and taller tufts at the rim
        front = (y1 - y) / (y1 - y0)
        if rnd.random() > 0.45 + 0.55 * front:
            continue
        clump = pnoise(Vector((x * 0.9, y * 0.9, seed)))
        h = (0.07 + 0.09 * rnd.random()) * (1.0 + 0.6 * max(0.0, clump))
        w = 0.022 + 0.012 * rnd.random()
        a = rnd.uniform(0, math.pi)
        lean = Vector((rnd.uniform(-0.4, 0.4), rnd.uniform(-0.4, 0.2), 0)) * h
        dx, dy = math.cos(a) * w, math.sin(a) * w
        b = len(verts)
        verts += [(x - dx, y - dy, 0.0), (x + dx, y + dy, 0.0), (x + lean.x * 0.4, y + lean.y * 0.4, h * 0.55),
                  (x + lean.x, y + lean.y, h)]
        faces += [(b, b + 1, b + 2), (b + 2, b + 1, b + 3)] if False else [(b, b + 1, b + 2), (b, b + 2, b + 3)]
        t = min(3, max(0, int((clump + 0.5) * 3 + rnd.random())))
        base = pal[max(0, t - 1)]
        tip = pal[min(3, t + 1)]
        cols += [base, base, tuple((u + v) / 2 for u, v in zip(base, tip)), tip]
    ob = W.mesh_from("grass", verts, faces, mat=grass_mat(), smooth=False, colors=cols)
    return ob


def grass_mat():
    nt = W.NT("grass")
    a = nt.n("ShaderNodeAttribute")
    a.attribute_name = "Col"
    b = nt.principled(a.outputs["Color"], rough=0.55, sss=0.2, sss_radius=(0.3, 0.6, 0.15), spec=0.3)
    tr = nt.n("ShaderNodeBsdfTranslucent")
    nt.l(a.outputs["Color"], tr.inputs["Color"])
    m = nt.n("ShaderNodeMixShader")
    m.inputs[0].default_value = 0.25
    nt.l(b.outputs[0], m.inputs[1])
    nt.l(tr.outputs[0], m.inputs[2])
    nt.l(m.outputs[0], nt.out.inputs["Surface"])
    return nt.m


def flowers(outline, th, seed, avoid=()):
    rnd = random.Random(seed)
    xs = [p[0] for p in outline]
    ys = [p[1] for p in outline]
    mats = []
    for c in th["flowers"]:
        nt = W.NT("fl" + c)
        mats.append(nt.done(nt.principled(c, rough=0.45, sss=0.3, sss_radius=(1, 0.6, 0.6))))
    heart = W.NT("flc")
    heart = heart.done(heart.principled("#FFC93C", rough=0.4))
    verts_by = [[] for _ in mats]
    # clusters, more of them towards the front rim
    for c in range(36):
        cx = rnd.uniform(min(xs) + 0.5, max(xs) - 0.5)
        cy = rnd.uniform(min(ys) + 0.3, max(ys) - 0.3)
        if rnd.random() < 0.5:
            cy = -abs(cy)
        if not inside((cx, cy), outline):
            continue
        mi = rnd.randrange(len(mats))
        for f in range(rnd.randint(3, 9)):
            x = cx + rnd.gauss(0, 0.25)
            y = cy + rnd.gauss(0, 0.18)
            if not inside((x, y), outline) or any((x - ax) ** 2 + (y - ay) ** 2 < ar * ar for ax, ay, ar in avoid):
                continue
            verts_by[mi].append((x, y, 0.09 + rnd.random() * 0.06, 0.035 + rnd.random() * 0.025))
    for mi, items in enumerate(verts_by):
        for (x, y, z, r) in items:
            for p in range(5):
                a = 2 * math.pi * p / 5
                bpy.ops.mesh.primitive_uv_sphere_add(radius=r * 0.6, segments=8, ring_count=5,
                                                     location=(x + math.cos(a) * r * 0.7, y + math.sin(a) * r * 0.25, z + math.sin(a) * r * 0.5))
                o = bpy.context.active_object
                o.scale = (1.0, 0.6, 0.45)
                o.data.materials.append(mats[mi])
            bpy.ops.mesh.primitive_uv_sphere_add(radius=r * 0.35, segments=8, ring_count=5, location=(x, y - 0.02, z))
            bpy.context.active_object.data.materials.append(heart)


def rock(name, at, size, mat, seed, flat=0.6):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=size, location=at)
    o = bpy.context.active_object
    o.name = name
    for v in o.data.vertices:
        n = pnoise(v.co * 1.7 + Vector((seed, seed * 0.3, 0)))
        v.co *= 1.0 + 0.18 * n
        v.co.z *= flat
    for p in o.data.polygons:
        p.use_smooth = True
    o.data.materials.append(mat)
    return o


def rock_mat(color, moss="#5FAE58", moss_at=0.48):
    nt = W.NT("rock" + color)
    tc = nt.n("ShaderNodeTexCoord")
    n = nt.n("ShaderNodeTexNoise", Scale=4.0, Detail=6.0)
    nt.l(tc.outputs["Object"], n.inputs["Vector"])
    geo = nt.n("ShaderNodeNewGeometry")
    sep = nt.n("ShaderNodeSeparateXYZ")
    nt.l(geo.outputs["Normal"], sep.inputs[0])
    col = nt.ramp(n.outputs["Fac"], [(0.3, "#8C7C7A"), (0.7, color)])
    mossy = nt.math("MULTIPLY", nt.math("GREATER_THAN", sep.outputs["Z"], 0.55), nt.math("GREATER_THAN", n.outputs["Fac"], moss_at))
    col = nt.mix(mossy, col, moss)
    b = nt.principled(col, rough=0.85)
    bump = nt.n("ShaderNodeBump", Strength=0.4)
    nt.l(n.outputs["Fac"], bump.inputs["Height"])
    nt.l(bump.outputs["Normal"], b.inputs["Normal"])
    return nt.done(b)


def gem_mat(color):
    nt = W.NT("gem" + color)
    return nt.done(nt.principled(color, rough=0.12, sss=0.5, sss_radius=(0.3, 1.0, 0.8), coat=0.6, trans=0.2))


def build_floor(theme, seed=8):
    th = THEMES[theme]
    x0, x1 = TRUNK_X - 1.9, SLOT_SPAN / 2 + 1.7
    outline = plateau_outline(x0, x1, 2.5, seed)
    mats = {"soil": soil_mat(th)}
    earth(outline, 0.3, mats)
    cm = cloud_mat()
    sphere_cloud("cloud", cloud_balls(outline, seed), mat=cm)
    ty = 0.35
    sphere_cloud("collar", collar_balls(TRUNK_X, ty, seed), voxel=0.035, mat=cm, keep_all=True)
    avoid = [(TRUNK_X, ty, TRUNK_R + 0.1)]
    grass(outline, th, seed, avoid=avoid)
    rim_overhang(outline, th, seed)
    roots(outline, seed)
    flowers(outline, th, seed, avoid=avoid)
    xs_ = [p[0] for p in outline]
    mushrooms([(min(xs_) + 2.3, -1.5), (max(xs_) - 2.2, -1.6)], seed)
    rm = stone_mat("#ADA4A6", "#7D7480", 5)
    rnd = random.Random(seed + 1)
    for i, (x, y, s) in enumerate([(x0 + 1.0, -1.6, 0.42), (x0 + 1.5, -2.05, 0.24), (x1 - 1.1, -1.4, 0.5),
                                   (x1 - 0.7, -1.9, 0.26), (-1.7, -2.15, 0.2), (3.9, 2.0, 0.34), (-6.3, 1.9, 0.28)]):
        rock(f"rock{i}", (x, y, s * 0.15), s, rm, i + seed, flat=rnd.uniform(0.5, 0.75))
    gm = gem_mat(th["gem"])
    for i, (x, y) in enumerate([(x0 + 1.9, -1.8), (x1 - 1.5, -1.9), (-5.2, -2.2), (6.1, -2.15), (0.6, 2.1)]):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.09 + 0.03 * (i % 2), location=(x, y, 0.06))
        g = bpy.context.active_object
        g.rotation_euler = (0.4 * i, 0.7, 0.3 * i)
        g.scale = (0.8, 0.8, 1.4)
        g.data.materials.append(gm)
    # holdout where the trunk passes through (shows the trunk drawn behind the floor)
    bpy.ops.mesh.primitive_cylinder_add(radius=TRUNK_R, depth=14.0, location=(TRUNK_X, ty, 0.0), vertices=64)
    proxy = bpy.context.active_object
    proxy.name = "trunk_holdout"
    proxy.data.materials.append(holdout_mat())
    return outline, ty


def render_floor(out, st, theme, seed=8, suffix=""):
    W.scene(st)
    W.directional_lights(st)
    outline, ty = build_floor(theme, seed)
    xs = [p[0] for p in outline]
    left, right = min(xs) - 0.9, max(xs) + 0.9
    top, bottom = 2.0, -5.6  # screen extent in units around z (approx; tilt is small)
    cxw = (left + right) / 2
    wpx = int(round((right - left) * PX2_PER_UNIT / 8)) * 8
    hpx = int(round((top - bottom) * PX2_PER_UNIT / 8)) * 8
    pv = float(os.environ.get("C08_PREVIEW", "1"))
    W.camera_frame((cxw, 0.0, (top + bottom) / 2), int(wpx * pv), int(hpx * pv), px_per_unit=PX2_PER_UNIT * pv)
    path = os.path.join(out, f"floor_{theme}{suffix}.png")
    W.render(path)
    origin = W.pixel_of((0.0, 0.0, 0.0))
    trunk_top = W.pixel_of((TRUNK_X, ty, 0.0))
    slots = {}
    for n in range(1, 11):
        sp = SLOT_SPAN / (n - 1) if n > 1 else 0
        slots[n] = [round(W.pixel_of((-SLOT_SPAN / 2 + i * sp, 0.0, 0.0))[0], 1) for i in range(n)]
    # plateau x-extent along the slot line y = 0, to check pedestals stay on the grass
    on_line = [x for x in [left + k * 0.02 for k in range(int((right - left) / 0.02))] if inside((x, 0.0), outline)]
    W.save_json(os.path.join(out, f"floor_{theme}{suffix}.json"), {
        "theme": theme, "seed": seed, "w": wpx, "h": hpx, "scale": 2, "px_per_unit": PX2_PER_UNIT,
        "origin_px": [round(origin[0], 1), round(origin[1], 1)],
        "note": "origin_px = điểm (0,0) của tầng trong code (tâm hàng chậu, chân chậu). Ảnh @2x.",
        "trunk": {"x_px": round(trunk_top[0], 1), "y_px": round(trunk_top[1], 1), "x_pt_from_origin": -610},
        "grass_line_px": [round(W.pixel_of((min(on_line), 0, 0))[0], 1), round(W.pixel_of((max(on_line), 0, 0))[0], 1)],
        "slot_x_px": slots,
    })


# ----------------------------------------------------------------------------- pedestals

def stone_mat(base, dark, seed):
    """Worn stone: cool-warm grey, dark crevices from AO, speckles, soft fuzzy moss on edges and low side."""
    nt = W.NT(f"stone{seed}")
    tc = nt.n("ShaderNodeTexCoord")
    n = nt.n("ShaderNodeTexNoise", Scale=5.0, Detail=8.0, Roughness=0.6)
    nt.l(tc.outputs["Object"], n.inputs["Vector"])
    big = nt.n("ShaderNodeTexNoise", Scale=1.6, Detail=2.0)
    nt.l(tc.outputs["Object"], big.inputs["Vector"])
    col = nt.ramp(nt.math("ADD", nt.math("MULTIPLY", n.outputs["Fac"], 0.6), nt.math("MULTIPLY", big.outputs["Fac"], 0.4)),
                  [(0.3, dark), (0.55, base), (0.75, "#E3D8CC")])
    vor = nt.n("ShaderNodeTexVoronoi", Scale=40.0)
    nt.l(tc.outputs["Object"], vor.inputs["Vector"])
    col = nt.mix(nt.math("MULTIPLY", nt.math("LESS_THAN", vor.outputs["Distance"], 0.12), 0.35), col, "#6E6260")
    crk = nt.n("ShaderNodeTexVoronoi", Scale=3.2, Randomness=1.0)
    crk.feature = "DISTANCE_TO_EDGE"
    nt.l(tc.outputs["Object"], crk.inputs["Vector"])
    crack = nt.math("LESS_THAN", nt.math("ADD", crk.outputs["Distance"], nt.math("MULTIPLY", n.outputs["Fac"], 0.03)), 0.035)
    col = nt.mix(nt.math("MULTIPLY", crack, 0.5), col, "#5E4A58")
    ao = nt.n("ShaderNodeAmbientOcclusion", Distance=0.12)
    ao.samples = 8
    col = nt.mix(nt.math("MULTIPLY", nt.math("SUBTRACT", 1.0, ao.outputs["AO"]), 0.9), col, "#5E4A58")
    # moss: where the surface is near the rim (normal turning sideways) and low, with a soft noisy border
    geo = nt.n("ShaderNodeNewGeometry")
    nz = nt.n("ShaderNodeSeparateXYZ")
    nt.l(geo.outputs["Normal"], nz.inputs[0])
    edge = nt.math("SUBTRACT", 1.0, nt.math("ABSOLUTE", nz.outputs["Z"]))
    mn = nt.n("ShaderNodeTexNoise", Scale=7.0, Detail=10.0, Roughness=0.7)
    nt.l(tc.outputs["Object"], mn.inputs["Vector"])
    mamt = nt.math("ADD", nt.math("MULTIPLY", edge, 0.55), nt.math("MULTIPLY", mn.outputs["Fac"], 1.0))
    mr = nt.n("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.88
    mr.inputs["From Max"].default_value = 1.02
    nt.l(mamt, mr.inputs["Value"])
    moss = nt.ramp(mn.outputs["Fac"], [(0.35, "#3F7A44"), (0.6, "#6FA85E"), (0.8, "#A9D37A")])
    col = nt.mix(mr.outputs[0], col, moss)
    b = nt.principled(col, rough=0.85, sheen=0.2)
    bump = nt.n("ShaderNodeBump", Strength=0.6, Distance=0.02)
    nt.l(nt.math("SUBTRACT", nt.math("ADD", n.outputs["Fac"], nt.math("MULTIPLY", mr.outputs[0], 0.6)), nt.math("MULTIPLY", crack, 0.5)), bump.inputs["Height"])
    nt.l(bump.outputs["Normal"], b.inputs["Normal"])
    return nt.done(b)


def slab(name, at, radius, height, mat, seed, squash=0.84):
    """Stone slab with steep worn sides and a flat-ish top."""
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=height, location=at, vertices=48)
    o = bpy.context.active_object
    o.name = name
    o.scale = (1.0, squash, 1.0)
    rnd = random.Random(seed)
    for v in o.data.vertices:  # irregular outline
        a = math.atan2(v.co.y, v.co.x)
        k = 1.0 + 0.07 * math.sin(3 * a + seed) + 0.04 * math.sin(7 * a + seed * 2)
        v.co.x *= k
        v.co.y *= k
        if v.co.z > 0:
            v.co.z += 0.015 * math.sin(2 * a + seed)
    bev = o.modifiers.new("bev", "BEVEL")
    bev.width, bev.segments, bev.limit_method = height * 0.38, 5, "ANGLE"
    sub = o.modifiers.new("sub", "SUBSURF")
    sub.levels = sub.render_levels = 2
    tex = bpy.data.textures.new(f"stone_disp{seed}", "CLOUDS")
    tex.noise_scale = 0.18
    disp = o.modifiers.new("disp", "DISPLACE")
    disp.texture = tex
    disp.strength = 0.025
    disp.mid_level = 0.5
    for poly in o.data.polygons:
        poly.use_smooth = True
    o.data.materials.append(mat)
    del rnd
    return o


def pedestal(theme, variant, th):
    """A low worn stone the pot stands on: visible thickness, rounded edges, moss on the sides."""
    if theme == "meadow":
        if variant == 0:  # one broad slab, slightly tilted
            m = stone_mat("#ADA4A6", "#7D7480", 11)
            o = slab("ped", (0, 0, 0.07), 0.78, 0.2, m, 11)
            o.rotation_euler = (0.03, -0.035, 0.25)
            top = 0.17
        else:  # a slab resting on a lower, wider one, shifted and turned
            m = stone_mat("#B3A9A6", "#827783", 23)
            slab("ped_lo", (0.12, 0.06, 0.02), 0.84, 0.14, m, 21, squash=0.8).rotation_euler = (0, 0, 0.6)
            slab("ped_hi", (-0.05, -0.03, 0.15), 0.66, 0.15, m, 23).rotation_euler = (0.02, 0.03, -0.3)
            top = 0.225
        return top
    raise ValueError(theme)


def pedestal_grass(th, seed):
    """Tufts around the foot (more in front) so the stone sinks into the lawn."""
    ring = []
    rnd = random.Random(seed)
    for k in range(140):
        a = rnd.uniform(0, 2 * math.pi)
        r = rnd.uniform(0.7, 1.05)
        ring.append((math.cos(a) * r, math.sin(a) * r * 0.8))
    pal = [P.hex_rgb(c) for c in th["grass"]]
    verts, faces, cols = [], [], []
    for (x, y) in ring:
        for t in range(3):
            h = rnd.uniform(0.06, 0.15)
            w = 0.02
            a = rnd.uniform(0, math.pi)
            dx, dy = math.cos(a) * w, math.sin(a) * w
            lx, ly = x + rnd.uniform(-0.05, 0.05), y + rnd.uniform(-0.05, 0.05)
            b = len(verts)
            verts += [(lx - dx, ly - dy, -0.02), (lx + dx, ly + dy, -0.02), (lx + rnd.uniform(-0.03, 0.03), ly - 0.02, h)]
            faces.append((b, b + 1, b + 2))
            c0, c1 = pal[rnd.randrange(2)], pal[2 + rnd.randrange(2)]
            cols += [c0, c0, c1]
    W.mesh_from("pgrass", verts, faces, mat=grass_mat(), smooth=False, colors=cols)
    fm = W.NT("pflower")
    fm = fm.done(fm.principled(th["flowers"][seed % len(th["flowers"])], rough=0.45, sss=0.3, sss_radius=(1, 0.6, 0.6)))
    for k in range(3):
        a = rnd.uniform(-2.6, -0.5)
        x, y = math.cos(a) * 0.88, math.sin(a) * 0.72
        for p_ in range(5):
            aa = 2 * math.pi * p_ / 5
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, segments=8, ring_count=5,
                                                 location=(x + math.cos(aa) * 0.026, y, 0.1 + math.sin(aa) * 0.022))
            bpy.context.active_object.data.materials.append(fm)


def shadow_catcher():
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, -0.02))
    pl = bpy.context.active_object
    pl.is_shadow_catcher = True
    return pl


def render_pedestals(out, st, theme):
    W.scene(st)
    W.directional_lights(st)
    th = THEMES[theme]
    meta = []
    for v in range(2):
        W.clear_objects()
        top = pedestal(theme, v, th)
        pedestal_grass(th, 40 + v)
        shadow_catcher()
        W.camera_frame((0.0, 0.0, 0.1), 256, 160, px_per_unit=PX2_PER_UNIT)
        name = f"ped_{theme}_{v}"
        W.render(os.path.join(out, name + ".png"))
        ax, ay = W.pixel_of((0, 0, 0))
        tx, tyy = W.pixel_of((0, 0, top))
        meta.append({"name": name, "w": 256, "h": 160, "anchor_px": [round(ax, 1), round(ay, 1)],
                     "pot_base_px": [round(tx, 1), round(tyy, 1)], "top_units": round(top, 3)})
    W.save_json(os.path.join(out, f"pedestals_{theme}.json"), {"scale": 2, "pedestals": meta})


def main():
    a = W.args({"out": os.path.join(W.HERE, "..", "out", "c08", "floor"), "samples": 64,
                "what": "floor,pedestals", "theme": "meadow", "seeds": "8,21"})
    st = W.style("world", a["samples"])
    os.makedirs(a["out"], exist_ok=True)
    if "pedestals" in a["what"]:
        render_pedestals(a["out"], st, a["theme"])
    if "floor" in a["what"]:
        for i, seed in enumerate(int(x) for x in str(a["seeds"]).split(",")):
            render_floor(a["out"], st, a["theme"], seed, "_" + "abcdefgh"[i])


if __name__ == "__main__":
    main()
