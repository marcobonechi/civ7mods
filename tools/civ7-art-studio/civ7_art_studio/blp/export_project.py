"""
Export the Python manifest constants in build_blp.py to a civart.json manifest.

One-shot migration. Once the JSON exists it is the source of truth and the constants
become dead weight, but keeping both around long enough to prove they agree is the
whole point: build from the constants, build from the JSON, and compare the two
packages byte for byte.

    python3 export_project.py [-o ../civart.json]
"""
import sys, os, json, argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_blp import default_project


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('-o', '--out', default='../civart.json')
    args = ap.parse_args()

    project = default_project()

    # The UI and Material packages keep their own constants, and importing them from
    # build_blp would be circular (both import PackageBuilder from it). Merging here
    # keeps the manifest whole without the cycle.
    from build_ui_blp import TEXTURES as UI_TEXTURES
    project['uiTextures'] = [dict(t) for t in UI_TEXTURES]

    import build_material_blp as bm
    project['materials'] = [
        {'name': bm.MATERIAL_NAME, 'kind': 'aniso',
         'slots': {slot: name for slot, name, *_ in bm.TEXTURES}},
        {'name': bm.SUZANNE_MATERIAL, 'kind': 'standard', 'tint_mode': 8,
         'slots': dict({slot: name for slot, name, *_ in bm.SUZANNE_TEXTURES},
                       orm='TEXTURE_Autogen_ORM_1C40753B_C897E224_3DFD00B1',
                       tints='TEXTURE_Autogen_TINTS_2ADB2D8F_1E5920CC_350CA8AF')},
    ]
    project['materialTextures'] = [
        {'slot': slot, 'name': name, 'size': size, 'width': w, 'height': h,
         'mips': mips, 'fmt': fmt, 'tex_class': cls, 'flags': flags,
         'copyFromShipped': bool(copy)}
        for slot, name, size, w, h, mips, fmt, cls, flags, copy in bm.TEXTURES
    ] + [
        {'slot': slot, 'name': name, 'size': size, 'width': w, 'height': h,
         'mips': mips, 'fmt': fmt, 'tex_class': cls, 'flags': flags,
         'copyFromShipped': False}
        for slot, name, size, w, h, mips, fmt, cls, flags in bm.SUZANNE_TEXTURES
    ]

    with open(args.out, 'w') as f:
        json.dump(project, f, indent=2)
        f.write('\n')

    print(f'wrote {args.out}  ({os.path.getsize(args.out)} bytes)')
    for key, value in project.items():
        if isinstance(value, list):
            print(f'  {key:<14} {len(value)}')
        else:
            print(f"  {key:<14} {value.get('name')}")


if __name__ == '__main__':
    main()
