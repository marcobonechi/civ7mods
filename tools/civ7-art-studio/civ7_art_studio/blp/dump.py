"""Dump the full container layout of a CIVBLP package (stripes, allocations, entry map)."""
import struct, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blp import BLP, ALLOC

def main(path, maxallocs=400):
    b = BLP(path)
    d = b.data
    print(f"file            {path}")
    print(f"size on disk    {len(d)}")
    print(f"magic/version   CIVBLP v{b.version}")
    print(f"packageDataOff  {b.pkgoff}")
    print(f"packageDataSize {b.pkgsize}")
    print(f"bigDataOffset   {b.bigoff}")
    print(f"bigDataCount    {b.bigcount}")
    print(f"fileSize field  {b.filesize}")
    pre = struct.unpack_from('<I2H2I', d, b.pkgoff)
    print(f"preamble        pkgVer={pre[0]} sizeofPtr={pre[1]} align64={pre[2]} sizeofHdr={pre[3]} endian={pre[4]}")
    names = ['resourceLinkerData', 'packageBlock', 'tempData', 'typeInfo', 'rootTypeName']
    print("\nstripes (offsets relative to packageDataOffset):")
    for n, (o, s) in zip(names, b.stripes):
        print(f"  {n:<20} offset={o:<10} size={s:<10} end={o+s}")
    print(f"  linkerDataOffset     {b.linker}   (offset into tempData where alloc table starts)")
    trail = struct.unpack_from('<8I', d, b.pkgoff + 16 + 40)
    print(f"  header trailing u32s {trail}")

    ro, rs = b.stripes[4]
    print(f"\nrootTypeName raw: {d[b.pkgoff+ro : b.pkgoff+ro+rs]!r}")

    print(f"\nallocations: {len(b.allocs)}  (table at pkgoff+{b.stripes[2][0]}+{b.linker} = {b.tempdata + b.linker})")
    print(f"{'idx':>5} {'stripe':>6} {'offset':>9} {'size':>8} {'count':>6}  typename / preview")
    for a in b.allocs[:maxallocs]:
        tn = b.typename(a)
        prev = ''
        if tn in ('char',):
            prev = repr(b.raw(a)[:60])
        elif 'String::BasicT' in tn:
            prev = repr(b.string(a)[:60])
        print(f"{a.index:>5} {a.stripe:>6} {a.offset:>9} {a.size:>8} {a.count:>6}  {tn[:70]} {prev}")
    if len(b.allocs) > maxallocs:
        print(f"  ... {len(b.allocs)-maxallocs} more")

    # entry map
    for a in b.allocs:
        if b.typename(a) != 'BLP::Package::EntryMap': continue
        raw = b.raw(a)
        print(f"\nEntryMap alloc #{a.index}: {a.count} entries, {a.size} bytes ({a.size//max(a.count,1)} per entry)")
        for i in range(min(a.count, 30)):
            h, = struct.unpack_from('<I', raw, i*16)
            p, = struct.unpack_from('<Q', raw, i*16+8)
            ea = b.ptr(p)
            nm = ''
            if ea:
                np_, = struct.unpack_from('<Q', b.raw(ea), 40)
                na = b.ptr(np_)
                nm = b.string(na) if na else ''
            print(f"   0x{h:08X} -> alloc#{p-1 if p else -1:<5} {b.typename(ea) if ea else '':<32} {nm}")
        if a.count > 30: print(f"   ... {a.count-30} more")

if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 400)
