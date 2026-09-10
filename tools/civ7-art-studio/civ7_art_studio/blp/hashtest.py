"""Recover the name-hash function used by CIVBLP asset entries."""
import sys, struct, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blp import BLP

M32 = 0xFFFFFFFF

def fnv1a32(s, seed=0x811C9DC5):
    h = seed
    for c in s.encode(): h = ((h ^ c) * 0x01000193) & M32
    return h

def fnv1_32(s, seed=0x811C9DC5):
    h = seed
    for c in s.encode(): h = ((h * 0x01000193) & M32) ^ c
    return h

def fnv1a32_lower(s): return fnv1a32(s.lower())
def fnv1a32_upper(s): return fnv1a32(s.upper())

def djb2(s):
    h = 5381
    for c in s.encode(): h = ((h*33) + c) & M32
    return h

def djb2x(s):
    h = 5381
    for c in s.encode(): h = ((h*33) ^ c) & M32
    return h

def sdbm(s):
    h = 0
    for c in s.encode(): h = (c + (h<<6) + (h<<16) - h) & M32
    return h

_crc = []
def _mk():
    for i in range(256):
        c = i
        for _ in range(8): c = (c>>1) ^ (0xEDB88320 if c & 1 else 0)
        _crc.append(c)
_mk()
def crc32(s):
    h = 0xFFFFFFFF
    for c in s.encode(): h = _crc[(h ^ c) & 0xFF] ^ (h>>8)
    return h ^ 0xFFFFFFFF
def crc32_nofinal(s):
    h = 0xFFFFFFFF
    for c in s.encode(): h = _crc[(h ^ c) & 0xFF] ^ (h>>8)
    return h

CANDS = {
    'fnv1a32': fnv1a32, 'fnv1a32_lower': fnv1a32_lower, 'fnv1a32_upper': fnv1a32_upper,
    'fnv1_32': fnv1_32, 'fnv1_32_lower': lambda s: fnv1_32(s.lower()),
    'djb2': djb2, 'djb2_lower': lambda s: djb2(s.lower()),
    'djb2x': djb2x, 'sdbm': sdbm,
    'crc32': crc32, 'crc32_lower': lambda s: crc32(s.lower()),
    'crc32_nofinal': crc32_nofinal,
}

def collect(path):
    b = BLP(path)
    pairs = []
    for a in b.allocs:
        tn = b.typename(a)
        if not tn.startswith('PackageAssetEntry_'): continue
        buf = b.raw(a)
        p, = struct.unpack_from('<Q', buf, 40)
        pa = b.ptr(p)
        if not pa: continue
        name = b.string(pa)
        h, = struct.unpack_from('<I', buf, 48)
        if name: pairs.append((name, h))
    return pairs

if __name__ == '__main__':
    pairs = collect(sys.argv[1])
    print(f"{len(pairs)} (name, hash) pairs; samples:")
    for n, h in pairs[:5]: print(f"   {n:<45} 0x{h:08X}")
    print()
    for cn, fn in CANDS.items():
        ok = sum(1 for n, h in pairs if fn(n) == h)
        print(f"  {cn:<16} {ok}/{len(pairs)}" + ("   <<< MATCH" if ok == len(pairs) else ""))
