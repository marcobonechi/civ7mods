"""Process Version 3 Hagia Sophia from Downloads/hagia sophia 3d model.glb.

Steps:
1. Import GLB
2. Remove 4 Ottoman minarets cleanly
3. Cap the 4 buttress pillars with stone roofs
4. Add Justinianic Christian gold cross atop central dome
5. Center horizontally and ground at Z = 0.00
6. Scale to Civ 7 wonder tile dimensions (~23 x 22 units, radius < 14)
7. Decimate to ~70k triangles (matching official wonder budget)
8. Render Cycles previews
9. Save to 3d_art/src/hagia_sophia_v3.blend
"""

import os
import math
import bpy
import bmesh
from mathutils import Vector

GLB_INPUT = "/Users/marcob/Downloads/hagia sophia 3d model.glb"
BLEND_OUT = os.path.abspath("3d_art/src/hagia_sophia_v3.blend")
PREVIEW_DIR = os.path.abspath("3d_art/preview")
os.makedirs(PREVIEW_DIR, exist_ok=True)

# 1. Clear scene & import
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.import_scene.gltf(filepath=GLB_INPUT)
mesh_obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
ob = mesh_obs[0]
ob.name = "HagiaSophiaV3"
bpy.context.view_layer.objects.active = ob

print(f"Loaded {GLB_INPUT}: {len(ob.data.polygons)} tris, {len(ob.data.vertices)} verts")

# 2. Minaret removal
minarets = [
    ( 0.427,  0.377),
    ( 0.427, -0.227),
    (-0.364,  0.377),
    (-0.364, -0.227),
]

def dist_m(x, y):
    return min(((x - mx)**2 + (y - my)**2)**0.5 for mx, my in minarets)

bm = bmesh.new()
bm.from_mesh(ob.data)

del_faces = [f for f in bm.faces if dist_m(f.calc_center_median().x, f.calc_center_median().y) < 0.045 and f.calc_center_median().z > 0.26]
print(f"Deleting {len(del_faces)} minaret faces...")
bmesh.ops.delete(bm, geom=del_faces, context="FACES")

loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context="VERTS")

# 3. Cap the 4 buttress pillars with stone caps
uv_layer = bm.loops.layers.uv.active
# Sample stone/wall UV for caps: (0.5, 0.5)
cap_faces = []
for mx, my in minarets:
    r = 0.035
    v1 = bm.verts.new((mx - r, my - r, 0.26))
    v2 = bm.verts.new((mx + r, my - r, 0.26))
    v3 = bm.verts.new((mx + r, my + r, 0.26))
    v4 = bm.verts.new((mx - r, my + r, 0.26))
    f = bm.faces.new((v1, v2, v3, v4))
    cap_faces.append(f)
    for l in f.loops:
        l[uv_layer].uv = (0.5, 0.5)

# 4. Add Justinianic Christian Gold Cross atop central dome finial
# Apex finial is around X=0.044, Y=0.093, Z=0.594
fx, fy, fz = 0.044, 0.093, 0.594
cross_verts = []

# Vertical post
pw, ph = 0.005, 0.065
v_p1 = bm.verts.new((fx - pw, fy - pw, fz))
v_p2 = bm.verts.new((fx + pw, fy - pw, fz))
v_p3 = bm.verts.new((fx + pw, fy + pw, fz))
v_p4 = bm.verts.new((fx - pw, fy + pw, fz))

v_p5 = bm.verts.new((fx - pw, fy - pw, fz + ph))
v_p6 = bm.verts.new((fx + pw, fy - pw, fz + ph))
v_p7 = bm.verts.new((fx + pw, fy + pw, fz + ph))
v_p8 = bm.verts.new((fx - pw, fy + pw, fz + ph))

# Horizontal crossbar
bw, bl, bh = 0.005, 0.040, 0.010
bz = fz + ph * 0.65
v_b1 = bm.verts.new((fx - bl, fy - bw, bz - bh*0.5))
v_b2 = bm.verts.new((fx + bl, fy - bw, bz - bh*0.5))
v_b3 = bm.verts.new((fx + bl, fy + bw, bz - bh*0.5))
v_b4 = bm.verts.new((fx - bl, fy + bw, bz - bh*0.5))

v_b5 = bm.verts.new((fx - bl, fy - bw, bz + bh*0.5))
v_b6 = bm.verts.new((fx + bl, fy - bw, bz + bh*0.5))
v_b7 = bm.verts.new((fx + bl, fy + bw, bz + bh*0.5))
v_b8 = bm.verts.new((fx - bl, fy + bw, bz + bh*0.5))

