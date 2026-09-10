"""
Turn a file the modder picked into a blob plus the manifest row that describes it.

The two halves must agree exactly. A package entry is the *only* description of its
blob -- size, dimensions, mip count, format -- and nothing at load time checks that the
description matches the bytes; a wrong size just makes the loader read the wrong number
of them. So every field written into the manifest here is measured from the payload
that was actually written, never taken from what the user typed or from a filename.

Each importer returns (row, findings). The row is appended to the manifest by the
caller, so an import that produces warnings can still be reviewed before it is kept.
"""
import os, shutil

from . import guards
from .tools import ensure_on_path

# Wwise banks with 3D positioning route to a bus expecting an emitter, which is right
# for a wonder ambience and wrong for a voice line played from the UI.
AUDIO_DONORS = {
    '3d': ('DLC/asia-wonders/Platforms/Windows/BLPs/SHARED_DATA/'
           'SOUNDBANK_Play_Wonder_SFX_Braziers'),
    '2d': ('DLC/heian-shell/Platforms/Windows/BLPs/SHARED_DATA/'
           'SOUNDBANK_UI_Leader_Banner_Drop'),
}


def _stash(project, kind, src):
    """Keep a copy of the source next to the project so it stays self-contained."""
    dest = project.source_dir(kind)
    os.makedirs(dest, exist_ok=True)
    target = os.path.join(dest, os.path.basename(src))
    if os.path.abspath(src) != os.path.abspath(target):
        shutil.copy2(src, target)
    return target


# ---------------------------------------------------------------------------
# Textures
# ---------------------------------------------------------------------------

def import_texture(project, src, ui_name, ui_entry=True):
    """
    A BC-compressed DDS becomes SHARED_DATA/TEXTURE_<name> plus a manifest row.

    The payload is copied through untouched, so what ships is exactly what the
    modder's encoder produced -- no re-encode, and none of the quality loss the
    built-in mode-6-only BC7 encoder would introduce.
    """
    ensure_on_path()
    import make_texture

    findings = guards.check_texture_name(ui_name)
    info, dds_findings = guards.inspect_dds(src, 'UITexture')
    findings += dds_findings
    if info is None or any(f.level == guards.ERROR for f in findings):
        return None, findings

    kind, payload, width, height, mips, dxgi = make_texture.read_dds(src)
    _stash(project, 'textures', src)

    blob = os.path.join(project.shared_data_dir, 'TEXTURE_' + ui_name)
    os.makedirs(project.shared_data_dir, exist_ok=True)
    make_texture.write_civbig(blob, payload, type_flag=make_texture.CIVBIG_TYPE_TEXTURE)

    row = {
        'ui_name': ui_name,
        'size': len(payload),          # measured, not declared
        'width': width, 'height': height, 'mips': mips,
        'fmt': dxgi, 'tex_class': 'UITexture',
        # bit 0x10 means the payload is Oodle-compressed. We copy it through raw, so
        # it must stay clear or the loader tries to decompress uncompressed bytes.
        'flags': 0x82,
    }
    if not ui_entry:
        row['tex_class'] = 'Model_BaseColor'
    return row, findings


# ---------------------------------------------------------------------------
# Audio
# ---------------------------------------------------------------------------

def import_audio(project, src, bank_name, game_root, donor='3d'):
    """
    A Wwise .wem becomes SHARED_DATA/SOUNDBANK_<name> plus a manifest row.

    The bank is a shipped one with its audio swapped rather than authored from
    scratch: a Sound object carries bus routing, positioning and RTPC slots that we
    have no reason to change and no way to reconstruct, and a bank generated wholesale
    by Wwise would carry bus ids hashed from the modder's own hierarchy that resolve
    to nothing at runtime.
    """
    ensure_on_path()
    import make_soundbank, make_texture

    info, findings = guards.inspect_wem(src)
    if info is None:
        return None, findings
    named = guards.check_name(bank_name, 'audio', 'SOUNDBANK_')
    if named:
        # The name is also the event id Sound.play takes, hashed from exactly this
        # string, so it has to be both present and hashable.
        return None, findings + named

    donor_path = os.path.join(game_root, AUDIO_DONORS.get(donor, AUDIO_DONORS['3d']))
    if not os.path.exists(donor_path):
        findings.append(guards.Finding(guards.ERROR, 'audio-donor-missing',
                                       f'donor bank not found: {donor_path}'))
        return None, findings

    _stash(project, 'audio', src)
    wem, _ch, _rate, _fmtlen = make_soundbank.read_wem(src)
    bank = make_soundbank.build_bank(donor_path, bank_name, wem,
                                     plugin=make_soundbank.PLUGIN_VORBIS,
                                     verbose=False)

    os.makedirs(project.shared_data_dir, exist_ok=True)
    blob = os.path.join(project.shared_data_dir, 'SOUNDBANK_' + bank_name)
    make_soundbank.write_civbig(blob, bank, type_flag=3)

    return {'name': 'SOUNDBANK_' + bank_name, 'size': len(bank)}, findings


# ---------------------------------------------------------------------------
# Meshes
# ---------------------------------------------------------------------------

def import_mesh(project, src, asset_name, scale=10.0, material='',
                wrapper_scale=1.0, flip_winding=False, ground=True):
    """
    A .glb becomes SHARED_DATA/GB_<name>_MB plus a manifest row.

    The counts and bounds in the row come from the conversion, because they describe
    the buffer that was just written -- a mismatch between nVertexCount and the actual
    data is not detected anywhere, it just renders garbage.
    """
    ensure_on_path()
    import import_gltf

    findings = guards.check_name(asset_name, 'mesh', 'GB__MB')
    if findings:
        return None, findings
    if not os.path.exists(src):
        return None, [guards.Finding(guards.ERROR, 'mesh-missing',
                                     f'{src} does not exist', src)]

    _stash(project, 'meshes', src)
    buffer_name = f'GB_{asset_name}_MB'
    os.makedirs(project.shared_data_dir, exist_ok=True)

    try:
        stats = import_gltf.convert(
            src, os.path.join(project.shared_data_dir, buffer_name),
            scale=scale, flip_winding=flip_winding, ground=ground)
    except SystemExit as e:
        return None, [guards.Finding(guards.ERROR, 'mesh-unreadable', str(e), src)]

    lo, hi = stats['bounds'][:3], stats['bounds'][3:]
    height = hi[2] - lo[2]
    if height < 4:
        findings.append(guards.Finding(
            guards.WARNING, 'mesh-tiny',
            f'{height:.1f} units tall. A person is about 18, so this will be hard to '
            f'see -- raise the import scale.', asset_name))
    elif height > 80:
        findings.append(guards.Finding(
            guards.WARNING, 'mesh-huge',
            f'{height:.1f} units tall, against about 18 for a person.', asset_name))
    if not material:
        findings.append(guards.Finding(
            guards.WARNING, 'mesh-no-material',
            'no material, so this renders plain white.', asset_name))

    row = {
        'asset': asset_name,
        'buffer': buffer_name,
        'buffer_size': stats['payload'],
        'vertex_offset': 0, 'vertex_count': stats['vertices'],
        'index_start': stats['index_start'],
        'primitive_count': stats['triangles'],
        'min_index': 0, 'max_index': stats['vertices'] - 1,
        'bounds': [round(v, 2) for v in stats['bounds']],
        'wrapper_scale': wrapper_scale,
    }
    if material:
        row['material'] = material
    return row, findings
