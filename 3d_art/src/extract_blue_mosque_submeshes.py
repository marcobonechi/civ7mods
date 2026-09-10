"""Extract the 44 LOD0 submeshes of Sultan Ahmet Camii from the GPU buffer into separate OBJ groups."""

import os
import sys
import struct

sys.path.insert(0, os.path.abspath("tools/civ7-art-studio"))
from civ7_art_studio.blp.blp import BLP
from civ7_art_studio.blp.bins import Reader

p = os.path.expanduser("~/Library/Application Support/Steam/steamapps/common/Sid Meier's Civilization VII/CivilizationVII.app/Contents/Resources/DLC/ottomans/Platforms/Mac/BLPs/StandardAsset.blp")
blp = BLP(p); r = Reader(blp)

submeshes = []
for a in blp.allocs:
    if blp.typename(a) == 'AssetPackage_Geometry_Mesh_Lod5':
        buf = blp.raw(a)
        for i in range(len(buf) // 56):
            chunk = buf[i*56 : (i+1)*56]
            gb_ptr = r.p64(chunk, 0)
            if not gb_ptr: continue
            gb_alloc = blp.ptr(gb_ptr)
            if not gb_alloc: continue
            gb_name = r.strat(blp.raw(gb_alloc), 8)
            if 'Sultan_Ahmet_Camii_HB_MB' in gb_name:
                mat_hash, v_off = struct.unpack_from('<2I', chunk, 16)
                v_stride = struct.unpack_from('<H', chunk, 24)[0]
                prim_count, min_idx, max_idx, idx_start = struct.unpack_from('<4I', chunk, 28)
                submeshes.append((i, mat_hash, v_off, v_stride, min_idx, max_idx, prim_count, idx_start))

# Select unique LOD0 passes
lod0_list = []
i = 0
while i < len(submeshes):
    s = submeshes[i]
    if i + 1 < len(submeshes) and submeshes[i+1][2] == s[2] and submeshes[i+1][6] < s[6]:
        lod0_list.append(s)
        i += 2
    else:
        # Check if identical duplicate (e.g. 15 and 16, 28 and 29)
        if i + 1 < len(submeshes) and submeshes[i+1][2] == s[2] and submeshes[i+1][6] == s[6] and submeshes[i+1][7] == s[7]:
            lod0_list.append(s)
            i += 2
        else:
            lod0_list.append(s)
            i += 1

print(f"Total unique LOD0 submeshes: {len(lod0_list)}")

gpu_path = os.path.expanduser("~/Library/Application Support/Steam/steamapps/common/Sid Meier's Civilization VII/CivilizationVII.app/Contents/Resources/DLC/ottomans/Platforms/Mac/BLPs/SHARED_DATA/GB_WON_Sultan_Ahmet_Camii_HB_MB")
raw = open(gpu_path, 'rb').read()
payload = raw[16:]

out_obj = os.path.abspath("3d_art/src/blue_mosque_submeshes.obj")
with open(out_obj, "w") as f:
    f.write("# Blue Mosque (Sultan Ahmet Camii) LOD0 submeshes\n")
    v_base = 0
    for idx, (s_idx, mat_hash, v_off, v_stride, min_idx, max_idx, prim_count, idx_start) in enumerate(lod0_list):
        f.write(f"o submesh_{s_idx:02d}_mat_{hex(mat_hash)}\n")
        
        # Read vertices
        s_verts = []
        for vi in range(min_idx, max_idx + 1):
            offset = v_off + vi * v_stride
            chunk = payload[offset : offset + v_stride]
            x, y, z = struct.unpack('<3e', chunk[:6])
            u, v = struct.unpack('<2e', chunk[12:16])
            s_verts.append((x, y, z, u, v))
            f.write(f"v {x:.4f} {y:.4f} {z:.4f}\n")
        
        for x, y, z, u, v in s_verts:
            f.write(f"vt {u:.4f} {v:.4f}\n")
            
        # Read indices
        idx_byte_start = idx_start * 4
        idx_bytes = payload[idx_byte_start : idx_byte_start + prim_count * 3 * 4]
        indices = struct.unpack(f"<{prim_count * 3}I", idx_bytes)
        
        for ti in range(0, len(indices), 3):
            i0 = indices[ti] - min_idx + v_base + 1
            i1 = indices[ti+1] - min_idx + v_base + 1
            i2 = indices[ti+2] - min_idx + v_base + 1
            f.write(f"f {i0}/{i0} {i1}/{i1} {i2}/{i2}\n")
            
        v_base += len(s_verts)

print(f"Wrote {out_obj}")
