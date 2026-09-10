import bpy, os, math
import bmesh
from mathutils import Vector

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

for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.wm.obj_import(filepath='3d_art/src/blue_mosque_submeshes.obj', forward_axis='Y', up_axis='Z')

# Remove terrain skirts
skirts = ["submesh_28", "submesh_29", "submesh_58", "submesh_59"]
for o in list(bpy.context.scene.objects):
    for s in skirts:
        if o.name.startswith(s):
            bpy.data.objects.remove(o, do_unlink=True)
            break

# Join remaining objects into one mesh
mesh_obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.context.view_layer.objects.active = mesh_obs[0]
for o in mesh_obs: o.select_set(True)
bpy.ops.object.join()
ob = bpy.context.active_object
ob.name = "HagiaSophiaAlt"

# Use bmesh to delete minaret faces
bm = bmesh.new()
bm.from_mesh(ob.data)

del_faces = []
for f in bm.faces:
    c = f.calc_center_median()
    # If face is part of the minaret column above buttress roof
    if dist_to_minaret(c.x, c.y) < 2.6 and c.z > 8.5:
        del_faces.append(f)

print(f"Deleting {len(del_faces)} minaret faces...")
bmesh.ops.delete(bm, geom=del_faces, context='FACES')

# Delete loose vertices
loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context='VERTS')

# Cap the open minaret stump boundaries at Z ~ 8.5
# Add square/octagonal flat caps on each of the 6 minaret corners
for mx, my in minarets_xy:
    # create a cap face at z = 8.5
    r = 2.0
    v1 = bm.verts.new((mx - r, my - r, 8.5))
    v2 = bm.verts.new((mx + r, my - r, 8.5))
    v3 = bm.verts.new((mx + r, my + r, 8.5))
    v4 = bm.verts.new((mx - r, my + r, 8.5))
    bm.faces.new((v1, v2, v3, v4))

bm.normal_update()
bm.to_mesh(ob.data)
bm.free()
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

bbox = [ob.matrix_world @ Vector(corner) for corner in ob.bound_box]
center = sum(bbox, Vector()) / 8.0

cam.location = center + Vector((45.0, -55.0, 40.0))
d = center - cam.location
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

scene.render.filepath = os.path.abspath("3d_art/preview/test_cut_minarets.png")
bpy.ops.render.render(write_still=True)
print("Saved preview to", scene.render.filepath)
