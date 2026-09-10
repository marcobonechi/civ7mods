"""
Pick the donor package a build needs, instead of hardcoding one.

Every build copies a `typeInfo` stripe verbatim from a shipped package. That stripe is
the type registry, and PackageBuilder._new refuses to emit a type the donor does not
declare -- so the donor is not an arbitrary choice, it is a function of what the
manifest contains. Get it wrong and the build dies with

    KeyError: donor package does not declare type 'AssetPackage_LayoutBaseLayerComponent0'

which is exactly what the documented donor (assyria) now does: it predates wonders.
Hardcoding a donor means every new feature silently invalidates older instructions.

The approach here is to measure rather than guess. Build the manifest once against the
richest donor available to learn which types it actually touches, then pick the
smallest shipped package whose registry covers that set. Smallest matters because the
stripe is copied verbatim into the output -- it is most of the file size.

    python3 donors.py <game-root> [--project ../civart.json] [--package StandardAsset]
"""
import sys, os, io, glob, json, argparse, contextlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blp import BLP


def candidates(game_root, package='StandardAsset'):
    """Every shipped package of the given name, base and DLC alike."""
    found = []
    for plat in ('Mac', 'Windows'):
        found += glob.glob(os.path.join(game_root, 'Base', 'Platforms', plat,
                                        'BLPs', f'{package}*.blp'))
        found += glob.glob(os.path.join(game_root, 'DLC', '*', 'Platforms', plat,
                                        'BLPs', f'{package}*.blp'))
    return sorted(found)


GENERATED_MARKER = '<!-- CUSTOM MODDED -->'


def is_generated(blp_path):
    """
    True if this package belongs to an art group we generated rather than a shipped one.

    Generated .dep files carry a marker comment. Without this check an installed mod is
    just another candidate donor -- a valid package, usually a small one, so it wins the
    smallest-sufficient contest and the next build silently depends on the last one's
    output.
    """
    group = os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.dirname(blp_path))))
    for dep in glob.glob(os.path.join(group, '*.dep')):
        try:
            with open(dep, encoding='utf-8', errors='replace') as f:
                if GENERATED_MARKER in f.read(4096):
                    return True
        except OSError:
            continue
    return False


def index(paths, exclude=('custom-art',)):
    """
    {path: set(declared type names)} for each package that parses.

    Packages we generated are skipped, both by the marker in their .dep and by the
    legacy name list, which still covers anything built before the marker existed.
    """
    out = {}
    for p in paths:
        if any(f'{os.sep}{name}{os.sep}' in p for name in exclude):
            continue
        if is_generated(p):
            continue
        try:
            out[p] = set(BLP(p).types())
        except Exception:
            continue          # not every shipped .blp is a package we can parse
    return out


def select(game_root, project, package='StandardAsset', exclude=('custom-art',)):
    """
    Return (chosen_path, required_types, all_sufficient_paths).

    Type registries are not nested -- a package declaring 400 types can still lack one
    that a 330-type package has -- so there is no single "richest" donor to probe
    against, and no way to learn the required set without a build that succeeds.
    Instead, try candidates smallest-first and keep the first that builds. A wrong
    donor fails on its first missing type, so the rejects cost almost nothing, and the
    first success is by construction the smallest sufficient one.
    """
    from build_blp import build_package
    idx = index(candidates(game_root, package), exclude)
    if not idx:
        raise SystemExit(f'no {package}*.blp packages found under {game_root}')

    misses = {}
    ok, needed = [], None
    for path in sorted(idx, key=lambda p: (len(idx[p]), p)):
        try:
            # clone_into reports to stdout; a probe is not a build, so keep it quiet
            with contextlib.redirect_stdout(io.StringIO()):
                _data, b = build_package(project, path, game_root)
        except KeyError as e:
            misses[path] = str(e)
            continue
        if needed is None:
            needed = {a.typename for a in b.allocs}
        ok.append(path)

    if not ok:
        sample = sorted(misses.items(), key=lambda kv: len(idx[kv[0]]))[-1]
        raise SystemExit('no shipped package declares every type this manifest needs.\n'
                         f'  largest tried: {sample[0]}\n  failed on: {sample[1]}')
    return ok[0], needed, ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('game_root')
    ap.add_argument('--project', help='civart.json (default: the built-in manifest)')
    ap.add_argument('--package', default='StandardAsset')
    args = ap.parse_args()

    if args.project:
        with open(args.project) as f:
            project = json.load(f)
    else:
        from build_blp import default_project
        project = default_project()

    chosen, needed, ok = select(args.game_root, project, args.package)
    idx = index(candidates(args.game_root, args.package))
    print(f'manifest emits {len(needed)} distinct types')
    print(f'{len(ok)} of {len(idx)} {args.package} packages are sufficient\n')
    for p in ok[:10]:
        mark = '->' if p == chosen else '  '
        print(f'  {mark} {len(idx[p]):>4} types  '
              f'{os.path.relpath(p, args.game_root)}')
    if len(ok) > 10:
        print(f'     ... {len(ok) - 10} more')
    print(f'\nchosen: {chosen}')


if __name__ == '__main__':
    main()
