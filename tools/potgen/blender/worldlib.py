"""Shared helpers for chỉ thị 08: tree trunk, cloud floors, pets.

Everything renders with the shared preset style/world.json through potlib.setup_scene, so camera
tilt, colour management, exposure and light colours/directions are the same as the pots.
"""
import json
import math
import os
import sys
import time

import bpy  # noqa: E402
import bmesh  # noqa: F401
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import potlib as P  # noqa: E402

STYLE_DIR = os.path.join(HERE, "..", "style")
PX_PER_UNIT = 256  # master renders; the game uses them at @2x of points


def args(defaults):
    a = dict(defaults)
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for i in range(0, len(argv) - 1, 2):
        a[argv[i].lstrip("-").replace("-", "_")] = argv[i + 1]
    return a


def style(name="world", samples=None):
    s = P.load_style(os.path.join(STYLE_DIR, f"{name}.json"))
    s["gpu_order"] = []  # CPU on this machine
    if samples:
        s["samples"] = int(samples)
    return s


def scene(st):
    """Shared scene (camera, lights, colour) from potlib. Returns the camera target object."""
    P.setup_scene(st)
    sc = bpy.context.scene
    try:
        sc.cycles.device = "CPU"
    except Exception:
        pass
    sc.render.image_settings.color_depth = "8"
    return bpy.data.objects["CamTarget"]


def directional_lights(st):
    """Swap the preset's area lights for suns with the same direction, colour and irradiance at the
    target. Needed for things that repeat vertically (the trunk tile): with point-like lights the
    shading would change with height and the joint would show. Irradiance of an area light of power E
    at distance d, seen face-on, is about E / (pi d^2); a sun's strength is that irradiance."""
    tgt = Vector((0.0, 0.0, st.get("target_z", 0.75)))
    for ob in [o for o in bpy.data.objects if o.type == "LIGHT"]:
        bpy.data.objects.remove(ob, do_unlink=True)
    for spec in st["lights"]:
        loc = Vector(spec["loc"])
        d = loc - tgt
        ld = bpy.data.lights.new(spec["name"] + "_sun", "SUN")
        ld.energy = spec["energy"] / (math.pi * d.length_squared)
        ld.color = P.hex_rgb(spec.get("color", "#FFFFFF"))
        ld.angle = math.radians(min(60.0, math.degrees(2 * math.atan(spec.get("size", 2.0) / 2 / d.length))))
        ob = bpy.data.objects.new(spec["name"] + "_sun", ld)
        ob.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        bpy.context.scene.collection.objects.link(ob)


def camera_frame(center, width_px, height_px, px_per_unit=PX_PER_UNIT):
    """Point the shared camera (its tilt kept) at `center`, with an exact pixel scale."""
    sc = bpy.context.scene
    cam = sc.camera
    tilt = math.pi / 2 - cam.rotation_euler.x
    sc.render.resolution_x, sc.render.resolution_y = int(width_px), int(height_px)
    cam.data.ortho_scale = max(width_px, height_px) / px_per_unit
    c = Vector(center)
    cam.location = (c.x, c.y - 12.0 * math.cos(tilt), c.z + 12.0 * math.sin(tilt))
    return tilt


