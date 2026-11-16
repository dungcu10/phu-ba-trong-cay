"""potlib — thư viện dựng chậu 3D thủ tục cho PHÚ BÀ TRỒNG CÂY.

Chạy bên trong Blender (bpy). Không phụ thuộc thư viện ngoài.
Mọi hình dạng được dựng từ hồ sơ (profile) và tham số trong file dòng chậu JSON,
nên cùng một bộ hàm dùng lại được cho mọi dòng chậu.

Quy ước: Z hướng lên, máy quay nhìn theo +Y (mặt trước của chậu quay về -Y).
Chiều cao thân chậu chuẩn hóa ~1.0 đơn vị.
"""
import math
import random

import bmesh
import bpy
from mathutils import Euler, Vector

TAU = math.tau
COLL_NAME = "POT"
GPU_ORDER = ["CUDA", "OPTIX", "HIP", "METAL", "ONEAPI"]


# ---------------------------------------------------------------- tham số ---

def V(x, p):
    """Giá trị tham số: số cố định, hoặc {"from": a, "to": b} nội suy theo tiến độ p (0..1)."""
    if isinstance(x, dict) and "from" in x:
        return x["from"] + (x["to"] - x["from"]) * p
    if isinstance(x, list) and x and isinstance(x[0], dict):
        return [V(i, p) for i in x]
    return x


def Vi(x, p):
    return int(round(V(x, p)))


def part_active(part, p):
    return part.get("min_p", 0.0) <= p + 1e-9 and p <= part.get("max_p", 1.0) + 1e-9


# ---------------------------------------------------------------- màu sắc ---

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h):
    """'#RRGGBB' (sRGB) -> tuple tuyến tính dùng cho shader."""
    h = h.lstrip("#")
    return tuple(srgb_to_linear(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4))


def _set_input(node, names, value):
    for n in names:
        if n in node.inputs:
            try:
                node.inputs[n].default_value = value
                return True
            except Exception:
                pass
    return False


