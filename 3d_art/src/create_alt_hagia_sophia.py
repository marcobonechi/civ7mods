"""Create alternative Hagia Sophia from Ottoman Blue Mosque geometry.

Keeps only the domed prayer hall. The shipped Blue Mosque asset is a whole complex:
the prayer hall (+Y), an arcaded courtyard of the same size again (-Y), and a
three-domed annex off the -X side. Only the prayer hall reads as Hagia Sophia, so the
other two are sliced away - see CUT_Y / CUT_X.

Also removes the minarets, recolors domes/ceilings Byzantine imperial red, adds a gold
cross, grounds at Z=0, and bakes a unified 2K PBR texture atlas.
"""

import os
import sys
import math
import bmesh
import bpy
import numpy as np
from mathutils import Vector

OUT_TEX_DIR = os.path.abspath("3d_art/textures")
OUT_DDS_DIR = os.path.abspath("3d_art/dds")
OUT_PREVIEW_DIR = os.path.abspath("3d_art/preview")
CC0_DIR = os.path.abspath("3d_art/textures/cc0")

os.makedirs(OUT_TEX_DIR, exist_ok=True)
os.makedirs(OUT_DDS_DIR, exist_ok=True)
os.makedirs(OUT_PREVIEW_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# 1. Geometry extraction & cleanup
# ---------------------------------------------------------------------------
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.meshes):
    bpy.data.meshes.remove(m, do_unlink=True)
for mat in list(bpy.data.materials):
    bpy.data.materials.remove(mat, do_unlink=True)

bpy.ops.wm.obj_import(filepath="3d_art/src/blue_mosque_submeshes.obj", forward_axis='Y', up_axis='Z')

minarets_xy = [
    ( 13.5, -23.7),
    (-13.5, -23.7),
    ( 13.5,  -1.8),
    (-13.5,  -1.8),
    ( 13.5,  25.3),
    (-13.5,  25.3),
]

def dist_to_minaret(x, y):
    return min(((x - mx)**2 + (y - my)**2)**0.5 for mx, my in minarets_xy)

# Slice planes, in the source asset's own units (before SCALE_FACTOR).
# The prayer hall runs y = -1.8 .. 25.3 - its corners are the minaret pairs at those
# y values - so -3.0 keeps its north facade intact and drops everything beyond.
# The annex sits entirely at x < -16; -15.0 clears it without touching the hall,
# whose west wall is at x = -13.5.
CUT_Y = -3.0
CUT_X = -15.0

# Remove terrain skirts
skirts = ["submesh_28", "submesh_29", "submesh_58", "submesh_59"]
for o in list(bpy.context.scene.objects):
    if any(o.name.startswith(s) for s in skirts):
        bpy.data.objects.remove(o, do_unlink=True)

# Remove minaret-specific standalone meshes
minaret_objs = ["submesh_46", "submesh_48", "submesh_55", "submesh_56"]
for o in list(bpy.context.scene.objects):
    if any(o.name.startswith(m) for m in minaret_objs):
        bpy.data.objects.remove(o, do_unlink=True)

# Categories of submeshes
dome_submeshes = {"submesh_52", "submesh_26", "submesh_40", "submesh_50", "submesh_04"}
wall_submeshes = {"submesh_00", "submesh_02", "submesh_60", "submesh_06"}
marble_submeshes = {"submesh_07", "submesh_13", "submesh_20", "submesh_34", "submesh_36", "submesh_37", "submesh_38", "submesh_42", "submesh_44", "submesh_45", "submesh_54", "submesh_57"}
dark_submeshes = {"submesh_09", "submesh_11", "submesh_15", "submesh_16", "submesh_17", "submesh_18", "submesh_22", "submesh_23", "submesh_24", "submesh_25", "submesh_30", "submesh_31", "submesh_32", "submesh_62", "submesh_63"}

def _hex_linear(h):
    rgb = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb) + (1.0,)

def load_cc0_img(subpath, non_color=False):
    p = os.path.join(CC0_DIR, subpath)
    if not os.path.exists(p): return None
    img = bpy.data.images.load(p, check_existing=True)
    if non_color: img.colorspace_settings.name = "Non-Color"
    return img

brick_c = load_cc0_img("brick/color.jpg")
brick_n = load_cc0_img("brick/normal.jpg", non_color=True)
brick_r = load_cc0_img("brick/roughness.jpg", non_color=True)

lead_c = load_cc0_img("lead/color.jpg")
lead_n = load_cc0_img("lead/normal.jpg", non_color=True)
lead_r = load_cc0_img("lead/roughness.jpg", non_color=True)

