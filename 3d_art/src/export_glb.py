"""Export Hagia Sophia as a single-mesh, single-primitive glTF with unified PBR material."""

import os
import sys
import bpy

blend_path = os.path.abspath("3d_art/src/hagia_sophia.blend")
bpy.ops.wm.open_mainfile(filepath=blend_path)

ob = bpy.data.objects.get("HagiaSophia")
if not ob:
    sys.exit("HagiaSophia object not found")

bpy.context.view_layer.objects.active = ob
for o in bpy.context.selected_objects:
    o.select_set(False)
ob.select_set(True)

# Replace multiple materials with single unified material
ob.data.materials.clear()

mat = bpy.data.materials.new("M_Hagia_Sophia")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
nodes.clear()

bsdf = nodes.new("ShaderNodeBsdfPrincipled")
output = nodes.new("ShaderNodeOutputMaterial")
links.new(output.inputs["Surface"], bsdf.outputs["BSDF"])

tex_dir = os.path.abspath("3d_art/textures")

# BaseColor
img_b = bpy.data.images.load(os.path.join(tex_dir, "hagia_sophia_B.png"))
tex_b = nodes.new("ShaderNodeTexImage")
tex_b.image = img_b
links.new(bsdf.inputs["Base Color"], tex_b.outputs["Color"])

# Normal
img_n = bpy.data.images.load(os.path.join(tex_dir, "hagia_sophia_N.png"))
img_n.colorspace_settings.name = "Non-Color"
tex_n = nodes.new("ShaderNodeTexImage")
tex_n.image = img_n
norm = nodes.new("ShaderNodeNormalMap")
links.new(norm.inputs["Color"], tex_n.outputs["Color"])
links.new(bsdf.inputs["Normal"], norm.outputs["Normal"])

# ORM
img_orm = bpy.data.images.load(os.path.join(tex_dir, "hagia_sophia_ORM.png"))
img_orm.colorspace_settings.name = "Non-Color"
tex_orm = nodes.new("ShaderNodeTexImage")
tex_orm.image = img_orm
sep = nodes.new("ShaderNodeSeparateColor")
links.new(sep.inputs["Color"], tex_orm.outputs["Color"])
links.new(bsdf.inputs["Roughness"], sep.outputs["Green"])
links.new(bsdf.inputs["Metallic"], sep.outputs["Blue"])

ob.data.materials.append(mat)

# Ensure all faces point to material index 0
for poly in ob.data.polygons:
    poly.material_index = 0

out_glb = os.path.abspath("3d_art/export/hagia_sophia.glb")
os.makedirs(os.path.dirname(out_glb), exist_ok=True)

bpy.ops.export_scene.gltf(
    filepath=out_glb,
    export_format="GLB",
    use_selection=True,
    export_materials="EXPORT",
    export_normals=True,
    export_texcoords=True,
    export_apply=True,
)
print("Exported GLB to", out_glb)