def make_material(name, spec):
    """Tạo vật liệu Principled từ spec JSON. Tương thích Blender 3.6 → 5.x."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])

    grad = spec.get("gradient")
    if grad:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        nt.links.new(tc.outputs["Generated"], sep.inputs[0])
        nt.links.new(sep.outputs[spec.get("gradient_axis", "Z")], ramp.inputs["Fac"])
        els = ramp.color_ramp.elements
        els[0].position = grad[0][0]
        els[0].color = (*hex_rgb(grad[0][1]), 1.0)
        els[1].position = grad[-1][0]
        els[1].color = (*hex_rgb(grad[-1][1]), 1.0)
        for pos, col in grad[1:-1]:
            e = els.new(pos)
            e.color = (*hex_rgb(col), 1.0)
        nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
        if spec.get("emission_from_gradient"):
            for n in ("Emission Color", "Emission"):
                if n in bsdf.inputs:
                    nt.links.new(ramp.outputs["Color"], bsdf.inputs[n])
                    break
    else:
        bsdf.inputs["Base Color"].default_value = (*hex_rgb(spec.get("color", "#cccccc")), 1.0)

    _set_input(bsdf, ["Metallic"], spec.get("metallic", 0.0))
    _set_input(bsdf, ["Roughness"], spec.get("roughness", 0.5))
    if "coat" in spec:
        _set_input(bsdf, ["Coat Weight", "Clearcoat"], spec["coat"])
        _set_input(bsdf, ["Coat Roughness", "Clearcoat Roughness"], spec.get("coat_roughness", 0.08))
    if "transmission" in spec:
        _set_input(bsdf, ["Transmission Weight", "Transmission"], spec["transmission"])
    if "ior" in spec:
        _set_input(bsdf, ["IOR"], spec["ior"])
    if "subsurface" in spec:
        _set_input(bsdf, ["Subsurface Weight", "Subsurface"], spec["subsurface"])
    if "sheen" in spec:
        _set_input(bsdf, ["Sheen Weight", "Sheen"], spec["sheen"])
    if "emission" in spec:
        _set_input(bsdf, ["Emission Color", "Emission"], (*hex_rgb(spec["emission"]), 1.0))
    if "emission" in spec or spec.get("emission_from_gradient"):
        _set_input(bsdf, ["Emission Strength"], spec.get("emission_strength", 1.0))
    return m


def build_materials(line):
    return {k: make_material("M_" + k, v) for k, v in line["materials"].items()}


# ----------------------------------------------------------- hình học cơ sở ---

def smooth_profile(pts, per=6):
    """Catmull-Rom qua các điểm (r, z) để có hồ sơ thân mềm mại."""
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(per):
            t = k / per
            t2, t3 = t * t, t * t * t
            out.append(tuple(
                0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t
                       + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2
                       + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)
                for d in (0, 1)))
    out.append(tuple(pts[-1]))
    return out


def radius_fn(prof):
    """Trả về hàm R(z) nội suy tuyến tính theo hồ sơ đã làm mịn (z tăng dần)."""
    zs = [z for _, z in prof]
    rs = [r for r, _ in prof]

    def R(z):
        if z <= zs[0]:
            return rs[0]
        if z >= zs[-1]:
            return rs[-1]
        lo, hi = 0, len(zs) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if zs[mid] <= z:
                lo = mid
            else:
                hi = mid
        t = (z - zs[lo]) / max(1e-9, zs[hi] - zs[lo])
        return rs[lo] + (rs[hi] - rs[lo]) * t

    def slope(z, dz=0.01):
        return (R(z + dz) - R(z - dz)) / (2 * dz)

    return R, slope


def mesh_object(name, verts, faces, mat=None, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    if smooth:
        for poly in me.polygons:
            poly.use_smooth = True
    if mat:
        me.materials.append(mat)
    return bpy.data.objects.new(name, me)


def lathe(name, prof, seg=72, cap_bottom=True, mat=None):
    """Tiện tròn hồ sơ (r, z) quanh trục Z. Pháp tuyến hướng ra ngoài."""
    n = len(prof)
    verts, faces = [], []
    for i in range(seg):
        a = TAU * i / seg
        c, s = math.cos(a), math.sin(a)
        for r, z in prof:
            verts.append((r * c, r * s, z))
    for i in range(seg):
        i2 = (i + 1) % seg
        for j in range(n - 1):
            a, b = i * n + j, i2 * n + j
            faces.append((a, b, b + 1, a + 1))
    if cap_bottom:
        ci = len(verts)
        verts.append((0.0, 0.0, prof[0][1]))
        for i in range(seg):
            i2 = (i + 1) % seg
            faces.append((i2 * n, i * n, ci))
    return mesh_object(name, verts, faces, mat)


def ring(name, R, z, rr, seg=128, sides=14, zfunc=None, rfunc=None, mat=None):
    """Vành xuyến; zfunc/rfunc(a) cho phép làm viền gợn sóng, ngọn lửa."""
    verts, faces = [], []
    for i in range(seg):
        a = TAU * i / seg
        Ri = R * (rfunc(a) if rfunc else 1.0)
        zi = z + (zfunc(a) if zfunc else 0.0)
        c, s = math.cos(a), math.sin(a)
        for j in range(sides):
            b = TAU * j / sides
            rad = Ri + rr * math.cos(b)
            verts.append((rad * c, rad * s, zi + rr * math.sin(b)))
    for i in range(seg):
        i2 = (i + 1) % seg
        for j in range(sides):
            j2 = (j + 1) % sides
            faces.append((i * sides + j, i2 * sides + j, i2 * sides + j2, i * sides + j2))
    return mesh_object(name, verts, faces, mat)


def feather_mesh(name, L=1.0, W=0.22, curl=0.12, cup=0.35, rib=0.018, barbs=6, nu=18, nv=8, shape="feather"):
    """Lông vũ cách điệu: phiến bất đối xứng, sống lông nổi, mép xẻ răng cưa,
    cong ra sau theo chiều dài và lòng máng theo chiều ngang.
    Hệ tọa độ: chiều dài theo +Z, chiều rộng theo X, mặt trước nhìn về -Y."""
    verts, faces = [], []
    if shape in ("blade", "spike"):
        cup, rib = 0.0, 0.0
    for i in range(nu + 1):
        u = i / nu
        s = math.sin(math.pi * min(u, 0.999))
        xoff = 0.0
        if shape == "leaf":
            w = W * max(0.04, s) ** 0.85 * (1.0 - 0.15 * u)
        elif shape == "fern":
            w = W * max(0.04, s) ** 0.7
            if u > 0.1:
                w *= 1.0 - 0.5 * ((u * 9) % 1.0) ** 1.5
        elif shape == "petal":
            w = W * max(0.05, math.sin(math.pi * (0.08 + 0.84 * u))) ** 0.45
        elif shape == "flame":
            w = W * max(0.04, s) ** 0.8 * (1.0 + 0.2 * math.sin(u * 16))
            xoff = 0.12 * W * math.sin(u * 6.0) * u
        elif shape == "fin":
            w = W * (0.25 + 0.75 * u ** 0.5) * max(0.05, 1.0 - u ** 8) ** 0.5
        elif shape == "membrane":
            w = W * (0.25 + 0.75 * max(0.04, s))
        elif shape == "ribbon":
            w = W * 0.32
            xoff = 0.25 * W * math.sin(u * TAU * 1.2)
        elif shape == "blade":
            w = W * (0.9 * (1.0 - u) + 0.02)
        elif shape == "spike":
            w = W * (0.35 * (1.0 - u) + 0.005)
        else:  # feather
            w = W * (0.07 + 0.93 * s ** 0.75) * (1.0 - 0.25 * u)
            if u > 0.18:
                w *= 1.0 - 0.14 * ((u * barbs) % 1.0) ** 2
        for j in range(nv + 1):
            v = -1.0 + 2.0 * j / nv
            side = 0.78 if (v < 0 and shape == "feather") else 1.0
            if shape == "membrane" and v > 0:
                side = 1.0 - 0.3 * abs(math.sin(u * math.pi * 4))
            x = v * w * side + xoff
            z = u * L
            y = curl * L * u * u + cup * W * v * v - rib * (1.0 - abs(v)) ** 3
            if shape == "fin":
                y += 0.03 * W * math.cos(v * math.pi * 6)
            if shape in ("blade", "spike"):
                y -= 0.1 * W * (1.0 - abs(v))
            verts.append((x, y, z))
    for i in range(nu):
        for j in range(nv):
            a = i * (nv + 1) + j
            faces.append((a, a + 1, a + nv + 2, a + nv + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    for poly in me.polygons:
        poly.use_smooth = shape not in ("blade", "spike")
    return me


def disc_mesh(name, teeth=0, t=0.07, seg=64):
    """Đĩa/đồng xu (teeth=0) hoặc bánh răng, mặt nhìn về -Y, tâm ở z=0.5 để mọc theo trục Z."""
    verts, faces = [], []
    ring = []
    for i in range(seg):
        a = TAU * i / seg
        r = 0.45
        if teeth:
            r *= 1.0 + (0.14 if math.cos(teeth * a) > 0.2 else 0.0)
        ring.append((r * math.cos(a), r * math.sin(a)))
    for y in (-t, t):
        for x, z in ring:
            verts.append((x, y, 0.5 + z))
    cf, cb = len(verts), len(verts) + 1
    verts += [(0.0, -t, 0.5), (0.0, t, 0.5)]
    for i in range(seg):
        i2 = (i + 1) % seg
        faces.append((cf, i, i2))
        faces.append((cb, seg + i2, seg + i))
        faces.append((i, seg + i, seg + i2, i2))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    return me


def element_mesh(name, shape, W):
    """Mesh cho một phần tử cánh/hào quang. Trả về (mesh, mức subdivision)."""
    if shape in ("coin", "gear"):
        return disc_mesh(name, teeth=12 if shape == "gear" else 0), 0
    if shape == "orb":
        me = ico_mesh(name, 0.45, 3)
        for v in me.vertices:
            v.co.z += 0.5
        return me, 0
    if shape in ("blade", "spike"):
        return feather_mesh(name, L=1.0, W=W, shape=shape, nu=10, nv=2), 0
    return feather_mesh(name, L=1.0, W=W, shape=shape), 2


def gem_mesh(name, n=8, table=0.55, crown=0.38, pav=0.9):
    """Đá quý giác cắt kiểu brilliant (bao lồi), mặt bàn hướng +Z."""
    pts = []
    for k in range(n):
        a = TAU * k / n
        pts.append((table * math.cos(a), table * math.sin(a), crown))
    for k in range(2 * n):
        a = TAU * k / (2 * n) + math.pi / (2 * n)
        pts.append((math.cos(a), math.sin(a), 0.0))
    for k in range(n):
        a = TAU * k / n
        pts.append((0.45 * math.cos(a), 0.45 * math.sin(a), -pav * 0.55))
    pts.append((0.0, 0.0, -pav))
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in pts]
    bmesh.ops.convex_hull(bm, input=vs)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


def ico_mesh(name, radius=1.0, subdiv=2):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    return me


def tube(name, pts, depth, mat=None, cyclic=False, radii=None, resolution=4):
    """Ống cong theo đường điểm — dùng cho hoa văn vàng (filigree)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = depth
    cu.bevel_resolution = resolution
    try:
        cu.use_fill_caps = True
    except Exception:
        pass
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for k, (pt, (x, y, z)) in enumerate(zip(sp.points, pts)):
        pt.co = (x, y, z, 1.0)
        if radii:
            pt.radius = radii[k]
    sp.use_cyclic_u = cyclic
    if mat:
        cu.materials.append(mat)
    return bpy.data.objects.new(name, cu)


