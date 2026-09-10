import bpy, os, math
import bmesh
from mathutils import Vector

for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.wm.obj_import(filepath='3d_art/src/blue_mosque_submeshes.obj', forward_axis='Y', up_axis='Z')

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

# Remove terrain skirts
skirts = ["submesh_28", "submesh_29", "submesh_58", "submesh_59"]
for o in list(bpy.context.scene.objects):
    if any(o.name.startswith(s) for s in skirts):
        bpy.data.objects.remove(o, do_unlink=True)

# Categories of submeshes
dome_submeshes = {"submesh_52", "submesh_26", "submesh_40", "submesh_50", "submesh_04"}
wall_submeshes = {"submesh_00", "submesh_02", "submesh_60", "submesh_06"}
marble_submeshes = {"submesh_07", "submesh_13", "submesh_20", "submesh_34", "submesh_36", "submesh_37", "submesh_38", "submesh_42", "submesh_44", "submesh_45", "submesh_54", "submesh_57"}
dark_submeshes = {"submesh_09", "submesh_11", "submesh_15", "submesh_16", "submesh_17", "submesh_18", "submesh_22", "submesh_23", "submesh_24", "submesh_25", "submesh_30", "submesh_31", "submesh_32", "submesh_62", "submesh_63"}

# Remove minaret-specific objects
minaret_objs = {"submesh_46", "submesh_48", "submesh_55", "submesh_56"}
for o in list(bpy.context.scene.objects):
    if any(o.name.startswith(m) for m in minaret_objs):
        bpy.data.objects.remove(o, do_unlink=True)

# Tag materials on each object before join
def make_mat(name, color, rough, metal):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    return mat

mat_dome = make_mat("M_Dome", (0.65, 0.12, 0.08, 1.0), 0.45, 0.15)       # Byzantine Imperial Red
mat_wall     = make_mat("M_TerracottaWall", (0.62, 0.32, 0.22, 1.0), 0.80, 0.0) # Terracotta brick/stone
mat_marble   = make_mat("M_CreamMarble", (0.85, 0.78, 0.68, 1.0), 0.55, 0.0)    # Antique marble
mat_dark     = make_mat("M_DarkInterior", (0.08, 0.04, 0.03, 1.0), 0.95, 0.0)   # Shadow cutout

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

# Join into single object
mesh_obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.context.view_layer.objects.active = mesh_obs[0]
for o in mesh_obs: o.select_set(True)
bpy.ops.object.join()
ob = bpy.context.active_object
ob.name = "HagiaSophiaAlt"

# Delete minaret columns
bm = bmesh.new()
bm.from_mesh(ob.data)

del_faces = []
for f in bm.faces:
    c = f.calc_center_median()
    if dist_to_minaret(c.x, c.y) < 2.6 and c.z > 8.5:
        del_faces.append(f)

bmesh.ops.delete(bm, geom=del_faces, context='FACES')

loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context='VERTS')

# Cap minaret stump corners
# find material index for marble
marble_idx = ob.data.materials.find("M_CreamMarble")
for mx, my in minarets_xy:
    r = 2.0
    v1 = bm.verts.new((mx - r, my - r, 8.5))
    v2 = bm.verts.new((mx + r, my - r, 8.5))
    v3 = bm.verts.new((mx + r, my + r, 8.5))
    v4 = bm.verts.new((mx - r, my + r, 8.5))
    f = bm.faces.new((v1, v2, v3, v4))
    f.material_index = marble_idx

# Add Justinianic Gold Cross at central dome apex
mat_gold = make_mat("M_GoldCross", (0.95, 0.75, 0.25, 1.0), 0.25, 1.0)
ob.data.materials.append(mat_gold)
gold_idx = ob.data.materials.find("M_GoldCross")

# Central dome apex is at (0.0, 11.7, 22.9)
cx, cy, cz = 0.0, 11.7, 22.9
# Vertical shaft
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

# Grounding: shift Z so bottom foundation sits at Z = 0.0, center XY
coords = [Vector(corner) for corner in ob.bound_box]
xs = [c.x for c in coords]; ys = [c.y for c in coords]; zs = [c.z for c in coords]
min_z = min(zs)
print(f"Shift Z by {-min_z:.2f} to ground at 0.0")
for v in ob.data.vertices:
    v.co.z -= min_z
    v.co.x -= (min(xs) + max(xs)) * 0.5
    v.co.y -= (min(ys) + max(ys)) * 0.5

ob.data.update()

# Render preview
scene = bpy.context.scene
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024

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

cam.location = Vector((45.0, -55.0, 40.0))
d = Vector((0, 0, 10.0)) - cam.location
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

scene.render.filepath = os.path.abspath("3d_art/preview/alt_hagia_sophia_colored.png")
bpy.ops.render.render(write_still=True)
print("Saved preview to", scene.render.filepath)
