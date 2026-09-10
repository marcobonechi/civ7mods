"""
End-to-end: a project folder in, a complete built/ tree out.

The interesting assertion is not that files appear but that the packages are
byte-identical to the ones already installed and confirmed working in-game. Everything
this app does is a rearrangement of how those bytes are described, so any difference is
a regression regardless of whether the result still validates.
"""
import os, sys, json, shutil
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from civ7_art_studio.project import Project
from civ7_art_studio import build as build_mod

# Derived from wherever the tools actually resolved to, not from counting parent
# directories -- this package is expected to be moved around.
from civ7_art_studio.tools import TOOLS_DIR
from conftest import CUSTOM_ART as MOD
from conftest import MANIFEST
GAME = os.environ.get('CIV7_GAME_ROOT', '/workspace/reference/full_game')
from conftest import INSTALLED

needs_game = pytest.mark.skipif(
    not os.path.isdir(os.path.join(GAME, 'DLC')) or not os.path.exists(MANIFEST),
    reason='game install or custom-art manifest not available')


@pytest.fixture(scope='module')
def built(tmp_path_factory):
    root = tmp_path_factory.mktemp('projects')
    p = Project.create(str(root), 'custom-art')
    with open(MANIFEST) as f:
        p.manifest = json.load(f)
    # Pin the donors the installed packages were actually built from. Two equally
    # valid donors produce byte-different packages, because the typeInfo stripe is
    # copied verbatim -- so without pinning, "matches the installed package" would
    # be testing which donor happens to be smallest today.
    p.manifest['donors'] = {
        'StandardAsset': 'DLC/joseon/Platforms/Windows/BLPs/StandardAsset.blp',
        'UI': 'DLC/heian-shell/Platforms/Windows/BLPs/UI.blp',
    }
    p.save()
    result = build_mod.build(p, GAME, sync=False)
    return p, result


# --- project scaffolding --------------------------------------------------

def test_create_makes_the_documented_layout(tmp_path):
    p = Project.create(str(tmp_path), 'MyCivMod')
    for kind in ('textures', 'meshes', 'audio', 'materials'):
        assert os.path.isdir(p.source_dir(kind))
    assert os.path.isdir(p.shared_data_dir)
    assert os.path.exists(p.manifest_path)
    # the two output roots are named for where they are copied to
    assert p.dlc_dir.endswith(os.path.join('built', 'DLC', 'MyCivMod'))
    assert p.mods_dir.endswith(os.path.join('built', 'Mods', 'MyCivMod'))


def test_create_rejects_a_name_that_cannot_be_a_folder(tmp_path):
    with pytest.raises(ValueError):
        Project.create(str(tmp_path), 'my mod!')


def test_create_refuses_to_clobber(tmp_path):
    Project.create(str(tmp_path), 'Thing')
    with pytest.raises(FileExistsError):
        Project.create(str(tmp_path), 'Thing')


def test_each_project_gets_its_own_guid(tmp_path):
    a = Project.create(str(tmp_path), 'A')
    b = Project.create(str(tmp_path), 'B')
    assert a.manifest['project']['guid'] != b.manifest['project']['guid']


def test_open_roundtrips(tmp_path):
    p = Project.create(str(tmp_path), 'Round')
    p.manifest['buildings'].append({'target': 'BIN_Monument_Scaled',
                                    'expression': '[BUILDING:X]',
                                    'priority': 1, 'weight': 1.0})
    p.save()
    assert Project.open(p.path).manifest == p.manifest


def test_list_finds_projects(tmp_path):
    Project.create(str(tmp_path), 'One')
    Project.create(str(tmp_path), 'Two')
    assert {e['name'] for e in Project.list(str(tmp_path))} == {'One', 'Two'}


# --- descriptors ----------------------------------------------------------

def test_dep_declares_only_what_was_built(tmp_path):
    p = Project.create(str(tmp_path), 'DepTest')
    xml = p.dep_xml(['StandardAsset', 'UI'])
    assert '<LibraryName text="StandardAsset"/>' in xml
    assert '<LibraryHash>3471015496</LibraryHash>' in xml
    assert '<LibraryName text="UI"/>' in xml
    # Material was not built, so its library must not be declared -- a declared
    # library with no package is looked for and not found.
    assert 'TiledMaterialLibrary' not in xml


def test_dep_carries_the_project_guid(tmp_path):
    p = Project.create(str(tmp_path), 'GuidTest')
    assert p.manifest['project']['guid'] in p.dep_xml(['StandardAsset'])