def add_mod(ob, kind, **kw):
    m = ob.modifiers.new(kind.lower(), kind)
    for k, v in kw.items():
        try:
            setattr(m, k, v)
        except Exception:
            pass
    return m


def subsurf(ob, levels=2):
    return add_mod(ob, "SUBSURF", levels=levels, render_levels=levels)


# --------------------------------------------------------------- bối cảnh ---

class Ctx:
    def __init__(self, line, mats, coll, root, R, slope, H, seed):
        self.line, self.mats, self.coll, self.root = line, mats, coll, root
        self.R, self.slope, self.H = R, slope, H
        self.rng = random.Random(seed)
        self.n = 0

    layer = "body"

    def link(self, ob, parent=True):
        self.coll.objects.link(ob)
        if parent:
            ob.parent = self.root
        lay = self.layer
        if lay == "wings":
            lay = "wing_r" if ob.location.x >= 0 else "wing_l"
        ob["pot_layer"] = lay
        self.n += 1
        return ob

    def mat(self, key):
        if key not in self.mats:
            raise KeyError(f"Vật liệu '{key}' chưa khai báo trong file dòng chậu")
        return self.mats[key]

    def surface(self, theta, z, off=0.0):
        r = self.R(z) + off
        return Vector((r * math.cos(theta), r * math.sin(theta), z))


def orient_outward(theta, tilt=0.0):
    """Euler để trục -Y cục bộ hướng ra ngoài tại góc theta, trục Z nghiêng theo bề mặt."""
    return Euler((tilt, 0.0, theta + math.pi / 2), "XYZ")


FRONT = -math.pi / 2  # mặt trước chậu (hướng về máy quay)


