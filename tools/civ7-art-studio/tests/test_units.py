"""
Units: decode a shipped unit, rename it, swap its members.

The load-bearing test is the round trip. Decoding a ValueSet into the manifest tree and
re-emitting it has to produce the same bytes, because that is the only evidence the
decoder understood what it read -- a subtly wrong tree still builds a package that
validates, loads, and renders a unit that is not the one anyone asked for.
"""
import os, sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from civ7_art_studio import gameinfo, units, guards
from civ7_art_studio.project import Project
from civ7_art_studio.tools import TOOLS_DIR

GAME = os.environ.get('CIV7_GAME_ROOT', '/workspace/reference/full_game')
needs_game = pytest.mark.skipif(not os.path.isdir(os.path.join(GAME, 'DLC')),
                                reason='game install not available')

DONOR = 'UNIT_ARCHER'


@pytest.fixture(scope='module')
def index():
    return gameinfo.load_index(GAME)


@pytest.fixture(scope='module')
def archer(index):
    return gameinfo.read_metadata(GAME, DONOR, index)


# --- decoding -------------------------------------------------------------

@needs_game
def test_decodes_a_unit(archer):
    assert archer['cls'] == 'UnitMetaData'
    assert len(archer['params']) > 40, 'a unit carries ~49 parameters'


@needs_game
def test_decodes_the_member_list(archer):
    members = units.read_members(archer['params'])
    assert len(members) == 8
    assert all(m['asset'] == 'MEMBER_ARCHER' for m in members)
    assert members[0]['scale'] == 1.0 and members[0]['promotion'] == 1


@needs_game
def test_summary_pulls_out_the_useful_fields(archer):
    s = units.summarise(archer['params'])
    assert s['formation'] == 'Formation_8_Range'
    assert s['memberAsset'] == 'MEMBER_ARCHER'
    assert s['memberCount'] == 8
    assert s['maxSpeed'] == 42.0
    assert s['movementType'] == 'MOVEMENT_TYPE_UNITFLAG'


@needs_game
def test_collection_element_type_is_preserved(archer):
    """
    It lives at +24 and is written straight back into m_eValueType. Dropping it would
    still produce a package that builds.
    """
    spec = dict((p, s) for p, s in archer['params'])['MemberInfo']
    assert spec[0] == 'collection' and spec[1] == 'tuple'


@needs_game
def test_empty_strings_survive_as_empty(archer):
    """
    Several entry references ship with an empty library or entry, and empty must stay
    empty -- the emitter turns it into a null pointer, and a zero-length string would
    read back as '\\x01' instead.
    """
    d = dict((p, s) for p, s in archer['params'])
    assert d['CombatFormation'][1]['library'] == ''
    assert d['PackedUnit'][1]['entry'] == ''


@needs_game
def test_non_unit_metadata_is_refused(index):
    data = gameinfo.read_metadata(GAME, 'BIN_Monument_Scaled', index)
    assert data is None, 'that is an asset entry, not metadata'


# --- the round trip -------------------------------------------------------

@needs_game
def test_decoded_unit_re_emits_identically(archer, tmp_path):
    """
    Emit the decoded tree, then decode it back out of our own package and compare. If
    the decoder misread a field, the second read disagrees with the first.
    """
    sys.path.insert(0, TOOLS_DIR)
    import build_blp, donors

    project = {'project': {'name': 'roundtrip'},
               'units': [{'name': DONOR, 'cls': 'UnitMetaData',
                          'params': archer['params']}]}
    donor_pkg, _needed, _ok = donors.select(GAME, project)
    data, _b = build_blp.build_package(project, donor_pkg, GAME)

    out = tmp_path / 'StandardAsset.blp'
    out.write_bytes(data)

    ours = gameinfo.read_metadata(
        str(tmp_path), DONOR,
        {'assets': {DONOR: {'type': 'PackageAssetEntry_Metadata0',
                            'packages': ['StandardAsset.blp']}}})
    assert ours is not None
    assert ours['params'] == archer['params']


# --- deriving -------------------------------------------------------------

@needs_game
def test_derive_without_changes_is_a_faithful_copy(archer):
    assert units.derive(archer['params']) == archer['params']


