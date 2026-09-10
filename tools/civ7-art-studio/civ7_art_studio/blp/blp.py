"""Minimal CIVBLP parser — port of blp-studio/src/core/blp-parser.ts"""
import struct, sys

ALLOC = 40

class Alloc:
    __slots__ = ('index','stripe','offset','size','count','userdata','typeptr')
    def __init__(self, i, stripe, offset, size, count, userdata, typeptr):
        self.index, self.stripe, self.offset, self.size = i, stripe, offset, size
        self.count, self.userdata, self.typeptr = count, userdata, typeptr
    def __repr__(self):
        return f"<A{self.index} s{self.stripe} off={self.offset} sz={self.size} n={self.count}>"

class BLP:
    def __init__(self, path):
        self.data = open(path,'rb').read()
        d = self.data
        assert d[:6] == b'CIVBLP', d[:6]
        self.version = struct.unpack_from('<H', d, 6)[0]
        self.pkgoff, self.pkgsize, self.bigoff, self.bigcount, self.filesize = \
            struct.unpack_from('<5I', d, 8)
        # preamble 16 bytes then package header
        h = self.pkgoff + 16
        self.stripes = [struct.unpack_from('<2I', d, h + i*8) for i in range(5)]
        self.linker = struct.unpack_from('<I', d, h+40)[0]
        self.pkgblock = self.pkgoff + self.stripes[1][0]
        self.tempdata = self.pkgoff + self.stripes[2][0]
        # allocations
        astart = self.tempdata + self.linker
        n = (self.stripes[2][1] - self.linker)//ALLOC
        self.allocs = []
        for i in range(n):
            o = astart + i*ALLOC
            if o+ALLOC > len(d): break
            stripe, = struct.unpack_from('<Q', d, o)
            off, size, cnt = struct.unpack_from('<3I', d, o+8)
            ud, = struct.unpack_from('<Q', d, o+24)
            tp, = struct.unpack_from('<Q', d, o+32)
            self.allocs.append(Alloc(i, stripe, off, size, cnt, ud, tp))
        self._tn = {}

    def base(self, stripe):
        return self.tempdata if stripe == 1 else self.pkgblock

    def raw(self, a):
        o = self.base(a.stripe) + a.offset
        return self.data[o:o+a.size]

    def ptr(self, p):
        if p == 0 or p-1 >= len(self.allocs): return None
        return self.allocs[p-1]

    def typename(self, a):
        if a.index in self._tn: return self._tn[a.index]
        t = self.ptr(a.typeptr)
        n = self.raw(t).split(b'\0')[0].decode('ascii','replace') if t else '<null>'
        self._tn[a.index] = n
        return n

    def string(self, a):
        r = self.raw(a)
        if len(r) >= 12:
            l1, l2 = struct.unpack_from('<2I', r, 0)
            if l1 > 0 and l2 == l1-1 and 8+l1 <= len(r)+1:
                return r[8:8+l2].decode('ascii','replace')
        return r.split(b'\0')[0].decode('ascii','replace')

    def strptr(self, p):
        a = self.ptr(p)
        return self.string(a) if a else ''

    # ---- type registry (nested package in typeInfo stripe) ----
    def types(self):
        tioff = self.pkgoff + self.stripes[3][0]
        ti = self.data[tioff:tioff+self.stripes[3][1]]
        ns = [struct.unpack_from('<2I', ti, 16+i*8) for i in range(5)]
        nl = struct.unpack_from('<I', ti, 16+40)[0]
        npb, ntd = ns[1][0], ns[2][0]
        st = ntd + nl
        cnt = (ns[2][1]-nl)//ALLOC
        na = []
        for i in range(cnt):
            o = st+i*ALLOC
            if o+ALLOC > len(ti): break
            stripe, = struct.unpack_from('<Q', ti, o)
            off, size, c = struct.unpack_from('<3I', ti, o+8)
            tp, = struct.unpack_from('<Q', ti, o+32)
            na.append(Alloc(i, stripe, off, size, c, 0, tp))
        def nread(a):
            b = npb if a.stripe == 0 else ntd
            return ti[b+a.offset:b+a.offset+a.size]
        def nstr(p):
            if p == 0 or p-1 >= len(na): return ''
            return nread(na[p-1]).replace(b'\0',b'').decode('ascii','replace')
        out = {}
        for a in na:
            if nstr(a.typeptr) != 'TypeInfoStripe::TypeVersion': continue
            es = a.size // max(a.count,1)
            d = nread(a)
            for i in range(a.count):
                e = d[i*es:(i+1)*es]
                namep, underp, fieldsp = struct.unpack_from('<3Q', e, 0)
                ver, size, traits = struct.unpack_from('<3I', e, 32)
                fields = []
                if fieldsp and fieldsp-1 < len(na):
                    fa = na[fieldsp-1]; fd = nread(fa)
                    fes = fa.size//max(fa.count,1)
                    for fi in range(fa.count):
                        fe = fd[fi*fes:(fi+1)*fes]
                        np_, tp_ = struct.unpack_from('<2Q', fe, 0)
                        fv, addr = struct.unpack_from('<2I', fe, 16)
                        fields.append((nstr(np_), nstr(tp_), fv, addr))
                out[nstr(namep)] = dict(name=nstr(namep), under=nstr(underp),
                                        fields=fields, version=ver, size=size, traits=traits)
        return out

if __name__ == '__main__':
    b = BLP(sys.argv[1])
    print(f"version={b.version} allocs={len(b.allocs)} root={b.strptr(1) if b.allocs else ''}")
    ts = b.types()
    filt = sys.argv[2] if len(sys.argv) > 2 else None
    for n, t in sorted(ts.items()):
        if filt and filt.lower() not in n.lower(): continue
        print(f"\n=== {n}  (v{t['version']} size={t['size']} traits=0x{t['traits']:x}) under={t['under']}")
        for f in t['fields']:
            print(f"    +{f[3]:<5} {f[0]:<32} : {f[1]}")
