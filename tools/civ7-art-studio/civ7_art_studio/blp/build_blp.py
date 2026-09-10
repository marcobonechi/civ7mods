"""
Build a CIVBLP StandardAsset package from a manifest.

Emits bin modifiers (building art), bins, region-pattern assets (improvements and
wonders), asset lists, textures, materials, static meshes and their wrappers,
soundbank entries, metadata assets (units, audio event lists), and deep clones of
shipped assets.

A bin modifier appends entries to a bin that already exists in another loaded
package (e.g. the base game's BIN_Hero_Building_Footprint) without replacing it.
That is the mechanism every civ DLC uses to register its building art, so it
stacks: many packages can modify the same bin.

The type registry (typeInfo stripe) is copied verbatim from a donor package. It is a
self-contained nested package describing every serialised type; declaring more types
than we use is harmless, but declaring fewer is fatal, so let donors.py choose one
rather than hardcoding it -- the donor a build needs is a function of what the
manifest contains, and grows as features are added.

Content lives in a manifest dict (see default_project / civart.json), not in this
file, so a GUI can author packages without generating Python.

Usage:
    python3 build_blp.py <donor.blp> <out.blp> [--project civart.json]
"""
import struct, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blp import BLP

try:
    from skins import SKIN_ENTRIES
except ImportError:
    # Generated from an installed game by gen_skins.py, so a fresh install legitimately
    # has none: the skin library is a feature you turn on by scanning, not a
    # prerequisite for building anything. Failing here made the whole package
    # unimportable, which is far too strong a reaction to an optional table.
    SKIN_ENTRIES = []

M32 = 0xFFFFFFFF

STRING_T = ('String::BasicT<Serialization::StaticPackageAllocator'
            '<StandardFallbackAllocator>, String::ASCII>')

def fnv1a32(s):
    """Case-sensitive FNV-1a 32. Verified against 99/99 name/hash pairs in shipped packages."""
    h = 0x811C9DC5
    for c in s.encode('ascii'):
        h = ((h ^ c) * 0x01000193) & M32
    return h


def align(n, a=16):
    return (n + a - 1) & ~(a - 1)


class Alloc:
    """One entry in the package allocation table."""
    def __init__(self, stripe, typename, count, size):
        self.stripe = stripe
        self.typename = typename      # str, resolved to a type-name alloc later
        self.count = count
        self.data = bytearray(size)
        self.polymorphic = False
        self.index = -1
        self.offset = 0
        self.patches = []             # (byte offset, target Alloc) -> u64 alloc pointer

    def ptr_at(self, off, target):
        self.patches.append((off, target))

    @property
    def size(self):
        return len(self.data)


