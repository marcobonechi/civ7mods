"""
Every rule gets a case that passes and a case that fails.

A guard that only ever fires is as useless as one that never does, and these encode
judgement calls, so the negative cases are the ones worth reading.
"""
import os, struct, sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from civ7_art_studio import guards
from civ7_art_studio.guards import ERROR, WARNING


def codes(findings):
    return {f.code for f in findings}


def building(target, expression, priority=1, weight=1.0):
    return {'target': target, 'expression': expression,
            'priority': priority, 'weight': weight}


# --- footprint targets ----------------------------------------------------

def test_wrapper_target_is_accepted():
    f = guards.check_buildings([building('BIN_Monument_Scaled',
                                         '[BUILDING:BUILDING_AHH]')])
    assert 'target-not-renderable' not in codes(f)


def test_bin_target_is_accepted():
    """The shipped footprint points straight at BIN_Cityhall and BIN_Palace."""
    f = guards.check_buildings([building('BIN_Cityhall',
                                         '[BUILDING:BUILDING_CITY_HALL_SKIN]')])
    assert 'target-not-renderable' not in codes(f)


def test_bare_geometry_target_is_flagged():
    """The mistake actually made: pointing at SUZANNE rather than SUZANNE_Scaled."""
    f = guards.check_buildings([building('SUZANNE', '[BUILDING:BUILDING_CAA]')])
    assert 'target-not-renderable' in codes(f)
    assert 'SUZANNE_Scaled' in next(x for x in f
                                    if x.code == 'target-not-renderable').message


# --- self-ingestion -------------------------------------------------------

def test_skin_tag_is_fine():
    f = guards.check_buildings([building('BIN_Market_Scaled',
                                         '[BUILDING:BUILDING_MARKET_SKIN]')])
    assert 'double-skin' not in codes(f)


def test_double_skin_tag_is_an_error():
    f = guards.check_buildings([building('BIN_Market_Scaled',
                                         '[BUILDING:BUILDING_MARKET_SKIN_SKIN]')])
    assert 'double-skin' in codes(f)
    assert any(x.level == ERROR for x in f if x.code == 'double-skin')


# --- seat -----------------------------------------------------------------

# A reference table of native bindings, i.e. each building rendering its own art.
# The seat check needs this: derived from the entries under test instead, every
# binding would define its own target's seat and nothing could ever mismatch.
NATIVE = [
    building('BIN_Monument_Scaled', '[BUILDING:BUILDING_MONUMENT_SKIN]'),
    building('BIN_Library_Scaled', '[BUILDING:BUILDING_LIBRARY_SKIN]'),
    building('BIN_Harbor_Scaled', '[BUILDING:BUILDING_HARBOR_SKIN]'),
    building('BIN_Dockyard_Scaled', '[BUILDING:BUILDING_DOCKYARD_SKIN]'),
    building('BIN_Lighthouse_Scaled', '[BUILDING:BUILDING_LIGHTHOUSE_SKIN]'),
    # all three bridges share one bin, and only the ancient one is water-seated
    building('BIN_Bridge_Scaled', '[BUILDING:BUILDING_ANCIENT_BRIDGE_SKIN]'),
    building('BIN_Bridge_Scaled', '[BUILDING:BUILDING_MEDIEVAL_BRIDGE_SKIN]'),
    building('BIN_Bridge_Scaled', '[BUILDING:BUILDING_MODERN_BRIDGE_SKIN]'),
]
SEATS = guards.bin_seats(NATIVE)


def check(entries):
    return guards.check_buildings(entries, art_seats=SEATS)


def test_seat_index_marks_a_shared_bin_ambiguous():
    assert SEATS['BIN_Bridge_Scaled'] is None
    assert SEATS['BIN_Harbor_Scaled'] == 'water'
    assert SEATS['BIN_Monument_Scaled'] == 'land'


def test_water_building_on_its_own_water_art_is_fine():
    f = check([building('BIN_Lighthouse_Scaled',
                        '[BUILDING:BUILDING_LIGHTHOUSE_SKIN]')])
    assert 'seat-mismatch' not in codes(f)


def test_land_art_on_water_building_warns():
    f = check([building('BIN_Monument_Scaled', '[BUILDING:BUILDING_HARBOR_SKIN]')])
    assert 'seat-mismatch' in codes(f)


def test_water_art_on_land_building_warns_too():
    """The mismatch is symmetric -- a dockyard on a plain sits above the ground."""
    f = check([building('BIN_Dockyard_Scaled', '[BUILDING:BUILDING_LIBRARY_SKIN]')])
    assert 'seat-mismatch' in codes(f)


def test_land_on_land_is_silent():
    f = check([building('BIN_Monument_Scaled', '[BUILDING:BUILDING_LIBRARY_SKIN]')])
    assert f == []


def test_shared_bin_never_flags_either_way():
    """
    The false positive that started this: the land bridges use the same art as the
    water one, and were flagged for using their own model.
    """
    for tag in ('BUILDING_MEDIEVAL_BRIDGE_SKIN', 'BUILDING_MODERN_BRIDGE_SKIN',
                'BUILDING_ANCIENT_BRIDGE_SKIN'):
        f = check([building('BIN_Bridge_Scaled', f'[BUILDING:{tag}]')])
        assert 'seat-mismatch' not in codes(f), tag


