import bpy, os, math
from mathutils import Vector

# Clear scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

glb_path = "/Users/marcob/Downloads/hagia sophia 3d model.glb"
bpy.ops.import_scene.gltf(filepath=glb_path)

mesh_obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
print("Imported mesh objects:", [o.name for o in mesh_obs])
ob = mesh_obs[0]

# Check geometry and dimensions
zs = [v.co.z for v in ob.data.vertices]
xs = [v.co.x for v in ob.data.vertices]
ys = [v.co.y for v in ob.data.vertices]
print(f"Blender raw bounds: X=[{min(xs):.2f}, {max(xs):.2f}] Y=[{min(ys):.2f}, {max(ys):.2f}] Z=[{min(zs):.2f}, {max(zs):.2f}]")
print(f"Materials: {[m.name for m in ob.data.materials]}")

# Setup camera & lighting
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 32
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024

# Sun
light_data = bpy.data.lights.new("Sun", "SUN")
light_data.energy = 3.5
light_ob = bpy.data.objects.new("Sun", light_data)
bpy.context.collection.objects.link(light_ob)
light_ob.rotation_euler = (math.radians(50), math.radians(20), math.radians(-35))

# Fill
fill_data = bpy.data.lights.new("Fill", "SUN")
fill_data.energy = 1.2
fill_data.color = (0.8, 0.88, 1.0)
fill_ob = bpy.data.objects.new("Fill", fill_data)
bpy.context.collection.objects.link(fill_ob)
fill_ob.rotation_euler = (math.radians(40), math.radians(-25), math.radians(145))

# Camera
cam_data = bpy.data.cameras.new("Camera")
cam_data.lens = 45
cam = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam)
scene.camera = cam

# Target center of object
cx = (min(xs) + max(xs)) * 0.5
cy = (min(ys) + max(ys)) * 0.5
cz = (min(zs) + max(zs)) * 0.5
radius = max(max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))

cam.location = Vector((cx + radius * 1.6, cy - radius * 1.8, cz + radius * 1.3))
d = Vector((cx, cy, cz)) - cam.location
cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

preview_path = os.path.abspath("3d_art/preview/tripo_hagia_sophia_preview.png")
scene.render.filepath = preview_path
bpy.ops.render.render(write_still=True)
print(f"Rendered preview to {preview_path}")