class PackageBuilder:
    STRIPE_BLOCK = 0    # packageBlock  -- asset data
    STRIPE_TEMP  = 1    # tempData      -- root object, type-name strings, alloc table

    def __init__(self, donor_path):
        donor = BLP(donor_path)
        self.donor = donor
        ti_off, ti_size = donor.stripes[3]
        self.typeinfo = donor.data[donor.pkgoff + ti_off: donor.pkgoff + ti_off + ti_size]
        self.types = donor.types()

        self.allocs = []
        self._typename_allocs = {}    # typename str -> Alloc (stripe 1)
        self._strings = {}            # string value -> Alloc (stripe 0)
        self._bstrings = {}           # string value -> String::BasicT Alloc (stripe 0)
        self.entries = []             # (name, Alloc) for the EntryMap
        self.bigdata = []             # data-entry allocs, for root m_BigDataEntries
        self.inline = []              # (alloc, payload) for blobs stored in-package

        # alloc #0 is the EntryMap; created empty and filled in build()
        self.entrymap = self._new(self.STRIPE_BLOCK, 'BLP::Package::EntryMap', 0, 0)

    # -- allocation helpers ---------------------------------------------------

    def _new(self, stripe, typename, count, size):
        a = Alloc(stripe, typename, count, size)
        t = self.types.get(typename)
        if t is None:
            raise KeyError(f"donor package does not declare type {typename!r}")
        a.polymorphic = bool(t['traits'] & 0x10)
        self.allocs.append(a)
        return a

    def typename_alloc(self, name):
        """Type-name strings live in tempData as raw NUL-terminated bytes, deduped."""
        a = self._typename_allocs.get(name)
        if a is None:
            raw = name.encode('ascii') + b'\0'
            a = Alloc(self.STRIPE_TEMP, 'char', len(raw), len(raw))
            a.data = bytearray(raw)
            self.allocs.append(a)
            self._typename_allocs[name] = a
        return a

    def opt_ptr(self, alloc, off, s):
        """
        Set a string pointer, or leave it null when the string is empty.

        The game encodes an absent asset name / expression as a null pointer, not as
        a pointer to a zero-length string. Emitting the latter makes an "always match"
        entry read back as the literal '\\x01' (the length header interpreted as text).
        """
        if s:
            alloc.ptr_at(off, self.string(s))

    def string(self, s):
        """Data strings live in packageBlock with a {len+1, len} u32 header, deduped."""
        a = self._strings.get(s)
        if a is None:
            raw = s.encode('ascii')
            buf = struct.pack('<2I', len(raw) + 1, len(raw)) + raw + b'\0'
            a = Alloc(self.STRIPE_BLOCK, 'char', len(buf), len(buf))
            a.data = bytearray(buf)
            self.allocs.append(a)
            self._strings[s] = a
        return a

    def bstr(self, s):
        """
        A BLP::BLPPtr<String::BasicT<...>> target: two hops.

        Fields typed BLPPtr<String> point at an 8-byte String::BasicT allocation which
        in turn points at the char data. Fields typed String::BasicT inline (bin entry
        asset names, m_Name, m_pMetaDataClassName) are one hop and use string() instead.
        """
        a = self._bstrings.get(s)
        if a is None:
            a = self._new(self.STRIPE_BLOCK, STRING_T, 1, 8)
            a.ptr_at(0, self.string(s))
            self._bstrings[s] = a
        return a

    # -- asset construction ---------------------------------------------------

    def add_bin_modifier(self, name, target_bin, added_entries):
        """
        added_entries: list of (asset_name, expression, priority, weight)
        Appends `added_entries` to the bin named `target_bin` in whichever
        package defines it.
        """
        entries = self._new(self.STRIPE_BLOCK, 'AssetPackage_BinEntry2',
                            len(added_entries), 32 * len(added_entries))
        for i, (asset, expr, priority, weight) in enumerate(added_entries):
            o = i * 32
            struct.pack_into('<f', entries.data, o + 0, weight)
            struct.pack_into('<I', entries.data, o + 4, priority)
            struct.pack_into('<I', entries.data, o + 8, fnv1a32(asset))
            self.opt_ptr(entries, o + 16, asset)
            self.opt_ptr(entries, o + 24, expr)

        comp = self._new(self.STRIPE_BLOCK, 'AssetPackage_BinModiferComponent0', 1, 56)
        struct.pack_into('<I', comp.data, 8, fnv1a32(target_bin))
        comp.ptr_at(16, self.string(target_bin))
        comp.ptr_at(24, entries)                                  # m_addEntries.pBlock
        struct.pack_into('<2I', comp.data, 32, len(added_entries), len(added_entries))
        # m_removeEntries (+40..56) stays zeroed

        coll = self._new(self.STRIPE_BLOCK, 'BLP::BLPPtr<BLP::ICollectionEntry>', 1, 8)
        coll.ptr_at(0, comp)

        entry = self._new(self.STRIPE_BLOCK, 'PackageAssetEntry_BinModifier0', 1, 56)
        entry.ptr_at(24, coll)                                    # m_kExtensibleCollection.m_Data.pBlock
        struct.pack_into('<2I', entry.data, 32, 1, 1)
        entry.ptr_at(40, self.string(name))
        struct.pack_into('<I', entry.data, 48, fnv1a32(name))

        self.entries.append((name, entry))
        return entry

    def add_bin(self, name, added_entries, fallback='', average_scale=1.0):
        """
        Create a new bin (not a modifier). Improvements resolve their art by asset
        name rather than through a tag dispatch table, so an improvement is given
        art by creating a bin named exactly its ConstructibleType.

        added_entries: list of (asset_name, expression, priority, weight)
        """
        ents = self._new(self.STRIPE_BLOCK, 'AssetPackage_BinEntry2',
                         len(added_entries), 32 * len(added_entries))
        for i, (asset, expr, priority, weight) in enumerate(added_entries):
            o = i * 32
            struct.pack_into('<f', ents.data, o + 0, weight)
            struct.pack_into('<I', ents.data, o + 4, priority)
            struct.pack_into('<I', ents.data, o + 8, fnv1a32(asset))
            self.opt_ptr(ents, o + 16, asset)
            self.opt_ptr(ents, o + 24, expr)

        comp = self._new(self.STRIPE_BLOCK, 'AssetPackage_BinEntryComponent2', 1, 88)
        if fallback:
            struct.pack_into('<I', comp.data, 8, fnv1a32(fallback))
            comp.ptr_at(16, self.string(fallback))
        comp.ptr_at(24, ents)                                     # m_entries.pBlock
        struct.pack_into('<2I', comp.data, 32, len(added_entries), len(added_entries))
        # exclusiveEntry (+40..72) and m_bUseRandomZRotationIfAttachment (+72) stay zero
        struct.pack_into('<f', comp.data, 76, average_scale)       # m_fAverageScaleIfAttachment
        # m_fScaleRangeIfAttachment (+80) stays 0.0

        coll = self._new(self.STRIPE_BLOCK, 'BLP::BLPPtr<BLP::ICollectionEntry>', 1, 8)
        coll.ptr_at(0, comp)

        entry = self._new(self.STRIPE_BLOCK, 'PackageAssetEntry_Bin0', 1, 56)
        entry.ptr_at(24, coll)
        struct.pack_into('<2I', entry.data, 32, 1, 1)
        entry.ptr_at(40, self.string(name))
        struct.pack_into('<I', entry.data, 48, fnv1a32(name))

        self.entries.append((name, entry))
        return entry


    def add_region_asset(self, asset_name, expression, attachments,
                         priority=3, rotation=63, hexes=None,
                         hex0_flags=1, base_layer=None):
        """
        Emit a region-pattern art asset. Improvements and wonders share this shape.

        Neither is reached through a bin dispatch. The engine loads every asset
        registered in the matching ROOT_ASSETS_* AssetList and matches each to a plot
        via its region pattern, so identity comes from the pattern expression and the
        asset name is arbitrary.

        `expression` is the full hex[0] tag, '[IMPROVEMENT:X]' or '[WONDER:X]'.
        `hexes` is {slot: (flags, expression)} for slots 1..6.

        The two differ in details taken from shipped assets:
          improvement  hex0_flags=1  rotation=63  no base layer
          wonder       hex0_flags=0  rotation=1   base_layer='TER_EDIT_Flatten_Hex'
        """
        n = len(attachments)
        atts = self._new(self.STRIPE_BLOCK, 'DirectAttachment4', n, 72 * n)
        for i, (att_name, target, rot_z) in enumerate(attachments):
            o = i * 72
            atts.ptr_at(o + 0, self.string(att_name))               # kBase.name
            struct.pack_into('<f', atts.data, o + 32, rot_z)        # kBase.rotation.z
            struct.pack_into('<f', atts.data, o + 36, 1.0)          # kBase.scale
            unique = f'{asset_name}_DirectAttachment_{att_name}'
            atts.ptr_at(o + 40, self.string(unique))
            struct.pack_into('<I', atts.data, o + 48, fnv1a32(unique))
            struct.pack_into('<I', atts.data, o + 52, fnv1a32(target))   # nAssetNameHash

        aset = self._new(self.STRIPE_BLOCK, 'DirectAttachmentSet4', 1, 32)
        aset.ptr_at(8, self.string('DirectAttachment'))             # m_classname
        aset.ptr_at(16, atts)
        struct.pack_into('<2I', aset.data, 24, n, n)

        rp = self._new(self.STRIPE_BLOCK, 'AssetPackage_RegionPatternComponent0', 1, 136)
        struct.pack_into('<I', rp.data, 12, priority)
        struct.pack_into('<I', rp.data, 16, rotation)
        pattern = {0: (hex0_flags, expression)}
        pattern.update(hexes or {})
        for slot, (flags, expr) in pattern.items():
            o = 24 + slot * 16                                      # HexPattern0[7], 16 each
            struct.pack_into('<I', rp.data, o, flags)
            self.opt_ptr(rp, o + 8, expr)

        comps = [aset, rp]
        if base_layer:
            # Flattens the terrain under the footprint. Wonders carry it; the
            # improvements examined do not.
            bl = self._new(self.STRIPE_BLOCK, 'AssetPackage_LayoutBaseLayerComponent0', 1, 24)
            bl.ptr_at(8, self.string(base_layer))
            struct.pack_into('<I', bl.data, 16, fnv1a32(base_layer))
            comps.append(bl)

        coll = self._new(self.STRIPE_BLOCK, 'BLP::BLPPtr<BLP::ICollectionEntry>',
                         len(comps), 8 * len(comps))
        for i, c in enumerate(comps):
            coll.ptr_at(i * 8, c)

        entry = self._new(self.STRIPE_BLOCK, 'PackageAssetEntry_Standard0', 1, 64)
        entry.ptr_at(24, coll)
        struct.pack_into('<2I', entry.data, 32, len(comps), len(comps))
        entry.ptr_at(40, self.string(asset_name))
        struct.pack_into('<I', entry.data, 48, fnv1a32(asset_name))
        self.entries.append((asset_name, entry))
        return entry

    def add_asset_list(self, name, project, asset_names, package='StandardAsset.blp'):
        """
        Emit a ROOT_ASSETS_* registration list (PackageAssetEntry_Metadata0, class
        AssetList). Without this the engine never loads the assets at all.
        """
        vals = []
        for i, a in enumerate(asset_names):
            v = self._new(self.STRIPE_BLOCK, 'BLP::BLPEntryValue', 1, 64)
            struct.pack_into('<I', v.data, 8, 8)                    # ValueType BLP_ENTRY
            v.ptr_at(16, self.bstr(f'Assets{i + 1:03d}'))           # m_pParamName
            v.ptr_at(40, self.bstr(a))                              # m_pEntryName
            v.ptr_at(48, self.bstr(package))                        # m_pBLPPackage
            vals.append(v)

        arr = self._new(self.STRIPE_BLOCK, 'BLP::BLPPtr<BLP::Value>', len(vals), 8 * len(vals))
        for i, v in enumerate(vals):
            arr.ptr_at(i * 8, v)

        coll = self._new(self.STRIPE_BLOCK, 'BLP::CollectionValue', 1, 48)
        struct.pack_into('<I', coll.data, 8, 10)                    # ValueType COLLECTION
        coll.ptr_at(16, self.bstr('Assets'))
        struct.pack_into('<I', coll.data, 24, 8)                    # m_eValueType BLP_ENTRY
        coll.ptr_at(32, arr)
        struct.pack_into('<2I', coll.data, 40, len(vals), len(vals))

        proj = self._new(self.STRIPE_BLOCK, 'BLP::StringValue', 1, 32)
        struct.pack_into('<I', proj.data, 8, 4)                     # ValueType STRING
        proj.ptr_at(16, self.bstr('Project'))
        proj.ptr_at(24, self.bstr(project))

        top = self._new(self.STRIPE_BLOCK, 'BLP::BLPPtr<BLP::Value>', 2, 16)
        top.ptr_at(0, coll)
        top.ptr_at(8, proj)

        vs = self._new(self.STRIPE_BLOCK, 'BLP::ValueSet', 1, 16)
        vs.ptr_at(0, top)
        struct.pack_into('<2I', vs.data, 8, 2, 2)

        entry = self._new(self.STRIPE_BLOCK, 'PackageAssetEntry_Metadata0', 1, 72)
        entry.ptr_at(40, self.string(name))
        struct.pack_into('<I', entry.data, 48, fnv1a32(name))
        entry.ptr_at(56, vs)                                        # m_pValueSet
        entry.ptr_at(64, self.string('AssetList'))                  # inline String::BasicT
        self.entries.append((name, entry))
        return entry


    def add_texture(self, ui_name, size, width, height, mips,
                    fmt=98, tex_class='UITexture', flags=0x92, offset=16,
                    depth=1, array_size=1, swizzle=0, tex_type=0, dropped_mips=0,
                    ui_entry=True):
        """
        Emit a UI texture: a BLP::TextureEntry holding the metadata plus a
        UIPackageEntry_Texture that names it for the UI.

        The pixel data is NOT in the package. It lives in
        Platforms/<OS>/BLPs/SHARED_DATA/TEXTURE_<ui_name>, a CIVBIG file whose header
        is magic(8) + size(4) + flags(4) with the payload at byte 16 -- hence the
        default offset. That header carries no name or hash, so the blob is a pure
        byte copy; only the filename ties it to this entry.

        TextureEntry extends BigDataEntry (identical field prefix), so it is also
        registered in the package's m_BigDataEntries.
        """
        tex_name = 'TEXTURE_' + ui_name

        tex = self._new(self.STRIPE_BLOCK, 'BLP::TextureEntry', 1, 88)
        tex.ptr_at(8, self.string(tex_name))                        # m_Name
        struct.pack_into('<Q', tex.data, 32, offset)                # m_nOffset
        struct.pack_into('<I', tex.data, 40, size)                  # m_nSize
        struct.pack_into('<I', tex.data, 44, flags)                 # m_mFlags
        struct.pack_into('<I', tex.data, 48, fnv1a32(tex_name))     # m_nNameHash
        tex.ptr_at(64, self.string(tex_class))                      # m_TextureClass
        struct.pack_into('<6H', tex.data, 72,
                         fmt, swizzle, width, height, depth, array_size)
        tex.data[84] = mips
        tex.data[85] = tex_type
        tex.data[86] = dropped_mips
        self.bigdata.append(tex)

        if not ui_entry:
            # Material textures are reached by allocation pointer from the material
            # and are not named in the EntryMap -- heian's Material.blp has no
            # UIPackageEntry_Texture at all.
            return tex

        entry = self._new(self.STRIPE_BLOCK, 'UIPackageEntry_Texture', 1, 64)
        entry.ptr_at(40, self.string(ui_name))
        struct.pack_into('<I', entry.data, 48, fnv1a32(ui_name))
        entry.ptr_at(56, tex)                                       # m_pTexture
        self.entries.append((ui_name, entry))
        return entry

    # Slot offsets in MaterialDesc_Aniso0
    MATERIAL_SLOTS = {
        'base_color':   32, 'normal':      40, 'orm':          48, 'anisotropy':  56,
        'aniso_dir':    64, 'opacity':     72, 'translucency': 80, 'tints':       88,
    }

    def add_material(self, name, slots, tint_mode=28,
                     uv_tint=(0x808080, 0xFFFFFFFF, 0x808080, 0xFFFFFFFF),
                     tint1='Team1', tint2='Team2'):
        """
        Emit a PackageMaterialEntry_Aniso.

        `slots` maps names from MATERIAL_SLOTS to TextureEntry allocs (from
        add_texture(..., ui_entry=False)). Unset slots stay null, as Opacity and
        Translucency are on the shipped banner materials.

        Note the texture references are BLPPtr<BLP::TextureEntry> -- allocation
        pointers, package-local -- so every texture a material uses must live in the
        same Material.blp. Materials themselves are reached by name hash
        (AssetPackage_Geometry_Mesh2.nMaterialHash), so they DO resolve across
        packages, which is what lets a mesh elsewhere bind to this one.
        """
        desc = self._new(self.STRIPE_BLOCK, 'MaterialDesc_Aniso0', 1, 96)
        struct.pack_into('<I', desc.data, 8, tint_mode)
        struct.pack_into('<4I', desc.data, 12, *uv_tint)
        for slot, tex in slots.items():
            if tex is not None:
                desc.ptr_at(self.MATERIAL_SLOTS[slot], tex)

        tints = self._new(self.STRIPE_BLOCK, 'MaterialDesc_TintParams0', 1, 32)
        tints.ptr_at(8, self.string(tint1))
        tints.ptr_at(16, self.string(tint2))
        struct.pack_into('<I', tints.data, 24, fnv1a32(tint1))
        struct.pack_into('<I', tints.data, 28, fnv1a32(tint2))

        coll = self._new(self.STRIPE_BLOCK, 'BLP::BLPPtr<BLP::ICollectionEntry>', 2, 16)
        coll.ptr_at(0, desc)
        coll.ptr_at(8, tints)

        entry = self._new(self.STRIPE_BLOCK, 'PackageMaterialEntry_Aniso', 1, 56)
        entry.ptr_at(24, coll)
        struct.pack_into('<2I', entry.data, 32, 2, 2)
        entry.ptr_at(40, self.string(name))
        struct.pack_into('<I', entry.data, 48, fnv1a32(name))
        self.entries.append((name, entry))
        return entry


    def add_static_mesh(self, asset, buffer, buffer_size, vertex_offset,
                        index_start, primitive_count, min_index, max_index, bounds,
                        material='', vertex_stride=20, components=0x0009, compression=1,
                        index_stride=4, mesh_flags=0x2,
                        geometry_diameter_pixels=0.0,
                        lod_diameter_pixels=-3.4028234663852886e+38):
        """
        Emit a static mesh: one GpuBufferEntry plus a GeometryComponent6 holding a
        single Geometry / Mesh / Lod. Modelled on IMP_Jinja_BldB, which has no
        skeleton, deformers or animation.

        `material` may be left empty -- an unresolved material hash renders white,
        which is exactly what a first geometry test wants.

        LOD selection lives on Geometry2.fDiameterPixels: it is the minimum on-screen
        diameter in pixels for which that geometry is eligible. IMP_Jinja_BldB has two
        Geometry2 records -- a detailed one at 220 and a simplified fallback at 0 --
        so zooming out past 220px switches to the simpler mesh. A single-LOD asset
        must therefore use 0, or it disappears as soon as it is small on screen.

        Lod5.fDiameterPixels is a different thing and is -FLT_MAX on nearly every
        shipped mesh; putting the threshold there instead does nothing useful.
        """
        gb = self._new(self.STRIPE_BLOCK, 'BLP::GpuBufferEntry', 1, 88)
        gb.ptr_at(8, self.string(buffer))
        struct.pack_into('<Q', gb.data, 32, 16)                  # payload starts past CIVBIG header
        struct.pack_into('<I', gb.data, 40, buffer_size)
        struct.pack_into('<I', gb.data, 44, 0x86)                # external (bit 0x02) GPU buffer
        struct.pack_into('<I', gb.data, 48, fnv1a32(buffer))
        struct.pack_into('<2I', gb.data, 64, 1, buffer_size)     # bytesPerElement, elementCount
        self.bigdata.append(gb)

        mat_hash = fnv1a32(material) if material else 0
        lod = self._new(self.STRIPE_BLOCK, 'AssetPackage_Geometry_Mesh_Lod5', 1, 56)
        lod.ptr_at(0, gb)                                        # pVB
        lod.ptr_at(8, gb)                                        # pIB -- one shared buffer
        struct.pack_into('<I', lod.data, 16, mat_hash)
        struct.pack_into('<I', lod.data, 20, vertex_offset)      # BYTE offset
        struct.pack_into('<H', lod.data, 24, vertex_stride)
        lod.data[27] = compression
        struct.pack_into('<I', lod.data, 28, primitive_count)
        struct.pack_into('<2I', lod.data, 32, min_index, max_index)
        struct.pack_into('<I', lod.data, 40, index_start)        # ELEMENT offset
        struct.pack_into('<H', lod.data, 44, index_stride)
        struct.pack_into('<H', lod.data, 46, components)
        struct.pack_into('<2f', lod.data, 48, lod_diameter_pixels, 1.0)

        mesh = self._new(self.STRIPE_BLOCK, 'AssetPackage_Geometry_Mesh2', 1, 88)
        struct.pack_into('<6f', mesh.data, 0, *bounds)           # kRange
        struct.pack_into('<6f', mesh.data, 24, *bounds)          # kCuller
        struct.pack_into('<I', mesh.data, 48, fnv1a32(asset))
        struct.pack_into('<I', mesh.data, 52, mat_hash)
        struct.pack_into('<2I', mesh.data, 68, 0, 1)             # nLodStart, nLodCount
        struct.pack_into('<I', mesh.data, 76, 65535)             # nSkeleton: none
        struct.pack_into('<I', mesh.data, 84, mesh_flags)

        geom = self._new(self.STRIPE_BLOCK, 'AssetPackage_Geometry2', 1, 24)
        struct.pack_into('<2I', geom.data, 0, fnv1a32(asset), fnv1a32(asset))
        struct.pack_into('<2I', geom.data, 8, 0, 1)              # nMeshStart, nMeshCount
        struct.pack_into('<I', geom.data, 16, 0)                 # nLod
        struct.pack_into('<f', geom.data, 20, geometry_diameter_pixels)

        comp = self._new(self.STRIPE_BLOCK, 'AssetPackage_GeometryComponent6', 1, 136)
        comp.ptr_at(8, geom);  struct.pack_into('<2I', comp.data, 16, 1, 1)
        comp.ptr_at(24, mesh); struct.pack_into('<2I', comp.data, 32, 1, 1)
        comp.ptr_at(40, lod);  struct.pack_into('<2I', comp.data, 48, 1, 1)
        struct.pack_into('<6f', comp.data, 104, *bounds)         # m_Range
        struct.pack_into('<I', comp.data, 128, 1)                # m_nGeometry

        coll = self._new(self.STRIPE_BLOCK, 'BLP::BLPPtr<BLP::ICollectionEntry>', 1, 8)
        coll.ptr_at(0, comp)

        entry = self._new(self.STRIPE_BLOCK, 'PackageAssetEntry_Standard0', 1, 64)
        entry.ptr_at(24, coll)
        struct.pack_into('<2I', entry.data, 32, 1, 1)
        entry.ptr_at(40, self.string(asset))
        struct.pack_into('<I', entry.data, 48, fnv1a32(asset))
        self.entries.append((asset, entry))
        return entry


    def add_attachment_asset(self, name, attachments, scale=1.0):
        """
        A wrapper asset: PackageAssetEntry_Standard0 whose only component is a
        DirectAttachmentSet4 pointing at other assets by name hash.

        This is the shape every BIN_X_Scaled footprint target has -- the building
        dispatch resolves to a wrapper, which attaches the real geometry. A bare
        geometry asset renders fine through WorldUI but does not appear when reached
        through the footprint bin, so the wrapper is not optional there.
        """
        n = len(attachments)
        atts = self._new(self.STRIPE_BLOCK, 'DirectAttachment4', n, 72 * n)
        for i, (att_name, target, rot_z) in enumerate(attachments):
            o = i * 72
            atts.ptr_at(o + 0, self.string(att_name))
            struct.pack_into('<f', atts.data, o + 32, rot_z)
            struct.pack_into('<f', atts.data, o + 36, scale)
            unique = f'{name}_DirectAttachment_{att_name}'
            atts.ptr_at(o + 40, self.string(unique))
            struct.pack_into('<I', atts.data, o + 48, fnv1a32(unique))
            struct.pack_into('<I', atts.data, o + 52, fnv1a32(target))

        aset = self._new(self.STRIPE_BLOCK, 'DirectAttachmentSet4', 1, 32)
        aset.ptr_at(8, self.string('DirectAttachment'))
        aset.ptr_at(16, atts)
        struct.pack_into('<2I', aset.data, 24, n, n)

        coll = self._new(self.STRIPE_BLOCK, 'BLP::BLPPtr<BLP::ICollectionEntry>', 1, 8)
        coll.ptr_at(0, aset)

        entry = self._new(self.STRIPE_BLOCK, 'PackageAssetEntry_Standard0', 1, 64)
        entry.ptr_at(24, coll)
        struct.pack_into('<2I', entry.data, 32, 1, 1)
        entry.ptr_at(40, self.string(name))
        struct.pack_into('<I', entry.data, 48, fnv1a32(name))
        self.entries.append((name, entry))
        return entry


    # Slot offsets in MaterialDesc_Standard2
    STANDARD_SLOTS = {
        'base_color': 40, 'emissive': 48, 'emissive_ramp': 56, 'normal': 64,
        'orm': 72, 'opacity': 80, 'opacity2': 88, 'tints': 96, 'translucency': 104,
    }

    def add_material_standard(self, name, slots, tint_mode=8, emissive_strength=1.0,
                              uv_tint=(0x808080, 0xFFFFFFFF, 0x808080, 0xFFFFFFFF),
                              tint1='Team1', tint2='Team2'):
        """
        Emit a PackageMaterialEntry_Standard -- the ordinary model material, used by
        304 of the shipped materials against only 13 Aniso ones (Aniso is for hair,
        cloth and banners with anisotropic highlights).

        Tinting is not a fixed colour. m_uvTintColor is identical
        (0x808080, 0xFFFFFFFF, 0x808080, 0xFFFFFFFF) on every shipped material
        inspected; the actual colour comes from the player at runtime, applied to the
        channels named by MaterialDesc_TintParams0 and masked by the Tints texture.
        So tinting needs a Tints mask to have anywhere to land -- tintMode 1 is what
        the shipped materials without a Tints slot use.

        Commonest slot combinations: BaseColor+Normal+ORM (121), then +Tints (104).
        """
        desc = self._new(self.STRIPE_BLOCK, 'MaterialDesc_Standard2', 1, 112)
        struct.pack_into('<f', desc.data, 8, emissive_strength)
        struct.pack_into('<I', desc.data, 12, tint_mode)
        struct.pack_into('<4I', desc.data, 16, *uv_tint)
        for slot, tex in slots.items():
            if tex is not None:
                desc.ptr_at(self.STANDARD_SLOTS[slot], tex)

        tints = self._new(self.STRIPE_BLOCK, 'MaterialDesc_TintParams0', 1, 32)
        tints.ptr_at(8, self.string(tint1))
        tints.ptr_at(16, self.string(tint2))
        struct.pack_into('<I', tints.data, 24, fnv1a32(tint1))
        struct.pack_into('<I', tints.data, 28, fnv1a32(tint2))

        coll = self._new(self.STRIPE_BLOCK, 'BLP::BLPPtr<BLP::ICollectionEntry>', 2, 16)
        coll.ptr_at(0, desc)
        coll.ptr_at(8, tints)

        entry = self._new(self.STRIPE_BLOCK, 'PackageMaterialEntry_Standard', 1, 56)
        entry.ptr_at(24, coll)
        struct.pack_into('<2I', entry.data, 32, 2, 2)
        entry.ptr_at(40, self.string(name))
        struct.pack_into('<I', entry.data, 48, fnv1a32(name))
        self.entries.append((name, entry))
        return entry


    # BLP::ValueType
    VT = {'float': 0, 'int': 1, 'bool': 2, 'rgb': 3, 'string': 4, 'object': 5,
          'coord2d': 6, 'coord3d': 7, 'entry': 8, 'artdef': 9, 'collection': 10,
          'curve': 11, 'tuple': 12}

    def _value(self, param, spec):
        """
        Build one BLP::Value. `spec` is (kind, payload):

            ('float'|'int'|'bool', number)
            ('string', text)
            ('entry', {'entry':..., 'library':..., 'xlpClass':..., 'package':...})
            ('tuple', [(param, spec), ...])
            ('collection', elem_kind, [(param, spec), ...])

        Param names and string values are BLPPtr<String> -- two hops, via bstr().
        """
        kind = spec[0]
        if kind in ('float', 'int', 'bool'):
            tname = {'float': 'BLP::FloatValue', 'int': 'BLP::IntValue',
                     'bool': 'BLP::BoolValue'}[kind]
            v = self._new(self.STRIPE_BLOCK, tname, 1, 32)
            struct.pack_into('<I', v.data, 8, self.VT[kind])
            v.ptr_at(16, self.bstr(param))
            if kind == 'float':
                struct.pack_into('<f', v.data, 24, float(spec[1]))
            else:
                struct.pack_into('<I', v.data, 24, int(spec[1]))
            return v

        if kind == 'string':
            v = self._new(self.STRIPE_BLOCK, 'BLP::StringValue', 1, 32)
            struct.pack_into('<I', v.data, 8, self.VT[kind])
            v.ptr_at(16, self.bstr(param))
            # Empty means a null pointer here too, exactly as in opt_ptr. Emitting a
            # pointer to a zero-length string instead makes the value read back as the
            # literal '\x01'. Shipped units carry several genuinely empty strings
            # (Description, AudioSwitchGroup), so copying one is enough to hit this.
            if spec[1]:
                v.ptr_at(24, self.bstr(spec[1]))
            return v

        if kind in ('coord3d', 'coord2d'):
            # BLP::Coord3DValue is 40 bytes: eType at +8, param at +16, float3 at +24.
            # Units are full of these -- 1007 across the 236 shipped UnitMetaData
            # assets, for offsets and camera positions -- and a ValueSet missing them
            # is not a smaller unit, it is one the engine crashes on.
            n = 3 if kind == 'coord3d' else 2
            tname = 'BLP::Coord3DValue' if kind == 'coord3d' else 'BLP::Coord2DValue'
            v = self._new(self.STRIPE_BLOCK, tname, 1, 40)
            struct.pack_into('<I', v.data, 8, self.VT[kind])
            v.ptr_at(16, self.bstr(param))
            struct.pack_into(f'<{n}f', v.data, 24, *[float(x) for x in spec[1]][:n])
            return v

        if kind == 'entry':
            d = spec[1]
            v = self._new(self.STRIPE_BLOCK, 'BLP::BLPEntryValue', 1, 64)
            struct.pack_into('<I', v.data, 8, self.VT[kind])
            v.ptr_at(16, self.bstr(param))
            for off, key in ((24, 'library'), (32, 'xlpClass'),
                             (40, 'entry'), (48, 'package')):
                if d.get(key):
                    v.ptr_at(off, self.bstr(d[key]))
            return v

        if kind == 'tuple':
            items = spec[1]
            v = self._new(self.STRIPE_BLOCK, 'BLP::TupleValue', 1, 40)
            struct.pack_into('<I', v.data, 8, self.VT[kind])
            v.ptr_at(16, self.bstr(param))
            arr, n = self._value_array(items)
            if arr is not None:
                v.ptr_at(24, arr)                       # m_Elements is an inline ValueSet
                struct.pack_into('<2I', v.data, 32, n, n)
            return v

        if kind == 'collection':
            elem_kind, items = spec[1], spec[2]
            v = self._new(self.STRIPE_BLOCK, 'BLP::CollectionValue', 1, 48)
            struct.pack_into('<I', v.data, 8, self.VT[kind])
            v.ptr_at(16, self.bstr(param))
            struct.pack_into('<I', v.data, 24, self.VT[elem_kind])
            arr, n = self._value_array(items)
            if arr is not None:
                v.ptr_at(32, arr)
            struct.pack_into('<2I', v.data, 40, n, n)
            return v

        raise ValueError(f'unknown value kind {kind!r}')

    def _value_array(self, items):
        if not items:
            return None, 0
        vals = [self._value(nm, sp) for nm, sp in items]
        arr = self._new(self.STRIPE_BLOCK, 'BLP::BLPPtr<BLP::Value>',
                        len(vals), 8 * len(vals))
        for i, v in enumerate(vals):
            arr.ptr_at(i * 8, v)
        return arr, len(vals)

    def sound_banks_component(self, banks):
        """
        Sound_BanksComponent2 -- the thing that actually LOADS banks.

        Without it a bank sits on disk unloaded and Sound.play() returns 0, which is
        indistinguishable from a broken bank: the shipped Play_Wonder_SFX_Braziers
        returns 0 too until whatever owns it is in the scene. asia-wonders hangs this
        component off the same AUDIO_AppEvents_* asset that carries its event list.
        """
        arr = self._new(self.STRIPE_BLOCK, 'BLP::BLPPtr<BLP::SoundBankEntry>',
                        len(banks), 8 * len(banks))
        for i, sb in enumerate(banks):
            arr.ptr_at(i * 8, sb)
        comp = self._new(self.STRIPE_BLOCK, 'Sound_BanksComponent2', 1, 24)
        comp.ptr_at(8, arr)
        struct.pack_into('<2I', comp.data, 16, len(banks), len(banks))
        return comp

    def sound_switch_component(self, switches):
        """
        Sound_SwitchComponent1 -- the Wwise switch state a unit's audio is set to.

        154 of the 236 shipped UnitMetaData assets carry one, holding (switchGroupID,
        switchValueID) pairs as raw FNV hashes. Copying a unit without it produces an
        asset that differs from every shipped equivalent in exactly one way, which is
        not a position worth being in.

        Sound_SwitchComponent0 is 16 bytes: group at +8, value at +12.
        """
        entries = []
        for group, value in switches:
            s = self._new(self.STRIPE_BLOCK, 'Sound_SwitchComponent0', 1, 16)
            struct.pack_into('<2I', s.data, 8, group & M32, value & M32)
            entries.append(s)

        arr = self._new(self.STRIPE_BLOCK, 'BLP::BLPPtr<Sound_SwitchComponent0>',
                        len(entries), 8 * len(entries))
        for i, s in enumerate(entries):
            arr.ptr_at(i * 8, s)

        comp = self._new(self.STRIPE_BLOCK, 'Sound_SwitchComponent1', 1, 24)
        comp.ptr_at(8, arr)
        struct.pack_into('<2I', comp.data, 16, len(entries), len(entries))
        return comp

    def add_metadata(self, name, class_name, params, components=None):
        """
        Emit a PackageAssetEntry_Metadata0 with an arbitrary ValueSet.

        Units use this: a unit's art is a 'UnitMetaData' asset named exactly its
        UnitType, holding movement parameters, a Formation reference and a MemberInfo
        collection whose entries point at MEMBER_* assets BY NAME. So making one unit
        look like another needs no geometry, material or bin work at all -- just this.
        """
        arr, n = self._value_array(params)
        vs = self._new(self.STRIPE_BLOCK, 'BLP::ValueSet', 1, 16)
        if arr is not None:
            vs.ptr_at(0, arr)
        struct.pack_into('<2I', vs.data, 8, n, n)

        entry = self._new(self.STRIPE_BLOCK, 'PackageAssetEntry_Metadata0', 1, 72)
        if components:
            coll = self._new(self.STRIPE_BLOCK, 'BLP::BLPPtr<BLP::ICollectionEntry>',
                             len(components), 8 * len(components))
            for i, c in enumerate(components):
                coll.ptr_at(i * 8, c)
            entry.ptr_at(24, coll)
            struct.pack_into('<2I', entry.data, 32, len(components), len(components))
        entry.ptr_at(40, self.string(name))
        struct.pack_into('<I', entry.data, 48, fnv1a32(name))
        entry.ptr_at(56, vs)
        entry.ptr_at(64, self.string(class_name))
        self.entries.append((name, entry))
        return entry


    def add_soundbank(self, name, size, offset=16, flags=0x02,
                      sb_flags=0, non_localized_hash=0):
        """
        Declare a Wwise SoundBank blob. Shipped entries all use flags 0x02 (external,
        i.e. a SHARED_DATA file), offset 16 past the CIVBIG header, and zero for both
        sbFlags and the non-localized bank hash.
        """
        sb = self._new(self.STRIPE_BLOCK, 'BLP::SoundBankEntry', 1, 64)
        sb.ptr_at(8, self.string(name))
        struct.pack_into('<Q', sb.data, 32, offset)
        struct.pack_into('<I', sb.data, 40, size)
        struct.pack_into('<I', sb.data, 44, flags)
        struct.pack_into('<I', sb.data, 48, fnv1a32(name))
        struct.pack_into('<I', sb.data, 56, sb_flags)
        struct.pack_into('<I', sb.data, 60, non_localized_hash)
        self.bigdata.append(sb)
        return sb

    # -- serialisation --------------------------------------------------------

    def build(self):
        # Blobs with flags bit 0x80 live in the package's own bigdata region rather
        # than SHARED_DATA; m_nOffset is their offset within it. Assign those before
        # anything is serialised, since the value lives inside the allocation bytes.
        inline_region = bytearray()
        for alloc, payload in self.inline:
            struct.pack_into('<Q', alloc.data, 32, len(inline_region))
            struct.pack_into('<I', alloc.data, 40, len(payload))
            inline_region += payload
            pad = (-len(inline_region)) % 512
            inline_region += b'\0' * pad

        # m_BigDataEntries array, before indices are assigned
        bigdata_arr = None
        if self.bigdata:
            bigdata_arr = self._new(self.STRIPE_BLOCK, 'BLP::BLPPtr<BLP::BigDataEntry>',
                                    len(self.bigdata), 8 * len(self.bigdata))
            for i, t in enumerate(self.bigdata):
                bigdata_arr.ptr_at(i * 8, t)

        # EntryMap contents, now that every asset exists
        n = len(self.entries)
        self.entrymap.count = n
        self.entrymap.data = bytearray(16 * n)
        for i, (name, a) in enumerate(self.entries):
            struct.pack_into('<I', self.entrymap.data, i * 16, fnv1a32(name))
            self.entrymap.ptr_at(i * 16 + 8, a)

        # Type-name allocs must exist before indices are assigned.
        # 'char' is self-referential: its own type name is "char".
        for a in list(self.allocs):
            self.typename_alloc(a.typename)
        # The loop above registers 'char' only as a side effect of some allocation
        # already having that typename -- true of any package containing a string,
        # false of an empty one, which then fails on the typename lookup below. A new
        # project builds an empty package before it has any content, so cover it here
        # rather than at the start, where the extra alloc would shift every index.
        self.typename_alloc('char')

        for i, a in enumerate(self.allocs):
            a.index = i

        # Lay out each stripe; 16-byte alignment throughout.
        block, temp = [], []
        for a in self.allocs:
            (block if a.stripe == self.STRIPE_BLOCK else temp).append(a)

        cur = 0
        for a in block:
            a.offset = cur
            cur = align(cur + a.size)
        block_size = cur

        ROOT_SIZE = self.types['BLP::Package']['size']            # 80
        cur = ROOT_SIZE
        for a in temp:
            a.offset = align(cur)
            cur = a.offset + a.size
        linker_offset = align(cur)

        # Resolve pointers (alloc index + 1; 0 is null)
        for a in self.allocs:
            for off, target in a.patches:
                struct.pack_into('<Q', a.data, off, target.index + 1)

        # packageBlock stripe
        block_buf = bytearray(block_size)
        for a in block:
            block_buf[a.offset:a.offset + a.size] = a.data

        # tempData stripe: root object, type-name strings, allocation table
        temp_buf = bytearray(linker_offset)
        struct.pack_into('<Q', temp_buf, 16, self.entrymap.index + 1)   # m_Entries.pBlock
        struct.pack_into('<2I', temp_buf, 24, n, n)                     # nElements, nCurrSize
        if bigdata_arr is not None:
            struct.pack_into('<Q', temp_buf, 32, bigdata_arr.index + 1)  # m_BigDataEntries
            struct.pack_into('<2I', temp_buf, 40,
                             len(self.bigdata), len(self.bigdata))
        # m_StringTable / m_kExtensibleCollection stay zeroed
        for a in temp:
            temp_buf[a.offset:a.offset + a.size] = a.data

        for a in self.allocs:
            tn = self._typename_allocs[a.typename]
            temp_buf += struct.pack('<QIIIIQQ',
                                    a.stripe, a.offset, a.size, a.count, 0,
                                    tn.index + 1 if a.polymorphic else 0,   # userData
                                    tn.index + 1)                            # typeNamePtr
        temp_size = len(temp_buf)

        # Stripe table. Order on disk: rootTypeName, typeInfo, packageBlock, tempData.
        PKG_OFF = 1024
        root_name = b'BLP::Package\0'
        root_name_off = 16 + 72                                  # preamble + package header
        typeinfo_off = root_name_off + len(root_name)
        block_off = typeinfo_off + len(self.typeinfo)
        temp_off = block_off + block_size

        hdr = bytearray()
        hdr += struct.pack('<I2H2I', 5, 8, 8, 72, 1)             # preamble
        hdr += struct.pack('<2I', block_off, 0)                  # resourceLinkerData (empty)
        hdr += struct.pack('<2I', block_off, block_size)         # packageBlock
        hdr += struct.pack('<2I', temp_off, temp_size)           # tempData
        hdr += struct.pack('<2I', typeinfo_off, len(self.typeinfo))
        hdr += struct.pack('<2I', root_name_off, len(root_name))
        hdr += struct.pack('<8I', linker_offset, 0, 0, 0, 16, 32, 40, 16)
        assert len(hdr) == 88, len(hdr)

        pkg = bytearray(hdr)
        pkg += root_name
        pkg += self.typeinfo
        pkg += block_buf
        pkg += temp_buf
        pkg_size = align(len(pkg), 512)
        pkg += b'\0' * (pkg_size - len(pkg))

        big_off = PKG_OFF + pkg_size
        out = bytearray(b'CIVBLP')
        out += struct.pack('<H', 1)                              # version
        out += struct.pack('<5I', PKG_OFF, pkg_size,
                           big_off,                              # bigDataOffset
                           len(self.bigdata),                    # bigDataCount
                           big_off + len(inline_region))         # fileSize
        out += b'\0' * (PKG_OFF - len(out))
        out += pkg
        out += inline_region
        return bytes(out)


