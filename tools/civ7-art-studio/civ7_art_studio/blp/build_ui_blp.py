"""
Build a UI.blp containing texture entries.

UI textures are two linked objects plus an external blob:

    EntryMap:  UIPackageEntry_Texture 'pb_yamatai_bg_1080'   <- the name the UI uses
                  m_pTexture --> BLP::TextureEntry 'TEXTURE_pb_yamatai_bg_1080'
                                   metadata only: format, size, dimensions, mips
                                   |
    SHARED_DATA/TEXTURE_pb_yamatai_bg_1080    <- CIVBIG file, the actual pixels

The CIVBIG header is magic(8) + size(4) + flags(4) with the payload at byte 16, and
carries no name or hash -- so cloning a texture is a byte-for-byte copy of the blob
under a new filename plus an entry here describing it.

    python3 build_ui_blp.py <donor-UI.blp> <out.blp>
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_blp import PackageBuilder


# Cloned verbatim from TEXTURE_lsbg_heian_1080 in DLC/heian-shell (BC7, format 98).
# Every field must match the blob, since the entry is the only description of it --
# get the size or mip count wrong and the loader reads the wrong number of bytes.
TEXTURES = [
    # Cloned from heian's blob: Oodle-compressed, hence flags 0x92.
    dict(ui_name='pb_yamatai_bg_1080',
         size=2368234, width=2560, height=1080, mips=10,
         fmt=98, tex_class='UITexture', flags=0x92),

    # Encoded from raw_art by make_texture.py. Raw payload, hence flags 0x82
    # (bit 0x10 clear). Regenerate with:
    #   python3 make_texture.py ../raw_art/Rite_Intercalate.dds rite_intercalate
    dict(ui_name='rite_intercalate',
         size=87408, width=256, height=256, mips=9,
         fmt=98, tex_class='UITexture', flags=0x82),

    # Civ icons. Names follow the shipped convention (heian ships TEXTURE_civ_sym_heian).
    # BC7 modes 5/6/7 throughout, so these carry real alpha, unlike rite_intercalate.
    dict(ui_name='civ_sym_pb_yamatai',
         size=87408, width=256, height=256, mips=9,
         fmt=98, tex_class='UITexture', flags=0x82),
    dict(ui_name='civ_line_pb_yamatai',
         size=87408, width=256, height=256, mips=9,
         fmt=98, tex_class='UITexture', flags=0x82),
]


def build_ui_package(textures, donor, log=None):
    """Emit a UI package from manifest texture rows. Returns (bytes, builder)."""
    say = log if log is not None else (lambda _m: None)
    b = PackageBuilder(donor)
    for t in textures:
        b.add_texture(**t)
        say(f"  texture {t['ui_name']}  ({t['width']}x{t['height']}, "
            f"{t['mips']} mips, fmt {t['fmt']}, {t['size']} bytes)")
        say(f"     needs SHARED_DATA/TEXTURE_{t['ui_name']}")
    return b.build(), b


def main():
    import argparse, json
    ap = argparse.ArgumentParser()
    ap.add_argument('donor')
    ap.add_argument('out')
    ap.add_argument('--project', help='civart.json (default: this mod)')
    args = ap.parse_args()

    if args.project:
        with open(args.project) as f:
            textures = json.load(f).get('uiTextures', [])
    else:
        textures = TEXTURES

    lines = []
    data, b = build_ui_package(textures, args.donor, log=lines.append)
    out_dir = os.path.dirname(args.out)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(args.out, 'wb') as f:
        f.write(data)
    print(f"wrote {args.out}  ({len(data)} bytes, {len(b.allocs)} allocations)")
    for line in lines:
        print(line)


if __name__ == '__main__':
    main()
