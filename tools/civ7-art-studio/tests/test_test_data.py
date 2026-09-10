"""
The fixture files in test_data/, run through the import paths a user would use.

These are real assets rather than synthesised ones: a BC5 normal map, a BC1 occlusion
mask, a BC4 tint mask, a BC7 civ symbol, a Wwise .wem and a 43k-vertex leader model.
Synthetic fixtures only ever prove the code handles what the code expects, which is
precisely the failure mode this project keeps hitting.

They are excluded from the wheel and the sdist -- megabytes of fixtures are no use to
an installed copy -- so every test here skips cleanly when they are absent.
"""
import os, sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from civ7_art_studio import guards, materials, importers
from civ7_art_studio.project import Project

from conftest import GAME, needs_game

DATA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    'test_data')
needs_data = pytest.mark.skipif(not os.path.isdir(DATA),
                                reason='test_data/ not present')

# (file, the slot it is meant for, the format it should turn out to be)
TEXTURES = [
    ('civ_sym_pb_yamatai_BC7.dds',   'base_color',   98),   # BC7, a UI symbol
    ('Moche_Normal_Banner.dds',      'normal',       83),   # BC5
    ('Moche_Occlussion_Banner.dds',  'orm',          71),   # BC1
    ('Moche_Tint_Banner.dds',        'tints',        80),   # BC4
]


@pytest.fixture
def project(tmp_path):
    return Project.create(str(tmp_path), 'DataTest')


# --- textures --------------------------------------------------------------

@needs_data
@pytest.mark.parametrize('name,slot,fmt', TEXTURES)
def test_each_fixture_is_the_format_its_slot_expects(name, slot, fmt):
    """
    These were authored for their slots, so each should pass its own class check and
    report the format that class ships as. A blanket BC7 rule would flag three of four.
    """
    cls = materials.SLOT_CLASS[slot]
    info, findings = guards.inspect_dds(os.path.join(DATA, name), cls)
    assert info is not None, [str(f) for f in findings]
    assert info['dxgi'] == fmt
    assert not any(f.code == 'texture-unexpected-format' for f in findings), \
        [str(f) for f in findings]


@needs_data
def test_the_normal_map_would_be_flagged_in_a_ui_slot():
    """The same file, wrong slot: BC5 is not what a UI texture should be."""
    _info, findings = guards.inspect_dds(
        os.path.join(DATA, 'Moche_Normal_Banner.dds'), 'UITexture')
    assert any(f.code == 'texture-unexpected-format' for f in findings)


@needs_data
def test_a_single_mip_texture_is_accepted():
    """
    The occlusion mask has one mip where the others have twelve. That is unusual but
    valid, and the entry simply has to say 1 -- it must not be rejected, and the mip
    count must not be inferred from the others.
    """
    info, _ = guards.inspect_dds(os.path.join(DATA, 'Moche_Occlussion_Banner.dds'),
                                 'Model_Occlusion')
    assert info['mips'] == 1
    assert info['width'] == info['height'] == 2048


@needs_data
@pytest.mark.parametrize('name,slot,fmt', TEXTURES)
def test_importing_a_fixture_records_what_it_measured(project, name, slot, fmt):
    row, findings = materials.import_slot_texture(
        project, os.path.join(DATA, name), name.split('.')[0].upper(), slot)
    assert row is not None, [str(f) for f in findings]
    assert row['fmt'] == fmt
    assert row['tex_class'] == materials.SLOT_CLASS[slot]

    # the entry is the blob's only description, so the size has to be the payload's
    blob = os.path.join(project.shared_data_dir, row['name'])
    with open(blob, 'rb') as f:
        head = f.read(16)
    import struct
    assert struct.unpack_from('<I', head, 8)[0] == row['size']


# --- audio -----------------------------------------------------------------

@needs_data
def test_the_wem_fixture_is_a_real_wem():
    info, findings = guards.inspect_wem(os.path.join(DATA, '110391493.wem'))
    assert info is not None, [str(f) for f in findings]
    assert info['channels'] == 1
    assert info['rate'] == 44100
    assert info['fmt_ext'] > 0, 'a Wwise wem carries an extended fmt chunk'


