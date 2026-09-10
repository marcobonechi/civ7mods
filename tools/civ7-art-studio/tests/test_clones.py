"""
Reusing a shipped asset: inspect, rename, repoint.

The operation is general — it was written for civ banners but knows nothing about
them. These tests use a banner and a building mesh side by side to keep that honest.

The rename map is the part worth checking hardest. A missed buffer name leaves the copy
reading the original's blob, so both assets share geometry and can never diverge — and
nothing reports it.
"""
import os, sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from civ7_art_studio import gameinfo, clones
from civ7_art_studio.project import Project
from civ7_art_studio.tools import TOOLS_DIR

GAME = os.environ.get('CIV7_GAME_ROOT', '/workspace/reference/full_game')
needs_game = pytest.mark.skipif(not os.path.isdir(os.path.join(GAME, 'DLC')),
                                reason='game install not available')

BANNER = 'CIVILIZATION_HEIAN_BANNER_GAME_ASSET'
BUILDING = 'IMP_Jinja_BldB'


@pytest.fixture(scope='module')
def index():
    return gameinfo.load_index(GAME)


# --- inspection -----------------------------------------------------------

@needs_game
def test_inspect_a_banner(index):
    info, findings = clones.inspect(GAME, index, BANNER)
    assert info is not None, [str(f) for f in findings]
    assert info['geometry'] > 0 and info['animation'] > 0
    assert info['package'].endswith('.blp')


@needs_game
def test_inspect_resolves_material_hashes_to_names(index):
    """Stored as bare 32-bit hashes; unresolved they tell you nothing."""
    info, _ = clones.inspect(GAME, index, BANNER)
    names = {m['name'] for m in info['materials']}
    assert 'CIVILIZATION_HEIAN_BANNER_GAME_MATERIAL' in names
    # the banner uses two, not one -- the default banner material is in there too
    assert 'CIVILIZATION_DEFAULT_BANNER_GAME_MATERIAL' in names


@needs_game
def test_material_hashes_that_are_not_material_entries_still_resolve(index):
    """
    The jinja building points at M_Wall_* names, which are ordinary asset entries
    rather than PackageMaterialEntry. Looking only at material entries left these
    showing as raw hashes.
    """
    info, _ = clones.inspect(GAME, index, BUILDING)
    assert info['materials'], 'this building should reference materials'
    assert all(m['name'] for m in info['materials']), \
        [m for m in info['materials'] if not m['name']]


@needs_game
def test_inspect_separates_owned_blobs_from_shared_ones(index):
    """
    The banner owns its geometry buffer and stateset, but its dozen animation blobs
    are shared with every other leader banner and must not be renamed.
    """
    info, _ = clones.inspect(GAME, index, BANNER)
    owned = {b['name'] for b in info['blobs'] if b['owned']}
    shared = {b['name'] for b in info['blobs'] if not b['owned']}
    assert 'GB_CIVILIZATION_HEIAN_BANNER_MB' in owned
    assert any(n.endswith('_StateSetBlob0') for n in owned)
    assert any(n.startswith('BLOB_LEAD_DIPLO_Banner') for n in shared)


@needs_game
def test_inspect_works_on_an_ordinary_building_mesh(index):
    """Nothing about this is banner-specific."""
    info, _ = clones.inspect(GAME, index, BUILDING)
    assert info is not None
    assert info['geometry'] > 0
    assert 'GB_IMP_Jinja_BldB_MB' in {b['name'] for b in info['blobs'] if b['owned']}


@needs_game
def test_inspect_rejects_an_unknown_asset(index):
    info, findings = clones.inspect(GAME, index, 'NOT_A_REAL_ASSET')
    assert info is None and any(f.code == 'clone-unknown-asset' for f in findings)


# --- renaming -------------------------------------------------------------

@needs_game
def test_derived_renames_match_the_hand_written_map(index):
    """
    The custom-art banner's rename map was written by hand. Deriving it has to produce
    exactly the same three entries, or the copy shares a blob with the original.
    """
    import json
    from conftest import MANIFEST as manifest
    if not os.path.exists(manifest):
        pytest.skip('custom-art manifest not present')
    with open(manifest) as f:
        hand = json.load(f)['clones'][0]['renames']

    info, _ = clones.inspect(GAME, index, BANNER)
    auto = clones.plan_renames(BANNER, 'CIVILIZATION_PB_YAMATAI_BANNER_GAME_ASSET',
                               info['blobs'])
    assert auto == hand


