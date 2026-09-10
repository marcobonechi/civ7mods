"""
Convert a glTF 2.0 binary (.glb) mesh into a game GPU buffer.

Why glTF: it is JSON plus a binary blob, so it parses with nothing but the standard
library -- no numpy dependency for the container, no third-party importer, no network.
It also carries skinning (JOINTS_0 / WEIGHTS_0) and animation, so the same export
serves when armature support is added; the vertex layout already has slots for bone
indices and weights at components & 0x2.

Blender export settings that matter:

    Format          glTF Binary (.glb)
    +Y Up           ON  (the default; this tool converts back to the game's Z-up)
    Compression     OFF (Draco is a separate codec this cannot decode)
    Data            Normals ON, UVs ON
    Later, for animation: Skinning ON, and include the armature

Axis and scale. glTF is Y-up right-handed, the game is Z-up, so positions map
(x, y, z) -> (x, -z, y). Blender works in metres while the game's unit is about a
tenth of a metre -- shipped character assets put feet at z~0 and helmets at z~19, so
a 1.8 m human is ~18 units. Hence the default scale of 10.

    python3 import_gltf.py <model.glb> <GB_NAME_MB> [-o SHARED_DATA] [--scale N]
"""
import sys, os, json, struct, argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_texture import write_civbig

CIVBIG_TYPE_GPU = 0
VERTEX_STRIDE = 20
VERTEX_COMPONENTS = 0x0009
COMPRESSION = 1
INDEX_STRIDE = 4

COMPONENT_FMT = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
COMPONENT_SIZE = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
TYPE_COUNT = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


# ---------------------------------------------------------------------------
# glTF reading
# ---------------------------------------------------------------------------