def feather_obj(ctx, me, mat, loc, rot, scale=1.0, sub=2, thick=0.012):
    ob = bpy.data.objects.new("Feather", me)
    if not me.materials:
        me.materials.append(mat)
    ob.location = loc
    ob.rotation_euler = rot
    ob.scale = (scale, scale, scale)
    if sub > 0:
        add_mod(ob, "SOLIDIFY", thickness=thick, offset=0.0)
        subsurf(ob, sub)
    elif me.name.startswith(("WingFeather", "TailFeather", "CrestFeather", "HaloFeather")) and len(me.polygons) < 64:
        add_mod(ob, "SOLIDIFY", thickness=thick * 1.5, offset=0.0)
    else:
        add_mod(ob, "BEVEL", width=0.025, segments=2)
    return ctx.link(ob)


# ------------------------------------------------------------ các bộ phận ---

def part_body(ctx, part, p):
    prof = smooth_profile(ctx.line["profiles"][part["profile"]])
    ob = lathe("Body", prof, seg=part.get("seg", 72), mat=ctx.mat(part["mat"]))
    add_mod(ob, "SOLIDIFY", thickness=part.get("wall", 0.045), offset=-1.0, use_even_offset=True)
    subsurf(ob, 2)
    ctx.link(ob)


def part_soil(ctx, part, p):
    z = ctx.H - part.get("depth", 0.07)
    R = ctx.R(z) * 0.96
    prof = [(0.002, z + 0.025), (R * 0.5, z + 0.02), (R * 0.85, z + 0.008), (R, z)]
    ob = lathe("Soil", prof, seg=64, cap_bottom=False, mat=ctx.mat(part["mat"]))
    tex = bpy.data.textures.get("SoilNoise") or bpy.data.textures.new("SoilNoise", "CLOUDS")
    tex.noise_scale = 0.08
    subsurf(ob, 2)
    add_mod(ob, "DISPLACE", texture=tex, strength=0.025, mid_level=0.5)
    ctx.link(ob)


def part_rim(ctx, part, p):
    z = ctx.H + part.get("dz", 0.0)
    rr = V(part.get("rr", 0.035), p)
    k = Vi(part.get("scallops", 0), p)
    amp = V(part.get("amp", 0.0), p)
    power = part.get("power", 3)
    zf = None
    if k and amp:
        def zf(a):
            return amp * max(0.0, math.cos(k * a)) ** power
    ob = ring("Rim", ctx.R(z) + rr * 0.3, z, rr, zfunc=zf, mat=ctx.mat(part["mat"]))
    subsurf(ob, 1)
    ctx.link(ob)
    if part.get("bead"):
        bead = ring("RimBead", ctx.R(z - 2.2 * rr) + rr * 0.15, z - 2.2 * rr, rr * 0.4,
                    mat=ctx.mat(part["bead"]))
        subsurf(bead, 1)
        ctx.link(bead)


def part_foot(ctx, part, p):
    rr = V(part.get("rr", 0.04), p)
    ob = ring("Foot", ctx.R(rr) + rr * 0.2, rr, rr, mat=ctx.mat(part["mat"]))
    subsurf(ob, 1)
    ctx.link(ob)
    if part.get("step"):
        st = ring("FootStep", ctx.R(rr) + rr * 1.4, rr * 0.6, rr * 0.7, mat=ctx.mat(part["mat"]))
        subsurf(st, 1)
        ctx.link(st)


def part_band(ctx, part, p):
    z = V(part["z"], p) * ctx.H
    rr = V(part.get("rr", 0.018), p)
    ob = ring("Band", ctx.R(z) + rr * 0.35, z, rr, mat=ctx.mat(part["mat"]))
    subsurf(ob, 1)
    ctx.link(ob)


def part_relief(ctx, part, p):
    """Vòng lông vũ chạm nổi ôm sát thân chậu."""
    z = V(part["z"], p) * ctx.H
    count = Vi(part.get("count", 12), p)
    L = V(part.get("length", 0.26), p)
    me = feather_mesh("ReliefFeather", L=1.0, W=part.get("width", 0.32), curl=0.0, cup=0.1, rib=0.04)
    mat = ctx.mat(part["mat"])
    down = part.get("down", False)
    for i in range(count):
        th = TAU * i / count + part.get("phase", 0.0)
        zc = z - (L * 0.5 if not down else -L * 0.5)
        tilt = math.atan2(ctx.slope(z), 1.0)
        if down:
            rot = Euler((-tilt, math.pi, th + math.pi / 2), "XYZ")
        else:
            rot = orient_outward(th, tilt)
        feather_obj(ctx, me, mat, ctx.surface(th, zc, part.get("off", 0.004)), rot,
                    scale=L, sub=1, thick=0.02)