def pixel_of(point):
    """Pixel position (from top-left) of a world point in the current render."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    bpy.context.view_layer.update()
    co = world_to_camera_view(sc, sc.camera, Vector(point))
    return co.x * sc.render.resolution_x, (1.0 - co.y) * sc.render.resolution_y


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def clear_objects(keep=("CamTarget",)):
    for ob in list(bpy.data.objects):
        if ob.type in ("LIGHT", "CAMERA") or ob.name in keep:
            continue
        bpy.data.objects.remove(ob, do_unlink=True)
    for m in list(bpy.data.meshes):
        if m.users == 0:
            bpy.data.meshes.remove(m)


def render(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.context.scene.render.filepath = path
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"[world08] {os.path.basename(path)} {time.time() - t:.1f}s", flush=True)


def mesh_from(name, verts, faces, uvs=None, mat=None, smooth=True, colors=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.update()
    if uvs is not None:
        uv = me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            for li in poly.loop_indices:
                uv.data[li].uv = uvs[me.loops[li].vertex_index]
    if colors is not None:
        attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
        for i, c in enumerate(colors):
            attr.data[i].color = (*c, 1.0)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    if mat:
        ob.data.materials.append(mat)
    return link(ob)


# ----------------------------------------------------------------------------- materials

class NT:
    """Tiny node-tree builder."""

    def __init__(self, name):
        self.m = bpy.data.materials.new(name)
        self.m.use_nodes = True
        self.t = self.m.node_tree
        self.t.nodes.clear()
        self.out = self.t.nodes.new("ShaderNodeOutputMaterial")

    def n(self, kind, **inputs):
        node = self.t.nodes.new(kind)
        for k, v in inputs.items():
            if k.startswith("_"):
                setattr(node, k[1:], v)
            else:
                P._set_input(node, [k], v)
        return node

    def l(self, a, b):  # noqa: E741
        self.t.links.new(a, b)

    def math(self, op, a, b=None):
        node = self.t.nodes.new("ShaderNodeMath")
        node.operation = op
        for i, x in enumerate((a, b)):
            if x is None:
                continue
            if isinstance(x, (int, float)):
                node.inputs[i].default_value = x
            else:
                self.l(x, node.inputs[i])
        return node.outputs[0]

    def ramp(self, fac, stops):
        r = self.t.nodes.new("ShaderNodeValToRGB")
        el = r.color_ramp.elements
        while len(el) < len(stops):
            el.new(0.5)
        for e, (pos, col) in zip(el, stops):
            e.position = pos
            e.color = (*P.hex_rgb(col), 1.0)
        self.l(fac, r.inputs[0])
        return r.outputs["Color"]

    def mix(self, fac, a, b):
        node = self.t.nodes.new("ShaderNodeMix")
        node.data_type = "RGBA"
        if isinstance(fac, (int, float)):
            node.inputs["Factor"].default_value = fac
        else:
            self.l(fac, node.inputs["Factor"])
        for sock, v in ((node.inputs[6], a), (node.inputs[7], b)):
            if isinstance(v, str):
                sock.default_value = (*P.hex_rgb(v), 1.0)
            else:
                self.l(v, sock)
        return node.outputs[2]

    def principled(self, color, rough=0.6, **kw):
        b = self.n("ShaderNodeBsdfPrincipled")
        if isinstance(color, str):
            b.inputs["Base Color"].default_value = (*P.hex_rgb(color), 1.0)
        else:
            self.l(color, b.inputs["Base Color"])
        P._set_input(b, ["Roughness"], rough)
        for k, v in kw.items():
            names = {"sss": ["Subsurface Weight", "Subsurface"], "sss_radius": ["Subsurface Radius"],
                     "sss_scale": ["Subsurface Scale"], "trans": ["Transmission Weight", "Transmission"],
                     "coat": ["Coat Weight", "Clearcoat"], "sheen": ["Sheen Weight", "Sheen"],
                     "spec": ["Specular IOR Level", "Specular"], "emit": ["Emission Color", "Emission"],
                     "emit_str": ["Emission Strength"]}[k]
            if isinstance(v, str):
                v = (*P.hex_rgb(v), 1.0)
            P._set_input(b, names, v)
        return b

    def done(self, shader):
        self.l(shader.outputs[0], self.out.inputs["Surface"])
        return self.m


def periodic_coords(nt, H, R_u=0.35, R_v=None, shift=0.0):
    """Vector + W for 4D noise that repeats on the mesh UV in u (0..1, around) and in v = z/H."""
    R_v = R_v if R_v is not None else H / (2 * math.pi)
    uvn = nt.n("ShaderNodeUVMap")
    sep = nt.n("ShaderNodeSeparateXYZ")
    nt.l(uvn.outputs[0], sep.inputs[0])
    au = nt.math("MULTIPLY", nt.math("ADD", sep.outputs[0], shift), 2 * math.pi)
    av = nt.math("MULTIPLY", sep.outputs[1], 2 * math.pi)
    comb = nt.n("ShaderNodeCombineXYZ")
    nt.l(nt.math("MULTIPLY", nt.math("COSINE", au), R_u), comb.inputs[0])
    nt.l(nt.math("MULTIPLY", nt.math("SINE", au), R_u), comb.inputs[1])
    nt.l(nt.math("MULTIPLY", nt.math("COSINE", av), R_v), comb.inputs[2])
    w = nt.math("MULTIPLY", nt.math("SINE", av), R_v)
    return comb.outputs[0], w


def noise4(nt, vec, w, scale, detail=4.0, rough=0.55):
    n = nt.n("ShaderNodeTexNoise", Scale=scale, Detail=detail, Roughness=rough)
    n.noise_dimensions = "4D"
    nt.l(vec, n.inputs["Vector"])
    nt.l(w, n.inputs["W"])
    return n


def save_json(path, data):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def eul(*deg):
    return Euler([math.radians(d) for d in deg], "XYZ")
