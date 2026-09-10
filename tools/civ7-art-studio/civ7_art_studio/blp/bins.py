"""Dump asset entries + Bin components (selection bins & bin modifiers) from a CIVBLP."""
import struct, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blp import BLP

class Reader:
    def __init__(self, blp):
        self.b = blp
        self.T = blp.types()

    def sizeof(self, tn):
        t = self.T.get(tn)
        if t: return t['size']
        return {'uint8':1,'uint16':2,'uint32':4,'int32':4,'uint64':8,'float':4,'bool':1}.get(tn, 8)

    def u32(self, buf, o): return struct.unpack_from('<I', buf, o)[0]
    def u16(self, buf, o): return struct.unpack_from('<H', buf, o)[0]
    def f32(self, buf, o): return struct.unpack_from('<f', buf, o)[0]
    def p64(self, buf, o): return struct.unpack_from('<Q', buf, o)[0]

    def strat(self, buf, o):
        """String::BasicT / BLPPtr<String> — 8-byte alloc pointer"""
        p = self.p64(buf, o)
        a = self.b.ptr(p)
        return self.b.string(a) if a else ''

    def vec(self, buf, o, elemtype):
        """BLPVector<T> at offset o -> list of (buffer, elem_offset)"""
        p = self.p64(buf, o)
        n = self.u32(buf, o+8)
        a = self.b.ptr(p)
        if not a or n == 0: return []
        data = self.b.raw(a)
        es = self.sizeof(elemtype)
        return [(data, i*es) for i in range(n)]

    def bin_entry(self, buf, o):
        return dict(weight=self.f32(buf,o), priority=self.u32(buf,o+4),
                    hash=self.u32(buf,o+8), asset=self.strat(buf,o+16),
                    expr=self.strat(buf,o+24))

def main(path, filt=None):
    b = BLP(path); r = Reader(b)
    bins, mods = [], []
    for a in b.allocs:
        tn = b.typename(a)
        if not tn.startswith('PackageAssetEntry_'): continue
        buf = b.raw(a)
        name = r.strat(buf, 40)
        comps = r.vec(buf, 24, 'BLP::BLPPtr<BLP::ICollectionEntry>')
        for cbuf, co in comps:
            ca = b.ptr(r.p64(cbuf, co))
            if not ca: continue
            ctn = b.typename(ca)
            cb = b.raw(ca)
            if ctn == 'AssetPackage_BinEntryComponent2':
                e = [r.bin_entry(eb, eo) for eb, eo in r.vec(cb, 24, 'AssetPackage_BinEntry2')]
                bins.append((name, r.strat(cb, 16), r.bin_entry(cb, 40), e))
            elif ctn == 'AssetPackage_BinModiferComponent0':
                add = [r.bin_entry(eb, eo) for eb, eo in r.vec(cb, 24, 'AssetPackage_BinEntry2')]
                mods.append((name, r.strat(cb, 16), add))

    print(f"### {path}\n### {len(bins)} bins, {len(mods)} bin-modifiers\n")
    for name, fb, excl, entries in bins:
        if filt and filt not in name and not any(filt in e['expr'] or filt in e['asset'] for e in entries):
            continue
        print(f"BIN {name}   fallback={fb!r}")
        if excl['asset'] or excl['expr']:
            print(f"    [exclusive] {excl['asset']!r}  <= {excl['expr']!r}")
        for e in entries:
            print(f"    w={e['weight']:<5g} p={e['priority']:<3} {e['asset']:<45} <= {e['expr']!r}")
        print()
    for name, target, add in mods:
        if filt and filt not in name and filt not in target and not any(filt in e['expr'] or filt in e['asset'] for e in add):
            continue
        print(f"BINMOD {name}   target={target!r}")
        for e in add:
            print(f"    +w={e['weight']:<5g} p={e['priority']:<3} {e['asset']:<45} <= {e['expr']!r}")
        print()

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