@needs_game
@needs_data
def test_importing_the_wem_builds_a_vorbis_bank(project):
    import struct
    row, findings = importers.import_audio(
        project, os.path.join(DATA, '110391493.wem'), 'Play_Fixture_Line', GAME,
        donor='2d')
    assert row is not None, [str(f) for f in findings]

    data = open(os.path.join(project.shared_data_dir, row['name']), 'rb').read()
    bank = data[16:16 + struct.unpack_from('<I', data, 8)[0]]
    off, sections = 0, {}
    while off + 8 <= len(bank):
        tag = bank[off:off + 4]
        n = struct.unpack_from('<I', bank, off + 4)[0]
        sections[tag] = (off + 8, n)
        off += 8 + n
    ho, _ = sections[b'HIRC']
    o = ho + 4
    for _ in range(struct.unpack_from('<I', bank, ho)[0]):
        t = bank[o]
        n = struct.unpack_from('<I', bank, o + 1)[0]
        if t == 2:
            assert struct.unpack_from('<I', bank, o + 9)[0] == 0x00040001, 'Vorbis'
            assert bank[o + 13] == 0, 'payload in the bank, not streamed'
        o += 5 + n


# --- meshes ----------------------------------------------------------------

@needs_data
def test_the_leader_model_imports(project):
    row, findings = importers.import_mesh(
        project, os.path.join(DATA, 'pedro.glb'), 'PEDRO', scale=10.0)
    assert row is not None, [str(f) for f in findings]
    assert row['vertex_count'] == 43008
    assert row['primitive_count'] == 65674
    assert row['max_index'] == row['vertex_count'] - 1


@needs_data
def test_the_leader_model_is_flagged_as_wildly_oversized(project):
    """
    At the default scale it comes out 1360 units tall against about 18 for a person --
    the model is authored in centimetres, not metres. Without the check it would be
    imported, built, and only noticed in-game as a figure taller than the map.
    """
    _row, findings = importers.import_mesh(
        project, os.path.join(DATA, 'pedro.glb'), 'PEDRO', scale=10.0)
    assert any(f.code == 'mesh-huge' for f in findings), [str(f) for f in findings]


@needs_data
def test_the_right_scale_puts_it_in_human_range(project):
    """1359.7 units at scale 10, so about 0.13 gets it to roughly 18."""
    row, findings = importers.import_mesh(
        project, os.path.join(DATA, 'pedro.glb'), 'PEDRO', scale=0.13)
    height = row['bounds'][5] - row['bounds'][2]
    assert 15 < height < 22, height
    assert not any(f.code in ('mesh-huge', 'mesh-tiny') for f in findings)


@needs_data
def test_the_model_is_grounded(project):
    row, _ = importers.import_mesh(project, os.path.join(DATA, 'pedro.glb'),
                                   'PEDRO', scale=0.13)
    assert row['bounds'][2] == 0.0


# --- the whole set through a build -----------------------------------------

@needs_game
@needs_data
def test_every_fixture_builds_into_a_package(project):
    from civ7_art_studio import build as build_mod

    rows = []
    for name, slot, _fmt in TEXTURES:
        row, _ = materials.import_slot_texture(
            project, os.path.join(DATA, name), name.split('.')[0].upper(), slot)
        rows.append(row)
    project.manifest['materialTextures'] = rows
    mat, _ = materials.make_material(
        'FIXTURE_MATERIAL', 'standard',
        {slot: r['name'] for (_n, slot, _f), r in zip(TEXTURES, rows)})
    project.manifest['materials'] = [mat]

    mesh, _ = importers.import_mesh(project, os.path.join(DATA, 'pedro.glb'),
                                    'PEDRO', scale=0.13, material='FIXTURE_MATERIAL')
    project.manifest['meshes'] = [mesh]

    bank, _ = importers.import_audio(project, os.path.join(DATA, '110391493.wem'),
                                     'Play_Fixture_Line', GAME, donor='2d')
    project.manifest['soundbanks'] = [bank]
    project.save()

    r = build_mod.build(project, GAME)
    assert r.ok, '\n'.join(r.log)
    assert set(r.packages) == {'StandardAsset', 'Material'}
    assert build_mod.missing_blobs(project) == [], 'every blob should be present'