def test_modinfo_updates_art_in_both_scopes(tmp_path):
    p = Project.create(str(tmp_path), 'ScopeTest')
    xml = p.modinfo_xml()
    assert xml.count('<UpdateArt><Item>ScopeTest</Item></UpdateArt>') == 2
    assert 'scope="game"' in xml and 'scope="shell"' in xml


# --- the real build -------------------------------------------------------

@needs_game
def test_build_succeeds(built):
    _p, r = built
    assert r.ok, '\n'.join(r.log)


@needs_game
def test_builds_all_three_packages(built):
    _p, r = built
    assert set(r.packages) == {'StandardAsset', 'UI', 'Material'}


@needs_game
@pytest.mark.parametrize('package', ['StandardAsset', 'UI'])
def test_package_matches_the_installed_one(built, package):
    p, _r = built
    produced = open(os.path.join(p.blp_dir, f'{package}.blp'), 'rb').read()
    installed = open(os.path.join(INSTALLED, f'{package}.blp'), 'rb').read()
    assert produced == installed


@needs_game
def test_material_package_is_reproduced(built):
    """
    Material.blp is rebuilt from the manifest rather than build_material_blp's own
    constants, so this is the one package whose bytes could legitimately differ --
    check it is at least structurally sound and carries both materials.
    """
    p, _r = built
    data = open(os.path.join(p.blp_dir, 'Material.blp'), 'rb').read()
    assert data[:6] == b'CIVBLP'
    assert b'CIVILIZATION_PB_YAMATAI_BANNER_GAME_MATERIAL' in data
    assert b'SUZANNE_MATERIAL' in data


@needs_game
def test_dep_and_modinfo_land_in_the_right_halves(built):
    p, _r = built
    assert os.path.exists(os.path.join(p.dlc_dir, 'custom-art.dep'))
    assert os.path.exists(os.path.join(p.mods_dir, 'modules', 'custom-art.modinfo'))
    # the .modinfo must not end up in the DLC half, where it does nothing
    assert not os.path.exists(os.path.join(p.dlc_dir, 'custom-art.modinfo'))


@needs_game
def test_donor_was_chosen_not_assumed(built):
    _p, r = built
    assert 'joseon' in r.donors['StandardAsset']


@needs_game
def test_auto_selection_picks_a_working_donor(tmp_path):
    """With nothing pinned, selection must still produce a valid package."""
    p = Project.create(str(tmp_path), 'AutoDonor')
    with open(MANIFEST) as f:
        p.manifest = json.load(f)
    p.manifest.pop('donors', None)
    p.manifest['project']['name'] = 'AutoDonor'
    p.save()
    r = build_mod.build(p, GAME, sync=False)
    assert r.ok, '\n'.join(r.log)
    assert 'joseon' in r.donors['StandardAsset']


@needs_game
def test_build_pins_the_donors_it_chose(tmp_path):
    """
    A rebuild months later should reproduce the same bytes, so the choice is recorded
    rather than re-decided -- a new DLC could otherwise ship a smaller qualifying
    package and silently change the output.
    """
    p = Project.create(str(tmp_path), 'Pinned')
    build_mod.build(p, GAME, sync=False)
    assert Project.open(p.path).manifest['donors']['StandardAsset'].endswith('.blp')


@needs_game
def test_missing_blobs_are_reported(built):
    """
    A freshly built tree has no SHARED_DATA payloads until they are synced, and every
    one of those entries would dangle silently in-game. The check must notice.
    """
    p, _r = built
    missing = build_mod.missing_blobs(p)
    assert 'SOUNDBANK_Play_PB_Yamatai_First_Meet' in missing
    assert any(m.startswith('GB_') for m in missing)


@needs_game
def test_manifest_errors_stop_the_build(tmp_path):
    p = Project.create(str(tmp_path), 'Bad')
    p.manifest['improvements'] = [{'asset': 'IMP_Thing', 'type': ''}]
    p.save()
    r = build_mod.build(p, GAME, sync=False, validate=False)
    assert not r.ok
    assert any(f.code == 'improvements-untyped' for f in r.findings)


@needs_game
def test_empty_project_still_builds(tmp_path):
    """A new project must produce a loadable art group before it has any content."""
    p = Project.create(str(tmp_path), 'Fresh')
    r = build_mod.build(p, GAME, sync=False)
    assert r.ok, '\n'.join(r.log)
    assert r.packages == ['StandardAsset']
    assert os.path.exists(os.path.join(p.blp_dir, 'StandardAsset.blp'))
