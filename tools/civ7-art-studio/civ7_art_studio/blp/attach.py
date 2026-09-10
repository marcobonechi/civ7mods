"""
Dump DirectAttachment4 records from wrapper assets (the BIN_X_Scaled entries the
footprint points at). These carry the placement knobs -- position/rotation/scale
and the ePlacement / eFlags / eBlocks bytes.

    python3 attach.py <name|--prefix P> <file.blp> [...]
"""
import struct, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blp import BLP
from bins import Reader

# DirectAttachment4, size 72
#  +0  kBase AttachmentBase0 : name(8) bonehash(u32@8) position(f3@12)
#                              rotation(f3@24) scale(f@36)
#  +40 kUniqueName(8)  +48 nUniqueNameHash  +52 nAssetNameHash
#  +56 nVisibilityHash +60 eFlags(u32)
#  +64 ePlacement(u8)  +65 eBlocks(u8)  +66 eVisibilityTags(u8)

def attachment(r, buf, o):
    f3 = lambda off: struct.unpack_from('<3f', buf, o + off)
    return dict(
        name=r.strat(buf, o + 0),
        bonehash=r.u32(buf, o + 8),
        position=f3(12),
        rotation=f3(24),
        scale=struct.unpack_from('<f', buf, o + 36)[0],
        unique=r.strat(buf, o + 40),
        assetHash=r.u32(buf, o + 52),
        visHash=r.u32(buf, o + 56),
        flags=r.u32(buf, o + 60),
        placement=buf[o + 64],
        blocks=buf[o + 65],
        visTags=buf[o + 66],
    )


def scan(path, match):
    try:
        b = BLP(path); r = Reader(b)
    except Exception:
        return
    for a in b.allocs:
        if not b.typename(a).startswith('PackageAssetEntry_'):
            continue
        buf = b.raw(a)
        name = r.strat(buf, 40)
        if not match(name):
            continue
        for cb, co in r.vec(buf, 24, 'BLP::BLPPtr<BLP::ICollectionEntry>'):
            ca = b.ptr(r.p64(cb, co))
            if not ca or b.typename(ca) != 'DirectAttachmentSet4':
                continue
            cbuf = b.raw(ca)
            atts = r.vec(cbuf, 16, 'DirectAttachment4')
            print(f"{name}   ({len(atts)} attachment(s))  [{os.path.basename(path)}]")
            for ab, ao in atts:
                d = attachment(r, ab, ao)
                pos = '(%.3f, %.3f, %.3f)' % d['position']
                rot = '(%.1f, %.1f, %.1f)' % d['rotation']
                print(f"   placement={d['placement']} blocks={d['blocks']} "
                      f"visTags={d['visTags']} flags=0x{d['flags']:08x} "
                      f"scale={d['scale']:.3f} pos={pos} rot={rot}")
                print(f"      name={d['name']!r} unique={d['unique']!r}")


def main():
    args = sys.argv[1:]
    if args[0] == '--prefix':
        needle, files = args[1], args[2:]
        match = lambda n: n.startswith(needle)
    else:
        needle, files = args[0], args[1:]
        match = lambda n: n == needle
    for p in files:
        scan(p, match)


if __name__ == '__main__':
    main()
