import bpy, math
from mathutils import Vector

blend_path = "3d_art/src/hagia_sophia_alt.blend"
bpy.ops.wm.open_mainfile(filepath=blend_path)

ob = bpy.data.objects["HagiaSophiaAlt"]

red_idx = [i for i, m in enumerate(ob.data.materials) if m.name == "M_Dome"][0]
wall_idx = [i for i, m in enumerate(ob.data.materials) if m.name == "M_Wall"][0]
marble_idx = [i for i, m in enumerate(ob.data.materials) if m.name == "M_Marble"][0]
dark_idx = [i for i, m in enumerate(ob.data.materials) if m.name == "M_Dark"][0]
gold_idx = [i for i, m in enumerate(ob.data.materials) if m.name == "M_Gold"][0]

# All faces that have upward normal on roofs/domes (Z > 4.5 in scaled model, normal.z > 0.15)
# In scaled model, max Z is ~19.95, roofline is around Z > 4.5.
reassigned = 0
for p in ob.data.polygons:
    if p.material_index == gold_idx:
        continue
    # Check if polygon is on a dome/roof
    # In scaled coordinates:
    # If Z > 4.5 and normal.z > 0.15, but exclude completely flat floors (normal.z > 0.98 at low height)
    if p.center.z > 4.2:
        if p.normal.z > 0.15:
            # Exclude flat courtyard balustrades or marble caps
            if p.normal.z > 0.99 and p.center.z < 6.0:
                continue
            if p.material_index != red_idx:
                p.material_index = red_idx
                reassigned += 1

print(f"Reassigned {reassigned} dome/roof faces to M_Dome")

# Save blend
bpy.ops.wm.save_as_mainfile(filepath=blend_path)

# Setup render scene
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 32
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024

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
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = f"3d_art/preview/{filename}"
    bpy.ops.render.render(write_still=True)
    print("Saved", scene.render.filepath)

render_view((30.0, -36.0, 26.0), (0, 0, 8.0), "alt_hagia_sophia_hero.png")
render_view((0.0, -42.0, 10.0), (0, 0, 8.0), "alt_hagia_sophia_elevation.png")
render_view((-32.0, -30.0, 28.0), (0, 0, 8.0), "alt_hagia_sophia_side.png")

# Cleanup
bpy.data.objects.remove(gp, do_unlink=True)
bpy.data.objects.remove(light_ob, do_unlink=True)
bpy.data.objects.remove(fill_ob, do_unlink=True)
bpy.data.objects.remove(cam, do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
