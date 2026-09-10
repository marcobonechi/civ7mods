"""
Materials: slots, borrowing, authoring, and the package-local rule.

The rule that shapes everything: a material resolves across packages by name hash, but
its texture slots are allocation pointers and do not. So every texture a material uses
must be declared in the same package with its blob alongside, and a slot pointing
anywhere else produces an untextured surface with no error.
"""
import os, sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from civ7_art_studio import gameinfo, materials, guards
from civ7_art_studio.project import Project
from civ7_art_studio.tools import TOOLS_DIR

from conftest import RAW, CUSTOM_ART as MOD
GAME = os.environ.get('CIV7_GAME_ROOT', '/workspace/reference/full_game')
needs_game = pytest.mark.skipif(not os.path.isdir(os.path.join(GAME, 'DLC')),
                                reason='game install not available')


@pytest.fixture(scope='module')
def index():
    return gameinfo.load_index(GAME)


@pytest.fixture
def project(tmp_path):
    return Project.create(str(tmp_path), 'MatTest')


# --- slots ----------------------------------------------------------------

def test_the_two_kinds_have_different_slots():
    std, aniso = set(materials.slots_for('standard')), set(materials.slots_for('aniso'))
    assert 'anisotropy' in aniso and 'anisotropy' not in std
    assert 'emissive' in std and 'emissive' not in aniso
    assert {'base_color', 'normal', 'orm', 'tints'} <= std & aniso


def test_slot_classes_are_not_guessable_from_the_name():
    """The names would suggest otherwise, so these come from the shipped data."""
    assert materials.SLOT_CLASS['orm'] == 'Model_Occlusion'
    assert materials.SLOT_CLASS['translucency'] == 'Model_TranslucencyMask'


# --- format expectations --------------------------------------------------

def test_ui_textures_are_bc7_but_model_textures_are_not():
    """
    A blanket BC7 check would reject every correctly authored normal and mask map.
    """
    assert materials.CLASS_FORMATS['UITexture'][0] == 98
    assert materials.CLASS_FORMATS['Model_Normal'][0] == 83        # BC5
    assert materials.CLASS_FORMATS['Model_Occlusion'][0] == 71     # BC1
    assert materials.CLASS_FORMATS['Model_Tint'][0] == 80          # BC4
    assert materials.CLASS_FORMATS['Model_BaseColor'][0] == 72     # BC1 sRGB, not BC7


@needs_game
def test_the_format_table_matches_the_installed_game(index):
    """
    Regenerate the claim rather than trusting it: if a patch changes what a class
    ships as, this fails instead of the guard quietly misreporting.
    """
    import collections
    by_class = collections.defaultdict(collections.Counter)
    for info in index['textures'].values():
        by_class[info['tex_class']][info['fmt']] += 1

    for cls, (preferred, accepted) in materials.CLASS_FORMATS.items():
        counts = by_class.get(cls)
        if not counts:
            continue
        commonest = counts.most_common(1)[0][0]
        assert commonest == preferred, f'{cls}: shipped art favours {commonest}'
        # every format that appears at all often should be accepted
        total = sum(counts.values())
        for fmt, n in counts.items():
            if n / total > 0.05:
                assert fmt in accepted, f'{cls}: {fmt} is {100*n//total}% of shipped'


@needs_game
def test_an_authored_normal_map_is_not_flagged_for_being_bc5():
    """The false positive a blanket BC7 rule would produce."""
    normal = os.path.join(RAW, 'TEXTURE_CIVILIZATION_PB_YAMATAI_BANNER_N.dds')
    if not os.path.exists(normal):
        pytest.skip('no sample normal map')
    info, findings = guards.inspect_dds(normal, 'Model_Normal')
    assert info is not None
    assert not any(f.code == 'texture-unexpected-format' for f in findings)