# --- priority -------------------------------------------------------------

def test_same_expression_same_priority_is_ambiguous():
    f = check([
        building('BIN_Monument_Scaled', '[BUILDING:BUILDING_AHH]', 1),
        building('BIN_Market_Scaled', '[BUILDING:BUILDING_AHH]', 1),
    ])
    assert 'ambiguous-priority' in codes(f)


def test_different_priorities_are_a_deliberate_override():
    f = check([
        building('BIN_Monument_Scaled', '[BUILDING:BUILDING_AHH]', 1),
        building('BIN_Market_Scaled', '[BUILDING:BUILDING_AHH]', 50),
    ])
    assert 'ambiguous-priority' not in codes(f)


# --- texture names --------------------------------------------------------

def test_plain_texture_name_is_fine():
    assert guards.check_texture_name('pb_yamatai_bg_1080') == []


@pytest.mark.parametrize('name', ['lsbg_assyria_1080.png', 'icon.dds', 'thing.JPG'])
def test_texture_name_with_extension_is_an_error(name):
    f = guards.check_texture_name(name)
    assert 'texture-name-extension' in codes(f)


def test_extension_error_suggests_the_corrected_name():
    f = guards.check_texture_name('lsbg_assyria_1080.png')
    assert 'lsbg_assyria_1080"' in f[0].message


# --- wem ------------------------------------------------------------------

def _riff(fmt_tag, channels=1, rate=48000, fmt_extra=b'', data=b'\0' * 64):
    fmt = struct.pack('<HHIIHH', fmt_tag, channels, rate, rate * 2, 2, 16) + fmt_extra
    body = b'WAVE'
    body += b'fmt ' + struct.pack('<I', len(fmt)) + fmt
    body += b'data' + struct.pack('<I', len(data)) + data
    return b'RIFF' + struct.pack('<I', len(body)) + body


def test_wwise_wem_is_accepted(tmp_path):
    p = tmp_path / 'ok.wem'
    p.write_bytes(_riff(0xFFFF, fmt_extra=b'\0' * 50))
    info, f = guards.inspect_wem(str(p))
    assert info is not None and info['rate'] == 48000
    assert 'audio-not-wem' not in codes(f)


def test_renamed_wav_is_rejected(tmp_path):
    """The failure this exists for: builds fine, loads fine, plays silence."""
    p = tmp_path / 'sneaky.wem'
    p.write_bytes(_riff(1))                     # WAVE_FORMAT_PCM
    info, f = guards.inspect_wem(str(p))
    assert info is None
    assert 'audio-not-wem' in codes(f)
    assert 'silence' in f[0].message


def test_stereo_wem_warns_but_is_allowed(tmp_path):
    p = tmp_path / 'stereo.wem'
    p.write_bytes(_riff(0xFFFF, channels=2, fmt_extra=b'\0' * 50))
    info, f = guards.inspect_wem(str(p))
    assert info is not None
    assert 'audio-not-mono' in codes(f)


def test_missing_audio_file(tmp_path):
    info, f = guards.inspect_wem(str(tmp_path / 'nope.wem'))
    assert info is None and 'audio-missing' in codes(f)


# --- whole manifest -------------------------------------------------------

def test_unnamed_project_is_an_error():
    f = guards.check_project({'project': {'name': ''}})
    assert 'project-unnamed' in codes(f)


def test_project_name_charset():
    f = guards.check_project({'project': {'name': 'my mod!'}})
    assert 'project-name-charset' in codes(f)


def test_audio_event_without_a_bank_warns():
    f = guards.check_project({
        'project': {'name': 'x'},
        'soundbanks': [],
        'audioEvents': [{'appEvent': 'A', 'wwiseEvent': 'Play_Thing'}],
    })
    assert 'audio-event-unbacked' in codes(f)


def test_audio_event_with_its_bank_is_silent():
    f = guards.check_project({
        'project': {'name': 'x'},
        'soundbanks': [{'name': 'SOUNDBANK_Play_Thing', 'size': 10}],
        'audioEvents': [{'appEvent': 'A', 'wwiseEvent': 'Play_Thing'}],
    })
    assert 'audio-event-unbacked' not in codes(f)


def test_improvement_without_a_type_is_an_error():
    f = guards.check_project({
        'project': {'name': 'x'},
        'improvements': [{'asset': 'IMP_Thing', 'type': ''}],
    })
    assert 'improvements-untyped' in codes(f)


def test_the_shipped_manifest_is_clean():
    """The real project should not trip its own guards, warnings aside."""
    import json
    from civ7_art_studio.tools import TOOLS_DIR
    from conftest import MANIFEST as manifest
    if not os.path.exists(manifest):
        pytest.skip('custom-art manifest not present')
    with open(manifest) as f:
        project = json.load(f)
    errors = [x for x in guards.check_project(project) if x.level == ERROR]
    assert errors == [], '\n'.join(str(e) for e in errors)
