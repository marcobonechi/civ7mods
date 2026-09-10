"""
Search the installed game's art packages.

Every section of the app asks the user to name a shipped asset -- which bin to borrow,
which unit's members to copy, which attachment set a wonder uses. Those names exist
only inside binary packages, so without search the forms cannot be filled in at all,
and the answer to "what can I point at?" is a hex editor.

Scanning ~300 packages takes a while, so the index is built once and cached. It is
keyed on the set of package files and their sizes: a game patch changes those and the
index rebuilds, while ordinary use never pays for the scan twice.
"""
import os, json, glob, hashlib, time

from .tools import ensure_on_path

# Entry types worth offering. Assets are what a modder references by name; the rest of
# a package is structure they never name directly.
ASSET_PREFIX = 'PackageAssetEntry_'
# Materials are entries too, under their own prefix. They matter because a cloned mesh
# names its material by hash, and without the material names indexed there is no way to
# show which material an asset currently uses -- only an opaque 32-bit number.
MATERIAL_PREFIX = 'PackageMaterialEntry_'

# What each entry type is good for, in the app's vocabulary rather than the engine's.
ROLE = {
    'PackageAssetEntry_Bin0': 'bin',
    'PackageAssetEntry_BinModifier0': 'bin modifier',
    'PackageAssetEntry_Standard0': 'asset',
    'PackageAssetEntry_Metadata0': 'metadata',
    'PackageMaterialEntry_Standard': 'material',
    'PackageMaterialEntry_Aniso': 'material',
}


def packages(game_root):
    """Every readable .blp under the install, base and DLC."""
    found = []
    for pattern in (
        os.path.join(game_root, 'Base', 'Platforms', 'Windows', 'BLPs', '*.blp'),
        os.path.join(game_root, 'DLC', '*', 'Platforms', 'Windows', 'BLPs', '*.blp'),
    ):
        found += glob.glob(pattern)
    return sorted(found)


# Bumped whenever the shape of an index entry changes, so an existing cache is rebuilt
# rather than being served with fields the code now expects and it does not have. The
# file fingerprint alone will not catch that: the game has not changed, we have.
INDEX_SCHEMA = 4


def _fingerprint(paths):
    h = hashlib.sha256()
    h.update(f'schema={INDEX_SCHEMA};'.encode())
    for p in paths:
        try:
            h.update(f'{p}:{os.path.getsize(p)}'.encode())
        except OSError:
            continue
    return h.hexdigest()[:16]


def cache_path(game_root):
    root = os.environ.get('CIV7_ART_CACHE') or os.path.join(
        os.path.expanduser('~'), '.cache', 'civ7-art-studio')
    os.makedirs(root, exist_ok=True)
    return os.path.join(root, 'assets.json')


def build_index(game_root, progress=None):
    """
    {asset name: {'type', 'role', 'packages': [...]}} across the whole install.

    A name can appear in several packages -- that is normal, since bin modifiers in
    different DLCs extend the same bins -- so packages is a list rather than a single
    value.
    """
    ensure_on_path()
    from blp import BLP
    from bins import Reader

    paths = packages(game_root)
    index = {}
    textures = {}
    for i, path in enumerate(paths):
        if progress and i % 20 == 0:
            progress(i, len(paths), os.path.basename(path))
        try:
            b = BLP(path)
            r = Reader(b)
        except Exception:
            continue                      # not every .blp is a package we can parse
        rel = os.path.relpath(path, game_root)
        for a in b.allocs:
            tn = b.typename(a)
            if tn == 'BLP::TextureEntry':
                _record_texture(b, r, a, rel, textures)
                continue
            if not tn.startswith(ASSET_PREFIX) and not tn.startswith(MATERIAL_PREFIX):
                continue
            try:
                name = r.strat(b.raw(a), 40)
            except Exception:
                continue
            if not name:
                continue
            e = index.setdefault(name, {'type': tn, 'role': ROLE.get(tn, 'asset'),
                                        'packages': []})
            if rel not in e['packages']:
                e['packages'].append(rel)
            # Metadata assets all share one entry type but mean completely different
            # things -- UnitMetaData, AssetList, camera settings. Without the class
            # there is no way to offer just the units, and filtering on a UNIT_ prefix
            # instead pulls in 300-odd assets that merely start with it.
            if tn == 'PackageAssetEntry_Metadata0' and 'cls' not in e:
                try:
                    e['cls'] = r.strat(b.raw(a), 64)
                except Exception:
                    pass
    return {'fingerprint': _fingerprint(paths), 'built': time.time(),
            'game_root': game_root, 'assets': index, 'textures': textures}