marble_c = load_cc0_img("marble/color.jpg")
marble_n = load_cc0_img("marble/normal.jpg", non_color=True)
marble_r = load_cc0_img("marble/roughness.jpg", non_color=True)

def create_pbr_mat(name, color_img, norm_img, rough_img, tint_hex, tint_fac, scale, norm_str, metal):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    output = nodes.new("ShaderNodeOutputMaterial")
    links.new(output.inputs["Surface"], bsdf.outputs["BSDF"])

    coord = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (scale, scale, scale)
    links.new(mapping.inputs["Vector"], coord.outputs["Object"])

    if color_img:
        tex_c = nodes.new("ShaderNodeTexImage")
        tex_c.image = color_img
        tex_c.projection = "BOX"
        tex_c.projection_blend = 0.15
        links.new(tex_c.inputs["Vector"], mapping.outputs["Vector"])

        mix = nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MIX"
        mix.inputs[0].default_value = tint_fac
        mix.inputs[7].default_value = _hex_linear(tint_hex)
        links.new(mix.inputs[6], tex_c.outputs["Color"])
        links.new(bsdf.inputs["Base Color"], mix.outputs[2])
    else:
        bsdf.inputs["Base Color"].default_value = _hex_linear(tint_hex)

    if rough_img:
        tex_r = nodes.new("ShaderNodeTexImage")
        tex_r.image = rough_img
        tex_r.projection = "BOX"
        tex_r.projection_blend = 0.15
        links.new(tex_r.inputs["Vector"], mapping.outputs["Vector"])
        links.new(bsdf.inputs["Roughness"], tex_r.outputs["Color"])
    else:
        bsdf.inputs["Roughness"].default_value = 0.85

    if norm_img:
        tex_n = nodes.new("ShaderNodeTexImage")
        tex_n.image = norm_img
        tex_n.projection = "BOX"
        tex_n.projection_blend = 0.15
        links.new(tex_n.inputs["Vector"], mapping.outputs["Vector"])

        norm = nodes.new("ShaderNodeNormalMap")
        norm.inputs["Strength"].default_value = norm_str
        links.new(norm.inputs["Color"], tex_n.outputs["Color"])
        links.new(bsdf.inputs["Normal"], norm.outputs["Normal"])

    bsdf.inputs["Metallic"].default_value = metal
    return mat

# Create materials:
# 1. Red Domes/Ceiling: Byzantine Imperial Terracotta/Crimson Red (#a82d1d)
# Dome tint: Byzantine imperial red. A blue (#1d6ea8, the same hue-rotated to azure with
# lightness and saturation untouched) was tried and reverted - keep that hex to hand if it
# is wanted again. Mixed at 0.70 over the lead texture, which lifts and greys it, so it
# reads lighter on screen than the raw hex looks.
mat_dome = create_pbr_mat("M_Dome", lead_c, lead_n, lead_r, "a82d1d", 0.70, 0.8, 0.4, 0.1)
# 2. Byzantine Terracotta Brick Walls (#b5563d)
mat_wall = create_pbr_mat("M_Wall", brick_c, brick_n, brick_r, "b5563d", 0.25, 1.2, 0.7, 0.0)
# 3. Cream Antique Marble Trim (#e8cfa6)
mat_marble = create_pbr_mat("M_Marble", marble_c, marble_n, marble_r, "e8cfa6", 0.35, 1.0, 0.5, 0.0)
# 4. Dark Shadow Interior (#2a150f)
mat_dark = create_pbr_mat("M_Dark", None, None, None, "2a150f", 0.0, 1.0, 0.0, 0.0)
# 5. Pure Gold Cross (#f6d27a)
mat_gold = create_pbr_mat("M_Gold", None, None, None, "f6d27a", 0.0, 1.0, 0.0, 1.0)
mat_gold.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.25

# Assign materials to submesh objects
for o in bpy.context.scene.objects:
    if o.type != 'MESH': continue
    o.data.materials.clear()
    prefix = o.name[:10]
    if prefix in dome_submeshes:
        o.data.materials.append(mat_dome)
    elif prefix in marble_submeshes:
        o.data.materials.append(mat_marble)
    elif prefix in dark_submeshes:
        o.data.materials.append(mat_dark)
    else:
        o.data.materials.append(mat_wall)

# Join into single unified building mesh
mesh_obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.context.view_layer.objects.active = mesh_obs[0]
for o in mesh_obs: o.select_set(True)
bpy.ops.object.join()
ob = bpy.context.active_object
ob.name = "HagiaSophiaAlt"

