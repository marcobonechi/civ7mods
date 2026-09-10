"""
Check CIVBLP structural invariants. Run against a shipped package first to
confirm the invariants themselves are right, then against a generated one.

    python3 validate.py <file.blp> [...]
"""
import struct, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blp import BLP, ALLOC


def validate(path):
    errs, warns = [], []
    b = BLP(path)
    d = b.data
    T = b.types()

    def err(m): errs.append(m)

    if b.filesize != len(d):
        warns.append(f"header fileSize {b.filesize} != actual {len(d)}")
    if b.bigoff + 0 > len(d):
        err(f"bigDataOffset {b.bigoff} past EOF {len(d)}")

    pre = struct.unpack_from('<I2H2I', d, b.pkgoff)
    if pre != (5, 8, 8, 72, 1):
        err(f"unexpected preamble {pre}")

    ro, rs = b.stripes[4]
    root_name = d[b.pkgoff + ro: b.pkgoff + ro + rs]
    if root_name != b'BLP::Package\0':
        err(f"rootTypeName {root_name!r} != b'BLP::Package\\0'")

    # stripes must not run past the declared package data
    for name, (o, s) in zip(['resourceLinker', 'packageBlock', 'tempData',
                             'typeInfo', 'rootTypeName'], b.stripes):
        if o + s > b.pkgsize:
            err(f"stripe {name} [{o},{o+s}) exceeds packageDataSize {b.pkgsize}")

    # allocation table must exactly fill the tail of tempData
    n = len(b.allocs)
    used = b.linker + n * ALLOC
    if used != b.stripes[2][1]:
        err(f"alloc table ends at {used} but tempData size is {b.stripes[2][1]}")

    # root BLP::Package object
    td = b.tempdata
    ptr, = struct.unpack_from('<Q', d, td + 16)
    n1, n2 = struct.unpack_from('<2I', d, td + 24)
    em = b.ptr(ptr)
    if em is None:
        err("root m_Entries.pBlock is null")
    else:
        if b.typename(em) != 'BLP::Package::EntryMap':
            err(f"root m_Entries points at {b.typename(em)!r}, not EntryMap")
        if not (n1 == n2 == em.count):
            err(f"root entry count {n1}/{n2} != EntryMap count {em.count}")

    bigptr, = struct.unpack_from('<Q', d, td + 32)
    bign, = struct.unpack_from('<I', d, td + 40)
    if bign != b.bigcount:
        err(f"root m_BigDataEntries count {bign} != header bigDataCount {b.bigcount}")

    # per-allocation invariants
    stripe_sizes = {0: b.stripes[1][1], 1: b.stripes[2][1]}
    for a in b.allocs:
        if a.stripe not in (0, 1):
            err(f"alloc#{a.index} bad stripe {a.stripe}")
            continue
        limit = b.linker if a.stripe == 1 else stripe_sizes[0]
        if a.offset + a.size > limit:
            err(f"alloc#{a.index} [{a.offset},{a.offset+a.size}) overruns stripe {a.stripe} limit {limit}")

        tn_alloc = b.ptr(a.typeptr)
        if tn_alloc is None:
            err(f"alloc#{a.index} has null typeNamePtr")
            continue
        if tn_alloc.stripe != 1:
            err(f"alloc#{a.index} type-name alloc #{tn_alloc.index} not in tempData")
        tn = b.raw(tn_alloc).split(b'\0')[0].decode('ascii', 'replace')
        t = T.get(tn)
        if t is None:
            warns.append(f"alloc#{a.index} type {tn!r} not in typeInfo registry")
        else:
            poly = bool(t['traits'] & 0x10)
            expect_ud = a.typeptr if poly else 0
            if a.userdata != expect_ud:
                err(f"alloc#{a.index} ({tn}) userData={a.userdata}, expected {expect_ud} "
                    f"(polymorphic={poly})")
            if tn != 'char' and t['size'] and a.count and a.size != t['size'] * a.count:
                warns.append(f"alloc#{a.index} ({tn}) size {a.size} != {t['size']}*{a.count}")
        if tn == 'char' and a.count != a.size:
            err(f"alloc#{a.index} char alloc count {a.count} != size {a.size}")

    # overlap check per stripe
    for s in (0, 1):
        spans = sorted(((a.offset, a.offset + a.size, a.index)
                        for a in b.allocs if a.stripe == s))
        for (s1, e1, i1), (s2, e2, i2) in zip(spans, spans[1:]):
            if s2 < e1:
                err(f"stripe {s}: alloc#{i1} [{s1},{e1}) overlaps alloc#{i2} [{s2},{e2})")

    # every pointer-shaped field we know about must resolve
    for a in b.allocs:
        if b.typename(a) == 'BLP::Package::EntryMap':
            raw = b.raw(a)
            for i in range(a.count):
                p, = struct.unpack_from('<Q', raw, i * 16 + 8)
                if b.ptr(p) is None:
                    err(f"EntryMap#{i} pEntry {p} does not resolve")

    status = 'FAIL' if errs else ('OK' if not warns else 'OK (with notes)')
    print(f"{status:<16} {os.path.basename(path)}  "
          f"[{len(b.allocs)} allocs, {len(d)} bytes]")
    for e in errs:
        print(f"   ERROR  {e}")
    for w in warns[:8]:
        print(f"   note   {w}")
    if len(warns) > 8:
        print(f"   note   ... {len(warns)-8} more")
    return not errs


if __name__ == '__main__':
    ok = all([validate(p) for p in sys.argv[1:]])
    sys.exit(0 if ok else 1)
