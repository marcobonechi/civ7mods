"""
API tests through a real client, no mocks.

The interesting cases are the refusals: a game path that is merely a directory, a
project name that cannot be a folder, a WAV wearing a .wem extension. Those are the
paths where the pipeline's silence starts, and the app's whole job is to end them
before a build rather than after a play session.
"""
import os, sys, json, struct
import pytest
from starlette.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from civ7_art_studio import server

from civ7_art_studio.tools import TOOLS_DIR
GAME = os.environ.get('CIV7_GAME_ROOT', '/workspace/reference/full_game')
from conftest import MANIFEST

needs_game = pytest.mark.skipif(not os.path.isdir(os.path.join(GAME, 'DLC')),
                                reason='game install not available')


@pytest.fixture
def client(tmp_path):
    server.STATE.update({'root': str(tmp_path), 'game': '', 'project': None,
                         'index': None})
    with TestClient(server.app) as c:
        yield c


def test_index_page_serves(client):
    r = client.get('/')
    assert r.status_code == 200
    assert 'Civ7 Art Studio' in r.text


def test_settings_start_empty(client):
    s = client.get('/api/settings').json()
    assert s['ok'] and s['project'] is None and s['projects'] == []


def test_game_path_must_actually_be_an_install(client, tmp_path):
    """A directory that exists is not the same as a game install."""
    decoy = tmp_path / 'not-the-game'
    decoy.mkdir()
    r = client.post('/api/settings', json={'game': str(decoy)}).json()
    assert not r['ok'] and 'DLC' in r['error']


@needs_game
def test_real_game_path_is_accepted(client):
    r = client.post('/api/settings', json={'game': GAME}).json()
    assert r['ok'] and r['gameValid']


def test_create_and_open_project(client):
    r = client.post('/api/projects/create', json={'name': 'TestMod'}).json()
    assert r['ok']
    assert r['project']['project']['name'] == 'TestMod'

    s = client.get('/api/settings').json()
    assert s['project'] == 'TestMod'
    assert [p['name'] for p in s['projects']] == ['TestMod']

    opened = client.post('/api/projects/open', json={'path': r['path']}).json()
    assert opened['ok']


def test_create_rejects_a_bad_name(client):
    r = client.post('/api/projects/create', json={'name': 'my mod!'}).json()
    assert not r['ok']


def test_manifest_requires_a_project(client):
    r = client.get('/api/manifest').json()
    assert not r['ok'] and 'no project' in r['error']


def test_manifest_saves_and_reports_findings(client):
    client.post('/api/projects/create', json={'name': 'Findings'})
    m = client.get('/api/manifest').json()['project']
    m['buildings'] = [{'target': 'SUZANNE', 'expression': '[BUILDING:X]',
                       'priority': 1, 'weight': 1.0}]
    r = client.post('/api/manifest', json={'project': m}).json()
    assert r['ok']
    assert any(f['code'] == 'target-not-renderable' for f in r['findings'])

    # and it persisted
    again = client.get('/api/manifest').json()
    assert again['project']['buildings'][0]['target'] == 'SUZANNE'


def test_build_needs_a_game_path(client):
    client.post('/api/projects/create', json={'name': 'NoGame'})
    r = client.post('/api/build').json()
    assert not r['ok'] and 'game install' in r['error']


def test_asset_search_needs_a_game_path(client):
    r = client.get('/api/assets/search?q=monument').json()
    assert not r['ok']


# --- file inspection ------------------------------------------------------

def _riff(fmt_tag, extra=b''):
    fmt = struct.pack('<HHIIHH', fmt_tag, 1, 48000, 96000, 2, 16) + extra
    body = b'WAVE' + b'fmt ' + struct.pack('<I', len(fmt)) + fmt \
         + b'data' + struct.pack('<I', 32) + b'\0' * 32
    return b'RIFF' + struct.pack('<I', len(body)) + body


def test_inspect_accepts_a_wwise_wem(client, tmp_path):
    p = tmp_path / 'good.wem'
    p.write_bytes(_riff(0xFFFF, b'\0' * 50))
    r = client.post('/api/inspect', json={'path': str(p), 'kind': 'audio'}).json()
    assert r['ok'] and r['info']['rate'] == 48000


def test_inspect_rejects_a_renamed_wav(client, tmp_path):
    p = tmp_path / 'bad.wem'
    p.write_bytes(_riff(1))
    r = client.post('/api/inspect', json={'path': str(p), 'kind': 'audio'}).json()
    assert r['ok']                       # the request worked
    assert r['info'] is None             # the file did not
    assert any(f['code'] == 'audio-not-wem' for f in r['findings'])


def test_inspect_flags_a_texture_name_with_an_extension(client, tmp_path):
    p = tmp_path / 'x.dds'
    p.write_bytes(b'not a dds')
    r = client.post('/api/inspect', json={'path': str(p), 'kind': 'textures',
                                          'name': 'my_icon.png'}).json()
    assert any(f['code'] == 'texture-name-extension' for f in r['findings'])


# --- filesystem picker ----------------------------------------------------

def test_fs_list_walks_directories(client, tmp_path):
    (tmp_path / 'alpha').mkdir()
    (tmp_path / '.hidden').mkdir()
    r = client.get('/api/fs/list', params={'path': str(tmp_path)}).json()
    names = [d['name'] for d in r['dirs']]
    assert r['ok'] and 'alpha' in names
    assert '.hidden' not in names
    assert not r['isGame']


