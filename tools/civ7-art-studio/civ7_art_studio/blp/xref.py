"""
Reverse pointer lookup: find every allocation that points at a given one.

Allocation pointers are stored as u64 (allocIndex + 1), so a referrer can be found
by scanning all allocation data for that value. Useful for answering "what actually
uses this string / asset", which forward-walking the known component types cannot
answer when the referrer's type is not yet decoded.

    python3 xref.py --string "[IMPROVEMENT:IMPROVEMENT_TEA_HOUSE]" <file.blp>
    python3 xref.py --alloc 3701 <file.blp>
"""
import struct, sys, os, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blp import BLP
from bins import Reader


def find_string_allocs(b, needle):
    out = []
    for a in b.allocs:
        if b.typename(a) != 'char':
            continue
        try:
            if needle in b.string(a):
                out.append(a.index)
        except Exception:
            pass
    return out


def referrers(b, index):
    """Allocations whose data contains the u64 pointer (index + 1)."""
    want = struct.pack('<Q', index + 1)
    hits = []
    for a in b.allocs:
        data = b.raw(a)
        off = data.find(want)
        while off != -1:
            if off % 8 == 0:
                hits.append((a, off))
            off = data.find(want, off + 1)
    return hits


def describe(b, r, a, off):
    name = ''
    if b.typename(a).startswith('PackageAssetEntry_'):
        name = r.strat(b.raw(a), 40)
    return (f"  alloc#{a.index:<7} +{off:<4} {b.typename(a):<44} "
            f"count={a.count:<5} {name}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--string', default=None)
    ap.add_argument('--alloc', type=int, default=None)
    ap.add_argument('--depth', type=int, default=3)
    ap.add_argument('file')
    args = ap.parse_args()

    b = BLP(args.file)
    r = Reader(b)

    seeds = []
    if args.string is not None:
        seeds = find_string_allocs(b, args.string)
        print(f"string {args.string!r} -> char allocs {seeds}")
    if args.alloc is not None:
        seeds.append(args.alloc)
    if not seeds:
        print("not found")
        return

    seen = set()
    frontier = list(seeds)
    for level in range(args.depth):
        nxt = []
        print(f"\n--- referrers, level {level + 1} ---")
        for idx in frontier:
            for a, off in referrers(b, idx):
                if a.index in seen:
                    continue
                seen.add(a.index)
                print(describe(b, r, a, off))
                nxt.append(a.index)
        if not nxt:
            break
        frontier = nxt


if __name__ == '__main__':
    main()