@needs_game
def test_derive_swaps_the_member_asset(archer):
    params = units.derive(archer['params'], member_asset='MEMBER_SPEARMAN')
    members = units.read_members(params)
    assert len(members) == 8
    assert all(m['asset'] == 'MEMBER_SPEARMAN' for m in members)


@needs_game
def test_derive_leaves_everything_else_alone(archer):
    """Movement, formations and the other 47 parameters are the donor's."""
    params = units.derive(archer['params'], member_asset='MEMBER_SPEARMAN')
    before = [(p, s) for p, s in archer['params'] if p != 'MemberInfo']
    after = [(p, s) for p, s in params if p != 'MemberInfo']
    assert before == after


@needs_game
def test_derive_renumbers_when_the_count_changes(archer):
    params = units.derive(archer['params'], member_count=3)
    names = [n for n, _ in dict((p, s) for p, s in params)['MemberInfo'][2]]
    assert names == ['MemberInfo001', 'MemberInfo002', 'MemberInfo003']


@needs_game
def test_derive_can_grow_the_member_list(archer):
    params = units.derive(archer['params'], member_count=12)
    assert len(units.read_members(params)) == 12


@needs_game
def test_derive_sets_scale_and_promotion(archer):
    params = units.derive(archer['params'], scale=1.5, promotion=2)
    m = units.read_members(params)[0]
    assert m['scale'] == 1.5 and m['promotion'] == 2


# --- make_unit ------------------------------------------------------------

@needs_game
def test_make_unit_builds_a_row(archer):
    row, findings = units.make_unit('UNIT_MY_ARCHER', DONOR, archer['params'])
    assert row is not None, [str(f) for f in findings]
    assert row['name'] == 'UNIT_MY_ARCHER'
    assert row['cls'] == 'UnitMetaData'
    assert row['copiedFrom'] == DONOR


@needs_game
def test_make_unit_requires_a_name(archer):
    row, findings = units.make_unit('', DONOR, archer['params'])
    assert row is None and any(f.code == 'unit-unnamed' for f in findings)


@needs_game
def test_make_unit_rejects_an_impossible_name(archer):
    row, findings = units.make_unit('UNIT MY ARCHER!', DONOR, archer['params'])
    assert row is None and any(f.code == 'unit-name-charset' for f in findings)


@needs_game
def test_make_unit_warns_about_the_naming_convention(archer):
    """The asset name must equal the UnitType, and the hash is case-sensitive."""
    _row, findings = units.make_unit('MyArcher', DONOR, archer['params'])
    assert any(f.code == 'unit-name-convention' for f in findings)


def test_make_unit_refuses_a_unit_with_no_members():
    row, findings = units.make_unit('UNIT_EMPTY', 'NONE',
                                    [['Movement', ['tuple', []]]])
    assert row is None and any(f.code == 'unit-no-members' for f in findings)


def test_check_units_catches_duplicates():
    rows = [{'name': 'UNIT_X', 'params': []}, {'name': 'UNIT_X', 'params': []}]
    assert any(f.code == 'unit-duplicate' for f in units.check_units(rows))


@needs_game
def test_check_units_flags_a_member_that_does_not_exist(archer, index):
    row, _ = units.make_unit('UNIT_TYPO', DONOR, archer['params'],
                             member_asset='MEMBER_ARHCER')
    findings = units.check_units([row], set(index['assets']))
    assert any(f.code == 'unit-unknown-member' for f in findings)


@needs_game
def test_check_units_accepts_a_real_member(archer, index):
    row, _ = units.make_unit('UNIT_FINE', DONOR, archer['params'],
                             member_asset='MEMBER_ARCHER')
    assert units.check_units([row], set(index['assets'])) == []


# --- through the build ----------------------------------------------------