# Ensure all 5 materials are in the mesh material list
for m in [mat_dome, mat_wall, mat_marble, mat_dark, mat_gold]:
    if m.name not in ob.data.materials:
        ob.data.materials.append(m)

# ---------------------------------------------------------------------------
# 2. Minaret removal & Buttress capping
# ---------------------------------------------------------------------------
bm = bmesh.new()
bm.from_mesh(ob.data)

del_faces = []
for f in bm.faces:
    c = f.calc_center_median()
    if dist_to_minaret(c.x, c.y) < 2.6 and c.z > 8.5:
        del_faces.append(f)

print(f"Deleting {len(del_faces)} minaret faces...")
bmesh.ops.delete(bm, geom=del_faces, context='FACES')

loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context='VERTS')

# Slice off the courtyard and the annex.
# bisect_plane rather than deleting faces by centre: a centre test leaves a ragged
# fringe of part-crossing faces along the seam, which showed as spikes hanging off
# the cut edge. Bisecting splits faces exactly on the plane and gives a flat edge.
def slice_off(plane_co, plane_no, what):
    before = len(bm.faces)
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-4,
                           plane_co=plane_co, plane_no=plane_no,
                           clear_outer=True, clear_inner=False)
    print(f"Sliced off {what}: {before - len(bm.faces)} faces")

slice_off((0.0, CUT_Y, 0.0), (0.0, -1.0, 0.0), "courtyard")
slice_off((CUT_X, 0.0, 0.0), (-1.0, 0.0, 0.0), "annex")
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')

# Cap the minaret stumps with marble cornice slabs. Only the four that survive the
# slice - capping a cut-away minaret would leave a quad floating in mid-air.
marble_idx = ob.data.materials.find("M_Marble")
for mx, my in [(mx, my) for mx, my in minarets_xy if my > CUT_Y and mx > CUT_X]:
    r = 2.0
    v1 = bm.verts.new((mx - r, my - r, 8.5))
    v2 = bm.verts.new((mx + r, my - r, 8.5))
    v3 = bm.verts.new((mx + r, my + r, 8.5))
    v4 = bm.verts.new((mx - r, my + r, 8.5))
    f = bm.faces.new((v1, v2, v3, v4))
    f.material_index = marble_idx

# ---------------------------------------------------------------------------
# 3. Add Byzantine Christian Gold Cross at central dome apex
# ---------------------------------------------------------------------------
gold_idx = ob.data.materials.find("M_Gold")
cx, cy, cz = 0.0, 11.7, 22.9

# Vertical cross shaft
shaft = bmesh.ops.create_cube(bm, size=1.0)['verts']
for v in shaft:
    v.co.x = cx + v.co.x * 0.4
    v.co.y = cy + v.co.y * 0.4
    v.co.z = cz + 1.6 + v.co.z * 2.8
for f in {f for v in shaft for f in v.link_faces}:
    f.material_index = gold_idx

# Crossbar
bar = bmesh.ops.create_cube(bm, size=1.0)['verts']
for v in bar:
    v.co.x = cx + v.co.x * 2.0
    v.co.y = cy + v.co.y * 0.4
    v.co.z = cz + 2.2 + v.co.z * 0.4
for f in {f for v in bar for f in v.link_faces}:
    f.material_index = gold_idx

bm.normal_update()
bm.to_mesh(ob.data)
bm.free()
ob.data.update()

# ---------------------------------------------------------------------------
# 4. Grounding & Hex scale (0.65 scale to sit naturally on the hex tile)
# ---------------------------------------------------------------------------
SCALE_FACTOR = 0.65
for v in ob.data.vertices:
    v.co *= SCALE_FACTOR

def mesh_bounds():
    """Bounds straight from the vertices.

    Not ob.bound_box: that is cached from before the bmesh write, so after slicing the
    courtyard away it still reports the whole complex - which silently centred the model
    on the old extents and left the prayer hall off-centre on its hex.
    """
    vs = ob.data.vertices
    xs = [v.co.x for v in vs]; ys = [v.co.y for v in vs]; zs = [v.co.z for v in vs]
    return xs, ys, zs

xs, ys, zs = mesh_bounds()
min_z = min(zs)
cx = (min(xs) + max(xs)) * 0.5
cy = (min(ys) + max(ys)) * 0.5
print(f"Shift Z by {-min_z:.2f} to ground at 0.0, centre XY by ({-cx:.2f}, {-cy:.2f})")
for v in ob.data.vertices:
    v.co.z -= min_z
    v.co.x -= cx
    v.co.y -= cy

