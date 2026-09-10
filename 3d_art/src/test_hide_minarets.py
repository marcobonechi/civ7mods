import bpy, os, math
from mathutils import Vector

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.wm.obj_import(filepath="3d_art/src/blue_mosque_submeshes.obj", forward_axis='Y', up_axis='Z')

# Hide/delete terrain skirts and upper minarets
skirts = ["submesh_28", "submesh_29", "submesh_58", "submesh_59"]
upper_minarets = ["submesh_46", "submesh_48", "submesh_55", "submesh_56"]

for o in list(bpy.context.scene.objects):
    for prefix in skirts + upper_minarets:
        if o.name.startswith(prefix):
            bpy.data.objects.remove(o, do_unlink=True)
            break

# Join remaining objects to inspect
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

all_obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
# calculate center
coords = [Vector(corner) for o in all_obs for corner in o.bound_box]
center = sum(coords, Vector()) / len(coords)

cam.location = center + Vector((45.0, -55.0, 40.0))
d = center - cam.location
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

scene.render.filepath = os.path.abspath("3d_art/preview/test_hide_minarets.png")
bpy.ops.render.render(write_still=True)
print("Saved preview to", scene.render.filepath)
