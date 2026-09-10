"""
Generate a static mesh GPU buffer in the game's vertex format.

Unlike every other tool here, this *generates* GPU data rather than copying bytes the
game authored -- so it is the first place a subtle error (float16 precision, normal
packing convention, winding order) can produce something that loads but looks wrong.
A cube is the deliberate first test: any mistake shows up as obviously geometric.

Buffer layout, matching IMP_Jinja_BldB:

    [LOD0 vertices][LOD1 vertices]...[all index data]

    nVertexOffset  byte offset of a LOD's vertices
    nIndexStart    ELEMENT offset of its indices (multiply by nIndexStride)

Vertex format at stride 20, eVertexComponents 0x0009, eCompression 1:

    +0   float16 x3 position + 2B pad
    +8   uint8 x4 packed normal
    +12  float16 x2 UV
    +16  float16 x2 UV2          (present because components & 0x8)

Z is up, and the world unit is roughly a tenth of a metre: character assets in the
heian package put feet at z~0 and helmets at z~19, so a person is about 18-19 units
tall. Size test geometry against that -- an 8-unit cube is knee height, and after a
BIN_*_Scaled wrapper's customary 0.69 scale it is barely 5 units.

    python3 make_mesh.py <name> [-o SHARED_DATA] [--size N]
"""
import sys, os, struct, argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_texture import write_civbig

CIVBIG_TYPE_GPU = 0
VERTEX_STRIDE = 20
VERTEX_COMPONENTS = 0x0009
COMPRESSION = 1
INDEX_STRIDE = 4


def f16(vals):
    """IEEE-754 half, from the standard library -- see import_gltf.pack_f16s."""
    return struct.pack(f'<{len(vals)}e', *vals)


def pack_normal(n):
    """uint8 x4, the usual n*0.5+0.5 mapping. w is unused by this vertex layout."""
    q = [min(255, max(0, round((c * 0.5 + 0.5) * 255.0))) for c in n]
    return bytes([q[0], q[1], q[2], 0])


def cube(size=4.0, height=None):
    """
    24 vertices -- 4 per face, so each face carries its own normal and UVs rather
    than sharing corners. Sits on z=0 so it rests on the ground.
    """
    h = height if height is not None else size * 2
    x = y = size
    faces = [
        # (normal, four corners CCW seen from outside)
        ((0, 0, 1),  [(-x, -y, h), (x, -y, h), (x, y, h), (-x, y, h)]),      # top
        ((0, 0, -1), [(-x, y, 0), (x, y, 0), (x, -y, 0), (-x, -y, 0)]),      # bottom
        ((0, -1, 0), [(-x, -y, 0), (x, -y, 0), (x, -y, h), (-x, -y, h)]),
        ((1, 0, 0),  [(x, -y, 0), (x, y, 0), (x, y, h), (x, -y, h)]),
        ((0, 1, 0),  [(x, y, 0), (-x, y, 0), (-x, y, h), (x, y, h)]),
        ((-1, 0, 0), [(-x, y, 0), (-x, -y, 0), (-x, -y, h), (-x, y, h)]),
    ]
    uv = [(0, 0), (1, 0), (1, 1), (0, 1)]

    verts = bytearray()
    idx = []
    for fi, (normal, corners) in enumerate(faces):
        base = fi * 4
        for ci, pos in enumerate(corners):
            verts += f16(pos) + b'\0\0'          # position + pad  -> 8B
            verts += pack_normal(normal)         # normal          -> 4B
            verts += f16(uv[ci])                 # UV              -> 4B
            verts += f16(uv[ci])                 # UV2             -> 4B
        idx += [base, base + 1, base + 2, base, base + 2, base + 3]

    assert len(verts) == 24 * VERTEX_STRIDE, len(verts)
    lo = (-x, -y, 0.0)
    hi = (x, y, h)
    return bytes(verts), idx, 24, lo, hi


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('name', help='buffer name, e.g. GB_TEST_CUBE_MB')
    ap.add_argument('-o', '--out-dir', default='../Platforms/Windows/BLPs/SHARED_DATA')
    ap.add_argument('--size', type=float, default=4.0)
    args = ap.parse_args()

    verts, idx, nverts, lo, hi = cube(args.size)
    index_bytes = struct.pack(f'<{len(idx)}I', *idx)
    payload = verts + index_bytes

    os.makedirs(args.out_dir, exist_ok=True)
    path = os.path.join(args.out_dir, args.name)
    total = write_civbig(path, payload, type_flag=CIVBIG_TYPE_GPU)

    tris = len(idx) // 3
    print(f'wrote {path}  ({total} bytes on disk, {len(payload)} payload)')
    print(f'  {nverts} vertices x {VERTEX_STRIDE}B = {len(verts)}B, '
          f'{tris} triangles x 3 x {INDEX_STRIDE}B = {len(index_bytes)}B')
    print(f'  bounds min={tuple(round(v,2) for v in lo)} max={tuple(round(v,2) for v in hi)}')
    print('\npaste into build_blp.py STATIC_MESHES:\n')
    print(f"    dict(asset={args.name.replace('GB_','').replace('_MB','')!r},")
    print(f"         buffer={args.name!r},")
    print(f"         buffer_size={len(payload)},")
    print(f"         vertex_offset=0, vertex_count={nverts},")
    print(f"         index_start={len(verts) // INDEX_STRIDE}, primitive_count={tris},")
    print(f"         min_index=0, max_index={nverts - 1},")
    print(f"         bounds=({lo[0]}, {lo[1]}, {lo[2]}, {hi[0]}, {hi[1]}, {hi[2]})),")


if __name__ == '__main__':
    main()