@needs_game
def test_a_derived_unit_builds(archer, tmp_path):
    from civ7_art_studio import build as build_mod
    p = Project.create(str(tmp_path), 'UnitBuild')
    row, _ = units.make_unit('UNIT_MY_ARCHER', DONOR, archer['params'],
                             member_asset='MEMBER_SPEARMAN', member_count=4)
    p.manifest['units'].append(row)
    p.save()

    r = build_mod.build(p, GAME, sync=False)
    assert r.ok, '\n'.join(r.log)
    data = open(os.path.join(p.blp_dir, 'StandardAsset.blp'), 'rb').read()
    assert b'UNIT_MY_ARCHER' in data
    assert b'MEMBER_SPEARMAN' in data


# --- nothing may be dropped ------------------------------------------------
# The round-trip test above compares a decode against a decode, so a value the decoder
# cannot represent is missing from *both* sides and the comparison still passes. That
# is exactly how coord3d went unnoticed: units copied fine, loaded fine, and crashed
# the game on entering a map. So this counts values against an independent reader.

def _count_values(tree):
    """Total values in a manifest params tree, nested ones included."""
    n = 0
    for _param, spec in tree:
        n += 1
        if spec[0] == 'tuple':
            n += _count_values(spec[1])
        elif spec[0] == 'collection':
            n += _count_values(spec[2])
    return n


def _count_shipped(game_root, package, asset):
    """The same count taken with meta.py, which reads every type generically."""
    sys.path.insert(0, TOOLS_DIR)
    from blp import BLP
    from bins import Reader
    import meta
    b = BLP(os.path.join(game_root, package))
    r = Reader(b)
    for a in b.allocs:
        if b.typename(a) != 'PackageAssetEntry_Metadata0':
            continue
        buf = b.raw(a)
        if r.strat(buf, 40) != asset:
            continue
        vs = b.ptr(r.p64(buf, 56))
        total = 0

        def walk(v):
            nonlocal total
            if v is None:
                return
            total += 1
            if isinstance(v.get('value'), list):
                for c in v['value']:
                    walk(c)

        for eb, eo in r.vec(b.raw(vs), 0, 'BLP::BLPPtr<BLP::Value>'):
            walk(meta.read_value(b, r, r.p64(eb, eo)))
        return total
    return None


@needs_game
def test_decoder_drops_nothing(archer, index):
    ours = _count_values(archer['params'])
    theirs = _count_shipped(GAME, index['assets'][DONOR]['packages'][0], DONOR)
    assert ours == theirs, f'decoded {ours} values, the asset has {theirs}'


@needs_game
def test_coord3d_values_survive(archer):
    """
    Five of them in an archer, 1007 across the 236 shipped units. Omitting them left a
    ValueSet the engine crashed on rather than one it treated as incomplete.
    """
    def walk(tree, out):
        for param, spec in tree:
            if spec[0] == 'coord3d':
                out.append((param, spec[1]))
            elif spec[0] == 'tuple':
                walk(spec[1], out)
            elif spec[0] == 'collection':
                walk(spec[2], out)
        return out
    found = walk(archer['params'], [])
    assert len(found) == 5, found
    assert all(len(v) == 3 for _p, v in found)


@needs_game
def test_an_unknown_value_type_raises_rather_than_dropping(monkeypatch):
    """A type we cannot reproduce must stop the copy, not quietly shrink it."""
    from civ7_art_studio import gameinfo as gi
    monkeypatch.setitem(gi._VALUE_KIND, 7, None)
    monkeypatch.delitem(gi._VALUE_KIND, 7)
    with pytest.raises(ValueError, match='cannot reproduce'):
        gi.read_metadata(GAME, DONOR)


# --- components ------------------------------------------------------------
# A metadata asset is its ValueSet *and* its components. Copying only the ValueSet
# produced units that differed from every shipped equivalent in exactly one way.

@needs_game
def test_donor_sound_switches_are_read(archer):
    """154 of the 236 shipped units carry a Sound_SwitchComponent1."""
    assert archer['soundSwitches'] == [[0x946D03F0, 0x2501BD2E],
                                       [0x9275CB7D, 0xF66E3F2D]]


@needs_game
def test_a_unit_with_no_switches_reads_as_empty(index):
    """82 of them have none, so absence has to be representable too."""
    for name, e in index['assets'].items():
        if e.get('cls') != 'UnitMetaData':
            continue
        data = gameinfo.read_metadata(GAME, name, index)
        if data and not data['soundSwitches']:
            return
    pytest.skip('no switch-less unit found')


