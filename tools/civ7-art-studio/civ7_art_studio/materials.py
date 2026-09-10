"""
Materials: texture slots, tinting, and the borrowing that makes them practical.

Two scoping rules drive everything here, and they pull in opposite directions:

  * A material is reached by NAME HASH, so it resolves across packages. That is what
    lets a mesh in StandardAsset.blp bind to a material in Material.blp.
  * A material's texture slots are BLPPtr<TextureEntry> -- allocation pointers, which
    are package-local. A texture cannot be aliased from anywhere else, so every one a
    material uses must be re-declared in this same package with its blob copied
    alongside.

That second rule is why borrowing matters. Borrowing a shipped occlusion or tint mask
means copying its entry field-for-field and its blob byte-for-byte, which is what
`borrow` does -- the entry is the blob's only description, and a single wrong field
makes the loader read the wrong number of bytes.

Every slot can equally be authored from your own DDS via `import_slot_texture`,
including the mask maps, which is the path to take once an occlusion or tint mask is
being painted in GIMP or baked in Blender. The two differ only in where the bytes come
from; the resulting entry is the same shape either way.
"""
import os, shutil

from . import guards
from .tools import ensure_on_path

# Which texture class belongs in which slot. Taken from what the shipped materials
# actually use rather than from the slot names: the occlusion/roughness/metal map is
# 'Model_Occlusion', and translucency is 'Model_TranslucencyMask'.
SLOT_CLASS = {
    'base_color':   'Model_BaseColor',
    'normal':       'Model_Normal',
    'orm':          'Model_Occlusion',
    'tints':        'Model_Tint',
    'opacity':      'Model_Opacity',
    'opacity2':     'Model_OpacityBlended',
    'translucency': 'Model_TranslucencyMask',
    'emissive':     'Model_Emissive',
    'emissive_ramp': 'ColorRamp',
    'anisotropy':   'Model_Anisotropy',
    'aniso_dir':    'Model_AnisotropicDirection',
}

KINDS = ('standard', 'aniso')

DXGI_NAMES = {
    71: 'BC1_UNORM', 72: 'BC1_UNORM_SRGB', 74: 'BC2_UNORM', 77: 'BC3_UNORM',
    78: 'BC3_UNORM_SRGB', 80: 'BC4_UNORM', 81: 'BC4_SNORM', 83: 'BC5_UNORM',
    84: 'BC5_SNORM', 95: 'BC6H_UF16', 98: 'BC7_UNORM', 99: 'BC7_UNORM_SRGB',
}

# What each texture class is actually compressed as, counted across the 27,122 shipped
# textures. The separation is near-total -- every Model_Normal is BC5, every
# Model_Occlusion is BC1, every Model_Opacity is BC4 -- so a mismatch is worth saying
# out loud, and a blanket "should be BC7" check is wrong for everything except UI.
#
# Note this contradicts the older note that every image texture ships as BC7: that was
# counted over UI textures, which are indeed 100% BC7, and does not hold for model
# textures. Base colour is BC1 sRGB, not BC7.
CLASS_FORMATS = {
    'Model_BaseColor':            (72, {72, 98, 99}),
    'Model_Normal':               (83, {83, 84}),
    'Model_Occlusion':            (71, {71, 80}),
    'Model_Tint':                 (80, {80, 83}),
    'Model_Anisotropy':           (80, {80}),
    'Model_AnisotropicDirection': (83, {83, 84}),
    'Model_Opacity':              (80, {80}),
    'Model_OpacityBlended':       (80, {80}),
    'Model_TranslucencyMask':     (80, {80}),
    'Model_Emissive':             (80, {80, 72, 98}),
    'UITexture':                  (98, {98, 99}),
}


def format_name(fmt):
    return DXGI_NAMES.get(fmt, f'DXGI {fmt}')


def slots_for(kind):
    """Slot names a material of this kind can fill, in the emitter's own order."""
    ensure_on_path()
    from build_blp import PackageBuilder
    table = (PackageBuilder.STANDARD_SLOTS if kind == 'standard'
             else PackageBuilder.MATERIAL_SLOTS)
    return sorted(table, key=lambda s: table[s])


def describe_slots(kind):
    """
    Slot name, the texture class it takes, and the compression that class ships as.

    The format is worth stating up front rather than only complaining afterwards: a
    normal map wants BC5 and an occlusion or tint mask BC4/BC1, and nothing about the
    slot name says so.
    """
    out = []
    for s in slots_for(kind):
        cls = SLOT_CLASS.get(s, '')
        preferred, accepted = CLASS_FORMATS.get(cls, (None, set()))
        out.append({
            'slot': s,
            'textureClass': cls,
            'format': format_name(preferred) if preferred else '',
            'formats': sorted(format_name(f) for f in (accepted or ())),
        })
    return out