ob.data.update()
xs, ys, zs = mesh_bounds()
print(f"Final bounds: X={min(xs):.2f}..{max(xs):.2f}, Y={min(ys):.2f}..{max(ys):.2f}, Z={min(zs):.2f}..{max(zs):.2f}")
print(f"Footprint: {max(xs)-min(xs):.2f} x {max(ys)-min(ys):.2f} units, height {max(zs)-min(zs):.2f} units")

# ---------------------------------------------------------------------------
# 4b. Repair the roof material assignment
# ---------------------------------------------------------------------------
# The per-submesh categorisation above is coarse: the shipped asset splits a single
# dome across several submeshes, and only some of them landed in dome_submeshes. Roughly
# half of all roof-facing area was left on M_Wall. That was invisible while the dome tint
# was imperial red, because brick (#b5563d) and that red (#a82d1d) are neighbours - it
# only showed up as blotching once the domes went blue.
#
# So reassign by geometry rather than by submesh: anything brick, above the roofline and
# facing upwards, is roof. Marble stays put (it is the cornice banding) and so does the
# gold cross; vertical brick - the great dome's drum and the turret shafts - is excluded
# by the normal test and stays brick, which is how the asset is meant to read.
dome_idx = ob.data.materials.find("M_Dome")
wall_idx = ob.data.materials.find("M_Wall")
ROOF_Z = 4.2          # grounded units; below this is facade, not roof
ROOF_NORMAL = 0.15    # how much a face must look upward to count as roof

repaired = 0
for poly in ob.data.polygons:
    if poly.material_index != wall_idx:
        continue
    if poly.center.z <= ROOF_Z or poly.normal.z <= ROOF_NORMAL:
        continue
    # Flat slabs low down are terrace floor, not roof.
    if poly.normal.z > 0.99 and poly.center.z < 6.0:
        continue
    poly.material_index = dome_idx
    repaired += 1
print(f"Roof repair: moved {repaired} brick faces to M_Dome")
ob.data.update()

# Unwrap into UV atlas
bpy.context.view_layer.objects.active = ob
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.015)
bpy.ops.object.mode_set(mode="OBJECT")

# ---------------------------------------------------------------------------
# 5. Cycles Preview Renders
# ---------------------------------------------------------------------------
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 32
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024

# Ground plane
bpy.ops.mesh.primitive_plane_add(size=70, location=(0, 0, 0))
gp = bpy.context.active_object
gmat = bpy.data.materials.new("GMat")
gmat.use_nodes = True
gmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.45, 0.48, 0.46, 1.0)
gp.data.materials.append(gmat)

light_data = bpy.data.lights.new("Sun", "SUN")
light_data.energy = 3.5
light_ob = bpy.data.objects.new("Sun", light_data)
bpy.context.collection.objects.link(light_ob)
light_ob.rotation_euler = (math.radians(52), math.radians(18), math.radians(-38))

fill_data = bpy.data.lights.new("Fill", "SUN")
fill_data.energy = 1.2
fill_data.color = (0.75, 0.85, 1.0)
fill_ob = bpy.data.objects.new("Fill", fill_data)
bpy.context.collection.objects.link(fill_ob)
fill_ob.rotation_euler = (math.radians(45), math.radians(-20), math.radians(140))

cam_data = bpy.data.cameras.new("Camera")
cam_data.lens = 45
cam = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam)
scene.camera = cam

def render_view(pos, target, filename):
    cam.location = Vector(pos)
    d = Vector(target) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(OUT_PREVIEW_DIR, filename)
    bpy.ops.render.render(write_still=True)
    print("Saved", scene.render.filepath)

# 3 camera angles: Hero (isometric), Elevation (front), Overhead
render_view((23.0, -27.0, 20.0), (0, 0, 7.0), "alt_hagia_sophia_hero.png")
render_view((0.0, -50.0, 15.0), (0, 0, 8.5), "alt_hagia_sophia_elevation.png")
render_view((-25.0, -23.0, 21.0), (0, 0, 7.0), "alt_hagia_sophia_side.png")

# Cleanup render helpers
bpy.data.objects.remove(gp, do_unlink=True)
bpy.data.objects.remove(light_ob, do_unlink=True)
bpy.data.objects.remove(fill_ob, do_unlink=True)
bpy.data.objects.remove(cam, do_unlink=True)

# Save blend file
blend_out = os.path.abspath("3d_art/src/hagia_sophia_alt.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_out)
print("Saved blend to", blend_out)