# ---------------------------------------------------------------------------
# The package we actually ship
# ---------------------------------------------------------------------------

# BIN_Hero_Building_Footprint is the engine's dispatch table for constructible
# art -- it is the only BIN_ name that appears as a string in the game binary.
# Its fallback is empty, which is why a building with no entry renders nothing.
#
# Base-game entries use priority 1, so anything higher wins.
#
# BIN_Monument_Scaled is what [BUILDING:BUILDING_MONUMENT] resolves to. It is a
# PackageAssetEntry_Standard0 wrapper (a DirectAttachmentSet4 that places and scales)
# which pulls in the BIN_Monument bin, and that bin carries the whole
# construction / completed / pillaged matrix plus the per-BUILDING_CULTURE variants.
# Pointing a new building at it therefore inherits all of that for free.
MONUMENT = 'BIN_Monument_Scaled'

HERO_FOOTPRINT_ADDITIONS = [
    # (asset bin, expression, priority, weight)

    # --- new buildings: nothing else competes for these types, so priority 1
    #     matches the base-game convention exactly.
    (MONUMENT, '[BUILDING:BUILDING_AHH]', 1, 1.0),
    (MONUMENT, '[BUILDING:BUILDING_BAA]', 1, 1.0),
    # BUILDING_CAA renders our generated cube instead, as the geometry test.
    # Swap back to MONUMENT to undo.
    ('SUZANNE_Scaled', '[BUILDING:BUILDING_CAA]', 1, 1.0),

    # --- superseded by BUILDING_MARKET_SKIN below; kept so an existing
    #     To=BUILDING_BRICKYARD_SKIN_MARKET remap keeps working. Safe to delete.
    ('BIN_Market_Scaled', '[BUILDING:BUILDING_BRICKYARD_SKIN_MARKET]', 50, 1.0),
]

