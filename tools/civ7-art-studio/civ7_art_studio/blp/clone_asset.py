"""
Deep-clone an asset out of a shipped package into our own, optionally renaming it
and repointing its material.

Why cloning rather than authoring: a banner asset is 44 geometry records, 55 animation
records, 29 stateset records and a handful of components. We want every one of those
values identical to the shipped asset -- the only intended change is one material hash.
Hand-writing emitters for all of it would be a lot of code whose sole job is to
reproduce bytes we can simply copy.

How the pointer walk works: rather than hardcoding each struct's layout, pointer
offsets are derived from the package's own type registry. A field is an 8-byte
allocation pointer if its type is BLP::BLPPtr<...>, ptr64<...> or String::BasicT<...>;
a BLP::BLPVector<T> holds one at its start; and struct-typed fields are recursed into.
Each allocation records its own type, so the walk needs no type inference.

Renames are applied to string *contents* during the walk, and any allocation whose type
carries both m_Name and m_nNameHash gets its hash recomputed to match -- so blob and
asset names stay self-consistent without special-casing each type.

    python3 clone_asset.py <source.blp> <asset name> <out.blp> [--dry-run]
"""
import sys, os, struct, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blp import BLP
from bins import Reader
from build_blp import PackageBuilder, fnv1a32

PTR_PREFIXES = ('BLP::BLPPtr<', 'ptr64<', 'PackagePtr64<', 'String::BasicT<')
VECTOR_PREFIX = 'BLP::BLPVector<'
FUNDAMENTAL = {'uint8', 'uint16', 'uint32', 'uint64', 'int32', 'float', 'bool', 'char'}


