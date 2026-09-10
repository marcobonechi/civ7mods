"""
Locate an asset by name across BLP packages and report its entry type + components.

    python3 findasset.py <name> <file.blp> [more.blp ...]
    python3 findasset.py --prefix BIN_Monument <file.blp> ...
"""
import struct, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blp import BLP
from bins import Reader


def scan(path, match):
    try:
        b = BLP(path)
        r = Reader(b)
    except Exception as e:
        print(f"  (skip {os.path.basename(path)}: {e})")
        return
    for a in b.allocs:
        tn = b.typename(a)
        if not tn.startswith('PackageAssetEntry_'):
            continue
        buf = b.raw(a)
        name = r.strat(buf, 40)
        if not match(name):
            continue
        comps = []
        for cb, co in r.vec(buf, 24, 'BLP::BLPPtr<BLP::ICollectionEntry>'):
            ca = b.ptr(r.p64(cb, co))
            if ca:
                comps.append(b.typename(ca))
        print(f"  {name:<42} {tn:<32} [{os.path.basename(path)}]")
        for c in comps:
            print(f"      component: {c}")


def main():
    args = sys.argv[1:]
    if args[0] == '--prefix':
        needle, files = args[1], args[2:]
        match = lambda n: n.startswith(needle)
    else:
        needle, files = args[0], args[1:]
        match = lambda n: n == needle
    print(f"searching {len(files)} package(s) for {needle!r}")
    for p in files:
        scan(p, match)


if __name__ == '__main__':
    main()