def _record_texture(b, r, alloc, rel, out):
    """
    Every field of a shipped TextureEntry, because borrowing one means restating all
    of them.

    A material's texture slots are package-local pointers, so a shipped ORM or tint
    mask cannot be referenced across packages -- it has to be re-declared here and its
    blob copied. The entry is the blob's only description, so a single wrong field
    makes the loader read the wrong number of bytes.
    """
    buf = b.raw(alloc)
    try:
        name = r.strat(buf, 8)
    except Exception:
        return
    if not name or name in out:
        return
    # Only entries with flags bit 0x02 have their bytes in SHARED_DATA; the rest carry
    # their payload inside the package and cannot be copied as a file.
    flags = r.u32(buf, 44)
    out[name] = {
        'size': r.u32(buf, 40), 'flags': flags,
        'tex_class': r.strat(buf, 64),
        'fmt': r.u16(buf, 72), 'width': r.u16(buf, 76), 'height': r.u16(buf, 78),
        'mips': buf[84],
        'external': bool(flags & 0x02),
        'package': rel,
    }


def load_index(game_root, rebuild=False, progress=None):
    """Cached index, rebuilt when the install's package files have changed."""
    path = cache_path(game_root)
    paths = packages(game_root)
    want = _fingerprint(paths)

    if not rebuild and os.path.exists(path):
        try:
            with open(path) as f:
                cached = json.load(f)
            if cached.get('fingerprint') == want and cached.get('game_root') == game_root:
                return cached
        except Exception:
            pass                          # a corrupt cache is not worth reporting

    index = build_index(game_root, progress)
    tmp = path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(index, f)
    os.replace(tmp, path)
    return index


def search(index, query, limit=50, role=None, suffix=None):
    """
    Case-insensitive substring search, best matches first.

    Ranking puts exact matches, then prefix matches, then the rest -- typing
    "monument" should surface BIN_Monument_Scaled well before
    BIN_TER_Decal_Monument_Path_A.
    """
    q = (query or '').lower()
    assets = index['assets']
    hits = []
    for name, e in assets.items():
        if role and e['role'] != role:
            continue
        if suffix and not name.endswith(suffix):
            continue
        low = name.lower()
        if q and q not in low:
            continue
        rank = 0 if low == q else (1 if low.startswith(q) else 2)
        hits.append((rank, len(name), name, e))
    hits.sort(key=lambda h: (h[0], h[1], h[2]))
    return [{'name': n, **e} for _r, _l, n, e in hits[:limit]]


def describe(game_root, name, index=None):
    """
    Full detail for one asset: its type, components, and attachment targets.

    This is what makes the browser useful rather than a name list -- an attachment
    set's targets are the actual answer to "what does this asset pull in".
    """
    ensure_on_path()
    from blp import BLP
    from bins import Reader

    index = index or load_index(game_root)
    entry = index['assets'].get(name)
    if not entry:
        return None

    out = {'name': name, 'type': entry['type'], 'role': entry['role'],
           'packages': entry['packages'], 'components': [], 'attachments': [],
           'binEntries': []}

    path = os.path.join(game_root, entry['packages'][0])
    b = BLP(path)
    r = Reader(b)
    for a in b.allocs:
        if b.typename(a) != entry['type']:
            continue
        buf = b.raw(a)
        if r.strat(buf, 40) != name:
            continue
        for cb, co in r.vec(buf, 24, 'BLP::BLPPtr<BLP::ICollectionEntry>'):
            ca = b.ptr(r.p64(cb, co))
            if ca is None:
                continue
            tn = b.typename(ca)
            out['components'].append(tn)
            if tn == 'DirectAttachmentSet4':
                out['attachments'] = _attachments(b, r, ca, hash_map(index))
            elif tn == 'AssetPackage_BinEntryComponent2':
                out['binEntries'] = _bin_entries(b, r, ca)
        break
    return out


def hash_map(index):
    """
    name hash -> asset name, over everything indexed.

    Attachments name their target by FNV-1a hash rather than by string, so without
    this an attachment set reads as a list of anonymous points -- which is exactly the
    question the browser exists to answer. Cached on the index dict since it is only
    needed once the user opens an asset.
    """
    cached = index.get('_hashes')
    if cached is not None:
        return cached
    ensure_on_path()
    from build_blp import fnv1a32
    cached = {fnv1a32(name): name for name in index['assets']}
    index['_hashes'] = cached
    return cached


def _attachments(b, r, comp, hashes=None):
    """
    What an attachment set pulls in, and where it puts it.

    The records are inline in the set's vector at +16, not pointers -- attach.py
    already has the 72-byte field layout, so decode with that rather than a second
    copy of the offsets. The attachment's own name is the *point* (Road_CP_NE);
    the asset it pulls in is named only by hash, so it is resolved through the index.
    """
    import attach

    hashes = hashes or {}
    found = []
    for ab, ao in r.vec(b.raw(comp), 16, 'DirectAttachment4'):
        try:
            d = attach.attachment(r, ab, ao)
        except Exception:
            continue
        found.append({
            'point': d['name'],
            'target': hashes.get(d['assetHash'], f"0x{d['assetHash']:08X}"),
            'targetResolved': d['assetHash'] in hashes,
            'position': [round(v, 4) for v in d['position']],
            'rotation': [round(v, 6) for v in d['rotation']],
            'scale': round(d['scale'], 4),
            'placement': d['placement'],
        })
    return found


