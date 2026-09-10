"""
Imports: a source file in, a blob plus a manifest row out.

The row and the blob have to agree, because the row is the blob's only description and
nothing at load time checks it. So the assertions here are mostly "does the number in
the manifest match the file that was written" -- a mismatch renders garbage rather than
raising anything.
"""
import os, sys, struct
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from civ7_art_studio import importers, guards
from civ7_art_studio.project import Project
from civ7_art_studio.tools import TOOLS_DIR

from conftest import RAW, CUSTOM_ART as MOD
GAME = os.environ.get('CIV7_GAME_ROOT', '/workspace/reference/full_game')

needs_game = pytest.mark.skipif(not os.path.isdir(os.path.join(GAME, 'DLC')),
                                reason='game install not available')


@pytest.fixture
def project(tmp_path):
    return Project.create(str(tmp_path), 'ImportTest')


def blob(project, name):
    return os.path.join(project.shared_data_dir, name)


def civbig_payload_size(path):
    """The size the CIVBIG header claims, which is what the entry must match."""
    with open(path, 'rb') as f:
        head = f.read(16)
    assert head[:6] == b'CIVBIG'
    return struct.unpack_from('<I', head, 8)[0]


# --- textures -------------------------------------------------------------

TEX = os.path.join(RAW, 'civ_sym_pb_yamatai_BC7.dds')
needs_tex = pytest.mark.skipif(not os.path.exists(TEX), reason='no sample DDS')


@needs_tex
def test_texture_import_writes_blob_and_row(project):
    row, findings = importers.import_texture(project, TEX, 'civ_sym_test')
    assert row is not None, [str(f) for f in findings]
    assert row['ui_name'] == 'civ_sym_test'
    assert os.path.exists(blob(project, 'TEXTURE_civ_sym_test'))


@needs_tex
def test_texture_row_matches_the_blob(project):
    """The declared size must be the payload size, or the loader reads the wrong count."""
    row, _ = importers.import_texture(project, TEX, 'civ_sym_test')
    assert row['size'] == civbig_payload_size(blob(project, 'TEXTURE_civ_sym_test'))


@needs_tex
def test_texture_flags_say_uncompressed(project):
    """
    Bit 0x10 means the payload is Oodle-compressed. We copy the DDS payload through
    raw, so it has to stay clear.
    """
    row, _ = importers.import_texture(project, TEX, 'civ_sym_test')
    assert not row['flags'] & 0x10


@needs_tex
def test_texture_keeps_a_copy_of_the_source(project):
    importers.import_texture(project, TEX, 'civ_sym_test')
    assert os.path.exists(os.path.join(project.source_dir('textures'),
                                       os.path.basename(TEX)))


@needs_tex
def test_texture_name_with_an_extension_is_refused(project):
    row, findings = importers.import_texture(project, TEX, 'civ_sym_test.png')
    assert row is None
    assert any(f.code == 'texture-name-extension' for f in findings)
    # and nothing was written under the bad name
    assert not os.path.exists(blob(project, 'TEXTURE_civ_sym_test.png'))


def test_uncompressed_dds_is_refused(project, tmp_path):
    bad = tmp_path / 'plain.dds'
    bad.write_bytes(b'DDS ' + b'\0' * 200)
    row, findings = importers.import_texture(project, str(bad), 'plain')
    assert row is None and findings


# --- audio ----------------------------------------------------------------

WEM = os.path.join(RAW, 'audio', 'FIRST_MEET_0E3DDC9D.wem')
needs_wem = pytest.mark.skipif(not os.path.exists(WEM), reason='no sample .wem')


@needs_game
@needs_wem
def test_audio_import_writes_bank_and_row(project):
    row, findings = importers.import_audio(project, WEM, 'Play_Test_Line', GAME)
    assert row is not None, [str(f) for f in findings]
    assert row['name'] == 'SOUNDBANK_Play_Test_Line'
    assert row['size'] == civbig_payload_size(blob(project, 'SOUNDBANK_Play_Test_Line'))


