"""
Generate the art-only skin tag table.

For every entry in BIN_Hero_Building_Footprint of the form

    [BUILDING:BUILDING_X] ...qualifiers...  ->  SOME_BIN

emit a parallel entry

    [BUILDING:BUILDING_X_SKIN] ...qualifiers...  ->  SOME_BIN

BUILDING_X_SKIN exists only in the art data and can never be produced by a
constructible, which is the property that makes a VisualRemap `To` work (see
readme). Any modder can then point a remap at BUILDING_X_SKIN to borrow
BUILDING_X's art for any building at all.

Scans the base game plus every DLC package, so bin modifiers that DLCs add to
the footprint (Assyria's Royal Library, etc.) are picked up too.

    python3 gen_skins.py <game-install-root> [-o skins.py]
"""
import sys, os, re, glob, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blp import BLP
from bins import Reader

TARGET_BIN = 'BIN_Hero_Building_Footprint'
SKIN_SUFFIX = '_SKIN'
SKIN_PRIORITY = 50

# Not real constructible types -- placeholders the engine uses for empty slots.
NOT_BUILDINGS = {'VACANT', 'NONE'}

BUILDING_TAG = re.compile(r'\[BUILDING:([A-Z0-9_]+)\]')


def footprint_entries(root, exclude=()):
    """
    Every entry that lands in BIN_Hero_Building_Footprint, from any package.

    `exclude` names art-group directories under DLC/ to ignore. Our own package
    must be excluded once it is installed, or the scan reads back the skin tags
    it generated last run and skins them again (BUILDING_X_SKIN_SKIN, ...).
    """
    pats = [
        os.path.join(root, 'Base/Platforms/Windows/BLPs/StandardAsset*.blp'),
        os.path.join(root, 'DLC/*/Platforms/Windows/BLPs/StandardAsset*.blp'),
    ]
    files = sorted({f for p in pats for f in glob.glob(p)})
    if exclude:
        drop = {os.path.normpath(os.path.join(root, 'DLC', d)) for d in exclude}
        files = [f for f in files
                 if os.path.normpath(os.path.join(os.path.dirname(f), '../../..'))
                 not in drop]
    out = []
    for path in files:
        try:
            b = BLP(path)
            r = Reader(b)
        except Exception:
            continue
        for a in b.allocs:
            if not b.typename(a).startswith('PackageAssetEntry_'):
                continue
            buf = b.raw(a)
            owner = r.strat(buf, 40)
            for cb, co in r.vec(buf, 24, 'BLP::BLPPtr<BLP::ICollectionEntry>'):
                ca = b.ptr(r.p64(cb, co))
                if not ca:
                    continue
                kind = b.typename(ca)
                cbuf = b.raw(ca)
                if kind == 'AssetPackage_BinEntryComponent2':
                    if owner != TARGET_BIN:
                        continue
                elif kind == 'AssetPackage_BinModiferComponent0':
                    if r.strat(cbuf, 16) != TARGET_BIN:
                        continue
                else:
                    continue
                for eb, eo in r.vec(cbuf, 24, 'AssetPackage_BinEntry2'):
                    e = r.bin_entry(eb, eo)
                    if e['asset'] and e['expr']:
                        out.append((e['asset'], e['expr'], e['priority'],
                                    os.path.basename(path)))
    return out


def water_buildings(db_path):
    """
    Constructibles the game seats on water.

    Nothing in the BLP expresses this -- the BIN_X_Scaled wrappers are byte-identical
    for water and land buildings, and no placement enum exists in the type registry.
    The seat (waterline vs sea floor) is a model-spawn parameter the engine chooses,
    so a skin can swap the art but cannot change how it sits. Mixing seats across a
    remap therefore leaves a land building on the sea floor, and this flag exists so
    the mismatch is visible before it is shipped rather than after.
    """
    import sqlite3
    c = sqlite3.connect(db_path)
    return {r[0] for r in c.execute(
        "SELECT DISTINCT ConstructibleType FROM Constructible_ValidTerrains "
        "WHERE TerrainType IN ('TERRAIN_COAST','TERRAIN_NAVIGABLE_RIVER')")}


