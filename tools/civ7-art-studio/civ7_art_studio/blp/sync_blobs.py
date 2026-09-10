"""
Copy every SHARED_DATA blob our packages reference but don't yet have.

A BLP entry only describes a blob -- name, size, format. The bytes live in
Platforms/<OS>/BLPs/SHARED_DATA/<entry name>. Miss one and the entry dangles, so
this reads the built packages, works out the full required set, and fetches whatever
is absent from the shipped packages.

Renamed clones are handled by mapping our name back to the source name: a cloned
banner's buffer is GB_CIVILIZATION_PB_YAMATAI_BANNER_MB here but ships as
GB_CIVILIZATION_HEIAN_BANNER_MB. Blob payloads carry no name internally (the CIVBIG
header is magic/size/flags only), so a rename is a plain file copy.

    python3 sync_blobs.py [--blps DIR] [--dry-run]
"""
import sys, os, shutil, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bins as B
from blp import BLP

GAME = os.environ.get('CIV7_GAME_ROOT', '/workspace/reference/full_game')
DATA_TYPES = ('BLP::BlobEntry', 'BLP::GpuBufferEntry',
              'BLP::SoundBankEntry', 'BLP::TextureEntry')

# Where to look for shipped blobs. The first few are the packages that carry the
# common shared set, checked first because they answer most lookups; the rest of the
# install follows.
#
# Searching everywhere matters once assets are reused from arbitrary packages: a mesh
# cloned out of DLC/heian keeps its GB_*_MB buffer there, and a fixed four-package list
# simply does not find it. The failure is quiet -- the entry stays dangling.
# Packages carrying the common shared set, checked before the rest of the install
# because they answer most lookups.
PREFERRED_GROUPS = ['DLC/heian-shell', 'DLC/assyria-shell', 'DLC/boot-shell', 'Base']


def _source_dirs(game_root=None):
    import glob
    root = game_root or GAME
    blps = 'Platforms/Windows/BLPs/SHARED_DATA'
    ordered = [os.path.join(root, g, *blps.split('/')) for g in PREFERRED_GROUPS]
    ordered += sorted(glob.glob(os.path.join(root, 'DLC', '*', *blps.split('/'))))
    seen, out = set(), []
    for d in ordered:
        if d not in seen and os.path.isdir(d):
            seen.add(d)
            out.append(d)
    return out


def set_game_root(root):
    """
    Point the blob search at a game install.

    The module picks a default from the environment at import time, which suits the
    CLI. The app learns the path at runtime instead, so it sets it here rather than
    rewriting module globals from outside.
    """
    global GAME, SOURCE_DIRS
    GAME = root
    SOURCE_DIRS = _source_dirs(root)
    return SOURCE_DIRS


SOURCE_DIRS = _source_dirs()

# our name -> shipped name, for anything the cloner renamed
RENAMED_FROM = {
    'GB_CIVILIZATION_PB_YAMATAI_BANNER_MB':
        'GB_CIVILIZATION_HEIAN_BANNER_MB',
    'CIVILIZATION_PB_YAMATAI_BANNER_GAME_ASSET_StateSetBlob0':
        'CIVILIZATION_HEIAN_BANNER_GAME_ASSET_StateSetBlob0',
}

# Blobs we author ourselves; never fetch these, just report if absent.
LOCAL = {
    'TEXTURE_CIVILIZATION_PB_YAMATAI_BANNER_N',
    'TEXTURE_rite_intercalate', 'TEXTURE_civ_sym_pb_yamatai',
    'TEXTURE_civ_line_pb_yamatai', 'TEXTURE_pb_yamatai_bg_1080',
}


def required(blp_dir):
    out = {}
    for pkg in sorted(os.listdir(blp_dir)):
        if not pkg.endswith('.blp'):
            continue
        p = os.path.join(blp_dir, pkg)
        try:
            b = BLP(p); r = B.Reader(b)
        except Exception as e:
            print(f'  ! cannot read {pkg}: {e}')
            continue
        for a in b.allocs:
            if b.typename(a) not in DATA_TYPES:
                continue
            buf = b.raw(a)
            # Only entries with flags bit 0x02 live in SHARED_DATA; the rest carry
            # their payload inside the package itself and need no file.
            if not (r.u32(buf, 44) & 0x02):
                continue
            out[r.strat(buf, 8)] = (pkg, r.u32(buf, 40))
    return out


