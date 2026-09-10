"""
Wrap a block-compressed DDS as a game texture blob.

The payload is copied through byte for byte, so what ships is exactly what your encoder
produced. There used to be a hand-rolled BC7 mode-6 encoder here for uncompressed RGBA
input; it is gone. It only ever searched one of BC7's eight modes, so it was beaten by
any real encoder, nothing in the app ever called it -- the import paths all require
pre-compressed input -- and it was the sole reason this package depended on numpy, which
added 40 MB to a frozen build to run code no user reached.

An earlier version of this note said BC7 was the only format used by any image texture,
"5100 of them across base and DLC". That count was the UI textures alone -- the scan
behind it missed the model textures, of which there are another 22,000. Model textures
are emphatically not BC7, and each class is near-uniform:

    Model_BaseColor              BC1_UNORM_SRGB (72)   4873 of 4874
    Model_Normal                 BC5_UNORM      (83)   4536 of 4536
    Model_Occlusion              BC1_UNORM      (71)   6414 of 6414
    Model_Tint                   BC4_UNORM      (80)    946, BC5 the rest
    Model_Opacity / Emissive /
      TranslucencyMask           BC4_UNORM      (80)   100%

So encoding a normal or mask map as BC7 is wrong, and a "should be BC7" check on one is
a false positive. Pre-compressed DDS input is passed through untouched, which is how
those formats get in.

Why no Oodle: texture flags bit 0x10 means "payload is Oodle-compressed", verified by a
perfect correlation across all 5110 shipped textures --

    flags 0x82   payload raw            (622 textures)
    flags 0x92   payload Oodle (0x8c)   (26373)
    flags 0x292  payload Oodle (0x8c)   (105)

(counts over all 27,122 textures; the earlier 20/4985/105 came from the same UI-only
scan as the format claim above, but the correlation itself held up on the full set)

so emitting flags 0x82 with a raw payload is a configuration the game already ships
(e.g. TEXTURE_CG_Assyria_HORIZ) and needs no Oodle compressor. For every shipped
flags=0x82 BC7 texture, m_nSize equals the raw mip-chain size exactly -- checked, 10/10.

    python3 make_texture.py <in.dds> <ui_name> [-o <SHARED_DATA dir>] [--mips N]

Input must be a block-compressed DDS -- BC1/BC3/BC4/BC5/BC7, with either a legacy FourCC
header or a DX10 one. Emits SHARED_DATA/TEXTURE_<ui_name> and prints the manifest row.
"""
import sys, os, struct, argparse

CIVBIG_MAGIC = b'CIVBIG\0\0'
CIVBIG_TYPE_TEXTURE = 1
ALIGNMENT = 512

DXGI_BC7_UNORM = 98
FLAGS_UNCOMPRESSED = 0x82

# Block-compressed DXGI formats the game uses, and their bytes per 4x4 block.
# Normal maps are BC5 (two channels, Z reconstructed in shader), not BC7 --
# TEXTURE_CIVILIZATION_<CIV>_BANNER_N is format 83 at 2048x2048 with 10 mips.
# Legacy FourCC headers (128-byte, pre-DX10). GIMP and older exporters emit these.
# ATI2 / BC5U is BC5_UNORM -- the same data a DX10 header would call format 83.
FOURCC_DXGI = {
    b'DXT1': 71, b'DXT3': 74, b'DXT5': 77,
    b'ATI1': 80, b'BC4U': 80,
    b'ATI2': 83, b'BC5U': 83,
}

BLOCK_BYTES = {
    71: ('BC1_UNORM', 8),  72: ('BC1_UNORM_SRGB', 8),
    74: ('BC2_UNORM', 16), 75: ('BC2_UNORM_SRGB', 16),
    77: ('BC3_UNORM', 16), 78: ('BC3_UNORM_SRGB', 16),
    80: ('BC4_UNORM', 8),  81: ('BC4_SNORM', 8),
    83: ('BC5_UNORM', 16), 84: ('BC5_SNORM', 16),
    95: ('BC6H_UF16', 16), 96: ('BC6H_SF16', 16),
    98: ('BC7_UNORM', 16), 99: ('BC7_UNORM_SRGB', 16),
}


