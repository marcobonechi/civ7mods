"""Procedural Hagia Sophia for Civilization VII.

The Justinianic church, as the wonder icon paints it: terracotta brick walls, a ribbed
lead-grey dome on a drum of windows, two cascading half-domes east and west, corner
buttress towers, an arcaded ground floor, and a gold cross. No minarets.

Dimensions below are in GAME units (Civ 7: 1 unit = 0.1 m, hex outer radius 12-14,
a human is 18-19 units tall). The mesh is emitted in Blender metres via UNIT, so the
glTF export converts back with `--scale 10.0` exactly as 3d_art/plan.md specifies.

Openings are cut with a boolean rather than laid on as dark panels, so every arch has
real depth and catches shadow at the shallow angle the game camera uses.

Run headless:
    blender -b --factory-startup --python 3d_art/src/hagia_sophia.py
or inside a running Blender (the MCP path):
    exec(open('3d_art/src/hagia_sophia.py').read())
"""

import math
import bmesh
import bpy
from mathutils import Vector

UNIT = 0.1  # game unit -> Blender metre

# ---------------------------------------------------------------- dimensions
PODIUM_X, PODIUM_Y, PODIUM_H = 24.0, 20.0, 0.8
STEP_INSET, STEP_H = 0.9, 0.45
BASE_Z = PODIUM_H + STEP_H

AISLE_X, AISLE_Y, AISLE_TOP = 20.8, 16.8, 9.4      # broad lower body
ATTIC_X, ATTIC_Y, ATTIC_TOP = 18.4, 14.8, 12.6     # low attic storey
NAVE, NAVE_TOP = 12.0, 15.5                        # central block under the drum

DRUM_R, DRUM_TOP = 5.9, 19.0
DRUM_WINDOWS = 24

DOME_R, DOME_RISE = 6.0, 3.8
DOME_SEGS, DOME_RINGS = 32, 7
DOME_FLUTE = 0.05                                  # alternate meridians pushed out

HALF_R, HALF_SPRING, HALF_RISE = 5.9, 13.5, 4.2     # east/west half-domes

TOWER, TOWER_TOP = 3.2, 15.0                        # corner buttress towers
TOWER_X, TOWER_Y = 9.2, 7.4

APEX = DRUM_TOP + DOME_RISE

# ---------------------------------------------------------------- palette
# sRGB hex sampled from Byzantium/icons/src/wondericon_hagia_sophia.svg.
PALETTE_SRGB = {
    "brick":  ("b5563d", 0.80, 0.0),
    "brick2": ("8f4330", 0.84, 0.0),
    "lead":   ("8ea1ad", 0.52, 0.20),
    "marble": ("e8cfa6", 0.62, 0.0),
    "gold":   ("f6d27a", 0.28, 1.0),
    "dark":   ("2a150f", 0.92, 0.0),
}
MATS = list(PALETTE_SRGB)
MI = {name: i for i, name in enumerate(MATS)}


def _srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _hex_linear(h):
    rgb = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(_srgb_to_linear(c) for c in rgb) + (1.0,)