@needs_game
def test_the_same_file_in_a_ui_slot_is_flagged():
    normal = os.path.join(RAW, 'TEXTURE_CIVILIZATION_PB_YAMATAI_BANNER_N.dds')
    if not os.path.exists(normal):
        pytest.skip('no sample normal map')
    _info, findings = guards.inspect_dds(normal, 'UITexture')
    assert any(f.code == 'texture-unexpected-format' for f in findings)


# --- borrowing ------------------------------------------------------------

@needs_game
def test_borrow_copies_the_blob_and_restates_every_field(project, index):
    name = 'TEXTURE_lsbg_heian_1080'
    row, findings = materials.borrow(project, GAME, index, name)
    assert row is not None, [str(f) for f in findings]

    shipped = index['textures'][name]
    for field in ('size', 'width', 'height', 'mips', 'fmt', 'flags', 'tex_class'):
        assert row[field] == shipped[field], field

    blob = os.path.join(project.shared_data_dir, name)
    assert os.path.exists(blob)
    assert os.path.getsize(blob) >= row['size']


@needs_game
def test_borrowed_blob_is_byte_identical(project, index):
    name = 'TEXTURE_lsbg_heian_1080'
    materials.borrow(project, GAME, index, name)
    src = os.path.join(GAME, os.path.dirname(index['textures'][name]['package']),
                       'SHARED_DATA', name)
    assert open(src, 'rb').read() == \
        open(os.path.join(project.shared_data_dir, name), 'rb').read()


@needs_game
def test_borrow_keeps_the_oodle_flag(project, index):
    """
    Shipped blobs are Oodle-compressed and copied as-is, so bit 0x10 must stay set --
    clearing it would make the loader read compressed bytes as raw pixels.
    """
    row, _ = materials.borrow(project, GAME, index, 'TEXTURE_lsbg_heian_1080')
    assert row['flags'] & 0x10
    assert row['copyFromShipped'] is True


@needs_game
def test_borrow_warns_when_the_class_does_not_fit_the_slot(project, index):
    row, findings = materials.borrow(project, GAME, index,
                                     'TEXTURE_lsbg_heian_1080', slot='normal')
    assert row is not None
    assert any(f.code == 'texture-class-mismatch' for f in findings)


@needs_game
def test_borrow_refuses_an_unknown_texture(project, index):
    row, findings = materials.borrow(project, GAME, index, 'TEXTURE_NOPE')
    assert row is None and any(f.code == 'texture-unknown' for f in findings)


# --- authoring ------------------------------------------------------------

TEX = os.path.join(RAW, 'civ_sym_pb_yamatai_BC7.dds')
needs_tex = pytest.mark.skipif(not os.path.exists(TEX), reason='no sample DDS')


@needs_tex
def test_author_a_slot_texture(project):
    row, findings = materials.import_slot_texture(project, TEX, 'MY_BASE', 'base_color')
    assert row is not None, [str(f) for f in findings]
    assert row['name'] == 'TEXTURE_MY_BASE'
    assert row['tex_class'] == 'Model_BaseColor'
    assert row['copyFromShipped'] is False
    assert not row['flags'] & 0x10, 'authored payloads are raw, not Oodle'
    assert os.path.exists(os.path.join(project.shared_data_dir, 'TEXTURE_MY_BASE'))


@needs_tex
def test_authoring_a_mask_slot_uses_the_mask_class(project):
    """
    The path that matters once occlusion and tint masks are painted externally: the
    slot decides the texture class, not the file.
    """
    row, _ = materials.import_slot_texture(project, TEX, 'MY_ORM', 'orm')
    assert row['tex_class'] == 'Model_Occlusion'
    row, _ = materials.import_slot_texture(project, TEX, 'MY_TINTS', 'tints')
    assert row['tex_class'] == 'Model_Tint'


@needs_tex
def test_authored_texture_keeps_a_copy_of_the_source(project):
    materials.import_slot_texture(project, TEX, 'MY_BASE', 'base_color')
    assert os.path.exists(os.path.join(project.source_dir('materials'),
                                       os.path.basename(TEX)))


