import bpy
import os
import math
from mathutils import Vector

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

# OBJ import with Z-up, Y-forward
bpy.ops.wm.obj_import(filepath="3d_art/src/blue_mosque.obj", forward_axis='Y', up_axis='Z')
ob = bpy.context.selected_objects[0]
print("Loaded object:", ob.name, "dimensions:", ob.dimensions)

# Render isometric view
scene = bpy.context.scene
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024

light_data = bpy.data.lights.new("Sun", "SUN")
light_data.energy = 3.5
light_ob = bpy.data.objects.new("Sun", light_data)
bpy.context.collection.objects.link(light_ob)
light_ob.rotation_euler = (math.radians(52), math.radians(18), math.radians(-38))

# Fill light
fill_data = bpy.data.lights.new("Fill", "SUN")
fill_data.energy = 1.2
fill_data.color = (0.75, 0.85, 1.0)
fill_ob = bpy.data.objects.new("Fill", fill_data)
bpy.context.collection.objects.link(fill_ob)
fill_ob.rotation_euler = (math.radians(45), math.radians(-20), math.radians(140))

cam_data = bpy.data.cameras.new("Camera")
cam_data.lens = 50
cam = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam)
scene.camera = cam

# Frame bounding box
bbox = [ob.matrix_world @ Vector(corner) for corner in ob.bound_box]
center = sum(bbox, Vector()) / 8.0
print("Center:", center)

cam.location = center + Vector((50.0, -60.0, 45.0))
d = center - cam.location
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

scene.render.filepath = os.path.abspath("3d_art/preview/blue_mosque_upright.png")
bpy.ops.render.render(write_still=True)
print("Saved preview to", scene.render.filepath)