cross_boxes = [
    (v_p1, v_p2, v_p3, v_p4, v_p5, v_p6, v_p7, v_p8),
    (v_b1, v_b2, v_b3, v_b4, v_b5, v_b6, v_b7, v_b8),
]

for (c1, c2, c3, c4, c5, c6, c7, c8) in cross_boxes:
    faces = [
        bm.faces.new((c1, c2, c3, c4)), # bottom
        bm.faces.new((c5, c8, c7, c6)), # top
        bm.faces.new((c1, c5, c6, c2)), # front
        bm.faces.new((c2, c6, c7, c3)), # right
        bm.faces.new((c3, c7, c8, c4)), # back
        bm.faces.new((c4, c8, c5, c1)), # left
    ]
    for cf in faces:
        for l in cf.loops:
            # Gold finial texture coordinate
            l[uv_layer].uv = (0.985, 0.75)

bm.normal_update()
bm.to_mesh(ob.data)
bm.free()
ob.data.update()

# 5. Centering & Grounding & Scaling
xs = [v.co.x for v in ob.data.vertices]
ys = [v.co.y for v in ob.data.vertices]
zs = [v.co.z for v in ob.data.vertices]

cx = (min(xs) + max(xs)) * 0.5
cy = (min(ys) + max(ys)) * 0.5
min_z = min(zs)

print(f"Shifting: cx={cx:.3f}, cy={cy:.3f}, min_z={min_z:.3f}")
for v in ob.data.vertices:
    v.co.x -= cx
    v.co.y -= cy
    v.co.z -= min_z

# Target scale: fit within outer hex radius 13.5 (max extent <= 12.0)
raw_max_extent = max(max(xs) - min(xs), max(ys) - min(ys))
TARGET_WIDTH = 23.5 # footprint ~23.5 x 22.0 units
scale_factor = TARGET_WIDTH / raw_max_extent
print(f"Applying scale factor: {scale_factor:.2f}")

for v in ob.data.vertices:
    v.co *= scale_factor

ob.data.update()

xs = [v.co.x for v in ob.data.vertices]
ys = [v.co.y for v in ob.data.vertices]
zs = [v.co.z for v in ob.data.vertices]
print(f"Scaled bounds: X=[{min(xs):.2f}, {max(xs):.2f}], Y=[{min(ys):.2f}, {max(ys):.2f}], Z=[{min(zs):.2f}, {max(zs):.2f}]")
print(f"Footprint: {max(xs)-min(xs):.1f} x {max(ys)-min(ys):.1f} units, height {max(zs)-min(zs):.1f} units")

# 6. Decimate to ~70k triangles
TARGET_TRIS = 70000
mod = ob.modifiers.new("Decimate", "DECIMATE")
mod.ratio = TARGET_TRIS / len(ob.data.polygons)
bpy.context.view_layer.objects.active = ob
bpy.ops.object.modifier_apply(modifier="Decimate")

print(f"Final mesh: {len(ob.data.polygons)} triangles, {len(ob.data.vertices)} vertices")

# Save blend
bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
print(f"Saved blend to {BLEND_OUT}")

# 7. Render Cycles previews
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 32
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024

# Ground plane
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
gp = bpy.context.active_object
gmat = bpy.data.materials.new("GMat")
gmat.use_nodes = True
gmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.35, 0.38, 0.35, 1.0)
gp.data.materials.append(gmat)

light_data = bpy.data.lights.new("Sun", "SUN")
light_data.energy = 3.8
light_ob = bpy.data.objects.new("Sun", light_data)
bpy.context.collection.objects.link(light_ob)
light_ob.rotation_euler = (math.radians(52), math.radians(18), math.radians(-38))

fill_data = bpy.data.lights.new("Fill", "SUN")
fill_data.energy = 1.4
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
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(PREVIEW_DIR, filename)
    bpy.ops.render.render(write_still=True)
    print("Saved", scene.render.filepath)

render_view((28.0, -32.0, 24.0), (0, 0, 8.0), "v3_hagia_sophia_hero.png")
render_view((0.0, -36.0, 10.0), (0, 0, 8.0), "v3_hagia_sophia_elevation.png")
render_view((-30.0, -28.0, 24.0), (0, 0, 8.0), "v3_hagia_sophia_side.png")

# Cleanup render helpers from blend
bpy.data.objects.remove(gp, do_unlink=True)
bpy.data.objects.remove(light_ob, do_unlink=True)
bpy.data.objects.remove(fill_ob, do_unlink=True)
bpy.data.objects.remove(cam, do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
print("Updated blend saved without render helpers.")