@needs_game
def test_fs_list_recognises_a_game_install(client):
    r = client.get('/api/fs/list', params={'path': GAME}).json()
    assert r['ok'] and r['isGame']


# --- the whole loop -------------------------------------------------------

@needs_game
def test_build_through_the_api(client):
    client.post('/api/settings', json={'game': GAME})
    client.post('/api/projects/create', json={'name': 'ApiBuild'})
    m = client.get('/api/manifest').json()['project']
    m['buildings'] = [{'target': 'BIN_Monument_Scaled',
                       'expression': '[BUILDING:BUILDING_API_TEST]',
                       'priority': 1, 'weight': 1.0}]
    client.post('/api/manifest', json={'project': m})

    r = client.post('/api/build').json()
    assert r['ok'] and r['built'], '\n'.join(r.get('log', []))
    assert r['packages'] == ['StandardAsset']
    assert os.path.exists(os.path.join(r['dlcDir'], 'ApiBuild.dep'))
    assert os.path.exists(os.path.join(r['modsDir'], 'modules', 'ApiBuild.modinfo'))
    # The donor follows the content: bin modifiers alone need far fewer types than the
    # full custom-art manifest, so this picks shawnee-tecumseh where that picks joseon.
    # Hardcoding one donor for both is exactly the mistake donors.py exists to prevent.
    assert 'shawnee-tecumseh' in r['donors']['StandardAsset']


@needs_game
def test_asset_search_and_describe(client):
    client.post('/api/settings', json={'game': GAME})
    r = client.get('/api/assets/search',
                   params={'q': 'monument', 'suffix': '_Scaled'}).json()
    assert r['ok']
    names = [h['name'] for h in r['results']]
    assert 'BIN_Monument_Scaled' in names

    d = client.get('/api/assets/BIN_Monument_Scaled').json()
    assert d['ok']
    # the payoff: the attachment names what it pulls in, resolved from a name hash
    assert d['asset']['attachments'][0]['target'] == 'BIN_Monument'
    assert d['asset']['attachments'][0]['targetResolved']


@needs_game
def test_describe_unknown_asset(client):
    client.post('/api/settings', json={'game': GAME})
    assert client.get('/api/assets/NOPE_NOT_REAL').json()['ok'] is False


# --- units ----------------------------------------------------------------

@needs_game
def test_unit_donors_are_only_units_with_art(client):
    """93 of 118 unit types have an art asset; the rest are not choices."""
    client.post('/api/settings', json={'game': GAME})
    r = client.get('/api/units/donors').json()
    assert r['ok']
    assert 'UNIT_ARCHER' in r['units']
    assert all(n.startswith('UNIT_') for n in r['units'])


@needs_game
def test_unit_donors_can_be_filtered(client):
    client.post('/api/settings', json={'game': GAME})
    r = client.get('/api/units/donors', params={'q': 'archer'}).json()
    assert r['ok'] and all('ARCHER' in n.upper() for n in r['units'])


@needs_game
def test_describe_unit_reports_what_it_looks_like(client):
    client.post('/api/settings', json={'game': GAME})
    r = client.get('/api/units/donors/UNIT_ARCHER').json()
    assert r['ok']
    assert r['unit']['memberCount'] == 8
    assert r['unit']['memberAsset'] == 'MEMBER_ARCHER'
    assert r['unit']['formation'] == 'Formation_8_Range'


@needs_game
def test_describe_rejects_a_non_unit(client):
    client.post('/api/settings', json={'game': GAME})
    assert client.get('/api/units/donors/BIN_Monument_Scaled').json()['ok'] is False


@needs_game
def test_create_unit_from_a_donor(client):
    client.post('/api/settings', json={'game': GAME})
    client.post('/api/projects/create', json={'name': 'UnitApi'})
    r = client.post('/api/units', json={
        'donor': 'UNIT_ARCHER', 'name': 'UNIT_MY_ARCHER',
        'memberAsset': 'MEMBER_SPEARMAN', 'memberCount': 4}).json()
    assert r['ok'] and r['created'], r.get('findings')
    assert r['row']['memberCount'] == 4
    assert r['row']['memberAsset'] == 'MEMBER_SPEARMAN'
    # the donor's other parameters came along
    assert r['row']['formation'] == 'Formation_8_Range'

    listed = client.get('/api/units').json()
    assert [u['name'] for u in listed['units']] == ['UNIT_MY_ARCHER']


@needs_game
def test_create_unit_rejects_a_bad_name(client):
    client.post('/api/settings', json={'game': GAME})
    client.post('/api/projects/create', json={'name': 'UnitBad'})
    r = client.post('/api/units', json={'donor': 'UNIT_ARCHER', 'name': ''}).json()
    assert r['ok'] and not r['created']
    assert any(f['code'] == 'unit-unnamed' for f in r['findings'])


@needs_game
def test_create_unit_rejects_an_unknown_donor(client):
    client.post('/api/settings', json={'game': GAME})
    client.post('/api/projects/create', json={'name': 'UnitDonor'})
    r = client.post('/api/units', json={'donor': 'UNIT_NOPE', 'name': 'UNIT_X'}).json()
    assert not r['ok']


@needs_game
def test_delete_unit(client):
    client.post('/api/settings', json={'game': GAME})
    client.post('/api/projects/create', json={'name': 'UnitDel'})
    client.post('/api/units', json={'donor': 'UNIT_ARCHER', 'name': 'UNIT_GONE'})
    client.delete('/api/units/UNIT_GONE')
    assert client.get('/api/units').json()['units'] == []
