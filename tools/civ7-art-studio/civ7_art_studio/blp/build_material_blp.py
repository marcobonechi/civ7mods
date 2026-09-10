"""
Build a Material.blp carrying a civilization banner material.

The banner's pattern is a pre-baked normal map, not a runtime lookup of
civ_sym_*/civ_line_* (those are 2D UI textures only). Comparing the shipped
CIVILIZATION_DEFAULT_BANNER_GAME_MATERIAL against CIVILIZATION_HEIAN_BANNER_GAME_MATERIAL
shows they differ in exactly three slots -- Normal, OcclusionRoughMetal and Tints --
with BaseColor, Anisotropy, AnisotropicDirection, tint mode and tint channels shared.

So a new civ's material is the DEFAULT one with its Normal swapped. We reuse DEFAULT's
ORM and Tints, which is what makes this tractable.

Texture references inside a material are BLPPtr<BLP::TextureEntry> -- allocation
pointers, package-local -- so every texture must be declared in this same package and
its blob copied into SHARED_DATA alongside. Copies are byte-for-byte, including the
shipped Oodle-compressed payloads, so no compressor is needed: we carry their
flags (0x92) verbatim. Only our own normal map is raw (0x82).

The material itself is reached by NAME HASH from AssetPackage_Geometry_Mesh2.nMaterialHash,
so it does resolve across packages.

    python3 build_material_blp.py <donor-Material.blp> <out.blp> [--copy-blobs]
"""
import sys, os, shutil, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_blp import PackageBuilder

MATERIAL_NAME = 'CIVILIZATION_PB_YAMATAI_BANNER_GAME_MATERIAL'
SUZANNE_MATERIAL = 'SUZANNE_MATERIAL'

# Suzanne's own maps. Both are copies of textures we already made, renamed so two
# packages never declare the same name hash; the blobs are byte-identical.
# The ORM and Tints slots reuse the banner's allocations -- same package, so the
# material's package-local pointers can simply point at them.
SUZANNE_TEXTURES = [
    ('base_color', 'TEXTURE_SUZANNE_B',
     87408, 256, 256, 9, 98, 'Model_BaseColor', 0x82),
    ('normal', 'TEXTURE_SUZANNE_N',
     5592400, 2048, 2048, 10, 83, 'Model_Normal', 0x82),
]

# Where to copy shipped blobs from. Any *-shell package carries the shared set.
DONOR_SHARED_DATA = ('/workspace/reference/full_game/DLC/assyria-shell'
                     '/Platforms/Windows/BLPs/SHARED_DATA')

# (slot, texture name, size, w, h, mips, fmt, class, flags, copy_from_shipped)
TEXTURES = [
    ('base_color', 'TEXTURE_CIVILIZATION_BASE_BANNER_B',
     1304552, 2048, 2048, 10, 72, 'Model_BaseColor', 0x92, True),
    ('normal', 'TEXTURE_CIVILIZATION_PB_YAMATAI_BANNER_N',
     5592400, 2048, 2048, 10, 83, 'Model_Normal', 0x82, False),
    ('orm', 'TEXTURE_Autogen_ORM_1C40753B_C897E224_3DFD00B1',
     1545333, 2048, 2048, 10, 71, 'Model_Occlusion', 0x92, True),
    ('anisotropy', 'TEXTURE_CIVILIZATION_BASE_BANNER_AN',
     1093164, 2048, 2048, 10, 80, 'Model_Anisotropy', 0x92, True),
    ('aniso_dir', 'TEXTURE_CIVILIZATION_BASE_BANNER_TG',
     2316096, 2048, 2048, 10, 83, 'Model_AnisotropicDirection', 0x92, True),
    ('tints', 'TEXTURE_Autogen_TINTS_2ADB2D8F_1E5920CC_350CA8AF',
     64192, 2048, 2048, 10, 80, 'Model_Tint', 0x92, True),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('donor')
    ap.add_argument('out')
    ap.add_argument('--copy-blobs', action='store_true',
                    help='copy the shipped blobs into SHARED_DATA next to the output')
    args = ap.parse_args()

    b = PackageBuilder(args.donor)
    slots = {}
    for slot, name, size, w, h, mips, fmt, cls, flags, _copy in TEXTURES:
        slots[slot] = b.add_texture(name[len('TEXTURE_'):], size, w, h, mips,
                                    fmt=fmt, tex_class=cls, flags=flags,
                                    ui_entry=False)
    b.add_material(MATERIAL_NAME, slots)

    # Suzanne: the ordinary Standard material -- base colour, normal, plus the
    # banner's ORM and Tints so team-colour tinting has a mask to work against.
    suz = {}
    for slot, name, size, w, h, mips, fmt, cls, flags in SUZANNE_TEXTURES:
        suz[slot] = b.add_texture(name[len('TEXTURE_'):], size, w, h, mips,
                                  fmt=fmt, tex_class=cls, flags=flags, ui_entry=False)
    suz['orm'] = slots['orm']
    suz['tints'] = slots['tints']
    b.add_material_standard(SUZANNE_MATERIAL, suz, tint_mode=8)

    data = b.build()
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, 'wb') as f:
        f.write(data)
    print(f'wrote {args.out}  ({len(data)} bytes, {len(b.allocs)} allocations)')
    print(f'  material {MATERIAL_NAME}')
    for slot, name, size, _w, _h, _m, fmt, cls, flags, _c in TEXTURES:
        print(f'    {slot:<12} {name:<50} fmt={fmt} flags=0x{flags:02x}')
    print(f'  material {SUZANNE_MATERIAL}  (Standard, tintMode 8, Team1/Team2)')
    for slot, name, _s, _w, _h, _m, fmt, cls, flags in SUZANNE_TEXTURES:
        print(f'    {slot:<12} {name:<50} fmt={fmt} flags=0x{flags:02x}')
    print(f"    {'orm':<12} {'(shared with banner)':<50}")
    print(f"    {'tints':<12} {'(shared with banner)':<50}")

    sd = os.path.join(os.path.dirname(args.out), 'SHARED_DATA')
    os.makedirs(sd, exist_ok=True)
    missing = []
    for _slot, name, _s, _w, _h, _m, _f, _c, _fl, copy in TEXTURES:
        dest = os.path.join(sd, name)
        if os.path.exists(dest):
            continue
        if copy and args.copy_blobs:
            src = os.path.join(DONOR_SHARED_DATA, name)
            if os.path.exists(src):
                shutil.copy2(src, dest)
                print(f'  copied blob {name} ({os.path.getsize(dest)} bytes)')
                continue
        missing.append(name)
    if missing:
        print('\n  MISSING blobs in SHARED_DATA (rerun with --copy-blobs, or generate):')
        for m in missing:
            print(f'    {m}')


if __name__ == '__main__':
    main()