def block_chain_size(w, h, mips, fmt=DXGI_BC7_UNORM):
    """Raw byte size of a block-compressed mip chain."""
    per_block = BLOCK_BYTES[fmt][1]
    total = 0
    for i in range(mips):
        mw, mh = max(1, w >> i), max(1, h >> i)
        total += ((mw + 3) // 4) * ((mh + 3) // 4) * per_block
    return total


# ---------------------------------------------------------------------------
# DDS input
# ---------------------------------------------------------------------------

def _usable_mips(w, h, declared, dxgi, payload_len):
    """Largest mip count that the payload actually contains."""
    n = declared
    while n > 1 and block_chain_size(w, h, n, dxgi) > payload_len:
        n -= 1
    if block_chain_size(w, h, n, dxgi) > payload_len:
        raise SystemExit(f'payload {payload_len} too small even for one mip of {w}x{h}')
    return n


def read_dds(path):
    """
    Read a block-compressed DDS.

    Returns ('bc', payload, width, height, mip_count, dxgi). The kind is still in the
    tuple so existing callers keep working, but it is always 'bc' now -- uncompressed
    input is refused rather than encoded.
    """
    d = open(path, 'rb').read()
    if d[:4] != b'DDS ':
        raise SystemExit(f'{path}: not a DDS file')
    height = struct.unpack_from('<I', d, 12)[0]
    width = struct.unpack_from('<I', d, 16)[0]
    declared_mips = struct.unpack_from('<I', d, 28)[0] or 1
    pf_flags = struct.unpack_from('<I', d, 80)[0]
    fourcc = d[84:88]

    if fourcc in FOURCC_DXGI:
        dxgi = FOURCC_DXGI[fourcc]
        payload = d[128:]                              # legacy header, no DX10 block
        avail = _usable_mips(width, height, declared_mips, dxgi, len(payload))
        expect = block_chain_size(width, height, avail, dxgi)
        return ('bc', payload[:expect], width, height, avail, dxgi)

    if fourcc == b'DX10':
        dxgi = struct.unpack_from('<I', d, 128)[0]
        if dxgi not in BLOCK_BYTES:
            raise SystemExit(f'{path}: DXGI format {dxgi} is not a block-compressed '
                             f'format this tool knows; supported: '
                             f'{sorted(BLOCK_BYTES)}')
        payload = d[148:]
        avail = _usable_mips(width, height, declared_mips, dxgi, len(payload))
        expect = block_chain_size(width, height, avail, dxgi)
        return ('bc', payload[:expect], width, height, avail, dxgi)

    raise SystemExit(
        f'{path}: not block-compressed (fourcc {fourcc!r}, pf_flags 0x{pf_flags:x}). '
        f'Compress it first -- BC7 for UI and colour, BC5 for normals, BC4 for masks.')


# ---------------------------------------------------------------------------
# Mip chain
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# BC7 mode 6 encoder
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# CIVBIG output
# ---------------------------------------------------------------------------

def write_civbig(path, payload, type_flag=CIVBIG_TYPE_TEXTURE):
    header = bytearray(16)
    header[0:8] = CIVBIG_MAGIC
    struct.pack_into('<I', header, 8, len(payload))
    struct.pack_into('<H', header, 12, 16)            # dataOffset
    struct.pack_into('<H', header, 14, type_flag)
    raw = bytes(header) + payload
    pad = (-len(raw)) % ALIGNMENT
    with open(path, 'wb') as f:
        f.write(raw + b'\0' * pad)
    return len(raw) + pad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('source')
    ap.add_argument('ui_name')
    ap.add_argument('-o', '--out-dir', default='../Platforms/Windows/BLPs/SHARED_DATA')
    ap.add_argument('--mips', type=int, default=None,
                    help='truncate the mip chain to this many levels')
    args = ap.parse_args()

    _kind, payload, w, h, nmips, dxgi = read_dds(args.source)
    if args.mips and args.mips < nmips:
        nmips = args.mips
        payload = payload[:block_chain_size(w, h, nmips, dxgi)]
        print(f'  truncated to {nmips} mips')
    print(f'{args.source}: {w}x{h} {BLOCK_BYTES[dxgi][0]} (fmt {dxgi}), {nmips} mips '
          f'-- passed through unmodified')

    os.makedirs(args.out_dir, exist_ok=True)
    blob = os.path.join(args.out_dir, 'TEXTURE_' + args.ui_name)
    total = write_civbig(blob, payload)
    print(f'\nwrote {blob}  ({total} bytes on disk, {len(payload)} payload)')
    print('\npaste into build_ui_blp.py TEXTURES:\n')
    print(f"    dict(ui_name={args.ui_name!r},")
    print(f"         size={len(payload)}, width={w}, height={h}, mips={nmips},")
    print(f"         fmt={dxgi}, tex_class='UITexture', flags=0x{FLAGS_UNCOMPRESSED:02x}),")


if __name__ == '__main__':
    main()