class Cloner:
    def __init__(self, src_path, renames=None, material_map=None, builder=None):
        self.src = BLP(src_path)
        self.r = Reader(self.src)
        self.types = self.src.types()
        self.renames = renames or {}
        self.material_map = material_map or {}
        # Clone into an existing package when given one -- an art group ships a single
        # StandardAsset.blp, so the banner has to land in the same file as the bins,
        # improvements and wonders. Standalone (donor == source) is for testing.
        self.out = builder or PackageBuilder(src_path)
        self.map = {}                            # src alloc index -> new Alloc
        self.stats = {}

    def find(self, asset_name):
        for a in self.src.allocs:
            if not self.src.typename(a).startswith('PackageAssetEntry_'):
                continue
            if self.r.strat(self.src.raw(a), 40) == asset_name:
                return a
        return None

    # -- registry-driven pointer discovery ------------------------------------

    def _ptr_offsets(self, typename, _depth=0):
        """Byte offsets of 8-byte allocation pointers within one element."""
        if typename in FUNDAMENTAL or _depth > 6:
            return []
        if typename.startswith(PTR_PREFIXES):
            return [0]
        t = self.types.get(typename)
        if t is None:
            return []
        offs = []
        for fname, ftype, _ver, faddr in t['fields']:
            if ftype.startswith(VECTOR_PREFIX):
                offs.append(faddr)               # LinearBlock.pBlock sits at the start
            elif ftype.startswith(PTR_PREFIXES):
                offs.append(faddr)
            elif ftype in FUNDAMENTAL or ftype.endswith('*'):
                continue
            else:
                for sub in self._ptr_offsets(ftype, _depth + 1):
                    offs.append(faddr + sub)
        return sorted(set(offs))

    def _hash_fields(self, typename):
        """(name_offset, hash_offset) if the type carries m_Name + m_nNameHash."""
        t = self.types.get(typename)
        if not t:
            return None
        by = {f[0]: f[3] for f in t['fields']}
        if 'm_Name' in by and 'm_nNameHash' in by:
            return by['m_Name'], by['m_nNameHash']
        return None

    def _material_fields(self, typename):
        t = self.types.get(typename)
        if not t:
            return []
        return [f[3] for f in t['fields'] if f[0] in ('nMaterialHash', 'm_nMaterialHash')]

    # -- the walk -------------------------------------------------------------

    def clone(self, src_alloc):
        if src_alloc.index in self.map:
            return self.map[src_alloc.index]

        tn = self.src.typename(src_alloc)
        raw = bytearray(self.src.raw(src_alloc))
        count = max(src_alloc.count, 1)
        stride = len(raw) // count if count else len(raw)

        # Strings: apply renames by content, which also resizes the allocation.
        if tn == 'char':
            text = self.src.string(src_alloc)
            if text in self.renames:
                new = self.renames[text]
                body = new.encode('ascii')
                raw = bytearray(struct.pack('<2I', len(body) + 1, len(body)) + body + b'\0')
                self.stats.setdefault('renamed', []).append(f'{text} -> {new}')

        # For char allocations count == size, so a rename that changes the length must
        # update both; carrying the source count over yields an invalid allocation.
        count_out = len(raw) if tn == 'char' else src_alloc.count
        new = self.out._new(self.out.STRIPE_BLOCK, tn, count_out, len(raw))
        new.data = raw
        self.map[src_alloc.index] = new
        self.stats[tn] = self.stats.get(tn, 0) + 1

        # Data entries must be listed in the root m_BigDataEntries, and those with
        # flags bit 0x80 carry their payload inside the package rather than in
        # SHARED_DATA -- lift those bytes across too.
        if tn in ('BLP::BlobEntry', 'BLP::GpuBufferEntry',
                  'BLP::SoundBankEntry', 'BLP::TextureEntry'):
            self.out.bigdata.append(new)
            # Blob names are what a rename map has to cover: miss one and the clone
            # points at the original's file, so two assets share a buffer.
            try:
                blob_name = self.src.string(
                    self.src.ptr(struct.unpack_from('<Q', raw, 8)[0]))
                if blob_name:
                    self.stats.setdefault('blobs', []).append((blob_name, tn))
            except Exception:
                pass
            # Flags bit 0x02 means "payload is a SHARED_DATA file"; without it the
            # bytes live in the package's own bigdata region. Verified across 19,488
            # shipped entries with no counterexamples -- note 0x86 IS external, so
            # testing 0x80 alone wrongly catches GPU buffers.
            flags = struct.unpack_from('<I', raw, 44)[0]
            if not (flags & 0x02):
                off = struct.unpack_from('<Q', raw, 32)[0]
                size = struct.unpack_from('<I', raw, 40)[0]
                start = self.src.bigoff + off
                self.out.inline.append((new, bytes(self.src.data[start:start + size])))
                self.stats.setdefault('inline_blobs', []).append(
                    f'{self.src.string(self.src.ptr(struct.unpack_from("<Q", raw, 8)[0]))} ({size} bytes)')

        # Remap material hashes wherever the registry says they live.
        for moff in self._material_fields(tn):
            for i in range(count):
                o = i * stride + moff
                if o + 4 <= len(raw):
                    old = struct.unpack_from('<I', raw, o)[0]
                    # Record every hash seen, not just the remapped ones: "which
                    # materials does this asset use?" is the question you have to
                    # answer before you can decide what to remap it to.
                    if old:
                        self.stats.setdefault('material_hashes', set()).add(old)
                    if old in self.material_map:
                        struct.pack_into('<I', new.data, o, self.material_map[old])
                        self.stats.setdefault('material_patched', []).append(
                            f'{tn}[{i}] 0x{old:08X} -> 0x{self.material_map[old]:08X}')

        # Recurse through every pointer field.
        offs = self._ptr_offsets(tn)
        for i in range(count):
            for off in offs:
                o = i * stride + off
                if o + 8 > len(raw):
                    continue
                ptr = struct.unpack_from('<Q', raw, o)[0]
                target = self.src.ptr(ptr)
                if target is None:
                    continue
                struct.pack_into('<Q', new.data, o, 0)      # cleared; ptr_at rewrites it
                new.ptr_at(o, self.clone(target))
        return new

    def finish_names(self):
        """Recompute m_nNameHash on anything whose name string was renamed."""
        for src_idx, new in self.map.items():
            tn = new.typename
            hf = self._hash_fields(tn)
            if not hf:
                continue
            name_off, hash_off = hf
            for off, target in new.patches:
                if off != name_off:
                    continue
                txt = target.data[8:].split(b'\0')[0].decode('ascii', 'replace')
                if txt:
                    struct.pack_into('<I', new.data, hash_off, fnv1a32(txt))
        return self


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('source')
    ap.add_argument('asset')
    ap.add_argument('out')
    ap.add_argument('--rename', action='append', default=[],
                    help='OLD=NEW string replacement, repeatable')
    ap.add_argument('--material', action='append', default=[],
                    help='OLDNAME=NEWNAME material remap, repeatable')
    ap.add_argument('--asset-list', default=None,
                    help='also emit a ROOT_ASSETS_* AssetList registering the clone')
    ap.add_argument('--project', default='custom-art')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    renames = dict(x.split('=', 1) for x in args.rename)
    material_map = {}
    for m in args.material:
        old, new = m.split('=', 1)
        material_map[fnv1a32(old)] = fnv1a32(new)
        print(f'material remap 0x{fnv1a32(old):08X} ({old})\n'
              f'            -> 0x{fnv1a32(new):08X} ({new})')

    c = Cloner(args.source, renames, material_map)
    src_entry = c.find(args.asset)
    if src_entry is None:
        raise SystemExit(f'asset {args.asset!r} not found in {args.source}')

    new_entry = c.clone(src_entry)
    c.finish_names()

    new_name = renames.get(args.asset, args.asset)
    c.out.entries.append((new_name, new_entry))
    if args.asset_list:
        c.out.add_asset_list(args.asset_list, args.project, [new_name])

    print(f'\ncloned {args.asset!r} -> {new_name!r}')
    counts = {k: v for k, v in c.stats.items() if isinstance(v, int)}
    for k in sorted(counts, key=lambda k: -counts[k])[:14]:
        print(f'   {counts[k]:5}  {k}')
    print(f'   {sum(counts.values()):5}  TOTAL allocations cloned')
    for label in ('renamed', 'material_patched'):
        for line in c.stats.get(label, []):
            print(f'   {label}: {line}')

    if args.dry_run:
        print('\n(dry run, nothing written)')
        return
    data = c.out.build()
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, 'wb') as f:
        f.write(data)
    print(f'\nwrote {args.out}  ({len(data)} bytes, {len(c.out.allocs)} allocations)')


if __name__ == '__main__':
    main()


def clone_into(builder, src_path, asset, renames=None, material_map=None, verbose=True):
    """Clone `asset` from `src_path` into an existing PackageBuilder. Returns the new name."""
    c = Cloner(src_path, renames or {}, material_map or {}, builder=builder)
    entry = c.find(asset)
    if entry is None:
        raise SystemExit(f'asset {asset!r} not found in {src_path}')
    new_entry = c.clone(entry)
    c.finish_names()
    new_name = (renames or {}).get(asset, asset)
    builder.entries.append((new_name, new_entry))
    if verbose:
        n = sum(v for v in c.stats.values() if isinstance(v, int))
        print(f"  * cloned {asset} -> {new_name}  ({n} allocations)")
        for line in c.stats.get('material_patched', [])[:1]:
            hits = len(c.stats.get('material_patched', []))
            print(f"      material remapped on {hits} mesh/lod records")
    return new_name