# The skin table: one art-only BUILDING_X_SKIN tag per building the footprint knows
# about, each rendering exactly what BUILDING_X renders. Generated from the installed
# game by gen_skins.py, so DLC buildings are covered via their bin modifiers.
#
# A VisualRemap's `To` must name something that exists only in the art data -- every
# shipped remap obeys this and the one counter-example fails (see readme). These tags
# satisfy that by construction: no constructible can ever produce them.
#
# Priority 50, not 1, on purpose. If a remap adds the tag rather than replacing it,
# the plot carries both the real BUILDING_X (base entry, p=1) and the skin tag at
# once; at equal priority the winner would be a coin flip. At 50 the skin wins
# deterministically whenever its tag is present.
HERO_FOOTPRINT_ADDITIONS += SKIN_ENTRIES


# ---------------------------------------------------------------------------
# Improvements
# ---------------------------------------------------------------------------
# Improvements do NOT go through BIN_Hero_Building_Footprint, and creating a bin
# named after the ConstructibleType does nothing -- that was an earlier theory,
# disproved by IMPROVEMENT_TEST_HILLFORT rendering nothing. Improvements need:
#
#   1. registration in a ROOT_ASSETS_IMPROVEMENTS_<project> AssetList (metadata asset)
#   2. a PackageAssetEntry_Standard0 carrying an AssetPackage_RegionPatternComponent0
#      whose hex[0] expression is '[IMPROVEMENT:<ConstructibleType>]'
#   3. a DirectAttachmentSet4 referencing the model bins
#
# The asset name is irrelevant -- base registers IMP_Hillfort, IMP_OIL_RIG and
# Improvement_Institute alongside IMPROVEMENT_BARAY. See readme.
#
# Emitting all of that is not implemented yet. It is also not needed for the current
# test: IMPROVEMENT_SHORE_BATTERY is cut content whose art ships fully registered and
# pattern-matched, so data/improvement-shore-battery.sql revives it with the BLP
# untouched. add_bin() below is correct and stays -- it is simply not the improvement
# mechanism.
IMPROVEMENT_ART = []