def _materials():
    out = []
    for name in MATS:
        h, rough, metal = PALETTE_SRGB[name]
        mat = bpy.data.materials.get("HS_" + name) or bpy.data.materials.new("HS_" + name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = _hex_linear(h)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
        out.append(mat)
    return out


# ---------------------------------------------------------------- primitives
def _tag(faces, mat):
    for f in faces:
        f.material_index = MI[mat]


def box(bm, cx, cy, z0, z1, sx, sy, mat="brick"):
    verts = bmesh.ops.create_cube(bm, size=1.0)["verts"]
    for v in verts:
        v.co.x = cx + v.co.x * sx
        v.co.y = cy + v.co.y * sy
        v.co.z = (z0 + z1) * 0.5 + v.co.z * (z1 - z0)
    _tag({f for v in verts for f in v.link_faces}, mat)
    return verts


def cylinder(bm, cx, cy, z0, z1, radius, segs, mat="brick", cap=False):
    verts = bmesh.ops.create_cone(
        bm, cap_ends=cap, segments=segs, radius1=1.0, radius2=1.0, depth=1.0)["verts"]
    for v in verts:
        v.co.x = cx + v.co.x * radius
        v.co.y = cy + v.co.y * radius
        v.co.z = (z0 + z1) * 0.5 + v.co.z * (z1 - z0)
    _tag({f for v in verts for f in v.link_faces}, mat)
    return verts


def _sphere_bm(segs, rings, flute=0.0):
    """Unit hemisphere, optionally fluted by pushing alternate meridians outward."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings * 2, radius=1.0)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-6], context="VERTS")
    if flute:
        step = math.tau / segs
        for v in bm.verts:
            r = math.hypot(v.co.x, v.co.y)
            if r < 1e-6:
                continue
            idx = round(math.atan2(v.co.y, v.co.x) / step)
            if idx % 2:
                v.co.x *= 1.0 + flute
                v.co.y *= 1.0 + flute
    return bm


def _merge(bm, src, mat):
    """Copy a temporary bmesh into the main one, tagging its faces."""
    me = bpy.data.meshes.new("_tmp")
    src.to_mesh(me)
    src.free()
    before = len(bm.faces)
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    bm.faces.ensure_lookup_table()
    _tag(bm.faces[before:], mat)


def dome(bm, cx, cy, z0, radius, rise, segs, rings, mat="lead", flute=0.0):
    sp = _sphere_bm(segs, rings, flute)
    for v in sp.verts:
        v.co.x = cx + v.co.x * radius
        v.co.y = cy + v.co.y * radius
        v.co.z = z0 + v.co.z * rise
    _merge(bm, sp, mat)


def half_dome(bm, cx, cy, z0, radius, rise, segs, rings, facing=1.0, mat="lead", flute=0.0):
    """A true half-dome: a hemisphere sliced vertically, flat face capped.

    `facing` is the direction the curved side bulges along X (+1 east, -1 west).
    """
    sp = _sphere_bm(segs, rings, flute)
    bmesh.ops.delete(sp, geom=[v for v in sp.verts if v.co.x < -1e-6], context="VERTS")
    holes = [e for e in sp.edges if len(e.link_faces) == 1]
    if holes:
        bmesh.ops.holes_fill(sp, edges=holes)
    for v in sp.verts:
        x, y = v.co.x * facing, v.co.y
        v.co.x = cx + x * radius
        v.co.y = cy + y * radius
        v.co.z = z0 + v.co.z * rise
    _merge(bm, sp, mat)


def arch_points(w, h, segs=7):
    """Outline of a round-headed arch: jambs plus a semicircular head."""
    hw = w * 0.5
    straight = max(h - hw, hw * 0.3)
    pts = [(-hw, 0.0), (hw, 0.0), (hw, straight)]
    for i in range(1, segs):
        a = math.pi * i / segs
        pts.append((hw * math.cos(a), straight + hw * math.sin(a)))
    pts.append((-hw, straight))
    return pts


def arch_cutter(bm, origin, u_dir, v_dir, n_dir, w, h, depth=0.15, segs=5, out=0.15):
    """A closed arch prism used as boolean cutter: starts proud of the wall, ends `depth` in."""
    o, u, v, n = Vector(origin), Vector(u_dir), Vector(v_dir), Vector(n_dir)
    pts = arch_points(w, h, segs)
    front = [bm.verts.new(o + u * p[0] + v * p[1] + n * out) for p in pts]
    back = [bm.verts.new(o + u * p[0] + v * p[1] - n * depth) for p in pts]
    bm.verts.ensure_lookup_table()
    faces = [bm.faces.new((front[(i + 1) % len(front)], front[i],
                           back[i], back[(i + 1) % len(back)])) for i in range(len(front))]
    faces.append(bm.faces.new(tuple(front)))
    faces.append(bm.faces.new(tuple(reversed(back))))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    _tag(faces, "dark")


def arch_row(bm, fixed, sign, z0, w, h, count, span, depth=0.15, axis="y", segs=5):
    """A row of `count` arch cutters across a wall facing +/- `axis`."""
    for i in range(count):
        t = -span * 0.5 + span * (i + 0.5) / count
        if axis == "y":
            arch_cutter(bm, (t, fixed, z0), (1, 0, 0), (0, 0, 1), (0, sign, 0),
                        w, h, depth, segs)
        else:
            arch_cutter(bm, (fixed, t, z0), (0, 1, 0), (0, 0, 1), (sign, 0, 0),
                        w, h, depth, segs)


# ---------------------------------------------------------------- solids
def build_solid(bm):
    box(bm, 0, 0, 0.0, PODIUM_H, PODIUM_X, PODIUM_Y, "marble")
    box(bm, 0, 0, PODIUM_H, BASE_Z,
        PODIUM_X - STEP_INSET * 2, PODIUM_Y - STEP_INSET * 2, "marble")

    box(bm, 0, 0, BASE_Z, AISLE_TOP, AISLE_X, AISLE_Y, "brick")
    box(bm, 0, 0, AISLE_TOP, ATTIC_TOP, ATTIC_X, ATTIC_Y, "brick")
    box(bm, 0, 0, BASE_Z, NAVE_TOP, NAVE, NAVE, "brick")

    for sx in (-1, 1):
        for sy in (-1, 1):
            box(bm, sx * TOWER_X, sy * TOWER_Y, BASE_Z, TOWER_TOP, TOWER, TOWER, "brick")

    # Drum band that carries each half-dome.
    for sx in (-1, 1):
        box(bm, sx * (NAVE * 0.5 + HALF_R * 0.30), 0, ATTIC_TOP - 1.4, HALF_SPRING,
            HALF_R * 0.72, HALF_R * 1.72, "brick")

    cylinder(bm, 0, 0, NAVE_TOP - 0.4, DRUM_TOP, DRUM_R, 40, "brick")


def build_cutters(bm):
    """Every opening, as a solid to subtract.

    Kept shallow and clean so shadow depth is preserved without wasting triangles
    on hidden interior cavities.
    """
    # Ground-floor arcade: five bays on the long faces, four on the short ones.
    for sy in (-1, 1):
        arch_row(bm, sy * AISLE_Y * 0.5, sy, BASE_Z + 0.5, 1.7, 3.9, 5,
                 AISLE_X - 6.6, 0.2, "y", 5)
    for sx in (-1, 1):
        arch_row(bm, sx * AISLE_X * 0.5, sx, BASE_Z + 0.5, 1.6, 3.7, 4,
                 AISLE_Y - 6.0, 0.2, "x", 5)

    # Attic windows.
    for sy in (-1, 1):
        arch_row(bm, sy * ATTIC_Y * 0.5, sy, AISLE_TOP + 0.85, 0.9, 1.9, 7,
                 ATTIC_X - 5.2, 0.15, "y", 4)
    for sx in (-1, 1):
        arch_row(bm, sx * ATTIC_X * 0.5, sx, AISLE_TOP + 0.85, 0.9, 1.9, 5,
                 ATTIC_Y - 4.8, 0.15, "x", 4)

    # A blind arch on each outward face of the buttress towers.
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * TOWER_X, sy * TOWER_Y
            arch_cutter(bm, (x, y + sy * TOWER * 0.5, AISLE_TOP + 0.7),
                        (1, 0, 0), (0, 0, 1), (0, sy, 0), 1.3, 2.9, 0.15, 4)
            arch_cutter(bm, (x + sx * TOWER * 0.5, y, AISLE_TOP + 0.7),
                        (0, 1, 0), (0, 0, 1), (sx, 0, 0), 1.3, 2.9, 0.15, 4)

    # The tympanum over each long face of the nave: three windows, not one void.
    for sy in (-1, 1):
        arch_row(bm, sy * NAVE * 0.5, sy, ATTIC_TOP + 0.7, 1.5, 3.1, 3,
                 NAVE - 4.2, 0.15, "y", 5)

    # Drum: the ring of windows.
    for i in range(DRUM_WINDOWS):
        a = math.tau * i / DRUM_WINDOWS
        c, s_ = math.cos(a), math.sin(a)
        arch_cutter(bm, (c * DRUM_R, s_ * DRUM_R, NAVE_TOP + 0.45),
                    (-s_, c, 0), (0, 0, 1), (c, s_, 0), 0.5, 2.1, 0.15, 3)

    # Main portal on the south face.
    arch_cutter(bm, (0, -AISLE_Y * 0.5, BASE_Z), (1, 0, 0), (0, 0, 1), (0, -1, 0),
                2.5, 5.2, 0.25, 7)


def build_added(bm):
    """Detail that sits on top of the solid: domes, cornices, cross."""
    # Marble string courses at each setback.
    box(bm, 0, 0, AISLE_TOP - 0.5, AISLE_TOP + 0.12,
        AISLE_X + 0.45, AISLE_Y + 0.45, "marble")
    box(bm, 0, 0, ATTIC_TOP - 0.45, ATTIC_TOP + 0.12,
        ATTIC_X + 0.45, ATTIC_Y + 0.45, "marble")
    box(bm, 0, 0, NAVE_TOP - 0.45, NAVE_TOP + 0.15, NAVE + 0.55, NAVE + 0.55, "marble")
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(bm, sx * TOWER_X, sy * TOWER_Y, TOWER_TOP, TOWER_TOP + 0.42,
                TOWER + 0.3, TOWER + 0.3, "marble")

    # Half-domes, flat face flush with the nave block so they cascade off the drum.
    for sx in (-1, 1):
        half_dome(bm, sx * NAVE * 0.5, 0, HALF_SPRING, HALF_R, HALF_RISE, 22, 6,
                  facing=sx, flute=DOME_FLUTE)

    # Cornice under the great dome, then the dome itself.
    cylinder(bm, 0, 0, DRUM_TOP - 0.35, DRUM_TOP + 0.3, DRUM_R + 0.4, 40, "marble")
    dome(bm, 0, 0, DRUM_TOP, DOME_R, DOME_RISE, DOME_SEGS, DOME_RINGS,
         flute=DOME_FLUTE)

    # Lantern and gold cross.
    cylinder(bm, 0, 0, APEX - 0.3, APEX + 0.7, 0.8, 12, "gold", cap=True)
    box(bm, 0, 0, APEX + 0.7, APEX + 3.0, 0.3, 0.3, "gold")
    box(bm, 0, 0, APEX + 2.0, APEX + 2.42, 1.25, 0.28, "gold")


# ---------------------------------------------------------------- assembly
def _object_from(bm, name, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    for m in mats:
        me.materials.append(m)
    return ob


def make(name="HagiaSophia"):
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m, do_unlink=True)
    mats = _materials()

    bm = bmesh.new(); build_solid(bm)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    solid = _object_from(bm, name, mats)

    bm = bmesh.new(); build_cutters(bm)
    cutter = _object_from(bm, "_HScut", mats)

    # Subtract the openings. The cutter carries the dark material, so the newly
    # exposed interior faces come out dark without any extra assignment.
    bpy.context.view_layer.objects.active = solid
    for o in bpy.context.selected_objects:
        o.select_set(False)
    solid.select_set(True)
    mod = solid.modifiers.new("openings", "BOOLEAN")
    mod.object = cutter
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)

    # Domes and cornices go on afterwards, untouched by the boolean.
    bm = bmesh.new(); build_added(bm)
    add_me = bpy.data.meshes.new("_HSadd")
    bm.to_mesh(add_me)
    bm.free()
    bm = bmesh.new()
    bm.from_mesh(solid.data)
    bm.from_mesh(add_me)
    bpy.data.meshes.remove(add_me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)

    # Into Blender metres, then centre on the hex and stand on Z = 0.
    for v in bm.verts:
        v.co *= UNIT
    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    zs = [v.co.z for v in bm.verts]
    shift = Vector(((min(xs) + max(xs)) * -0.5, (min(ys) + max(ys)) * -0.5, -min(zs)))
    for v in bm.verts:
        v.co += shift
    bm.normal_update()
    bm.to_mesh(solid.data)
    bm.free()

    me = solid.data
    me.update()
    # Smooth by angle: the dome's rings round off, while its flutes and every
    # brick corner stay sharp. Flat shading everywhere would kill the domes;
    # smoothing everything would erase the ribs.
    for poly in me.polygons:
        poly.use_smooth = True
    bpy.context.view_layer.objects.active = solid
    for o in bpy.context.selected_objects:
        o.select_set(False)
    solid.select_set(True)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(20.0))
    except (AttributeError, RuntimeError):
        # Older builds: fall back to smoothing only the lead domes.
        for poly in me.polygons:
            poly.use_smooth = me.materials[poly.material_index].name == "HS_lead"

    # The Civ 7 vertex layout carries UV and UV2, so the mesh must be unwrapped
    # before import_gltf.py will have anything to pack into the buffer.
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")
    return solid


def report(ob):
    me = ob.data
    g = 1.0 / UNIT
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    print("verts %d  faces %d  tris %d" % (len(me.vertices), len(me.polygons), tris))
    print("bounds units  x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f"
          % (min(xs) * g, max(xs) * g, min(ys) * g, max(ys) * g, min(zs) * g, max(zs) * g))
    print("footprint %.1f x %.1f units, height %.1f units"
          % ((max(xs) - min(xs)) * g, (max(ys) - min(ys)) * g, (max(zs) - min(zs)) * g))


def render_previews():
    scene = bpy.context.scene
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024

    # Ground plane
    bpy.ops.mesh.primitive_plane_add(size=50, location=(0, 0, 0))
    gp = bpy.context.active_object
    gp.name = "Ground"
    mat = bpy.data.materials.new("GroundMat")
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.50, 0.55, 0.52, 1.0)
    mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.95
    gp.data.materials.append(mat)

    # Sun light
    light_data = bpy.data.lights.new("Sun", "SUN")
    light_data.energy = 3.5
    light_ob = bpy.data.objects.new("Sun", light_data)
    bpy.context.collection.objects.link(light_ob)
    light_ob.rotation_euler = (math.radians(52), math.radians(18), math.radians(-38))

    # Fill light
    fill_data = bpy.data.lights.new("Fill", "SUN")
    fill_data.energy = 1.0
    fill_data.color = (0.75, 0.85, 1.0)
    fill_ob = bpy.data.objects.new("Fill", fill_data)
    bpy.context.collection.objects.link(fill_ob)
    fill_ob.rotation_euler = (math.radians(45), math.radians(-20), math.radians(140))

    # Camera
    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 55
    cam = bpy.data.objects.new("Camera", cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam

    def render(pos, target, path):
        cam.location = Vector(pos)
        d = Vector(target) - Vector(pos)
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)

    render((3.8, -4.2, 3.8), (0, 0, 1.2), "3d_art/preview/hagia_sophia_hero.png")
    render((0.0, -5.5, 1.4), (0, 0, 1.4), "3d_art/preview/hagia_sophia_elevation.png")
    render((-4.2, -3.8, 3.8), (0, 0, 1.2), "3d_art/preview/hagia_sophia_side.png")

    # Clean up render helpers
    bpy.data.objects.remove(gp, do_unlink=True)
    bpy.data.objects.remove(light_ob, do_unlink=True)
    bpy.data.objects.remove(fill_ob, do_unlink=True)
    bpy.data.objects.remove(cam, do_unlink=True)


if __name__ == "__main__" or True:
    ob = make()
    report(ob)
    render_previews()
    bpy.ops.wm.save_as_mainfile(filepath="3d_art/src/hagia_sophia.blend")

