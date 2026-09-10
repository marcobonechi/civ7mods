"""
Persistent settings and the path picker.

The value here is not that a path round-trips through JSON — it is that a *stale* path
does not. A remembered install that has been uninstalled, moved, or is on an unplugged
drive would otherwise fail every later build with a confusing error about an unreadable
donor, so it is dropped at load and the user is asked again.
"""
import os, sys, json
import pytest
from starlette.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from civ7_art_studio import settings, server

GAME = os.environ.get('CIV7_GAME_ROOT', '/workspace/reference/full_game')
needs_game = pytest.mark.skipif(not os.path.isdir(os.path.join(GAME, 'DLC')),
                                reason='game install not available')


@pytest.fixture
def config(tmp_path, monkeypatch):
    """Point the config directory at a temp dir so tests never touch the real one."""
    cfg = tmp_path / 'cfg'
    cfg.mkdir()
    monkeypatch.setattr(settings, 'config_dir', lambda: str(cfg))
    monkeypatch.delenv('CIV7_GAME_ROOT', raising=False)
    monkeypatch.delenv('CIV7_ART_PROJECTS', raising=False)
    return cfg


def fake_install(tmp_path, name='game'):
    root = tmp_path / name
    (root / 'Base').mkdir(parents=True)
    (root / 'DLC').mkdir(parents=True)
    return str(root)


# --- recognising an install ----------------------------------------------

def test_looks_like_game_needs_both_halves(tmp_path):
    root = tmp_path / 'half'
    (root / 'DLC').mkdir(parents=True)
    assert not settings.looks_like_game(str(root))
    (root / 'Base').mkdir()
    assert settings.looks_like_game(str(root))


def test_looks_like_game_rejects_junk():
    assert not settings.looks_like_game('')
    assert not settings.looks_like_game('/definitely/not/here')


@needs_game
def test_the_real_install_is_recognised():
    assert settings.looks_like_game(GAME)


# --- round trip -----------------------------------------------------------

def test_defaults_when_nothing_saved(config):
    data = settings.load()
    assert data['gameRoot'] in ('', *settings.detect_game())
    assert data['projectsRoot'].endswith('CivVIIArt')


def test_save_then_load(config, tmp_path):
    game = fake_install(tmp_path)
    settings.save({'gameRoot': game, 'projectsRoot': '/tmp/p',
                   'lastProject': '/tmp/p/x', 'recentGames': [game]})
    data = settings.load()
    assert data['gameRoot'] == game
    assert data['projectsRoot'] == '/tmp/p'
    assert data['lastProject'] == '/tmp/p/x'


def test_a_stale_game_path_is_forgotten(config, tmp_path):
    """An uninstall or unplugged drive must not poison every future build."""
    game = fake_install(tmp_path)
    settings.save({'gameRoot': game, 'recentGames': [game]})
    os.rename(game, str(tmp_path / 'moved'))

    data = settings.load()
    assert data['gameRoot'] != game
    assert game not in data['recentGames']


def test_unknown_keys_are_dropped(config):
    with open(settings.config_path(), 'w') as f:
        json.dump({'gameRoot': '', 'somethingElse': 42}, f)
    assert 'somethingElse' not in settings.load()


def test_a_corrupt_config_falls_back_to_defaults(config):
    with open(settings.config_path(), 'w') as f:
        f.write('{ this is not json')
    assert settings.load()['projectsRoot'].endswith('CivVIIArt')


def test_remember_game_moves_to_front_without_duplicating(config, tmp_path):
    a, b = fake_install(tmp_path, 'a'), fake_install(tmp_path, 'b')
    data = {'recentGames': []}
    settings.remember_game(data, a)
    settings.remember_game(data, b)
    settings.remember_game(data, a)
    assert data['recentGames'] == [a, b]
    assert data['gameRoot'] == a


def test_remember_game_ignores_a_non_install(config, tmp_path):
    data = {'recentGames': []}
    settings.remember_game(data, str(tmp_path))
    assert data['recentGames'] == []


# --- through the server ---------------------------------------------------

@pytest.fixture
def client(tmp_path, config):
    server.STATE.update({'root': str(tmp_path / 'projects'), 'game': '',
                         'settings': settings.load(), 'project': None, 'index': None})
    with TestClient(server.app) as c:
        yield c


@needs_game
def test_game_path_survives_a_restart(client, tmp_path, config):
    client.post('/api/settings', json={'game': GAME})

    # a fresh process would reload from disk; simulate that
    reloaded = settings.load()
    assert reloaded['gameRoot'] == GAME
    assert GAME in reloaded['recentGames']


def test_open_project_is_remembered(client, tmp_path, config):
    r = client.post('/api/projects/create', json={'name': 'Remembered'}).json()
    assert settings.load()['lastProject'] == r['path']


def test_settings_reports_where_config_lives(client):
    s = client.get('/api/settings').json()
    assert s['configPath'].endswith('settings.json')


# --- picker ---------------------------------------------------------------

def test_roots_include_home_and_a_filesystem_root(client):
    r = client.get('/api/fs/roots').json()
    kinds = {x['kind'] for x in r['roots']}
    assert 'home' in kinds
    assert 'drive' in kinds


@needs_game
def test_roots_offer_a_detected_install(client, monkeypatch):
    monkeypatch.setattr(settings, 'detect_game', lambda: [GAME])
    r = client.get('/api/fs/roots').json()
    assert any(x['path'] == GAME and x['kind'] == 'game' for x in r['roots'])


def test_listing_marks_which_child_is_an_install(client, tmp_path):
    """
    The picker's job: stopping at the Steam folder or at `common` both look right, so
    the actual install has to be pointed out.
    """
    common = tmp_path / 'steamapps' / 'common'
    common.mkdir(parents=True)
    fake_install(common, "Sid Meier's Civilization VII")
    (common / 'Some Other Game').mkdir()

    r = client.get('/api/fs/list', params={'path': str(common)}).json()
    marked = {d['name']: d['isGame'] for d in r['dirs']}
    assert marked["Sid Meier's Civilization VII"] is True
    assert marked['Some Other Game'] is False
    assert r['isGame'] is False          # `common` itself is not the install


def test_listing_filters_files_by_extension(client, tmp_path):
    (tmp_path / 'a.wem').write_bytes(b'x' * 10)
    (tmp_path / 'b.dds').write_bytes(b'y' * 20)
    (tmp_path / 'c.txt').write_text('no')

    r = client.get('/api/fs/list', params={'path': str(tmp_path),
                                           'files': '.wem,.dds'}).json()
    assert {f['name'] for f in r['files']} == {'a.wem', 'b.dds'}
    assert r['files'][0]['size'] == 10


def test_listing_omits_files_unless_asked(client, tmp_path):
    (tmp_path / 'a.wem').write_bytes(b'x')
    r = client.get('/api/fs/list', params={'path': str(tmp_path)}).json()
    assert r['files'] == []


def test_listing_reports_no_parent_at_the_root(client):
    r = client.get('/api/fs/list', params={'path': '/'}).json()
    assert r['ok'] and r['parent'] is None


def test_setting_a_non_install_path_is_refused_by_name(client, tmp_path):
    r = client.post('/api/settings', json={'game': str(tmp_path)}).json()
    assert not r['ok']
    assert 'Base/ and DLC/' in r['error']