# ---------------------------------------------------------------------------
# Audio
# ---------------------------------------------------------------------------
# Built by make_soundbank.py: a Wwise bank cloned from a shipped minimal one with its
# audio swapped for a Vorbis .wem produced by Wwise Authoring 2022.1. Wwise object IDs
# are FNV-1 (not 1a) over the lowercased name, so the Event the game calls is simply
# fnv1(bank name) -- which is why bank and event share a name here.
#
# The banks are only reachable because AUDIO_EVENT_LIST carries a Sound_BanksComponent2
# naming them; a bank on disk that nothing references is never loaded, and Sound.play
# then returns 0 exactly as it does for a misspelt event.
SOUNDBANKS = [
    dict(name='SOUNDBANK_Play_PB_Yamatai_First_Meet', size=223792),
    dict(name='SOUNDBANK_Play_PB_Yamatai_Declare_War_From_AI', size=173651),
    dict(name='SOUNDBANK_Play_PB_Yamatai_Declare_War_From_Human', size=160025),
    dict(name='SOUNDBANK_Play_PB_Yamatai_Defeat', size=200761),
    dict(name='SOUNDBANK_Play_PB_Yamatai_Kudos', size=201502),
    dict(name='SOUNDBANK_Play_PB_Yamatai_Warning', size=141409),
    dict(name='SOUNDBANK_Play_PB_Yamatai_Happy_Positive', size=22893),
    dict(name='SOUNDBANK_Play_PB_Yamatai_Happy_Negative', size=13871),
    dict(name='SOUNDBANK_Play_PB_Yamatai_Neutral_Positive', size=10455),
    dict(name='SOUNDBANK_Play_PB_Yamatai_Neutral_Negative', size=6078),
    dict(name='SOUNDBANK_Play_PB_Yamatai_Unhappy_Positive', size=8820),
    dict(name='SOUNDBANK_Play_PB_Yamatai_Unhappy_Negative', size=7204),
]

