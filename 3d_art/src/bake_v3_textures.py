"""Extract and convert 4K PBR textures from Downloads/hagia sophia 3d model.glb into Civ 7 DDS maps."""

import os
import io
import struct
import subprocess
from pygltflib import GLTF2
from PIL import Image

GLB_INPUT = "/Users/marcob/Downloads/hagia sophia 3d model.glb"
TEX_DIR = os.path.abspath("3d_art/textures")
DDS_DIR = os.path.abspath("3d_art/dds")
os.makedirs(TEX_DIR, exist_ok=True)
os.makedirs(DDS_DIR, exist_ok=True)

TARGET_RES = (2048, 2048)


def extract_and_convert():
    print(f"Loading GLB: {GLB_INPUT}")
    g = GLTF2().load(GLB_INPUT)
    blob = g.binary_blob()

    def get_image(idx):
        bv = g.bufferViews[g.images[idx].bufferView]
        raw_bytes = blob[bv.byteOffset : bv.byteOffset + bv.byteLength]
        img = Image.open(io.BytesIO(raw_bytes))
        return img

    print("Extracting BaseColor...")
    bc_img = get_image(0).convert("RGB")
    if bc_img.size != TARGET_RES:
        print(f"Resizing BaseColor from {bc_img.size} to {TARGET_RES}...")
        bc_img = bc_img.resize(TARGET_RES, Image.Resampling.LANCZOS)
    b_png = os.path.join(TEX_DIR, "hagia_sophia_B.png")
    bc_img.save(b_png, format="PNG")
    print(f"Saved {b_png}")

    print("Extracting RM (ORM)...")
    rm_img = get_image(1).convert("RGB")
    if rm_img.size != TARGET_RES:
        print(f"Resizing RM (ORM) from {rm_img.size} to {TARGET_RES}...")
        rm_img = rm_img.resize(TARGET_RES, Image.Resampling.LANCZOS)
    orm_png = os.path.join(TEX_DIR, "hagia_sophia_ORM.png")
    rm_img.save(orm_png, format="PNG")
    print(f"Saved {orm_png}")

    print("Extracting Normal...")
    norm_img = get_image(2).convert("RGB")
    if norm_img.size != TARGET_RES:
        print(f"Resizing Normal from {norm_img.size} to {TARGET_RES}...")
        norm_img = norm_img.resize(TARGET_RES, Image.Resampling.LANCZOS)
    n_png = os.path.join(TEX_DIR, "hagia_sophia_N.png")
    norm_img.save(n_png, format="PNG")
    print(f"Saved {n_png}")

    print("\n--- Encoding DDS Maps ---")
    b_dds = os.path.join(DDS_DIR, "hagia_sophia_B.dds")
    orm_dds = os.path.join(DDS_DIR, "hagia_sophia_ORM.dds")
    n_dds = os.path.join(DDS_DIR, "hagia_sophia_N.dds")

    # 1. BaseColor -> DXT1 with ImageMagick + DX10 header (Format 72: BC1_UNORM_SRGB)
    subprocess.run(["magick", b_png, "-define", "dds:compression=dxt1", b_dds], check=True)
    with open(b_dds, "rb") as f:
        data = f.read()
    hdr = bytearray(data[:128])
    hdr[84:88] = b"DX10"
    dx10 = struct.pack("<5I", 72, 3, 0, 1, 0)
    with open(b_dds, "wb") as f:
        f.write(hdr + dx10 + data[128:])
    print(f"Encoded BaseColor: {b_dds}")

    # 2. ORM -> DXT1 with ImageMagick (Format 71: BC1_UNORM)
    subprocess.run(["magick", orm_png, "-define", "dds:compression=dxt1", orm_dds], check=True)
    print(f"Encoded ORM: {orm_dds}")

    # 3. Normal -> BC5 ATI2 (Format 83: BC5_UNORM)
    py_env = os.path.abspath("3d_art/.venv/bin/python")
    subprocess.run([py_env, "3d_art/src/make_normal_dds.py", n_png, n_dds], check=True)

    # 4. Verify with check_dds.py
    subprocess.run(["python3", "3d_art/src/check_dds.py", b_dds, n_dds, orm_dds], check=True)
    print("\nTexture extraction and DDS encoding completed successfully!")


if __name__ == "__main__":
    extract_and_convert()