def part_filigree(ctx, part, p):
    """Dải hoa văn vàng lượn sóng + cuộn xoắn ở mỗi đỉnh sóng."""
    zc = V(part["z"], p) * ctx.H
    amp = V(part.get("amp", 0.04), p)
    waves = Vi(part.get("waves", 8), p)
    depth = V(part.get("depth", 0.011), p)
    mat = ctx.mat(part["mat"])
    off = depth * 0.9
    pts = []
    for i in range(360):
        a = TAU * i / 360
        z = zc + amp * math.sin(waves * a)
        pts.append(tuple(ctx.surface(a, z, off)))
    ctx.link(tube("FiligreeWave", pts, depth, mat, cyclic=True))
    s = V(part.get("spiral", 0.045), p)
    if s <= 0:
        return
    for k in range(waves):
        for sign in (1, -1):
            a0 = (math.pi / 2 + TAU * k) / waves if sign > 0 else (3 * math.pi / 2 + TAU * k) / waves
            cz = zc + sign * (amp + s * 0.9)
            spts, radii = [], []
            turns = 2.2 * math.pi
            steps = 40
            for j in range(steps + 1):
                f = j / steps
                phi = f * turns
                rho = s * (1.0 - 0.85 * f)
                a = a0 + rho * math.cos(phi) / max(0.1, ctx.R(cz))
                z = cz - sign * rho * math.sin(phi + math.pi / 2) * 0.9
                spts.append(tuple(ctx.surface(a, z, off)))
                radii.append(1.0 - 0.6 * f)
            ctx.link(tube("FiligreeSpiral", spts, depth * 0.85, mat, radii=radii))