@needs_game
def test_make_unit_carries_the_switches(archer):
    row, _ = units.make_unit('UNIT_X', DONOR, archer['params'],
                             sound_switches=archer['soundSwitches'],
                             profile='full')
    assert row['soundSwitches'] == [[0x946D03F0, 0x2501BD2E],
                                    [0x9275CB7D, 0xF66E3F2D]]


@needs_game
def test_a_copied_unit_is_structurally_identical_to_its_donor(archer, index,
                                                              tmp_path):
    """
    The whole claim of the units feature, checked as a whole: same class, same
    components, same switch values, same value count.
    """
    sys.path.insert(0, TOOLS_DIR)
    import build_blp, donors
    from blp import BLP
    from bins import Reader

    def describe(path, asset):
        b = BLP(path)
        r = Reader(b)
        for a in b.allocs:
            if b.typename(a) != 'PackageAssetEntry_Metadata0':
                continue
            buf = b.raw(a)
            if r.strat(buf, 40) != asset:
                continue
            comps, switches = [], []
            for cb, co in r.vec(buf, 24, 'BLP::BLPPtr<BLP::ICollectionEntry>'):
                ca = b.ptr(r.p64(cb, co))
                if ca is None:
                    continue
                comps.append(b.typename(ca))
                if b.typename(ca) == 'Sound_SwitchComponent1':
                    for eb, eo in r.vec(b.raw(ca), 8,
                                        'BLP::BLPPtr<Sound_SwitchComponent0>'):
                        sa = b.ptr(r.p64(eb, eo))
                        if sa is not None:
                            switches.append((r.u32(b.raw(sa), 8),
                                             r.u32(b.raw(sa), 12)))
            return r.strat(buf, 64), comps, switches, _count_values_raw(b, r, buf)
        return None

    def _count_values_raw(b, r, buf):
        import meta
        vs = b.ptr(r.p64(buf, 56))
        total = 0

        def walk(v):
            nonlocal total
            if v is None:
                return
            total += 1
            if isinstance(v.get('value'), list):
                for c in v['value']:
                    walk(c)
        for eb, eo in r.vec(b.raw(vs), 0, 'BLP::BLPPtr<BLP::Value>'):
            walk(meta.read_value(b, r, r.p64(eb, eo)))
        return total

    row, _ = units.make_unit(DONOR, DONOR, archer['params'],
                             sound_switches=archer['soundSwitches'],
                             profile='full')
    project = {'project': {'name': 'ident'}, 'units': [row]}
    donor_pkg, _n, _o = donors.select(GAME, project)
    data, _b = build_blp.build_package(project, donor_pkg, GAME)
    out = tmp_path / 'StandardAsset.blp'
    out.write_bytes(data)

    shipped = describe(os.path.join(GAME, index['assets'][DONOR]['packages'][0]),
                       DONOR)
    ours = describe(str(out), DONOR)
    assert ours == shipped, f'\nshipped {shipped}\nours    {ours}'


# --- registration ----------------------------------------------------------
# A unit asset in no list is never registered. Every one of the 24 DLCs that ships
# units carries a ROOT_UNITS_<project>; ours emitted none, so every unit the GUI made
# was unregistered — the same failure improvements have, where the asset exists in the
# package and the engine never loads it.

def test_units_have_their_own_list_name():
    sys.path.insert(0, TOOLS_DIR)
    from build_blp import asset_list_names
    names = asset_list_names('my-mod')
    assert names['units'] == 'ROOT_UNITS_my-mod'
    # not a ROOT_ASSETS_ variant, unlike improvements and wonders
    assert not names['units'].startswith('ROOT_ASSETS')


@needs_game
def test_a_built_unit_is_registered(archer, tmp_path):
    from civ7_art_studio import build as build_mod
    p = Project.create(str(tmp_path), 'UnitReg')
    row, _ = units.make_unit('UNIT_MINE', DONOR, archer['params'],
                             sound_switches=archer['soundSwitches'],
                             profile='full')
    p.manifest['units'].append(row)
    p.save()

    r = build_mod.build(p, GAME, sync=False)
    assert r.ok, '\n'.join(r.log)
    data = open(os.path.join(p.blp_dir, 'StandardAsset.blp'), 'rb').read()
    assert b'ROOT_UNITS_UnitReg' in data
    assert b'UNIT_MINE' in data


