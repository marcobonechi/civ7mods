"""Bake procedural Hagia Sophia materials into unified PBR texture maps.

Generates:
  3d_art/textures/hagia_sophia_B.png   - BaseColor (Albedo)
  3d_art/textures/hagia_sophia_N.png   - Normal (Tangent space)
  3d_art/textures/hagia_sophia_ORM.png - Occlusion (R), Roughness (G), Metallic (B)
"""

import os
import sys
import math
import bpy
import numpy as np

OUT_DIR = os.path.abspath("3d_art/textures")
DDS_DIR = os.path.abspath("3d_art/dds")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(DDS_DIR, exist_ok=True)

WIDTH, HEIGHT = 2048, 2048


def bake():
    # Load model
    blend_path = os.path.abspath("3d_art/src/hagia_sophia.blend")
    bpy.ops.wm.open_mainfile(filepath=blend_path)

    ob = bpy.data.objects.get("HagiaSophia")
    if not ob:
        sys.exit("HagiaSophia object not found in blend file")

    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)

    # Set Cycles CPU bake
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    scene.cycles.bake_type = "DIFFUSE"
    scene.render.bake.use_selected_to_active = False
    scene.render.bake.margin = 16

    # 1. BaseColor bake image
    print("Baking BaseColor (Diffuse Color)...")
    img_b = bpy.data.images.new("HS_Bake_B", width=WIDTH, height=HEIGHT, alpha=False)
    for mat in ob.data.materials:
        mat.use_nodes = True
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.name = "_BakeNode"
        node.image = img_b
        mat.node_tree.nodes.active = node

    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, margin=16)
    img_b.filepath_raw = os.path.join(OUT_DIR, "hagia_sophia_B.png")
    img_b.file_format = "PNG"
    img_b.save()
    print("Saved", img_b.filepath_raw)

    # 2. Roughness bake
    print("Baking Roughness...")
    img_rough = bpy.data.images.new("HS_Bake_Rough", width=WIDTH, height=HEIGHT, alpha=False)
    for mat in ob.data.materials:
        node = mat.node_tree.nodes.get("_BakeNode")
        node.image = img_rough
        mat.node_tree.nodes.active = node

    bpy.ops.object.bake(type="ROUGHNESS", margin=16)

    # 3. Normal map bake
    print("Baking Normal Map...")
    img_n = bpy.data.images.new("HS_Bake_N", width=WIDTH, height=HEIGHT, alpha=False)
    for mat in ob.data.materials:
        node = mat.node_tree.nodes.get("_BakeNode")
        node.image = img_n
        mat.node_tree.nodes.active = node

    bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT", margin=16)
    img_n.filepath_raw = os.path.join(OUT_DIR, "hagia_sophia_N.png")
    img_n.file_format = "PNG"
    img_n.save()
    print("Saved", img_n.filepath_raw)

    # 4. Ambient Occlusion bake
    print("Baking Ambient Occlusion...")
    scene.cycles.samples = 16
    img_ao = bpy.data.images.new("HS_Bake_AO", width=WIDTH, height=HEIGHT, alpha=False)
    for mat in ob.data.materials:
        node = mat.node_tree.nodes.get("_BakeNode")
        node.image = img_ao
        mat.node_tree.nodes.active = node

    bpy.ops.object.bake(type="AO", margin=16)

    # 4b. Metallic bake via emission
    print("Baking Metallic...")
    img_metal = bpy.data.images.new("HS_Bake_Metal", width=WIDTH, height=HEIGHT, alpha=False)
    for mat in ob.data.materials:
        bsdfs = [n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"]
        if bsdfs:
            m = bsdfs[0].inputs["Metallic"].default_value
            bsdfs[0].inputs["Emission Color"].default_value = (m, m, m, 1.0)
            bsdfs[0].inputs["Emission Strength"].default_value = 1.0
        node = mat.node_tree.nodes.get("_BakeNode")
        node.image = img_metal
        mat.node_tree.nodes.active = node

    scene.cycles.samples = 1
    bpy.ops.object.bake(type="EMIT", margin=16)

    # Reset emission and clean bake nodes
    for mat in ob.data.materials:
        bsdfs = [n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"]
        if bsdfs:
            bsdfs[0].inputs["Emission Strength"].default_value = 0.0
        node = mat.node_tree.nodes.get("_BakeNode")
        if node:
            mat.node_tree.nodes.remove(node)

    # 5. Assemble ORM Map (R=AO, G=Roughness, B=Metallic)
    print("Assembling ORM map...")
    num_pixels = WIDTH * HEIGHT

    ao_pixels = np.empty(num_pixels * 4, dtype=np.float32)
    img_ao.pixels.foreach_get(ao_pixels)
    ao_pixels = ao_pixels.reshape((num_pixels, 4))

    rough_pixels = np.empty(num_pixels * 4, dtype=np.float32)
    img_rough.pixels.foreach_get(rough_pixels)
    rough_pixels = rough_pixels.reshape((num_pixels, 4))

    metal_pixels = np.empty(num_pixels * 4, dtype=np.float32)
    img_metal.pixels.foreach_get(metal_pixels)
    metal_pixels = metal_pixels.reshape((num_pixels, 4))

    orm = np.empty((num_pixels, 4), dtype=np.float32)
    orm[:, 0] = ao_pixels[:, 0]     # R: Ambient Occlusion
    orm[:, 1] = rough_pixels[:, 0]  # G: Roughness
    orm[:, 2] = metal_pixels[:, 0]  # B: Metallic
    orm[:, 3] = 1.0                 # Alpha

    img_orm = bpy.data.images.new("HS_Bake_ORM", width=WIDTH, height=HEIGHT, alpha=False)
    img_orm.pixels.foreach_set(orm.ravel())
    img_orm.filepath_raw = os.path.join(OUT_DIR, "hagia_sophia_ORM.png")
    img_orm.file_format = "PNG"
    img_orm.save()
    print("Saved", img_orm.filepath_raw)

    print("Baking completed successfully!")


if __name__ == "__main__":
    bake()