@needs_game
@needs_wem
def test_audio_bank_uses_vorbis_not_pcm(project):
    """
    PCM builds a bank that loads, returns a play id, and is silent -- the failure that
    cost the most time to find. The codec in the Sound object must be Vorbis.
    """
    importers.import_audio(project, WEM, 'Play_Test_Line', GAME)
    data = open(blob(project, 'SOUNDBANK_Play_Test_Line'), 'rb').read()
    size = struct.unpack_from('<I', data, 8)[0]
    bank = data[16:16 + size]

    off, sections = 0, {}
    while off + 8 <= len(bank):
        tag = bank[off:off + 4]
        n = struct.unpack_from('<I', bank, off + 4)[0]
        sections[tag] = (off + 8, n)
        off += 8 + n
    ho, _ = sections[b'HIRC']
    count = struct.unpack_from('<I', bank, ho)[0]
    o = ho + 4
    codecs = []
    for _ in range(count):
        t = bank[o]
        n = struct.unpack_from('<I', bank, o + 1)[0]
        if t == 2:                                    # Sound object
            codecs.append(struct.unpack_from('<I', bank, o + 9)[0])
            assert bank[o + 13] == 0, 'streamType must be 0 (payload is in the bank)'
        o += 5 + n
    assert codecs == [0x00040001], f'expected Vorbis, got {[hex(c) for c in codecs]}'


@needs_game
@needs_wem
def test_audio_event_id_is_the_name_hash(project):
    """The bank id is fnv1 of the name, which is how Sound.play finds the event."""
    sys.path.insert(0, TOOLS_DIR)
    import make_soundbank
    importers.import_audio(project, WEM, 'Play_Test_Line', GAME)
    data = open(blob(project, 'SOUNDBANK_Play_Test_Line'), 'rb').read()
    bank_id = struct.unpack_from('<I', data, 16 + 8 + 4)[0]
    assert bank_id == make_soundbank.fnv1_32('Play_Test_Line')


@needs_game
def test_renamed_wav_is_refused(project, tmp_path):
    fmt = struct.pack('<HHIIHH', 1, 1, 48000, 96000, 2, 16)
    body = b'WAVE' + b'fmt ' + struct.pack('<I', len(fmt)) + fmt \
         + b'data' + struct.pack('<I', 16) + b'\0' * 16
    bad = tmp_path / 'fake.wem'
    bad.write_bytes(b'RIFF' + struct.pack('<I', len(body)) + body)
    row, findings = importers.import_audio(project, str(bad), 'Play_Fake', GAME)
    assert row is None
    assert any(f.code == 'audio-not-wem' for f in findings)


@needs_game
@needs_wem
def test_audio_needs_a_name(project):
    row, findings = importers.import_audio(project, WEM, '', GAME)
    assert row is None
    assert any(f.code == 'audio-unnamed' for f in findings)


# --- meshes ---------------------------------------------------------------

GLB = os.path.join(RAW, 'suzanne.glb')
needs_glb = pytest.mark.skipif(not os.path.exists(GLB), reason='no sample .glb')


@needs_glb
def test_mesh_import_writes_buffer_and_row(project):
    row, findings = importers.import_mesh(project, GLB, 'SUZANNE_TEST')
    assert row is not None, [str(f) for f in findings]
    assert row['buffer'] == 'GB_SUZANNE_TEST_MB'
    assert row['buffer_size'] == civbig_payload_size(
        blob(project, 'GB_SUZANNE_TEST_MB'))


@needs_glb
def test_mesh_counts_come_from_the_conversion(project):
    """Suzanne's known geometry, so a silent change in the converter shows up here."""
    row, _ = importers.import_mesh(project, GLB, 'SUZANNE_TEST')
    assert row['vertex_count'] == 1966
    assert row['primitive_count'] == 968
    assert row['max_index'] == 1965


@needs_glb
def test_mesh_is_grounded(project):
    """A Blender model centred on the origin would sit half underground on a tile."""
    row, _ = importers.import_mesh(project, GLB, 'SUZANNE_TEST')
    assert row['bounds'][2] == 0.0


@needs_glb
def test_mesh_scale_is_checked_against_human_height(project):
    _row, findings = importers.import_mesh(project, GLB, 'TINY', scale=0.5)
    assert any(f.code == 'mesh-tiny' for f in findings)