def load_glb(path):
    raw = open(path, 'rb').read()
    if raw[:4] != b'glTF':
        # A .gltf text file with an external .bin is also fine.
        try:
            doc = json.loads(raw.decode('utf-8'))
        except Exception:
            raise SystemExit(f'{path}: not a .glb and not JSON glTF')
        bin_path = None
        for b in doc.get('buffers', []):
            if 'uri' in b and not b['uri'].startswith('data:'):
                bin_path = os.path.join(os.path.dirname(path), b['uri'])
        blob = open(bin_path, 'rb').read() if bin_path else b''
        return doc, blob

    version, _length = struct.unpack_from('<2I', raw, 4)
    if version != 2:
        raise SystemExit(f'{path}: glTF version {version}, expected 2')
    off, doc, blob = 12, None, b''
    while off < len(raw):
        clen, ctype = struct.unpack_from('<2I', raw, off)
        chunk = raw[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:          # JSON
            doc = json.loads(chunk.decode('utf-8'))
        elif ctype == 0x004E4942:        # BIN
            blob = chunk
        off += 8 + clen + ((-clen) % 4)
    if doc is None:
        raise SystemExit(f'{path}: no JSON chunk')
    return doc, blob


def read_accessor(doc, blob, index):
    acc = doc['accessors'][index]
    n = acc['count']
    ncomp = TYPE_COUNT[acc['type']]
    fmt = COMPONENT_FMT[acc['componentType']]
    csize = COMPONENT_SIZE[acc['componentType']]
    if 'bufferView' not in acc:
        return [tuple([0] * ncomp) for _ in range(n)]
    bv = doc['bufferViews'][acc['bufferView']]
    base = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
    stride = bv.get('byteStride') or (ncomp * csize)
    out = []
    for i in range(n):
        o = base + i * stride
        out.append(struct.unpack_from('<' + fmt * ncomp, blob, o))
    return out


# ---------------------------------------------------------------------------
# encoding
# ---------------------------------------------------------------------------

def pack_f16s(vals):
    """
    float32 -> IEEE-754 half, via struct's 'e' format.

    This used to go through numpy, for exact round-to-nearest-even -- a hand-rolled
    version that truncates the mantissa is off by 1 ULP on many values. struct gives
    the same rounding from the standard library: checked bit-for-bit against numpy
    over 200k values including every vertex of the test models, with no mismatches.
    That removed the package's only numpy dependency, and 40 MB from a frozen build.
    """
    return struct.pack(f'<{len(vals)}e', *vals)


def pack_normal(n):
    x, y, z = n
    ln = (x * x + y * y + z * z) ** 0.5 or 1.0
    q = [max(0, min(255, int(round((c / ln * 0.5 + 0.5) * 255.0)))) for c in (x, y, z)]
    return bytes(q + [0])


def convert(source, out_path, scale=10.0, keep_axes=False, flip_winding=False,
            ground=True, log=None):
    """
    Convert a .glb to a GPU buffer at `out_path`. Returns the numbers describing it.

    Those numbers -- vertex count, index start, triangle count, bounds -- are what the
    package entry has to declare, and nothing at load time checks them against the
    buffer. So they are returned from the conversion rather than re-derived later,
    which is the only way to be sure the description matches the bytes.
    """
    say = log if log is not None else (lambda _m: None)
    doc, blob = load_glb(source)
    verts = bytearray()
    indices = []
    vbase = 0
    lo = [1e30] * 3
    hi = [-1e30] * 3
    prim_total = 0
    skinned = False
    staged = []            # (position, normal, uv) after axis/scale, before grounding

    for mesh in doc.get('meshes', []):
        for prim in mesh.get('primitives', []):
            if prim.get('mode', 4) != 4:
                say(f"  skipping primitive with mode {prim.get('mode')} (not triangles)")
                continue
            attrs = prim['attributes']
            if 'POSITION' not in attrs:
                continue
            pos = read_accessor(doc, blob, attrs['POSITION'])
            nrm = (read_accessor(doc, blob, attrs['NORMAL'])
                   if 'NORMAL' in attrs else [(0.0, 0.0, 1.0)] * len(pos))
            uv = (read_accessor(doc, blob, attrs['TEXCOORD_0'])
                  if 'TEXCOORD_0' in attrs else [(0.0, 0.0)] * len(pos))

            for i in range(len(pos)):
                p = pos[i]
                n = nrm[i]
                if keep_axes:
                    P = (p[0], p[1], p[2]); N = (n[0], n[1], n[2])
                else:
                    P = (p[0], -p[2], p[1])          # glTF Y-up -> game Z-up
                    N = (n[0], -n[2], n[1])
                P = tuple(c * scale for c in P)
                for k in range(3):
                    lo[k] = min(lo[k], P[k]); hi[k] = max(hi[k], P[k])
                staged.append((P, N, uv[i][:2]))

            if 'indices' in prim:
                idx = [v[0] for v in read_accessor(doc, blob, prim['indices'])]
            else:
                idx = list(range(len(pos)))
            for t in range(0, len(idx) - 2, 3):
                tri = [idx[t] + vbase, idx[t + 1] + vbase, idx[t + 2] + vbase]
                if flip_winding:
                    tri.reverse()
                indices += tri
                prim_total += 1
            vbase += len(pos)

            if 'JOINTS_0' in attrs:
                skinned = True
                say('  note: mesh is skinned. Bone data is NOT written -- that needs '
                    'components 0x2 and stride 28, which is not implemented yet.')

    if not vbase:
        raise SystemExit('no triangle geometry found')

    # Blender models are usually centred on the origin, so half the mesh sits below
    # z=0 -- i.e. underground once placed on a tile. Drop it so the lowest point
    # rests on the ground unless the caller wants the original framing.
    dz = -lo[2] if ground else 0.0
    if dz:
        lo[2] += dz; hi[2] += dz
        say(f'  grounded: shifted z by {dz:+.2f} so the base sits at 0')
    for P, N, UV in staged:
        verts += pack_f16s((P[0], P[1], P[2] + dz)) + b'\0\0'
        verts += pack_normal(N)
        verts += pack_f16s(UV)
        verts += pack_f16s(UV)                       # UV2 mirrors UV0

    index_bytes = struct.pack(f'<{len(indices)}I', *indices)
    payload = bytes(verts) + index_bytes
    out_dir = os.path.dirname(out_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    total = write_civbig(out_path, payload, type_flag=CIVBIG_TYPE_GPU)

    return {
        'path': out_path, 'onDisk': total, 'payload': len(payload),
        'vertices': vbase, 'triangles': prim_total,
        'vertexBytes': len(verts), 'indexBytes': len(index_bytes),
        'index_start': len(verts) // INDEX_STRIDE,
        'bounds': (lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]),
        'height': hi[2] - lo[2], 'skinned': skinned,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('source')
    ap.add_argument('name', help='buffer name, e.g. GB_MY_MODEL_MB')
    ap.add_argument('-o', '--out-dir', default='../Platforms/Windows/BLPs/SHARED_DATA')
    ap.add_argument('--scale', type=float, default=10.0,
                    help='Blender metres -> game units (default 10; a human is ~18)')
    ap.add_argument('--keep-axes', action='store_true',
                    help='skip the glTF Y-up to game Z-up conversion')
    ap.add_argument('--flip-winding', action='store_true',
                    help='reverse triangle winding if the model renders inside-out')
    ap.add_argument('--no-ground', action='store_true',
                    help='keep the model centred instead of resting it on z=0')
    args = ap.parse_args()

    s = convert(args.source, os.path.join(args.out_dir, args.name),
                scale=args.scale, keep_axes=args.keep_axes,
                flip_winding=args.flip_winding, ground=not args.no_ground,
                log=print)
    lo, hi = s['bounds'][:3], s['bounds'][3:]

    print(f"wrote {s['path']}  ({s['onDisk']} bytes on disk, {s['payload']} payload)")
    print(f"  {s['vertices']} vertices x {VERTEX_STRIDE}B = {s['vertexBytes']}B, "
          f"{s['triangles']} triangles = {s['indexBytes']}B")
    print(f'  bounds min={tuple(round(v,2) for v in lo)} max={tuple(round(v,2) for v in hi)}')
    print(f"  height {s['height']:.1f} units (a person is ~18)")
    print('\npaste into civart.json meshes (or import through the GUI):\n')
    asset = args.name.replace('GB_', '').replace('_MB', '')
    print(f"    dict(asset={asset!r},")
    print(f"         buffer={args.name!r},")
    print(f"         buffer_size={s['payload']},")
    print(f"         vertex_offset=0, vertex_count={s['vertices']},")
    print(f"         index_start={s['index_start']}, primitive_count={s['triangles']},")
    print(f"         min_index=0, max_index={s['vertices'] - 1},")
    print(f"         bounds=({lo[0]:.2f}, {lo[1]:.2f}, {lo[2]:.2f}, "
          f"{hi[0]:.2f}, {hi[1]:.2f}, {hi[2]:.2f}),")
    print(f"         wrapper_scale=1.0),")


if __name__ == '__main__':
    main()