@needs_game
def test_no_unit_list_when_there_are_no_units(tmp_path):
    from civ7_art_studio import build as build_mod
    p = Project.create(str(tmp_path), 'NoUnits')
    r = build_mod.build(p, GAME, sync=False)
    assert r.ok
    data = open(os.path.join(p.blp_dir, 'StandardAsset.blp'), 'rb').read()
    assert b'ROOT_UNITS' not in data


@needs_game
def test_shipped_dlcs_register_their_units(index):
    """The rule this is derived from, asserted against the install."""
    lists = {n for n in index['assets'] if n.startswith('ROOT_UNITS_')}
    assert len(lists) >= 20, lists
    assert 'ROOT_UNITS_dai-viet' in lists


# --- parameter profiles ----------------------------------------------------
# A hand-authored 10-parameter unit has been placed on a map and moved around; a
# 49-parameter copy of a donor has not. Until that is understood, the smaller set is
# the default and the faithful copy is opt-in.

@needs_game
def test_minimal_is_the_default(archer):
    row, _ = units.make_unit('UNIT_X', DONOR, archer['params'])
    assert row['profile'] == 'minimal'
    assert len(row['params']) == 10


@needs_game
def test_minimal_keeps_exactly_the_known_working_set(archer):
    row, _ = units.make_unit('UNIT_X', DONOR, archer['params'])
    assert [p for p, _ in row['params']] == [
        p for p, _ in archer['params'] if p in set(units.MINIMAL_PARAMS)]
    assert set(p for p, _ in row['params']) == set(units.MINIMAL_PARAMS)


@needs_game
def test_minimal_preserves_the_donor_ordering(archer):
    """The engine wrote that order; there is no reason to reshuffle it."""
    row, _ = units.make_unit('UNIT_X', DONOR, archer['params'])
    donor_order = [p for p, _ in archer['params'] if p in set(units.MINIMAL_PARAMS)]
    assert [p for p, _ in row['params']] == donor_order


@needs_game
def test_minimal_still_carries_the_members(archer):
    """Whatever else is dropped, the visible part must survive."""
    row, _ = units.make_unit('UNIT_X', DONOR, archer['params'],
                             member_asset='MEMBER_ARCHER', member_count=5)
    assert len(units.read_members(row['params'])) == 5


@needs_game
def test_minimal_drops_the_components_too(archer):
    """The working reference had none, so a minimal copy is not half-faithful."""
    row, _ = units.make_unit('UNIT_X', DONOR, archer['params'],
                             sound_switches=archer['soundSwitches'])
    assert 'soundSwitches' not in row


@needs_game
def test_full_is_opt_in_and_complete(archer):
    row, _ = units.make_unit('UNIT_X', DONOR, archer['params'], profile='full')
    assert row['profile'] == 'full'
    assert len(row['params']) == len(archer['params'])


@needs_game
def test_an_unknown_profile_is_refused(archer):
    row, findings = units.make_unit('UNIT_X', DONOR, archer['params'],
                                    profile='everything')
    assert row is None and any(f.code == 'unit-profile' for f in findings)


@needs_game
def test_a_minimal_unit_matches_the_known_working_asset(archer):
    """
    The working custom-art UNIT_TEST, read back out of the package that shipped it.
    A minimal copy should carry the same parameter names.
    """
    from conftest import INSTALLED as installed
    fake = {'assets': {'UNIT_TEST': {'type': 'PackageAssetEntry_Metadata0',
                                     'packages': ['StandardAsset.blp']}}}
    working = gameinfo.read_metadata(installed, 'UNIT_TEST', fake)
    if working is None:
        pytest.skip('custom-art package not built')
    row, _ = units.make_unit('UNIT_X', DONOR, archer['params'])
    assert set(p for p, _ in row['params']) == set(p for p, _ in working['params'])
    assert working['soundSwitches'] == []
