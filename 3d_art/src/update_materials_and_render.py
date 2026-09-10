import bpy, os, math
from mathutils import Vector

blend_path = "3d_art/src/hagia_sophia_alt.blend"
bpy.ops.wm.open_mainfile(filepath=blend_path)

ob = bpy.data.objects["HagiaSophiaAlt"]

# 1. Recenter and Ground
zs = [v.co.z for v in ob.data.vertices]
xs = [v.co.x for v in ob.data.vertices]
ys = [v.co.y for v in ob.data.vertices]
min_z = min(zs)
cx = (min(xs) + max(xs)) * 0.5
cy = (min(ys) + max(ys)) * 0.5

print(f"Centering: dx={-cx:.3f}, dy={-cy:.3f}, dz={-min_z:.3f}")
for v in ob.data.vertices:
    v.co.x -= cx
    v.co.y -= cy
    v.co.z -= min_z
ob.data.update()

zs = [v.co.z for v in ob.data.vertices]
xs = [v.co.x for v in ob.data.vertices]
ys = [v.co.y for v in ob.data.vertices]
print(f"Grounded bounds: X=[{min(xs):.2f}, {max(xs):.2f}], Y=[{min(ys):.2f}, {max(ys):.2f}], Z=[{min(zs):.2f}, {max(zs):.2f}]")

def _hex_linear(h):
    rgb = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb) + (1.0,)

# 2. Material fine-tuning:
# M_Dome: Deep imperial Byzantine red with MULTIPLY blend on lead seams
mat_red = bpy.data.materials.get("M_Dome")
if mat_red:
    nodes = mat_red.node_tree.nodes
    mix = [n for n in nodes if n.type == "MIX"]
    if mix:
        mix[0].blend_type = "MULTIPLY"
        mix[0].inputs[0].default_value = 0.90
        mix[0].inputs[7].default_value = _hex_linear("8f1e14") # Imperial Byzantine red
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Roughness"].default_value = 0.55

# M_Wall: Warm Byzantine limestone / ashlar masonry
mat_wall = bpy.data.materials.get("M_Wall")
if mat_wall:
    nodes = mat_wall.node_tree.nodes
    mix = [n for n in nodes if n.type == "MIX"]
    if mix:
        mix[0].blend_type = "MIX"
        mix[0].inputs[0].default_value = 0.70
        mix[0].inputs[7].default_value = _hex_linear("d2c3af") # Warm Byzantine limestone
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Roughness"].default_value = 0.85

# M_Marble: Pale ivory marble trim
mat_marble = bpy.data.materials.get("M_Marble")
if mat_marble:
    nodes = mat_marble.node_tree.nodes
    mix = [n for n in nodes if n.type == "MIX"]
    if mix:
        mix[0].inputs[0].default_value = 0.60
        mix[0].inputs[7].default_value = _hex_linear("f3ede2")
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Roughness"].default_value = 0.45

# M_Gold: Rich imperial cross
mat_gold = bpy.data.materials.get("M_Gold")
if mat_gold:
    bsdf = mat_gold.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = _hex_linear("f5c842")
        bsdf.inputs["Metallic"].default_value = 1.0
        bsdf.inputs["Roughness"].default_value = 0.20

# M_Dark: Rich dark interior / ironwork
mat_dark = bpy.data.materials.get("M_Dark")
if mat_dark:
    bsdf = mat_dark.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = _hex_linear("251b18")
        bsdf.inputs["Roughness"].default_value = 0.90

# Re-unwrap UV with optimal island packing
bpy.context.view_layer.objects.active = ob
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.015)
bpy.ops.object.mode_set(mode="OBJECT")

# Save updated blend
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print("Saved blend file.")

# 3. Setup render scene
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
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join("3d_art/preview", filename)
    bpy.ops.render.render(write_still=True)
    print("Saved", scene.render.filepath)

render_view((30.0, -36.0, 26.0), (0, 0, 8.0), "alt_hagia_sophia_hero.png")
render_view((0.0, -42.0, 10.0), (0, 0, 8.0), "alt_hagia_sophia_elevation.png")
render_view((-32.0, -30.0, 28.0), (0, 0, 8.0), "alt_hagia_sophia_side.png")

# Cleanup render helpers from blend file
bpy.data.objects.remove(gp, do_unlink=True)
bpy.data.objects.remove(light_ob, do_unlink=True)
bpy.data.objects.remove(fill_ob, do_unlink=True)
bpy.data.objects.remove(cam, do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print("Updated blend saved without render helpers.")