# AudioEventList maps a game-side AppEvent string onto a Wwise event name, exactly as
# asia-wonders does for its wonder placement sounds. The AppEvent spellings below are
# still unverified -- Sound.play(<Wwise event>) is the tested path.
AUDIO_EVENT_LIST = 'AUDIO_AppEvents_custom-art'
AUDIO_EVENTS = [
    # (AppEvent the game fires, Wwise event name = our bank name)
    ('LOC:VO_PB_Yamatai_First_Meet', 'Play_PB_Yamatai_First_Meet'),
]

# ---------------------------------------------------------------------------
# Units
# ---------------------------------------------------------------------------
# A unit's art is a 'UnitMetaData' metadata asset named exactly its UnitType -- 304 of
# them ship, 250 in Base and 54 more from DLC. (An earlier note here said "93 of 118",
# counted from a single StandardAsset shard; Base alone splits across several, and DLC
# adds more still.) There is no [UNIT:...] tag namespace; UNIT_CULTURE is only the civ
# art style. The asset holds movement parameters, a Formation reference and a
# MemberInfo collection whose entries name member assets -- spelled MEMBER_* mostly,
# but Member_*_Bin in places, so never assume the prefix.
#
# So one unit can be made to look like another purely by pointing MemberInfo at the
# other unit's members -- no geometry, no material, no bins. This copies UNIT_ARCHER.
#
# Units must be REGISTERED, in ROOT_UNITS_<project> -- note that is not a ROOT_ASSETS_
# variant like improvements and wonders use. All 24 DLCs that ship units carry one. An
# unregistered unit still resolves through WorldUI.addModelAtPlot, which looks the asset
# up by name directly, so it appears to work right up until a map loads one for real.
#
# A metadata asset is its ValueSet *and* its components: 154 of the 236 shipped units
# carry a Sound_SwitchComponent1 holding Wwise switch ids, and a copy needs both.
SA = 'StandardAsset'
SA_PKG = 'StandardAsset.blp'

def _member(i, asset, scale=1.0, promotion=1):
    return (f'MemberInfo{i:03d}', ('tuple', [
        ('Asset', ('entry', {'library': SA, 'xlpClass': SA,
                             'entry': asset, 'package': SA_PKG})),
        ('UniformScale', ('float', scale)),
        ('PromotionLevel', ('int', promotion)),
    ]))

UNITS = [
    dict(name='UNIT_TEST', cls='UnitMetaData', copied_from='UNIT_ARCHER', params=[
        ('Movement', ('tuple', [
            ('MaxSpeed', ('float', 42.0)),
            ('TurnRadius', ('float', 0.0)),
            ('MovementType', ('string', 'MOVEMENT_TYPE_UNITFLAG')),
            ('TurnRateDegPerSec', ('float', 0.0)),
            ('SmallMoveDistance', ('float', 0.0)),
            ('UsesTurnAnimations', ('bool', 0)),
            ('ZeroToMaxSpeedTime', ('float', 0.5)),
            ('LeanFactor', ('float', 0.0)),
            ('ConfomPitchToTerrain', ('bool', 0)),
            ('ConfomRollToTerrain', ('bool', 0)),
            ('MaxWaterDepth', ('float', 1.0)),
            ('CanAirPatrol', ('bool', 0)),
            ('WalkSpeedOverride', ('float', 0.0)),
        ])),
        ('Formation', ('entry', {'library': SA, 'xlpClass': SA,
                                 'entry': 'Formation_8_Range', 'package': SA_PKG})),
        ('MemberInfo', ('collection', 'tuple',
                        [_member(i + 1, 'MEMBER_ARCHER') for i in range(8)])),
        ('UseRangedCombatSelect', ('bool', 1)),
        ('UseChargesForHealth', ('bool', 0)),
        ('UsePromotionsForHealth', ('bool', 0)),
        ('MinNumMembers', ('int', 1)),
        ('PortraitCamera', ('entry', {'xlpClass': SA,
                                      'entry': 'PORTRAIT_CAMERA_INFANTRY_ARCHERS',
                                      'package': SA_PKG})),
        ('RiverScale', ('float', 1.0)),
        ('PackedScale', ('float', 1.0)),
    ]),
]

# ---------------------------------------------------------------------------
# Static meshes -- geometry we generate ourselves
# ---------------------------------------------------------------------------
# Generated by make_mesh.py. No material is set, so the mesh renders white -- the
# same fallback the banner showed when its material could not resolve.
STATIC_MESHES = [
    dict(asset='TEST_CUBE',
         buffer='GB_TEST_CUBE_MB',
         buffer_size=624,
         vertex_offset=0, vertex_count=24,
         index_start=120, primitive_count=12,
         min_index=0, max_index=23,
         # 30 units across and tall -- a person is ~18, so this is unmistakable.
         # wrapper_scale 1.0, not the usual 0.69, to keep the test unambiguous.
         bounds=(-15.0, -15.0, 0.0, 15.0, 15.0, 30.0),
         wrapper_scale=1.0),

    # Imported from Blender via import_gltf.py. Suzanne is a good first real model:
    # instantly recognisable, so a wrong axis, winding or scale is obvious at a glance.
    dict(asset='SUZANNE',
         buffer='GB_SUZANNE_MB',
         buffer_size=50936,
         vertex_offset=0, vertex_count=1966,
         index_start=9830, primitive_count=968,
         min_index=0, max_index=1965,
         bounds=(-13.67, -8.52, 0.00, 13.67, 8.52, 19.69),
         wrapper_scale=1.0,
         material='SUZANNE_MATERIAL'),
]