def find_source(name):
    for d in SOURCE_DIRS:
        p = os.path.join(d, name)
        if os.path.exists(p):
            return p
    return None


def from_manifest(project):
    """
    Derive the renamed and locally-authored blob sets from a manifest.

    Both were hand-maintained lists of this mod's names. A clone's rename map already
    says which of our names is a copy of which shipped blob, and the manifest already
    says which blobs we author, so neither needs restating -- and a hand-maintained
    list silently stops covering a new asset the moment someone forgets to add it.
    """
    renamed, local = {}, set()
    for c in project.get('clones', []):
        for old, new in (c.get('renames') or {}).items():
            renamed[new] = old
    for t in project.get('uiTextures', []):
        if not t.get('flags', 0) & 0x10:          # raw payload -> we encoded it
            local.add('TEXTURE_' + t['ui_name'])
    for t in project.get('materialTextures', []):
        if not t.get('copyFromShipped'):
            local.add(t['name'])
    for m in project.get('meshes', []):
        local.add(m['buffer'])
    for s in project.get('soundbanks', []):
        local.add(s['name'])
    return renamed, local - set(renamed)


def sync(blp_dir, project=None, dry_run=False, log=print):
    """
    Fetch every referenced blob this package does not have. Returns a summary dict.

    Callable in-process, because the app cannot shell out to it: a frozen build has no
    Python interpreter to run a script with -- sys.executable is the app itself, so
    spawning `sys.executable sync_blobs.py ...` re-invokes the app with the script as
    an argument.
    """
    renamed = dict(RENAMED_FROM)
    local = set(LOCAL)
    if project:
        extra_renamed, extra_local = from_manifest(project)
        renamed.update(extra_renamed)
        local.update(extra_local)

    sd = os.path.join(blp_dir, 'SHARED_DATA')
    os.makedirs(sd, exist_ok=True)
    need = required(blp_dir)
    log(f'{len(need)} data entries required')

    result = {'required': len(need), 'present': 0, 'copied': 0,
              'localMissing': [], 'unresolved': [], 'stray': []}

    for name, (pkg, size) in sorted(need.items()):
        dest = os.path.join(sd, name)
        if os.path.exists(dest):
            result['present'] += 1
            continue
        if name in local:
            log(f'  LOCAL, not generated yet: {name}  [{pkg}]')
            result['localMissing'].append(name)
            continue
        src = find_source(renamed.get(name, name))
        if not src:
            log(f'  NOT FOUND anywhere: {name}  [{pkg}, size {size}]')
            result['unresolved'].append(name)
            continue
        if dry_run:
            log(f'  would copy {os.path.basename(src)} -> {name}')
        else:
            shutil.copy2(src, dest)
            log(f'  copied {name}  ({os.path.getsize(dest)} bytes)'
                + (f'  [renamed from {os.path.basename(src)}]'
                   if os.path.basename(src) != name else ''))
        result['copied'] += 1

    log(f"{result['present']} already present, {result['copied']} copied, "
        f"{len(result['localMissing'])} local-and-missing, "
        f"{len(result['unresolved'])} unresolved")

    # Anything in SHARED_DATA that nothing references is dead weight.
    result['stray'] = [f for f in sorted(os.listdir(sd)) if f not in need]
    if result['stray']:
        log('stray files not referenced by any package:')
        for f in result['stray']:
            log(f'   {f}')
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--blps', default='../Platforms/Windows/BLPs')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--project', help='civart.json; derives the renamed/local sets')
    args = ap.parse_args()

    project = None
    if args.project:
        import json
        with open(args.project) as f:
            project = json.load(f)

    r = sync(args.blps, project, args.dry_run)
    return 1 if r['unresolved'] else 0


if __name__ == '__main__':
    sys.exit(main())