def part_gems(ctx, part, p):
    z = V(part["z"], p) * ctx.H
    count = Vi(part.get("count", 1), p)
    size = V(part.get("size", 0.08), p)
    spread = math.radians(V(part.get("spread", 26), p))
    me = gem_mesh("Gem")
    gmat = ctx.mat(part["mat"])
    me.materials.append(gmat)
    for i in range(count):
        th = FRONT + spread * (i - (count - 1) / 2)
        zi = z + part.get("arc", 0.0) * abs(i - (count - 1) / 2) ** 2
        sz = size * (1.0 if i == (count - 1) // 2 or count % 2 == 0 else part.get("side_scale", 0.78))
        loc = ctx.surface(th, zi, sz * 0.25)
        rot = Euler((math.pi / 2, 0.0, th + math.pi / 2), "XYZ")
        ob = bpy.data.objects.new("Gem", me)
        ob.location, ob.rotation_euler = loc, rot
        ob.scale = (sz, sz, sz * 0.8)
        ctx.link(ob)
        if part.get("bezel"):
            bz = ring("Bezel", sz * 1.02, 0.0, sz * 0.16, seg=48, sides=10, mat=ctx.mat(part["bezel"]))
            bz.location, bz.rotation_euler = loc, rot
            subsurf(bz, 1)
            ctx.link(bz)


def _fan(ctx, part, p, name, base_fn, angle_fn, mat):
    count = Vi(part.get("count", 5), p)
    L = V(part.get("length", 0.6), p)
    W = part.get("width", 0.2)
    shape = part.get("shape", "feather")
    if shape in ("feather",):
        me, sub = feather_mesh(name, L=1.0, W=W, curl=part.get("curl", 0.12), cup=part.get("cup", 0.35)), 2
    else:
        me, sub = element_mesh(name, shape, W)
    for i in range(count):
        f = i / max(1, count - 1)
        curve = part.get("len_curve", "mid")
        g = {"up": 1.0 - f, "down": f}.get(curve, math.sin(math.pi * f))
        lm = part.get("len_min", 0.62)
        Li = L * (lm + (1.0 - lm) * g)
        loc, rot = base_fn(i, f), angle_fn(i, f)
        feather_obj(ctx, me, mat, loc, rot, scale=Li, sub=sub)
    return count


def part_wings(ctx, part, p):
    z = V(part["z"], p) * ctx.H
    a0, a1 = (math.radians(a) for a in V(part.get("spread", [25, 95]), p))
    mat = ctx.mat(part["mat"])
    layers = part.get("layers", 2)
    for side in (1, -1):
        bx = side * (ctx.R(z) * 0.92)
        for layer in range(layers):
            shrink = 1.0 if layer == 0 else part.get("covert_scale", 0.6)
            sub = dict(part)
            sub.setdefault("len_curve", "up")
            sub["length"] = V(part.get("length", 0.6), p) * shrink
            sub["count"] = max(2, Vi(part.get("count", 5), p) - 2 * layer)
            ylay = 0.06 - 0.05 * layer
            zlay = z - 0.04 * layer

            def base_fn(i, f, bx=bx, ylay=ylay, zlay=zlay):
                return Vector((bx, ylay, zlay - 0.05 * f))

            def angle_fn(i, f, side=side, layer=layer):
                a = a0 + (a1 - a0) * f
                return Euler((-0.12 - 0.05 * layer, side * a, 0.0), "XYZ")

            _fan(ctx, sub, p, "WingFeather", base_fn, angle_fn, mat)


def part_tail(ctx, part, p):
    z = V(part["z"], p) * ctx.H
    spread = math.radians(V(part.get("spread", 55), p))
    mat = ctx.mat(part["mat"])
    y = part.get("y", 0.28)

    def base_fn(i, f):
        return Vector((0.0, y, z))

    def angle_fn(i, f):
        return Euler((-0.3, -spread + 2 * spread * f, 0.0), "XYZ")

    sub = dict(part)
    sub.setdefault("len_curve", "mid")
    _fan(ctx, sub, p, "TailFeather", base_fn, angle_fn, mat)


def part_crest(ctx, part, p):
    z = ctx.H + part.get("dz", -0.02)
    spread = math.radians(V(part.get("spread", 32), p))
    mat = ctx.mat(part["mat"])
    yfront = -ctx.R(ctx.H) * 0.95

    def base_fn(i, f):
        return Vector((0.0, yfront, z))

    def angle_fn(i, f):
        return Euler((0.15, -spread + 2 * spread * f, 0.0), "XYZ")

    sub = dict(part)
    sub.setdefault("len_curve", "mid")
    _fan(ctx, sub, p, "CrestFeather", base_fn, angle_fn, mat)
    if part.get("gem"):
        me = gem_mesh("CrestGem")
        me.materials.append(ctx.mat(part["gem"]))
        ob = bpy.data.objects.new("CrestGem", me)
        s = part.get("gem_size", 0.075)
        ob.location = Vector((0.0, yfront - 0.03, z + 0.02))
        ob.rotation_euler = Euler((math.pi / 2, 0.0, 0.0), "XYZ")
        ob.scale = (s, s, s * 0.8)
        ctx.link(ob)


def part_pedestal(ctx, part, p):
    """Bệ mây (metaball) + đĩa vàng đỡ chậu. Không chịu tỉ lệ của thân chậu."""
    h = V(part.get("height", 0.28), p)
    rad = V(part.get("radius", 0.75), p)
    mb = bpy.data.metaballs.new("CloudBase")
    mb.resolution = 0.035
    mb.render_resolution = 0.02
    rng = random.Random(7)
    n = part.get("puffs", 14)
    for i in range(n):
        a = TAU * i / n
        e = mb.elements.new()
        e.co = (rad * 0.82 * math.cos(a), rad * 0.55 * math.sin(a), h * 0.45 + rng.uniform(-0.03, 0.04))
        e.radius = rad * rng.uniform(0.32, 0.42)
    for i in range(5):
        e = mb.elements.new()
        e.co = (rng.uniform(-0.3, 0.3) * rad, rng.uniform(-0.2, 0.2) * rad, h * 0.55)
        e.radius = rad * 0.45
    if part.get("mat"):
        mb.materials.append(ctx.mat(part["mat"]))
    ob = bpy.data.objects.new("CloudBase", mb)
    ctx.link(ob, parent=False)
    if part.get("plate"):
        prof = [(rad * 0.62, h - 0.05), (rad * 0.68, h - 0.02), (rad * 0.66, h), (rad * 0.58, h + 0.01)]
        pl = lathe("Plate", prof, seg=72, cap_bottom=True, mat=ctx.mat(part["plate"]))
        subsurf(pl, 2)
        ctx.link(pl, parent=False)


def part_halo(ctx, part, p):
    """Vầng hào quang phía sau chậu. styles: elements | rays | wreath | orbs | double | disc (kết hợp được)."""
    styles = part.get("styles", [part.get("style", "elements")])
    r0 = V(part.get("radius", 0.9), p)
    L = V(part.get("length", 0.5), p)
    cz = V(part.get("z", 0.75), p) * ctx.H
    y = part.get("y", 0.55)
    mat = ctx.mat(part["mat"])
    ring_mat = ctx.mat(part.get("ring_mat", part["mat"]))

    def put_ring(R, rr, m, dy=0.0):
        rg = ring("HaloRing", R, 0.0, rr, seg=128, sides=10, mat=m)
        rg.location = Vector((0.0, y + dy, cz))
        rg.rotation_euler = Euler((math.pi / 2, 0.0, 0.0), "XYZ")
        subsurf(rg, 1)
        ctx.link(rg)

    if part.get("ring", True):
        put_ring(r0 * 0.96, part.get("ring_rr", 0.03), ring_mat)
    for st in styles:
        if st in ("elements", "rays", "wreath"):
            shape = part.get("shape", "spike" if st == "rays" else "feather")
            count = Vi(part.get("count", 24 if st == "rays" else 16), p)
            me, sub = element_mesh("HaloFeather", shape, part.get("width", 0.24))
            for i in range(count):
                a = TAU * i / count
                if st == "wreath":
                    loc = Vector((r0 * math.sin(a), y - 0.02, cz + r0 * math.cos(a)))
                    rot = Euler((0.0, a + math.pi / 2 + 0.35, 0.0), "XYZ")
                    sc = L * 0.55
                else:
                    loc = Vector((r0 * math.sin(a), y, cz + r0 * math.cos(a)))
                    rot = Euler((0.0, a, 0.0), "XYZ")
                    sc = L * ((0.6 + 0.6 * (i % 2)) if st == "rays" else (0.85 + 0.3 * (i % 2)))
                feather_obj(ctx, me, mat, loc, rot, scale=sc, sub=sub)
        elif st == "orbs":
            count = Vi(part.get("orb_count", 10), p)
            me = ico_mesh("HaloOrb", 1.0, 3)
            me.materials.append(ctx.mat(part.get("orb_mat", part["mat"])))
            for i in range(count):
                a = TAU * i / count + 0.2
                ob = bpy.data.objects.new("HaloOrb", me)
                s = part.get("orb_size", 0.07) * (1.0 + 0.4 * (i % 3 == 0))
                ob.location = Vector((r0 * 1.02 * math.sin(a), y - 0.05, cz + r0 * 1.02 * math.cos(a)))
                ob.scale = (s, s, s)
                ctx.link(ob)
        elif st == "double":
            put_ring(r0 * 0.78, part.get("ring_rr", 0.03) * 0.8, ctx.mat(part.get("ring2_mat", part.get("ring_mat", part["mat"]))), 0.02)
            put_ring(r0 * 1.12, part.get("ring_rr", 0.03) * 0.6, ring_mat, 0.04)
        elif st == "disc":
            me = disc_mesh("HaloDisc", t=0.02)
            me.materials.append(ctx.mat(part.get("disc_mat", part["mat"])))
            ob = bpy.data.objects.new("HaloDisc", me)
            d = r0 * 2.0 / 0.9
            ob.location = Vector((0.0, y + 0.08, cz - 0.5 * d))
            ob.scale = (d, 1.0, d)
            add_mod(ob, "BEVEL", width=0.01, segments=2)
            ctx.link(ob)


def part_dots(ctx, part, p):
    """Chấm trang trí gắn trên thân: đinh tán, hạt trân châu, đốm nấm, giọt sơn..."""
    count = Vi(part.get("count", 12), p)
    me = ico_mesh("Dot", 1.0, 2)
    me.materials.append(ctx.mat(part["mat"]))
    rng = random.Random(part.get("seed", 3))
    z0, z1 = part.get("z", [0.2, 0.85])
    arc = math.radians(part.get("arc", 160))
    smin, smax = part.get("size", [0.03, 0.06])
    for i in range(count):
        if part.get("ring"):
            th = FRONT - arc / 2 + arc * (i + 0.5) / count
            z = (z0 + z1) / 2 * ctx.H
        else:
            th = FRONT + rng.uniform(-arc / 2, arc / 2)
            z = rng.uniform(z0, z1) * ctx.H
        s = rng.uniform(smin, smax)
        ob = bpy.data.objects.new("Dot", me)
        ob.location = ctx.surface(th, z, s * 0.15)
        ob.scale = (s, s, s * part.get("flat", 0.55))
        ob.rotation_euler = orient_outward(th, math.pi / 2)
        ctx.link(ob)


def part_embers(ctx, part, p):
    count = Vi(part.get("count", 10), p)
    me = ico_mesh("Ember", 1.0, 2)
    me.materials.append(ctx.mat(part["mat"]))
    rng = random.Random(part.get("seed", 11))
    box = part.get("box", [1.3, 0.2, 2.0])
    placed = 0
    tries = 0
    while placed < count and tries < count * 40:
        tries += 1
        x = rng.uniform(-box[0], box[0])
        z = rng.uniform(box[1], box[2]) * ctx.H
        y = rng.uniform(-0.5, 0.4)
        if z < ctx.H + 0.1 and math.hypot(x, y) < ctx.R(min(z, ctx.H)) + 0.12:
            continue
        ob = bpy.data.objects.new("Ember", me)
        s = rng.uniform(*part.get("size", [0.012, 0.03]))
        ob.location = (x, y, z)
        ob.scale = (s, s, s * 1.4)
        ctx.link(ob)
        placed += 1


PARTS = {
    "body": part_body, "soil": part_soil, "rim": part_rim, "foot": part_foot,
    "band": part_band, "relief": part_relief, "filigree": part_filigree, "gems": part_gems,
    "wings": part_wings, "tail": part_tail, "crest": part_crest, "pedestal": part_pedestal,
    "halo": part_halo, "embers": part_embers, "dots": part_dots,
}


# ------------------------------------------------------------ dựng 1 cấp ---

def clear_pot():
    coll = bpy.data.collections.get(COLL_NAME)
    if coll:
        for ob in list(coll.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
    else:
        coll = bpy.data.collections.new(COLL_NAME)
        bpy.context.scene.collection.children.link(coll)
    for store in (bpy.data.meshes, bpy.data.curves, bpy.data.metaballs):
        for d in list(store):
            if d.users == 0:
                store.remove(d)
    return coll


def build_pot(line, mats, milestone, p, seed=1):
    """Dựng chậu cho một cấp: milestone = mốc tiến hóa, p = tiến độ tới mốc kế tiếp (0..1)."""
    coll = clear_pot()
    parts = [pt for pt in milestone["parts"] if part_active(pt, p)]
    body = next(pt for pt in parts if pt["type"] == "body")
    prof = smooth_profile(line["profiles"][body["profile"]])
    R, slope = radius_fn(prof)
    H = prof[-1][1]

    root = bpy.data.objects.new("PotRoot", None)
    coll.objects.link(root)
    ped = next((pt for pt in parts if pt["type"] == "pedestal"), None)
    root.location = (0.0, 0.0, V(ped.get("height", 0.28), p) if ped else 0.0)
    s = V(body.get("scale", 1.0), p)
    root.scale = (s, s, s)

    ctx = Ctx(line, mats, coll, root, R, slope, H, seed)
    for pt in parts:
        fn = PARTS.get(pt["type"])
        if fn is None:
            raise KeyError(f"Loại bộ phận chưa hỗ trợ: {pt['type']}")
        ctx.layer = LAYER_OF.get(pt["type"], "body")
        fn(ctx, pt, p)
    return ctx.n


# Lớp chuyển động trong game: hào quang (xoay), cánh trái/phải (vỗ), lấp lánh (nhấp nháy), thân (đứng yên)
LAYER_OF = {"halo": "halo", "wings": "wings", "tail": "halo", "embers": "fx", "pedestal": "base"}
LAYERS = ["halo", "wing_l", "wing_r", "base", "body", "fx"]


def render_layers(path_base):
    """Render từng lớp riêng (các lớp khác ẩn khỏi render). Trả về danh sách file."""
    sc = bpy.context.scene
    coll = bpy.data.collections.get(COLL_NAME)
    obs = [o for o in coll.objects if "pot_layer" in o]
    present = sorted({o["pot_layer"] for o in obs}, key=LAYERS.index)
    out = []
    for lay in present:
        for o in obs:
            o.hide_render = o["pot_layer"] != lay
        sc.render.filepath = f"{path_base}__{lay}.png"
        bpy.ops.render.render(write_still=True)
        out.append((lay, sc.render.filepath))
    for o in obs:
        o.hide_render = False
    return out


# ------------------------------------------------- máy quay, ánh sáng, render ---

def _enable_gpu(sc):
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
    except Exception:
        sc.cycles.device = "CPU"
        return "CPU"
    for dev_type in GPU_ORDER:
        try:
            prefs.compute_device_type = dev_type
        except Exception:
            continue
        for fn in ("refresh_devices", "get_devices"):
            try:
                getattr(prefs, fn)()
                break
            except Exception:
                pass
        gpus = [d for d in prefs.devices if d.type == dev_type]
        if gpus:
            for d in prefs.devices:
                d.use = d.type == dev_type
            sc.cycles.device = "GPU"
            return dev_type + ":" + ",".join(d.name for d in gpus)
    sc.cycles.device = "CPU"
    return "CPU"


def _track(ob, target):
    c = ob.constraints.new("TRACK_TO")
    c.target = target
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"


def setup_scene(style):
    """Cảnh chuẩn dùng chung cho MỌI cấp, MỌI dòng chậu: cùng camera, ánh sáng, khung hình."""
    sc = bpy.context.scene
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)

    sc.render.engine = "CYCLES"
    global GPU_ORDER
    GPU_ORDER = style.get("gpu_order", GPU_ORDER)
    device = _enable_gpu(sc)
    sc.cycles.samples = style.get("samples", 96)
    try:
        sc.cycles.use_adaptive_sampling = True
    except Exception:
        pass
    sc.cycles.use_denoising = True
    for dn in (("OPTIX",) if device.startswith("OPTIX") else ()) + ("OPENIMAGEDENOISE",):
        try:
            sc.cycles.denoiser = dn
            break
        except Exception:
            pass
    try:
        sc.cycles.max_bounces = 8
        sc.cycles.transmission_bounces = 8
    except Exception:
        pass

    res = style.get("resolution", 1024)
    sc.render.resolution_x = sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "8"

    for vt in style.get("view_transform", ["AgX", "Filmic", "Standard"]):
        try:
            sc.view_settings.view_transform = vt
            break
        except Exception:
            continue
    for lk in style.get("look", []):
        try:
            sc.view_settings.look = lk
            break
        except Exception:
            continue
    sc.view_settings.exposure = style.get("exposure", 0.0)

    world = bpy.data.worlds.get("PotWorld") or bpy.data.worlds.new("PotWorld")
    sc.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    bg = world.node_tree.nodes.get("Background") if world.node_tree else None
    if bg is None:
        world.color = hex_rgb(style.get("world_color", "#B9A8D6"))
    else:
        bg.inputs[0].default_value = (*hex_rgb(style.get("world_color", "#B9A8D6")), 1.0)
        bg.inputs[1].default_value = style.get("world_strength", 0.55)

    target = bpy.data.objects.new("CamTarget", None)
    sc.collection.objects.link(target)
    target.location = (0.0, 0.0, style.get("target_z", 0.75))

    cam_data = bpy.data.cameras.new("PotCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = style.get("ortho_scale", 3.4)
    cam = bpy.data.objects.new("PotCam", cam_data)
    sc.collection.objects.link(cam)
    tilt = math.radians(style.get("tilt_deg", 14))
    dist = 12.0
    cam.location = (0.0, -dist * math.cos(tilt), target.location.z + dist * math.sin(tilt))
    cam.rotation_euler = Euler((math.pi / 2 - tilt, 0.0, 0.0), "XYZ")
    sc.camera = cam

    for spec in style["lights"]:
        ld = bpy.data.lights.new(spec["name"], "AREA")
        ld.energy = spec["energy"]
        ld.color = hex_rgb(spec.get("color", "#FFFFFF"))
        ld.size = spec.get("size", 2.0)
        lo = bpy.data.objects.new(spec["name"], ld)
        lo.location = spec["loc"]
        sc.collection.objects.link(lo)
        _track(lo, target)
    return device


def anchor_of_ground(scene):
    """Vị trí điểm (0,0,0) — đáy chậu — trên ảnh, tính theo tỉ lệ khung (gốc trên-trái)."""
    from bpy_extras.object_utils import world_to_camera_view
    bpy.context.view_layer.update()
    co = world_to_camera_view(scene, scene.camera, Vector((0.0, 0.0, 0.0)))
    return round(co.x, 4), round(1.0 - co.y, 4)