# Rotation about Z for each hex direction, in radians, taken from the shipped asset.
HEX_DIR = {
    'E':  0.0,
    'NE':  1.0471980571746826,   # +60 deg
    'NW':  2.0943949222564697,   # +120
    'SE': -1.0471980571746826,
    'SW': -2.0943949222564697,
    'W':  -3.141592025756836,    # 180
}

# The full attachment set of the shipped IMPROVEMENT_ShoreBattery: the model itself,
# a road-connection decal per hex direction, a river blocker and a railroad decal.
# Every one is a reference to an existing bin by name hash, so the whole set costs
# 9 x 72 bytes of struct plus strings -- no art is duplicated. Omitting the Road_CP_*
# entries is what stops an improvement blending into an adjoining road network.
SHORE_BATTERY_ATTACHMENTS = [
    ('newAttachmentPoint_1', 'BIN_IMP_ShoreBattery',                  0.0),
    ('Road_CP_E',            'BIN_IMP_ShoreBattery_Road_CP_E',        HEX_DIR['E']),
    ('Road_CP_NE',           'BIN_IMP_ShoreBattery_Road_CP_NE',       HEX_DIR['NE']),
    ('Road_CP_NW',           'BIN_IMP_ShoreBattery_Road_CP_NW',       HEX_DIR['NW']),
    ('Road_CP_SE',           'BIN_IMP_ShoreBattery_Road_CP_SE',       HEX_DIR['SE']),
    ('Road_CP_SW',           'BIN_IMP_ShoreBattery_Road_CP_SW',       HEX_DIR['SW']),
    ('Road_CP_W',            'BIN_IMP_ShoreBattery_Road_CP_W',        HEX_DIR['W']),
    ('newAttachmentPoint_2', 'BIN_River_Blocker',                     0.0),
    # note the lowercase 'b' -- the shipped name really is Shorebattery here, and the
    # hash is case-sensitive, so correcting the spelling would break the reference
    ('newAttachmentPoint_3', 'BIN_IMP_Shorebattery_Railroad_Decal',   0.0),
]

# hexes mirror the shipped asset exactly: hex[0] identifies the improvement, hex[2]
# requires an adjacent marine tile. Confirmed to gate rendering outright, not merely
# orientation -- inland placement draws nothing. rotation=63 lets the engine try all
# six orientations to satisfy it.
#
# IMPROVEMENT_SHORE_BATTERY already exists as a modern-age improvement, so defining it
# would render from the shipped art no matter what we do here and would prove nothing.
# IMPROVEMENT_TEST_SHORE_BATTERY is a type the game has never heard of, so anything that
# appears can only have come from this package.
#
# BIN_IMP_ShoreBattery is what the shipped IMPROVEMENT_ShoreBattery attaches
# (nAssetNameHash 0x5D679F12, confirmed against fnv1a). It is a bin, so it carries the
# completed / construction / pillaged states.
IMPROVEMENTS = [
    dict(asset='IMP_Test_Shore_Battery',
         type='IMPROVEMENT_TEST_SHORE_BATTERY',
         attachments=SHORE_BATTERY_ATTACHMENTS,
         hexes={2: (0, '[BIOME:MARINE]')}),

    # Art-only improvement type, for testing whether VisualRemaps reach improvements.
    # No gameplay row will ever exist for IMPROVEMENT_TEST_SHORE_BATTERY_SKIN, so it
    # satisfies the same "To must be art-only" rule that makes building remaps work.
    # Hillfort art is deliberately unmistakable against a shore battery, and no marine
    # hex is required so it renders wherever the remap puts it.
    dict(asset='IMP_Test_Shore_Battery_Skin',
         type='IMPROVEMENT_TEST_SHORE_BATTERY_SKIN',
         attachments=[('newAttachmentPoint_1', 'BIN_Improvement_Hillfort', 0.0)]),
]

# ---------------------------------------------------------------------------
# Wonders
# ---------------------------------------------------------------------------
# Same region-pattern mechanism as improvements, with three differences taken from
# the shipped WONDER_Mausoleum_Halicarnassus (DLC/asia-wonders):
#
#   hex[0] flags = 0x0   (improvements use 0x1)
#   rotation     = 1     (one orientation, vs 63 for improvements)
#   LayoutBaseLayerComponent0 = 'TER_EDIT_Flatten_Hex'   flattens terrain underneath
#
# A modded wonder with no registered asset falls back to WONDER_FALLBACK, which is
# why an unmodded custom wonder shows the pyramid placeholder rather than nothing --
# improvements, having no fallback, render nothing instead.
#
# Road connection points use a generic shared decal here, not wonder-specific bins.
MAUSOLEUM_ATTACHMENTS = [
    ('newAttachmentPoint_1', 'BIN_WON_Mausoleum_Halicarnassus',        -0.5235987901687622),
    ('Road_CP_E',            'BIN_TER_Decal_Road_CP_Straight_Short_A',  HEX_DIR['E']),
    ('Road_CP_NE',           'BIN_TER_Decal_Road_CP_Straight_Short_A',  HEX_DIR['NE']),
    ('Road_CP_NW',           'BIN_TER_Decal_Road_CP_Straight_Short_A',  HEX_DIR['NW']),
    ('Road_CP_SE',           'BIN_TER_Decal_Road_CP_Straight_Short_A',  HEX_DIR['SE']),
    ('Road_CP_SW',           'BIN_TER_Decal_Road_CP_Straight_Short_A',  HEX_DIR['SW']),
    ('Road_CP_W',            'BIN_TER_Decal_Road_CP_Straight_Short_A',  HEX_DIR['W']),
]

WONDERS = [
    dict(asset='WONDER_PB_Hashihaka_Kofun',
         type='WONDER_PB_HASHIHAKA_KOFUN',
         attachments=MAUSOLEUM_ATTACHMENTS,
         base_layer='TER_EDIT_Flatten_Hex'),
]

WONDER_ASSET_LIST = 'ROOT_ASSETS_WONDERS_custom-art'

# ---------------------------------------------------------------------------
# Cloned assets
# ---------------------------------------------------------------------------
# A civ banner is a full model -- 8 meshes, 14 LODs, 15 deformers, 10 animations,
# 11 states -- and we want every value identical to the shipped one. The only
# intended change is the material hash on the four cloth meshes, so the asset is
# deep-copied from heian-shell rather than authored (see clone_asset.py).
#
# Materials bind by NAME HASH (AssetPackage_Geometry_Mesh2.nMaterialHash), which
# resolves across packages -- that is what lets the clone point at a material in our
# own Material.blp. Geometry buffers do not: pVB/pIB are allocation pointers, so
# GB_..._MB is cloned into this package and its blob copied to SHARED_DATA.
# Relative to the game install root, so a project is portable between machines.
HEIAN_SHELL = 'DLC/heian-shell/Platforms/Windows/BLPs/StandardAsset.blp'

CLONES = [
    dict(source=HEIAN_SHELL,
         asset='CIVILIZATION_HEIAN_BANNER_GAME_ASSET',
         renames={
             'CIVILIZATION_HEIAN_BANNER_GAME_ASSET':
                 'CIVILIZATION_PB_YAMATAI_BANNER_GAME_ASSET',
             'GB_CIVILIZATION_HEIAN_BANNER_MB':
                 'GB_CIVILIZATION_PB_YAMATAI_BANNER_MB',
             'CIVILIZATION_HEIAN_BANNER_GAME_ASSET_StateSetBlob0':
                 'CIVILIZATION_PB_YAMATAI_BANNER_GAME_ASSET_StateSetBlob0',
         },
         materials={'CIVILIZATION_HEIAN_BANNER_GAME_MATERIAL':
                    'CIVILIZATION_PB_YAMATAI_BANNER_GAME_MATERIAL'},
         assetList='leaders'),
]

# Banners are registered here, alongside the leader models.
LEADER_ASSET_LIST = 'ROOT_ASSETS_LEADERS_custom-art'

# Registration list. Named after our art group, matching ROOT_ASSETS_IMPROVEMENTS_sengoku.
IMPROVEMENT_ASSET_LIST = 'ROOT_ASSETS_IMPROVEMENTS_custom-art'
ASSET_LIST_PROJECT = 'custom-art'


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------
# Everything above this line is the content of one particular mod. Everything below
# is a generic driver over a plain dict, so the GUI can author packages without
# generating Python. default_project() is that same content expressed as the dict,
# and is what the JSON manifest is exported from.
#
# The dict must survive a JSON round-trip: no tuples that matter, no non-string dict
# keys. normalise() repairs what JSON cannot preserve (hex slot keys become ints).

DEFAULT_GAME_ROOT = os.environ.get('CIV7_GAME_ROOT', '/workspace/reference/full_game')


def _json_native(v):
    """
    Tuples to lists, recursively.

    The value-tree the unit manifests use is built from nested tuples, and json.dump
    writes those as arrays -- so a manifest exported and reloaded is not equal to the
    one in memory even though it builds the same package. Normalising up front makes
    the round-trip an identity, which is what lets the test assert equality rather
    than merely 'both produce the same bytes'.
    """
    if isinstance(v, (list, tuple)):
        return [_json_native(x) for x in v]
    if isinstance(v, dict):
        return {k: _json_native(x) for k, x in v.items()}
    return v