# BLP::ValueType -> the manifest's spec kind. The emitter's VT table is the same map
# in the other direction, so a value read here re-emits as the bytes it came from.
_VALUE_KIND = {0: 'float', 1: 'int', 2: 'bool', 4: 'string', 6: 'coord2d',
               7: 'coord3d', 8: 'entry', 10: 'collection', 12: 'tuple'}


def read_metadata(game_root, name, index=None):
    """
    Decode a shipped metadata asset into the manifest's `params` tree.

    This is what makes "copy a shipped unit" possible without anyone typing thirteen
    movement floats. The tree it returns is the exact shape build_blp._value consumes,
    so a decoded asset re-emits as the same bytes -- which also makes it checkable, and
    test_units asserts precisely that.
    """
    import struct
    ensure_on_path()
    from blp import BLP
    from bins import Reader
    import meta

    index = index or load_index(game_root)
    entry = index['assets'].get(name)
    if not entry or entry['type'] != 'PackageAssetEntry_Metadata0':
        return None

    b = BLP(os.path.join(game_root, entry['packages'][0]))
    r = Reader(b)

    def value(ptr, depth=0):
        """(param, spec) for one BLP::Value, or None if it is a type we cannot emit."""
        a = b.ptr(ptr)
        if a is None or depth > 6:
            return None
        buf = b.raw(a)
        vt = r.u32(buf, 8)
        param = meta.pstr(b, r, buf, 16)
        kind = _VALUE_KIND.get(vt)
        if kind is None:
            # Never drop a value silently. A ValueSet missing a parameter is not a
            # simpler asset, it is a malformed one -- coord3d was omitted this way and
            # produced units that loaded and then crashed the game on map entry.
            raise ValueError(
                f'{name}: parameter {param!r} has value type {vt}, which this decoder '
                f'cannot reproduce. Copying it would silently drop the parameter.')
        if kind == 'float':
            return [param, [kind, struct.unpack_from('<f', buf, 24)[0]]]
        if kind in ('int', 'bool'):
            return [param, [kind, r.u32(buf, 24)]]
        if kind in ('coord3d', 'coord2d'):
            n = 3 if kind == 'coord3d' else 2
            return [param, [kind, list(struct.unpack_from(f'<{n}f', buf, 24))]]
        if kind == 'string':
            return [param, [kind, meta.pstr(b, r, buf, 24)]]
        if kind == 'entry':
            return [param, [kind, {
                'library': meta.pstr(b, r, buf, 24),
                'xlpClass': meta.pstr(b, r, buf, 32),
                'entry': meta.pstr(b, r, buf, 40),
                'package': meta.pstr(b, r, buf, 48)}]]
        if kind == 'tuple':
            kids = [value(r.p64(eb, eo), depth + 1)
                    for eb, eo in r.vec(buf, 24, 'BLP::BLPPtr<BLP::Value>')]
            return [param, [kind, [k for k in kids if k]]]
        # collection: the element type lives at +24 and must be carried through, since
        # the emitter writes it back into m_eValueType.
        elem = _VALUE_KIND.get(r.u32(buf, 24), 'tuple')
        kids = [value(r.p64(eb, eo), depth + 1)
                for eb, eo in r.vec(buf, 32, 'BLP::BLPPtr<BLP::Value>')]
        return [param, [kind, elem, [k for k in kids if k]]]

    for a in b.allocs:
        if b.typename(a) != 'PackageAssetEntry_Metadata0':
            continue
        buf = b.raw(a)
        if r.strat(buf, 40) != name:
            continue
        vs = b.ptr(r.p64(buf, 56))
        params = []
        if vs:
            params = [value(r.p64(eb, eo)) for eb, eo
                      in r.vec(b.raw(vs), 0, 'BLP::BLPPtr<BLP::Value>')]

        # Components sit alongside the ValueSet and are just as much part of the asset.
        # A unit's Sound_SwitchComponent1 carries its Wwise switch state; 154 of the
        # 236 shipped units have one, and copying an asset without it leaves the copy
        # differing from every shipped equivalent.
        switches = []
        for cb, co in r.vec(buf, 24, 'BLP::BLPPtr<BLP::ICollectionEntry>'):
            ca = b.ptr(r.p64(cb, co))
            if ca is None or b.typename(ca) != 'Sound_SwitchComponent1':
                continue
            for eb, eo in r.vec(b.raw(ca), 8, 'BLP::BLPPtr<Sound_SwitchComponent0>'):
                sa = b.ptr(r.p64(eb, eo))
                if sa is not None:
                    sw = b.raw(sa)
                    switches.append([r.u32(sw, 8), r.u32(sw, 12)])

        return {'name': name, 'cls': r.strat(buf, 64),
                'params': [p for p in params if p],
                'soundSwitches': switches,
                'package': entry['packages'][0]}
    return None


def _bin_entries(b, r, comp):
    """The (asset, expression, priority, weight) rows inside a bin."""
    rows = []
    try:
        for entry in r.bin_entry(b, comp):
            rows.append(entry)
    except Exception:
        pass
    return rows
