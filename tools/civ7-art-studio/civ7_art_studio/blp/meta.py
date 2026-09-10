"""
Dump PackageAssetEntry_Metadata0 assets and their ValueSets.

Metadata assets carry authored key/value data (camera settings, tint sets, asset
lists...). Useful for finding lookup tables that are not expressed as bins.

    python3 meta.py [--class AssetList] [--grep Hillfort] <file.blp> [...]
"""
import struct, sys, os, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blp import BLP
from bins import Reader

VT = {0: 'FLOAT', 1: 'INT', 2: 'BOOL', 3: 'RGB', 4: 'STRING', 5: 'OBJECT',
      6: 'COORD2D', 7: 'COORD3D', 8: 'BLP_ENTRY', 9: 'ARTDEF_REF',
      10: 'COLLECTION', 11: 'CURVE', 12: 'TUPLE'}


def pstr(b, r, buf, off):
    """
    Resolve a BLP::BLPPtr<String::BasicT<...>> field.

    Two hops, unlike the String::BasicT fields embedded inline in bin entries:
    the pointer names an 8-byte String::BasicT allocation, which in turn holds the
    pointer to the char data. Treating it as a single hop yields the raw pointer
    bytes as text (e.g. 'v\\x0e'), which is what a one-hop read produces here.
    """
    a = b.ptr(r.p64(buf, off))
    if a is None:
        return ''
    if b.typename(a) == 'char':
        return b.string(a)
    inner = b.ptr(r.p64(b.raw(a), 0))
    return b.string(inner) if inner else ''


def read_value(b, r, ptr, depth=0):
    a = b.ptr(ptr)
    if not a or depth > 4:
        return None
    buf = b.raw(a)
    t = b.typename(a)
    vt = r.u32(buf, 8)
    name = pstr(b, r, buf, 16)
    out = {'param': name, 'type': VT.get(vt, vt), 'kind': t}
    if t == 'BLP::StringValue':
        out['value'] = pstr(b, r, buf, 24)
    elif t == 'BLP::FloatValue':
        out['value'] = struct.unpack_from('<f', buf, 24)[0]
    elif t in ('BLP::IntValue', 'BLP::BoolValue'):
        out['value'] = r.u32(buf, 24)
    elif t == 'BLP::BLPEntryValue':
        out['value'] = {'library': pstr(b, r, buf, 24), 'xlpClass': pstr(b, r, buf, 32),
                        'entry': pstr(b, r, buf, 40), 'package': pstr(b, r, buf, 48)}
    elif t in ('BLP::CollectionValue', 'BLP::TupleValue'):
        off = 32 if t == 'BLP::CollectionValue' else 24
        out['value'] = [read_value(b, r, r.p64(eb, eo), depth + 1)
                        for eb, eo in r.vec(buf, off, 'BLP::BLPPtr<BLP::Value>')]
    return out


def render(v, indent=6):
    if v is None:
        return
    pad = ' ' * indent
    val = v.get('value')
    if isinstance(val, list):
        print(f"{pad}{v['param']} ({v['type']}):")
        for c in val:
            render(c, indent + 3)
    else:
        print(f"{pad}{v['param']} ({v['type']}) = {val!r}")


def scan(path, cls, needle):
    try:
        b = BLP(path); r = Reader(b)
    except Exception:
        return
    for a in b.allocs:
        if b.typename(a) != 'PackageAssetEntry_Metadata0':
            continue
        buf = b.raw(a)
        name = r.strat(buf, 40)
        klass = r.strat(buf, 64)
        if cls and klass != cls:
            continue
        vs = b.ptr(r.p64(buf, 56))
        vals = []
        if vs:
            vbuf = b.raw(vs)
            vals = [read_value(b, r, r.p64(eb, eo))
                    for eb, eo in r.vec(vbuf, 0, 'BLP::BLPPtr<BLP::Value>')]
        if needle:
            blob = repr(vals) + name + klass
            if needle.lower() not in blob.lower():
                continue
        print(f"{name}   [class={klass}]  ({os.path.basename(path)})")
        for v in vals:
            render(v)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--class', dest='cls', default=None)
    ap.add_argument('--grep', default=None)
    ap.add_argument('files', nargs='+')
    args = ap.parse_args()
    for p in args.files:
        scan(p, args.cls, args.grep)


if __name__ == '__main__':
    main()