def default_project():
    """The custom-art mod as a manifest dict. The source of truth for civart.json."""
    return _json_native({
        'project': {
            'name': 'custom-art',
            'guid': 'EB3EA06B-5FA2-4E60-9EFE-AC337C01A806',
            'displayName': 'Custom Art Test',
            'author': 'slothoth',
            'version': '1',
        },
        'buildings': [
            {'target': a, 'expression': e, 'priority': p, 'weight': w}
            for a, e, p, w in HERO_FOOTPRINT_ADDITIONS
        ],
        'binArt': [{'type': t, 'art': a} for t, a in IMPROVEMENT_ART],
        'improvements': [
            {'asset': i['asset'], 'type': i['type'],
             'attachments': [list(a) for a in i['attachments']],
             'hexes': {str(k): list(v) for k, v in (i.get('hexes') or {}).items()}}
            for i in IMPROVEMENTS
        ],
        'wonders': [
            {'asset': w['asset'], 'type': w['type'],
             'attachments': [list(a) for a in w['attachments']],
             'baseLayer': w.get('base_layer'),
             'hexes': {str(k): list(v) for k, v in (w.get('hexes') or {}).items()}}
            for w in WONDERS
        ],
        'units': [
            {'name': u['name'], 'cls': u['cls'], 'copiedFrom': u.get('copied_from'),
             'params': u['params']}
            for u in UNITS
        ],
        'meshes': [dict(m) for m in STATIC_MESHES],
        'soundbanks': [dict(s) for s in SOUNDBANKS],
        'audioEvents': [{'appEvent': a, 'wwiseEvent': w} for a, w in AUDIO_EVENTS],
        'clones': [dict(c) for c in CLONES],
    })


def asset_list_names(project_name):
    """
    The five generated registration names, all derived from the art group name.

    The bin modifier substitutes '-' for '_' because it is an identifier in the
    engine's namespace; the ROOT_ASSETS_* lists keep the dash, matching the shipped
    ROOT_ASSETS_IMPROVEMENTS_sengoku.
    """
    return {
        'binModifier': 'BIN_MODIFIER_Hero_Building_Footprint_'
                       + project_name.replace('-', '_'),
        'improvements': f'ROOT_ASSETS_IMPROVEMENTS_{project_name}',
        'wonders':      f'ROOT_ASSETS_WONDERS_{project_name}',
        'leaders':      f'ROOT_ASSETS_LEADERS_{project_name}',
        # The generic list, and the right default for a reused mesh. The game ships 48
        # of these against 22 ROOT_ASSETS_LEADERS -- registering an ordinary building
        # or unit mesh as a leader asset because banners were the first use case would
        # be filing it under the wrong heading.
        'assets':       f'ROOT_ASSETS_{project_name}',
        # Units have their own list, not a ROOT_ASSETS_ variant. Every one of the 24
        # DLCs that ships units has a ROOT_UNITS_<project>; a unit asset that is in no
        # list is never registered, exactly as with improvements.
        'units':        f'ROOT_UNITS_{project_name}',
        'audioEvents':  f'AUDIO_AppEvents_{project_name}',
    }


def _hexes(raw):
    """JSON object keys are strings; add_region_asset wants int slot numbers."""
    if not raw:
        return None
    return {int(k): tuple(v) for k, v in raw.items()}


def build_package(project, donor, game_root=None, log=None):
    """
    Emit a StandardAsset package from a manifest dict. Returns (bytes, builder).

    `donor` supplies the typeInfo stripe and must declare every type the manifest
    causes us to emit -- see donors.py for picking one automatically. `game_root` is
    only needed when the manifest has clones, whose source paths are relative to it.
    """
    say = log if log is not None else (lambda _m: None)
    game_root = game_root or DEFAULT_GAME_ROOT
    name = project['project']['name']
    lists = asset_list_names(name)

    b = PackageBuilder(donor)

    buildings = [(x['target'], x['expression'], x['priority'], x['weight'])
                 for x in project.get('buildings', [])]
    if buildings:
        b.add_bin_modifier(lists['binModifier'], 'BIN_Hero_Building_Footprint', buildings)

    for entry in project.get('binArt', []):
        b.add_bin(entry['type'], [(entry['art'], '', 1, 1.0)], fallback=entry['art'])

    improvements = project.get('improvements', [])
    for imp in improvements:
        b.add_region_asset(imp['asset'], f"[IMPROVEMENT:{imp['type']}]",
                           imp['attachments'], hexes=_hexes(imp.get('hexes')))
        say(f"  * improvement {imp['asset']}  [IMPROVEMENT:{imp['type']}]"
            f"  ({len(imp['attachments'])} attachments)")
        for slot, (fl, ex) in sorted((_hexes(imp.get('hexes')) or {}).items()):
            say(f"      hex[{slot}] flags=0x{fl:x} {ex}")
    if improvements:
        b.add_asset_list(lists['improvements'], name, [i['asset'] for i in improvements])
        say(f"  * registered in {lists['improvements']}")

    wonders = project.get('wonders', [])
    for w in wonders:
        b.add_region_asset(w['asset'], f"[WONDER:{w['type']}]", w['attachments'],
                           rotation=1, hex0_flags=0,
                           base_layer=w.get('baseLayer'), hexes=_hexes(w.get('hexes')))
        say(f"  * wonder {w['asset']}  [WONDER:{w['type']}]"
            f"  ({len(w['attachments'])} attachments, base={w.get('baseLayer')})")
    if wonders:
        b.add_asset_list(lists['wonders'], name, [w['asset'] for w in wonders])
        say(f"  * registered in {lists['wonders']}")

    banks = project.get('soundbanks', [])
    events = project.get('audioEvents', [])
    bank_allocs = []
    for sb in banks:
        bank_allocs.append(b.add_soundbank(sb['name'], sb['size']))
        say(f"  * soundbank {sb['name']}  ({sb['size']} bytes)")
    if bank_allocs:
        b.add_metadata(lists['audioEvents'], 'AudioEventList', [
            ('AudioEventList', ('collection', 'tuple', [
                (f'AudioEventList{i:03d}', ('tuple', [
                    ('AppEvent', ('string', e['appEvent'])),
                    ('AudioEvent', ('string', e['wwiseEvent'])),
                ])) for i, e in enumerate(events)
            ])),
        ], components=[b.sound_banks_component(bank_allocs)])
        say(f"  * audio events {lists['audioEvents']}  "
            f"({len(events)} mapping(s), {len(bank_allocs)} bank(s) loaded)")

    units = project.get('units', [])
    for u in units:
        comps = ([b.sound_switch_component(u['soundSwitches'])]
                 if u.get('soundSwitches') else None)
        b.add_metadata(u['name'], u['cls'], u['params'], components=comps)
        say(f"  * unit {u['name']}  ({u['cls']}, members copied from "
            f"{u.get('copiedFrom')}"
            + (f", {len(u['soundSwitches'])} sound switch(es)"
               if u.get('soundSwitches') else '') + ')')
    if units:
        b.add_asset_list(lists['units'], name, [u['name'] for u in units])
        say(f"  * registered in {lists['units']}")

    for m in project.get('meshes', []):
        kw = {k: v for k, v in m.items() if k not in ('vertex_count', 'wrapper_scale')}
        b.add_static_mesh(**kw)
        wrapper = m['asset'] + '_Scaled'
        scale = m.get('wrapper_scale', 0.69)
        b.add_attachment_asset(wrapper, [('newAttachmentPoint_1', m['asset'], 0.0)],
                               scale=scale)
        say(f"  * static mesh {m['asset']}  ({m['vertex_count']} verts, "
            f"{m['primitive_count']} tris)  "
            f"material={m.get('material') or '(none -> renders white)'}")
        say(f"      + wrapper {wrapper} (attachment set, scale {scale})"
            f" -- footprint targets must be wrappers")

    clones = project.get('clones', [])
    if clones:
        from clone_asset import clone_into
        # Each clone says which registration list it belongs in; a banner is a leader
        # asset, a reused building mesh is not. Grouped so one list is emitted per
        # distinct destination rather than one per clone.
        grouped = {}
        for c in clones:
            src = c['source']
            if not os.path.isabs(src):
                src = os.path.join(game_root, src)
            cloned = clone_into(b, src, c['asset'],
                                renames=c.get('renames'),
                                material_map={fnv1a32(k): fnv1a32(v)
                                              for k, v in c.get('materials', {}).items()})
            grouped.setdefault(c.get('assetList', 'assets'), []).append(cloned)
        for key in sorted(grouped):
            if not key:
                continue          # deliberately unregistered
            list_name = lists.get(key, f'ROOT_ASSETS_{key.upper()}_{name}')
            b.add_asset_list(list_name, name, grouped[key])
            say(f'  * registered in {list_name}')

    return b.build(), b


def main():
    import argparse, json
    ap = argparse.ArgumentParser()
    ap.add_argument('donor', help='shipped .blp supplying the typeInfo stripe')
    ap.add_argument('out')
    ap.add_argument('--project', help='civart.json manifest (default: this mod)')
    ap.add_argument('--game-root', default=DEFAULT_GAME_ROOT)
    args = ap.parse_args()

    if args.project:
        with open(args.project) as f:
            project = json.load(f)
    else:
        project = default_project()

    lines = []
    data, b = build_package(project, args.donor, args.game_root, log=lines.append)

    out_dir = os.path.dirname(args.out)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(args.out, 'wb') as f:
        f.write(data)

    for line in lines:
        print(line)
    print(f"wrote {args.out}  ({len(data)} bytes, {len(b.allocs)} allocations)")
    buildings = project.get('buildings', [])
    for x in buildings[:4]:
        print(f"  + {x['expression']}  ->  {x['target']}   (priority {x['priority']})")
    if len(buildings) > 4:
        print(f"  + ... {len(buildings) - 4} more footprint entries")


if __name__ == '__main__':
    main()