@needs_tex
def test_authored_texture_name_with_an_extension_is_refused(project):
    row, findings = materials.import_slot_texture(project, TEX, 'my.png', 'base_color')
    assert row is None and any(f.code == 'texture-name-extension' for f in findings)


# --- materials ------------------------------------------------------------

def test_make_material_defaults_tint_mode_by_kind():
    std, _ = materials.make_material('M', 'standard', {'tints': 'TEXTURE_T'})
    ani, _ = materials.make_material('A', 'aniso', {'tints': 'TEXTURE_T'})
    assert std['tint_mode'] == 8 and ani['tint_mode'] == 28


def test_material_without_a_tint_mask_falls_back_to_mode_one():
    """Team colour has nothing to land on without a Tints texture."""
    row, findings = materials.make_material('M', 'standard',
                                            {'base_color': 'TEXTURE_B'})
    assert row['tint_mode'] == 1
    assert any(f.code == 'material-tint-without-mask' for f in findings)


def test_explicit_tint_mode_is_respected():
    row, _ = materials.make_material('M', 'standard', {'base_color': 'TEXTURE_B'},
                                     tint_mode=8)
    assert row['tint_mode'] == 8


def test_material_needs_a_name():
    row, findings = materials.make_material('', 'standard', {})
    assert row is None and any(f.code == 'material-unnamed' for f in findings)


def test_a_slot_the_kind_does_not_have_is_an_error():
    row, findings = materials.make_material('M', 'standard',
                                            {'anisotropy': 'TEXTURE_A'})
    assert row is None
    assert any(f.code == 'material-bad-slot' for f in findings)


def test_empty_material_warns_about_white():
    _row, findings = materials.make_material('M', 'standard', {})
    assert any(f.code == 'material-empty' for f in findings)


# --- the package-local rule ------------------------------------------------

def test_slot_pointing_at_an_undeclared_texture_is_an_error():
    findings = materials.check_materials(
        [{'name': 'M', 'slots': {'base_color': 'TEXTURE_ELSEWHERE'}}], [])
    assert any(f.code == 'material-missing-texture' for f in findings)
    assert 'package-local' in next(f for f in findings
                                   if f.code == 'material-missing-texture').message


def test_slot_pointing_at_a_declared_texture_is_fine():
    findings = materials.check_materials(
        [{'name': 'M', 'slots': {'base_color': 'TEXTURE_MINE'}}],
        [{'name': 'TEXTURE_MINE'}])
    assert not any(f.code == 'material-missing-texture' for f in findings)


def test_unused_declared_texture_warns():
    findings = materials.check_materials([], [{'name': 'TEXTURE_ORPHAN'}])
    assert any(f.code == 'material-texture-unused' for f in findings)


def test_duplicate_material_is_an_error():
    findings = materials.check_materials(
        [{'name': 'M', 'slots': {}}, {'name': 'M', 'slots': {}}], [])
    assert any(f.code == 'material-duplicate' for f in findings)


# --- through the build ----------------------------------------------------

@needs_game
@needs_tex
def test_a_material_builds_into_a_package(project, index):
    from civ7_art_studio import build as build_mod

    base, _ = materials.import_slot_texture(project, TEX, 'MY_BASE', 'base_color')
    orm, _ = materials.borrow(project, GAME, index,
                              'TEXTURE_Autogen_ORM_1C40753B_C897E224_3DFD00B1', 'orm')
    project.manifest['materialTextures'] = [base] + ([orm] if orm else [])
    slots = {'base_color': base['name']}
    if orm:
        slots['orm'] = orm['name']
    mat, findings = materials.make_material('MY_MATERIAL', 'standard', slots)
    project.manifest['materials'] = [mat]
    project.save()

    r = build_mod.build(project, GAME, sync=False)
    assert r.ok, '\n'.join(r.log)
    assert 'Material' in r.packages
    data = open(os.path.join(project.blp_dir, 'Material.blp'), 'rb').read()
    assert b'MY_MATERIAL' in data
    assert b'TEXTURE_MY_BASE' in data