@needs_game
def test_shared_blobs_are_not_renamed(index):
    info, _ = clones.inspect(GAME, index, BANNER)
    auto = clones.plan_renames(BANNER, 'CIVILIZATION_X_BANNER_GAME_ASSET',
                               info['blobs'])
    assert not any(k.startswith('BLOB_LEAD_DIPLO_Banner') for k in auto)


def test_rename_keeps_the_buffer_suffix():
    blobs = [{'name': 'GB_MY_THING_MB', 'owned': True}]
    auto = clones.plan_renames('MY_THING', 'YOUR_THING', blobs)
    assert auto['GB_MY_THING_MB'] == 'GB_YOUR_THING_MB'


def test_stem_strips_the_asset_suffix():
    """Blob names carry the stem, not the full asset name."""
    assert clones._stem('CIVILIZATION_HEIAN_BANNER_GAME_ASSET') \
        == 'CIVILIZATION_HEIAN_BANNER'


# --- building the row -----------------------------------------------------

@needs_game
def test_make_clone_row(index):
    info, _ = clones.inspect(GAME, index, BANNER)
    row, findings = clones.make_clone(
        BANNER, 'CIVILIZATION_MINE_BANNER_GAME_ASSET', info['package'],
        {'CIVILIZATION_HEIAN_BANNER_GAME_MATERIAL': 'MY_MATERIAL'}, info['blobs'])
    assert row is not None, [str(f) for f in findings]
    assert row['newName'] == 'CIVILIZATION_MINE_BANNER_GAME_ASSET'
    assert row['assetList'] == 'assets'
    assert len(row['renames']) == 3


def test_clone_needs_a_new_name():
    row, findings = clones.make_clone('A', '', 'pkg.blp')
    assert row is None and any(f.code == 'clone-unnamed' for f in findings)


def test_clone_cannot_reuse_the_original_name():
    row, findings = clones.make_clone('A', 'A', 'pkg.blp')
    assert row is None and any(f.code == 'clone-same-name' for f in findings)


def test_clone_without_a_material_change_warns():
    _row, findings = clones.make_clone('A', 'B', 'pkg.blp')
    assert any(f.code == 'clone-no-material-change' for f in findings)


def test_asset_list_is_recorded():
    row, _ = clones.make_clone('A', 'B', 'pkg.blp', asset_list='leaders')
    assert row['assetList'] == 'leaders'


def test_clone_pointing_at_an_undefined_material_warns():
    rows = [{'newName': 'B', 'asset': 'A', 'materials': {'X': 'MY_MAT'}}]
    findings = clones.check_clones(rows, project_materials=[])
    assert any(f.code == 'clone-unknown-material' for f in findings)


def test_clone_pointing_at_a_defined_material_is_quiet():
    rows = [{'newName': 'B', 'asset': 'A', 'materials': {'X': 'MY_MAT'}}]
    findings = clones.check_clones(rows, project_materials=[{'name': 'MY_MAT'}])
    assert not any(f.code == 'clone-unknown-material' for f in findings)


# --- registration ---------------------------------------------------------

def test_registration_lists_are_derived_from_the_project_name():
    sys.path.insert(0, TOOLS_DIR)
    from build_blp import asset_list_names
    names = asset_list_names('my-mod')
    # the generic list is the default for a reused mesh; LEADERS is one kind of 22
    assert names['assets'] == 'ROOT_ASSETS_my-mod'
    assert names['leaders'] == 'ROOT_ASSETS_LEADERS_my-mod'


@needs_game
def test_clones_register_where_they_are_told(index, tmp_path):
    from civ7_art_studio import build as build_mod
    sys.path.insert(0, TOOLS_DIR)

    p = Project.create(str(tmp_path), 'CloneReg')
    info, _ = clones.inspect(GAME, index, BUILDING)
    row, _ = clones.make_clone(BUILDING, 'MY_JINJA', info['package'], {},
                               info['blobs'], asset_list='assets')
    p.manifest['clones'] = [row]
    p.save()

    r = build_mod.build(p, GAME, sync=False)
    assert r.ok, '\n'.join(r.log)
    data = open(os.path.join(p.blp_dir, 'StandardAsset.blp'), 'rb').read()
    assert b'MY_JINJA' in data
    assert b'ROOT_ASSETS_CloneReg' in data
    assert b'ROOT_ASSETS_LEADERS_CloneReg' not in data, \
        'a reused building mesh is not a leader asset'
