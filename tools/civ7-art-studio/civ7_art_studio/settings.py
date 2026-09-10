"""
Settings that outlive a session: where the game is, where projects live, what was open.

The game install path is the one thing every session needs and nobody can retype from
memory -- it is a long path on whichever drive Steam happened to use. Losing it on every
restart is the sort of small friction that stops people bothering.

Stored per-user in the platform's own config directory (%LOCALAPPDATA% on Windows,
~/Library/Application Support on macOS, ~/.config on Linux) rather than next to the
code, so it survives reinstalling or moving the app -- which has already happened once.
"""
import os, json

import platformdirs

APP = 'Civ7ArtStudio'

# Where Steam usually puts it. Checked in order, and only as a suggestion -- the user
# can always point somewhere else, and a wrong guess is worse than no guess, so a
# candidate has to actually look like an install before it is offered.
STEAM_SUFFIX = os.path.join('steamapps', 'common', "Sid Meier's Civilization VII")
COMMON_ROOTS = [
    r'C:\Program Files (x86)\Steam',
    r'C:\Program Files\Steam',
    r'C:\SteamLibrary',
    os.path.expanduser('~/.steam/steam'),
    os.path.expanduser('~/.local/share/Steam'),
    os.path.expanduser('~/Library/Application Support/Steam'),
]

DEFAULTS = {
    'gameRoot': '',
    'projectsRoot': '',
    'lastProject': '',
    'recentGames': [],
}


def config_dir():
    return platformdirs.user_config_dir(APP)


def cache_dir():
    return platformdirs.user_cache_dir(APP)


def config_path():
    return os.path.join(config_dir(), 'settings.json')


def looks_like_game(path):
    """A Civ VII install has both halves; either alone is some other folder."""
    return bool(path) and os.path.isdir(os.path.join(path, 'DLC')) \
        and os.path.isdir(os.path.join(path, 'Base'))


def detect_game():
    """Plausible install paths, in preference order. May be empty."""
    found = []
    env = os.environ.get('CIV7_GAME_ROOT')
    if looks_like_game(env):
        found.append(env)

    roots = list(COMMON_ROOTS)
    if os.name == 'nt':
        # Steam libraries land on whichever drive had room, so check them all rather
        # than assuming C:. Missing drives just fail the isdir test.
        for letter in 'CDEFGHIJKL':
            roots += [f'{letter}:\\Steam', f'{letter}:\\SteamLibrary',
                      f'{letter}:\\Games\\Steam']
    for root in roots:
        candidate = os.path.join(root, STEAM_SUFFIX)
        if looks_like_game(candidate) and candidate not in found:
            found.append(candidate)
    return found


def default_projects_root():
    if os.environ.get('CIV7_ART_PROJECTS'):
        return os.environ['CIV7_ART_PROJECTS']
    home = os.path.expanduser('~')
    docs = os.path.join(home, 'Documents')
    return os.path.join(docs if os.path.isdir(docs) else home, 'CivVIIArt')


def load():
    """Saved settings merged over the defaults, with anything stale dropped."""
    data = dict(DEFAULTS)
    try:
        with open(config_path()) as f:
            saved = json.load(f)
        if isinstance(saved, dict):
            data.update({k: v for k, v in saved.items() if k in DEFAULTS})
    except (OSError, ValueError):
        pass                      # first run, or a file we cannot read; defaults win

    # A remembered path can go stale -- an uninstall, an unplugged drive, a moved
    # library. Silently forgetting it is better than failing every build with a
    # confusing error about a donor that cannot be read.
    if data['gameRoot'] and not looks_like_game(data['gameRoot']):
        data['gameRoot'] = ''
    data['recentGames'] = [p for p in data['recentGames'] if looks_like_game(p)]

    if not data['gameRoot']:
        candidates = detect_game()
        if candidates:
            data['gameRoot'] = candidates[0]
    if not data['projectsRoot']:
        data['projectsRoot'] = default_projects_root()
    return data


def save(data):
    os.makedirs(config_dir(), exist_ok=True)
    keep = {k: data.get(k, v) for k, v in DEFAULTS.items()}
    tmp = config_path() + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(keep, f, indent=2)
        f.write('\n')
    os.replace(tmp, config_path())
    return keep


def remember_game(data, path):
    """Move a path to the front of the recent list, keeping the last few."""
    if not looks_like_game(path):
        return data
    recent = [p for p in data.get('recentGames', []) if p != path]
    data['recentGames'] = ([path] + recent)[:5]
    data['gameRoot'] = path
    return data