@needs_glb
def test_mesh_without_material_warns(project):
    _row, findings = importers.import_mesh(project, GLB, 'SUZANNE_TEST')
    assert any(f.code == 'mesh-no-material' for f in findings)


@needs_glb
def test_mesh_with_material_does_not_warn(project):
    _row, findings = importers.import_mesh(project, GLB, 'SUZANNE_TEST',
                                           material='SUZANNE_MATERIAL')
    assert not any(f.code == 'mesh-no-material' for f in findings)


# --- imports reach the build ----------------------------------------------

@needs_game
@needs_glb
def test_imported_mesh_builds_and_gets_a_wrapper(project):
    from civ7_art_studio import build as build_mod
    row, _ = importers.import_mesh(project, GLB, 'SUZANNE_TEST',
                                   material='SUZANNE_MATERIAL')
    project.manifest.setdefault('meshes', []).append(row)
    project.save()

    r = build_mod.build(project, GAME, sync=False)
    assert r.ok, '\n'.join(r.log)
    data = open(os.path.join(project.blp_dir, 'StandardAsset.blp'), 'rb').read()
    assert b'SUZANNE_TEST' in data
    # footprint targets must be wrappers, so one is emitted alongside the geometry
    assert b'SUZANNE_TEST_Scaled' in data


# --- names are required ----------------------------------------------------
# Every individual check tolerated an empty name, so one slipped all the way through
# to a blob called TEXTURE_ or GB__MB that nothing could ever reference.

@needs_tex
def test_texture_import_refuses_an_empty_name(project):
    row, findings = importers.import_texture(project, TEX, '')
    assert row is None
    assert any(f.code == 'texture-unnamed' for f in findings)
    assert not os.path.exists(blob(project, 'TEXTURE_'))


@needs_glb
def test_mesh_import_refuses_an_empty_name(project):
    row, findings = importers.import_mesh(project, GLB, '   ')
    assert row is None
    assert any(f.code == 'mesh-unnamed' for f in findings)
    assert not os.path.exists(blob(project, 'GB__MB'))


@needs_glb
def test_mesh_import_refuses_an_unusable_name(project):
    row, findings = importers.import_mesh(project, GLB, 'my model')
    assert row is None and any(f.code == 'mesh-name-charset' for f in findings)


@needs_game
@needs_wem
def test_audio_import_refuses_an_unusable_name(project):
    """The name becomes the event id, hashed from exactly this string."""
    row, findings = importers.import_audio(project, WEM, 'Play Test Line', GAME)
    assert row is None and any(f.code == 'audio-name-charset' for f in findings)


# --- deleting an import removes its blob -----------------------------------

@needs_tex
def test_deleting_a_texture_removes_the_blob(project):
    """A row deleted alone leaves the file behind as stray dead weight."""
    from civ7_art_studio import server
    row, _ = importers.import_texture(project, TEX, 'doomed')
    project.manifest['uiTextures'] = [row]
    project.save()
    assert os.path.exists(blob(project, 'TEXTURE_doomed'))

    server.STATE['project'] = project
    from starlette.testclient import TestClient
    with TestClient(server.app) as c:
        r = c.delete('/api/import/texture/doomed').json()
    assert r['ok'] and 'TEXTURE_doomed' in r['removedBlobs']
    assert not os.path.exists(blob(project, 'TEXTURE_doomed'))
    assert project.manifest['uiTextures'] == []


@needs_glb
def test_deleting_a_mesh_removes_its_buffer(project):
    from civ7_art_studio import server
    from starlette.testclient import TestClient
    row, _ = importers.import_mesh(project, GLB, 'DOOMED_MESH')
    project.manifest['meshes'] = [row]
    project.save()

    server.STATE['project'] = project
    with TestClient(server.app) as c:
        r = c.delete('/api/import/mesh/DOOMED_MESH').json()
    assert r['ok'] and 'GB_DOOMED_MESH_MB' in r['removedBlobs']
    assert not os.path.exists(blob(project, 'GB_DOOMED_MESH_MB'))