def build_skins(entries):
    """(skin_asset, skin_expr, source_building, priority, package) per usable entry."""
    skins, skipped = [], []
    seen = set()
    for asset, expr, priority, pkg in entries:
        types = BUILDING_TAG.findall(expr)
        real = [t for t in types if t not in NOT_BUILDINGS]
        if len(real) != 1:
            # 0 -> not keyed on a building at all; >1 -> unique-quarter style
            # expressions where it is ambiguous which building the skin names.
            skipped.append((asset, expr, pkg, f'{len(real)} building tags'))
            continue
        src = real[0]
        if src.endswith(SKIN_SUFFIX):
            # Already one of ours. Belt and braces alongside the DLC exclusion:
            # without this a rebuild would emit BUILDING_X_SKIN_SKIN.
            skipped.append((asset, expr, pkg, 'already a skin tag'))
            continue
        skin = src + SKIN_SUFFIX
        skin_expr = expr.replace(f'[BUILDING:{src}]', f'[BUILDING:{skin}]')
        key = (asset, skin_expr)
        if key in seen:
            continue
        seen.add(key)
        # Offset rather than flatten. A building can have several footprint entries
        # ordered by priority -- BUILDING_OBSERVATORY is p=1 plain and p=5 for the
        # [ADJACENCY_BONUS:TERRAIN] variant. Flattening them all to one value would
        # make that a coin flip; offsetting preserves the relative order while still
        # clearing every base entry.
        skins.append((asset, skin_expr, src, priority + SKIN_PRIORITY, pkg))
    return skins, skipped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('root', help='game install root (contains Base/ and DLC/)')
    ap.add_argument('-o', '--out', default=None, help='write a python table here')
    ap.add_argument('--exclude', default='custom-art',
                    help='comma-separated DLC art groups to ignore (default: our own)')
    ap.add_argument('--md', default=None, help='also write a markdown reference here')
    ap.add_argument('--db', default=None,
                    help='gameplay sqlite, to flag which skins are water-seated')
    args = ap.parse_args()

    exclude = [d for d in args.exclude.split(',') if d]
    entries = footprint_entries(args.root, exclude)
    water = water_buildings(args.db) if args.db else None
    skins, skipped = build_skins(entries)
    buildings = sorted({s[2] for s in skins})

    print(f"{len(entries)} footprint entries -> {len(skins)} skin entries "
          f"covering {len(buildings)} buildings")
    if skipped:
        print(f"skipped {len(skipped)}:")
        for asset, expr, pkg, why in skipped:
            print(f"   [{why}] {asset} <= {expr!r}  ({pkg})")

    if not args.out:
        for asset, skin_expr, src, _, pkg in skins:
            print(f"  {src+SKIN_SUFFIX:<44} -> {asset:<34} {skin_expr!r}")
        return

    with open(args.out, 'w') as f:
        f.write('"""Generated by gen_skins.py -- do not edit by hand.\n\n')
        f.write(f'{len(skins)} art-only skin tags covering {len(buildings)} buildings.\n')
        f.write('Each BUILDING_X_SKIN tag renders whatever BUILDING_X renders.\n"""\n\n')
        f.write(f'# priorities are the source entry priority + {SKIN_PRIORITY},\n')
        f.write('# which clears every base entry while preserving relative order\n')
        f.write('# (e.g. BUILDING_OBSERVATORY is p=1 plain, p=5 with adjacency bonus)\n')
        f.write('# (asset bin, expression, priority, weight)\n')
        f.write('SKIN_ENTRIES = [\n')
        for asset, skin_expr, src, prio, pkg in sorted(skins, key=lambda s: (s[2], s[1])):
            f.write(f'    ({asset!r}, {skin_expr!r}, {prio}, 1.0),\n')
        f.write(']\n\n')
        f.write('SKIN_TAGS = [\n')
        for bld in buildings:
            f.write(f'    {bld + SKIN_SUFFIX!r},\n')
        f.write(']\n')
        if water is not None:
            f.write('\n# Skins whose art is seated at the waterline. The seat is chosen at\n'
                    '# model-spawn time and is not expressed in the BLP, so a skin cannot\n'
                    '# change it -- applying one of these to a land building (or a land\n'
                    '# skin to a water building) leaves the model at the wrong height.\n')
            f.write('WATER_SKINS = [\n')
            for bld in buildings:
                if bld in water:
                    f.write(f'    {bld + SKIN_SUFFIX!r},\n')
            f.write(']\n')
    print(f"wrote {args.out}")

    if args.md:
        by_bld = {}
        for asset, skin_expr, src, prio, pkg in skins:
            by_bld.setdefault(src, []).append((asset, skin_expr, pkg))
        multi = {b for b, v in by_bld.items() if len(v) > 1}
        with open(args.md, 'w') as f:
            f.write('# Building skin tags\n\n')
            f.write(f'{len(skins)} art-only tags covering {len(by_bld)} buildings, '
                    'generated by `tools/gen_skins.py`.\n\n')
            f.write('Point a `VisualRemap` at one of these to give any building '
                    "that building's art:\n\n")
            f.write('```xml\n<Row>\n  <ID>REMAP_MY_THING</ID>\n'
                    '  <DisplayName>LOC_REMAP_MY_THING</DisplayName>\n'
                    '  <Kind>BUILDING</Kind>\n'
                    '  <From>BUILDING_WHATEVER</From>\n'
                    '  <To>BUILDING_MOTTE_SKIN</To>\n</Row>\n```\n\n')
            if water is not None:
                f.write('**Seat.** The waterline-vs-sea-floor seat is a model-spawn\n'
                        'parameter, not BLP data, so a skin swaps the art but cannot\n'
                        'change how it sits. Putting a `land` skin on a water building\n'
                        'leaves it on the sea floor, and vice versa. Match the seat\n'
                        'column to the building you are remapping.\n\n')
            f.write('| skin tag | renders as | seat | art asset |\n')
            f.write('|---|---|---|---|\n')
            for src in sorted(by_bld):
                for asset, skin_expr, pkg in by_bld[src]:
                    qual = skin_expr.replace(f'[BUILDING:{src}{SKIN_SUFFIX}]', '').strip()
                    qual = qual[4:].strip() if qual.startswith('and ') else qual
                    shown = f'`{src}`' + (f' <br><sub>{qual}</sub>' if qual else '')
                    if water is None:
                        seat = '?'
                    else:
                        seat = '**water**' if src in water else 'land'
                    f.write(f'| `{src}{SKIN_SUFFIX}` | {shown} | {seat} | `{asset}` |\n')
        print(f"wrote {args.md}")


if __name__ == '__main__':
    main()