def borrow(project, game_root, index, texture_name, slot=None):
    """
    Re-declare a shipped texture in this package and copy its bytes.

    Returns (row, findings). The row restates every field of the shipped entry,
    because that entry is the only description the loader gets.
    """
    findings = []
    info = (index.get('textures') or {}).get(texture_name)
    if info is None:
        return None, [guards.Finding(
            guards.ERROR, 'texture-unknown',
            f'{texture_name} is not in the installed game', texture_name)]
    if not info['external']:
        return None, [guards.Finding(
            guards.ERROR, 'texture-inline',
            f'{texture_name} keeps its payload inside its package rather than in '
            f'SHARED_DATA, so there is no file to copy.', texture_name)]

    src = os.path.join(game_root, os.path.dirname(info['package']),
                       'SHARED_DATA', texture_name)
    if not os.path.exists(src):
        return None, [guards.Finding(
            guards.ERROR, 'texture-blob-missing',
            f'{texture_name} is declared in {info["package"]} but its blob is not in '
            f'that package\'s SHARED_DATA.', texture_name)]

    os.makedirs(project.shared_data_dir, exist_ok=True)
    shutil.copy2(src, os.path.join(project.shared_data_dir, texture_name))

    if slot and SLOT_CLASS.get(slot) and info['tex_class'] != SLOT_CLASS[slot]:
        findings.append(guards.Finding(
            guards.WARNING, 'texture-class-mismatch',
            f'{texture_name} is a {info["tex_class"]}, but the {slot} slot normally '
            f'takes a {SLOT_CLASS[slot]}.', texture_name))

    return {'slot': slot or '', 'name': texture_name, 'size': info['size'],
            'width': info['width'], 'height': info['height'], 'mips': info['mips'],
            'fmt': info['fmt'], 'tex_class': info['tex_class'],
            'flags': info['flags'], 'copyFromShipped': True}, findings


def import_slot_texture(project, src, texture_name, slot):
    """
    Author a slot's texture from a BC-compressed DDS.

    Same passthrough as a UI texture -- the payload ships exactly as the encoder made
    it -- but declared with the slot's model texture class rather than UITexture, and
    with no UI entry, since nothing references it by a UI name.
    """
    ensure_on_path()
    import make_texture

    # Check the file against the class this slot takes, so an authored BC5 normal or
    # BC4 tint mask is not flagged for failing to be BC7.
    tex_class = SLOT_CLASS.get(slot, 'Model_BaseColor')
    info, findings = guards.inspect_dds(src, tex_class)
    if info is None:
        return None, findings

    name = texture_name if texture_name.startswith('TEXTURE_') \
        else 'TEXTURE_' + texture_name
    findings += guards.check_texture_name(name[len('TEXTURE_'):])
    if any(f.level == guards.ERROR for f in findings):
        return None, findings

    dest = project.source_dir('materials')
    os.makedirs(dest, exist_ok=True)
    target = os.path.join(dest, os.path.basename(src))
    if os.path.abspath(src) != os.path.abspath(target):
        shutil.copy2(src, target)

    kind, payload, width, height, mips, dxgi = make_texture.read_dds(src)
    os.makedirs(project.shared_data_dir, exist_ok=True)
    make_texture.write_civbig(os.path.join(project.shared_data_dir, name), payload,
                              type_flag=make_texture.CIVBIG_TYPE_TEXTURE)

    return {'slot': slot, 'name': name, 'size': len(payload),
            'width': width, 'height': height, 'mips': mips, 'fmt': dxgi,
            'tex_class': tex_class,
            # Raw payload, so bit 0x10 (Oodle-compressed) must stay clear.
            'flags': 0x82, 'copyFromShipped': False}, findings


def make_material(name, kind='standard', slots=None, tint_mode=None):
    """
    Build a manifest material row. Returns (row, findings).

    tintMode defaults differ by kind because the shipped materials do: the ordinary
    model material uses 8, the anisotropic one 28.
    """
    findings = []
    name = (name or '').strip()
    if not name:
        return None, [guards.Finding(guards.ERROR, 'material-unnamed',
                                     'a material needs a name -- meshes bind to it '
                                     'by a hash of exactly this string')]
    if kind not in KINDS:
        return None, [guards.Finding(guards.ERROR, 'material-kind',
                                     f'unknown material kind {kind!r}', name)]

    slots = {s: t for s, t in (slots or {}).items() if t}
    valid = set(slots_for(kind))
    for slot in sorted(set(slots) - valid):
        findings.append(guards.Finding(
            guards.ERROR, 'material-bad-slot',
            f'a {kind} material has no {slot} slot; it has '
            f'{", ".join(sorted(valid))}.', name))
    if any(f.level == guards.ERROR for f in findings):
        return None, findings

    if not slots:
        findings.append(guards.Finding(
            guards.WARNING, 'material-empty',
            'no textures, so anything using this renders plain white.', name))

    # Tinting is masked by the Tints texture, so without one it has nowhere to land.
    # Shipped materials with no Tints slot use tintMode 1.
    mode = tint_mode if tint_mode is not None else (8 if kind == 'standard' else 28)
    if 'tints' not in slots and tint_mode is None and mode != 1:
        mode = 1
        findings.append(guards.Finding(
            guards.WARNING, 'material-tint-without-mask',
            'no Tints texture, so team colour has no mask to land on. Using tintMode '
            '1, which is what shipped materials without a Tints slot use.', name))

    return {'name': name, 'kind': kind, 'tint_mode': mode, 'slots': slots}, findings


def check_materials(materials, material_textures):
    """
    Every slot must name a texture declared in this same package.

    A dangling slot pointer is the specific failure the package-local rule causes, and
    it produces an untextured surface rather than an error.
    """
    out = []
    declared = {t['name'] for t in material_textures}
    seen = set()
    for m in materials:
        name = m.get('name', '')
        if name in seen:
            out.append(guards.Finding(guards.ERROR, 'material-duplicate',
                                      f'{name} is defined twice', name))
        seen.add(name)
        for slot, texture in (m.get('slots') or {}).items():
            if texture not in declared:
                out.append(guards.Finding(
                    guards.ERROR, 'material-missing-texture',
                    f'{slot} points at {texture}, which is not declared in this '
                    f'package. Texture slots are package-local -- import or borrow '
                    f'it here, a reference to another package will not resolve.',
                    name))

    used = {t for m in materials for t in (m.get('slots') or {}).values()}
    for t in material_textures:
        if t['name'] not in used:
            out.append(guards.Finding(
                guards.WARNING, 'material-texture-unused',
                f'{t["name"]} is declared but no material uses it.', t['name']))
    return out
