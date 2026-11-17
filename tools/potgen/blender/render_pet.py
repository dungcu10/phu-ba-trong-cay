"""Chỉ thị 08 · C — thú cưng chibi. Bước 1: Mèo Mây.

  python render_pet.py -- --pet cloud_cat --out ../out/c08/pet [--samples 64]

Chibi: đầu khoảng 55% chiều cao, mắt to bóng với 2 đốm sáng, má hồng — cùng vật liệu mặt với chậu
(face_eye / face_hi / face_blush của render_catalog). Mèo Mây: đuôi là một cụm mây (cùng vật liệu
mây với tầng), trăng khuyết vàng trên trán, cổ có cụm mây.
Xuất: idle (đứng yên), breathe_0..5 (thở/nhún), happy (vui). Ánh sáng: preset world (đèn vùng như chậu).
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import worldlib as W  # noqa: E402
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

P = W.P
TURN = math.radians(16)  # 3/4 view, same idea as the pots' faces


def mat(name, color, **kw):
    nt = W.NT(name)
    return nt.done(nt.principled(color, **kw))


def fur_mat():
    nt = W.NT("fur")
    tc = nt.n("ShaderNodeTexCoord")
    sep = nt.n("ShaderNodeSeparateXYZ")
    nt.l(tc.outputs["Object"], sep.inputs[0])
    f = nt.n("ShaderNodeMapRange")
    f.inputs["From Min"].default_value = 0.0
    f.inputs["From Max"].default_value = 0.75
    nt.l(sep.outputs["Z"], f.inputs["Value"])
    col = nt.ramp(f.outputs[0], [(0.0, "#F3D9E6"), (0.45, "#FFF1EA"), (1.0, "#FFF9F2")])
    n = nt.n("ShaderNodeTexNoise", Scale=26.0, Detail=3.0)
    nt.l(tc.outputs["Object"], n.inputs["Vector"])
    b = nt.principled(col, rough=0.7, sss=0.35, sss_radius=(1.0, 0.6, 0.5), sss_scale=0.08, sheen=0.8)
    bump = nt.n("ShaderNodeBump", Strength=0.08)
    nt.l(n.outputs["Fac"], bump.inputs["Height"])
    nt.l(bump.outputs["Normal"], b.inputs["Normal"])
    return nt.done(b)


def cloud_mat():
    nt = W.NT("pcloud")
    tc = nt.n("ShaderNodeTexCoord")
    sep = nt.n("ShaderNodeSeparateXYZ")
    nt.l(tc.outputs["Object"], sep.inputs[0])
    f = nt.n("ShaderNodeMapRange")
    f.inputs["From Min"].default_value = 0.0
    f.inputs["From Max"].default_value = 0.9
    nt.l(sep.outputs["Z"], f.inputs["Value"])
    col = nt.ramp(f.outputs[0], [(0.0, "#D6C3EA"), (0.3, "#FBD3C6"), (0.55, "#FFEADB"), (1.0, "#FFF8EE")])
    return nt.done(nt.principled(col, rough=0.9, sss=0.25, sss_radius=(1.0, 0.75, 0.6), sss_scale=0.05, sheen=0.6, spec=0.2))


def ellipsoid(name, loc, scale, m, rot=(0, 0, 0), sub=4):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    ob.scale = scale
    ob.rotation_euler = rot
    me.materials.append(m)
    return W.link(ob)


def puffs(name, balls, m, voxel=0.018, smooth=4):
    bm = bmesh.new()
    for (x, y, z, r) in balls:
        res = bmesh.ops.create_icosphere(bm, subdivisions=3, radius=r)
        bmesh.ops.translate(bm, vec=Vector((x, y, z)), verts=res["verts"])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    W.link(ob)
    rm = ob.modifiers.new("r", "REMESH")
    rm.mode, rm.voxel_size, rm.use_smooth_shade = "VOXEL", voxel, True
    sm = ob.modifiers.new("s", "CORRECTIVE_SMOOTH")
    sm.factor, sm.iterations, sm.use_only_smooth = 0.7, smooth, True
    me.materials.append(m)
    return ob


def tube(name, pts, r, m, sides=10):
    verts, faces = [], []
    n = len(pts)
    for k, p in enumerate(pts):
        p = Vector(p)
        t = (Vector(pts[min(k + 1, n - 1)]) - Vector(pts[max(k - 1, 0)])).normalized()
        ref = Vector((0, 1, 0)) if abs(t.y) < 0.9 else Vector((1, 0, 0))
        nx = t.cross(ref).normalized()
        ny = t.cross(nx)
        for j in range(sides):
            a = 2 * math.pi * j / sides
            verts.append(p + (nx * math.cos(a) + ny * math.sin(a)) * r)
    for k in range(n - 1):
        for j in range(sides):
            a = k * sides + j
            b = k * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    return W.mesh_from(name, verts, faces, mat=m)


def crescent(name, loc, size, m, rot):
    """Flat gold crescent: a disc minus an offset disc, beveled."""
    pts = []
    N = 40
    for k in range(N + 1):  # outer arc
        a = math.radians(-125 + 250 * k / N)
        pts.append((math.cos(a), math.sin(a)))
    for k in range(N + 1):  # inner arc back (offset circle)
        a = math.radians(105 - 210 * k / N)
        pts.append((0.42 + 0.78 * math.cos(a), 0.78 * math.sin(a)))
    verts = [(x * size, 0.0, y * size) for x, y in pts]
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in verts]
    face = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    bmesh.ops.translate(bm, vec=Vector((0, -0.25 * size, 0)), verts=[e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)])
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    ob.rotation_euler = rot
    bev = ob.modifiers.new("b", "BEVEL")
    bev.width, bev.segments = 0.12 * size, 3
    me.materials.append(m)
    return W.link(ob)


def build_cat(phase=0.0, happy=False):
    """Built around the origin = ground point under the cat."""
    fur = fur_mat()
    cl = cloud_mat()
    eye = mat("eye", "#24151C", rough=0.08, coat=1.0)
    hi = mat("hi", "#FFFFFF", emit="#FFFFFF", emit_str=2.0)
    blush = mat("blush", "#FF8FAB", rough=0.7)
    pink = mat("pink", "#FFA7BE", rough=0.5, sss=0.3, sss_radius=(1, 0.4, 0.4))
    gold = mat("gold", "#F2B93B", rough=0.22, emit="#FFC94A", emit_str=0.25)
    root = bpy.data.objects.new("cat", None)
    W.link(root)

    def own(ob):
        ob.parent = root
        return ob

    br = math.sin(phase)
    # body: a soft pear, sitting
    sq = 1.0 + 0.035 * br
    own(ellipsoid("body", (0, 0.02, 0.28 * sq), (0.28 / math.sqrt(sq), 0.26, 0.3 * sq), fur))
    own(ellipsoid("belly", (0, -0.14, 0.22 * sq), (0.18, 0.11, 0.18 * sq), fur))
    # front paws and hind feet
    for s in (-1, 1):
        if happy and s > 0:
            own(ellipsoid("pawup", (0.33, -0.24, 0.5), (0.08, 0.075, 0.095), fur))
            own(ellipsoid("pawpad", (0.335, -0.31, 0.51), (0.045, 0.02, 0.045), pink))
        else:
            own(ellipsoid("paw", (0.12 * s, -0.22, 0.06), (0.085, 0.1, 0.07), fur))
        own(ellipsoid("foot", (0.26 * s, -0.08, 0.07), (0.1, 0.13, 0.075), fur))
    # cloud bib on the chest: billows of mixed size, not a ring of beads
    rnd = random.Random(3)
    balls = []
    for k in range(9):
        a = math.radians(-160 + 140 * k / 8) + rnd.uniform(-0.1, 0.1)
        r = rnd.choice((0.07, 0.09, 0.11, 0.13))
        balls.append((0.24 * math.cos(a), 0.2 * math.sin(a) - 0.05, 0.5 + 0.025 * br + rnd.uniform(-0.04, 0.03), r))
    for k in range(4):
        balls.append((rnd.uniform(-0.12, 0.12), -0.21, 0.42 + rnd.uniform(-0.04, 0.04), rnd.uniform(0.06, 0.09)))
    own(puffs("bib", balls, cl, voxel=0.012))
    # head (~55% of the height)
    hz = 0.83 + 0.02 * br
    tilt = math.radians(8 if happy else 0)
    head = own(ellipsoid("head", (0, -0.02, hz), (0.45, 0.39, 0.35), fur, rot=(0, tilt, 0)))
    for s in (-1, 1):  # cheek fluff
        own(ellipsoid("cheek", (0.36 * s, -0.12, hz - 0.13), (0.13, 0.12, 0.1), fur))
    # ears: rounded cones with pink inside
    for s in (-1, 1):
        lift = 0.04 if happy else 0.0
        ex, ez = 0.26 * s, hz + 0.26 + lift
        ear = own(ellipsoid("ear", (ex, 0.02, ez), (0.12, 0.07, 0.16), fur, rot=(0, -0.38 * s, 0)))
        own(ellipsoid("earin", (ex - 0.005 * s, -0.035, ez - 0.01), (0.07, 0.03, 0.1), pink, rot=(0, -0.38 * s, 0)))
        bpy.context.view_layer.update()
        # pull the top of the ear into a point
        for v in ear.data.vertices:
            if v.co.z > 0.3:
                k = (v.co.z - 0.3) / 0.7
                v.co.x *= 1 - 0.65 * k
                v.co.y *= 1 - 0.55 * k
                v.co.z *= 1 + 0.25 * k
    # face (front of the head is -Y)
    fy = -0.375
    for s in (-1, 1):
        if happy:
            pts = [(0.15 * s + 0.07 * math.cos(math.pi * k / 10), fy - 0.01, hz - 0.01 + 0.055 * math.sin(math.pi * k / 10)) for k in range(11)]
            own(tube("eyeclosed", pts, 0.017, eye))
        else:
            own(ellipsoid("eye", (0.16 * s, fy + 0.02, hz - 0.03), (0.098, 0.05, 0.122), eye))
            own(ellipsoid("hi1", (0.16 * s - 0.018, fy - 0.03, hz + 0.02), (0.032, 0.012, 0.034), hi))
            own(ellipsoid("hi2", (0.16 * s + 0.03, fy - 0.03, hz - 0.075), (0.016, 0.008, 0.017), hi))
        own(ellipsoid("blush", (0.25 * s, fy + 0.045, hz - 0.13), (0.065, 0.018, 0.035), blush, rot=(0, 0, -0.5 * s)))
    own(ellipsoid("nose", (0, fy - 0.022, hz - 0.085), (0.026, 0.015, 0.018), pink))
    mw = 1.25 if happy else 1.0
    for s in (-1, 1):  # "ω" mouth
        pts = [(s * (0.035 * mw) * (1 - math.cos(math.pi * k / 8)), fy - 0.012, hz - 0.115 - 0.025 * math.sin(math.pi * k / 8) * mw) for k in range(9)]
        own(tube("mouth", pts, 0.0085, eye))
    if happy:
        own(ellipsoid("tongue", (0, fy - 0.012, hz - 0.15), (0.03, 0.012, 0.022), pink))
    # whiskers, thin and few
    for s in (-1, 1):
        for j in range(2):
            pts = [(s * (0.36 + 0.12 * k / 6), fy + 0.1, hz - 0.09 - 0.03 * j + 0.012 * k / 6 * (1 - 2 * j)) for k in range(7)]
            own(tube("whisker", pts, 0.0045, mat("wh", "#E9D7DE", rough=0.6), sides=6))
    # golden crescent on the forehead
    own(crescent("moon", (0.0, fy + 0.06, hz + 0.165), 0.085, gold, (math.radians(-14), 0, math.radians(-20))))
    # cloud tail: a curled cluster of puffs rising behind on the right
    sway = math.radians(5) * br + (math.radians(12) if happy else 0)
    tb = []
    rnd = random.Random(9)
    for k in range(16):
        f = k / 15
        a = 0.2 + f * 3.4
        x = 0.30 + 0.20 * f + 0.13 * math.sin(a)
        z = 0.15 + 0.62 * f + 0.07 * math.cos(a)
        x, z = x * math.cos(sway) - (z - 0.15) * math.sin(sway), 0.15 + x * math.sin(sway) + (z - 0.15) * math.cos(sway)
        r = 0.07 + 0.07 * math.sin(math.pi * min(1.0, f * 1.15)) + rnd.uniform(-0.012, 0.02)
        tb.append((x, 0.2 - 0.05 * f, z, r))
        for q in range(2):  # billows on the outside of the tail
            a_ = rnd.uniform(0, 2 * math.pi)
            tb.append((x + math.cos(a_) * r * 0.8, 0.2 - 0.05 * f - r * 0.3, z + math.sin(a_) * r * 0.8, r * rnd.uniform(0.45, 0.62)))
    own(puffs("tail", tb, cl, voxel=0.012, smooth=8))
    root.rotation_euler = (0, 0, -TURN)
    return root


def render_cat(out, st, only=""):
    W.scene(st)
    frames = [("idle", 0.0, False)] + [(f"breathe_{i}", 2 * math.pi * i / 6, False) for i in range(6)] + [("happy", math.pi / 2, True)]
    if only:
        frames = [f for f in frames if f[0] in only.split(",")]
    meta = []
    for name, ph, happy in frames:
        W.clear_objects()
        build_cat(ph, happy)
        W.camera_frame((0.0, 0.0, 0.62), 640, 640, px_per_unit=400)
        W.render(os.path.join(out, f"cloud_cat_{name}.png"))
        gx, gy = W.pixel_of((0, 0, 0))
        meta.append({"name": name, "w": 640, "h": 640, "ground_px": [round(gx, 1), round(gy, 1)]})
    W.save_json(os.path.join(out, "cloud_cat.json"), {"px_per_unit": 400, "frames": meta,
                                                       "note": "ground_px = điểm chạm đất (gốc tọa độ). Thu về @2x: × 112.8/400."})


def main():
    a = W.args({"out": os.path.join(W.HERE, "..", "out", "c08", "pet"), "samples": 64, "pet": "cloud_cat", "only": ""})
    st = W.style("world", a["samples"])
    os.makedirs(a["out"], exist_ok=True)
    render_cat(a["out"], st, a["only"])


if __name__ == "__main__":
    main()
