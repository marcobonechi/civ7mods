"""
Switching pieces of a project on and off, to bisect a problem.

Two properties matter. Disabling must never cascade — during a bisection, silently
switching off things the user did not point at destroys the experiment. And a build
must never emit a half-item: a material whose texture is off is not a smaller material,
it is one with a slot pointing at nothing.
"""
import os, sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from civ7_art_studio import selection


def manifest():
    """A project with a full dependency chain: building -> mesh -> material -> texture."""
    return {
        'project': {'name': 'sel'},
        'materialTextures': [{'name': 'TEXTURE_A'}, {'name': 'TEXTURE_SPARE'}],
        'materials': [{'name': 'MAT', 'slots': {'base_color': 'TEXTURE_A'}}],
        'meshes': [{'asset': 'MESH', 'material': 'MAT', 'primitive_count': 10}],
        'buildings': [{'expression': '[BUILDING:X]', 'target': 'MESH_Scaled',
                       'priority': 1, 'weight': 1.0}],
        'soundbanks': [{'name': 'SOUNDBANK_Play_Thing', 'size': 1}],
        'audioEvents': [{'appEvent': 'A', 'wwiseEvent': 'Play_Thing'}],
        'uiTextures': [{'ui_name': 'icon'}],
    }


def find(groups, kind, key):
    for g in groups:
        if g['kind'] != kind:
            continue
        for i in g['items']:
            if i['key'] == key:
                return i
    return None


# --- defaults -------------------------------------------------------------

def test_everything_starts_enabled():
    """Absent means on, so existing manifests need no migration."""
    for g in selection.items(manifest()):
        assert all(i['enabled'] for i in g['items'])


def test_enabling_removes_the_flag_rather_than_setting_true():
    m = manifest()
    selection.set_enabled(m, 'uiTextures', 'icon', False)
    assert m['uiTextures'][0]['enabled'] is False
    selection.set_enabled(m, 'uiTextures', 'icon', True)
    assert 'enabled' not in m['uiTextures'][0]


# --- dependency direction -------------------------------------------------

def test_the_chain_is_discovered():
    deps = selection.dependencies(manifest())
    assert deps[('materials', 'MAT')] == [('materialTextures', 'TEXTURE_A')]
    assert deps[('meshes', 'MESH')] == [('materials', 'MAT')]
    assert deps[('buildings', '[BUILDING:X]')] == [('meshes', 'MESH')]
    assert deps[('audioEvents', 'Play_Thing')] == [('soundbanks', 'SOUNDBANK_Play_Thing')]


def test_a_building_pointing_at_a_shipped_bin_depends_on_nothing():
    m = manifest()
    m['buildings'][0]['target'] = 'BIN_Monument_Scaled'
    assert selection.dependencies(m)[('buildings', '[BUILDING:X]')] == []


def test_items_report_what_locks_them():
    groups = selection.items(manifest())
    assert find(groups, 'materialTextures', 'TEXTURE_A')['lockedBy'] == \
        [{'kind': 'materials', 'key': 'MAT'}]
    assert find(groups, 'materialTextures', 'TEXTURE_SPARE')['lockedBy'] == []
    assert find(groups, 'buildings', '[BUILDING:X]')['lockedBy'] == []


# --- disabling ------------------------------------------------------------

def test_an_unused_item_can_be_disabled():
    m = manifest()
    changed, error = selection.set_enabled(m, 'materialTextures', 'TEXTURE_SPARE', False)
    assert changed and error is None


def test_a_needed_item_is_refused_and_says_what_needs_it():
    m = manifest()
    changed, error = selection.set_enabled(m, 'materialTextures', 'TEXTURE_A', False)
    assert not changed
    assert 'MAT' in error


def test_disabling_never_cascades():
    """
    The property that makes bisection trustworthy: turning one thing off must not
    quietly turn off anything else.
    """
    m = manifest()
    selection.set_enabled(m, 'buildings', '[BUILDING:X]', False)
    assert selection.is_enabled(m['meshes'][0])
    assert selection.is_enabled(m['materials'][0])
    assert selection.is_enabled(m['materialTextures'][0])


def test_unwinding_the_chain_top_down_works():
    m = manifest()
    for kind, key in [('buildings', '[BUILDING:X]'), ('meshes', 'MESH'),
                      ('materials', 'MAT'), ('materialTextures', 'TEXTURE_A')]:
        changed, error = selection.set_enabled(m, kind, key, False)
        assert changed, f'{kind} {key}: {error}'


def test_unlocking_happens_as_dependents_go_off():
    m = manifest()
    assert find(selection.items(m), 'materials', 'MAT')['lockedBy']
    selection.set_enabled(m, 'buildings', '[BUILDING:X]', False)
    selection.set_enabled(m, 'meshes', 'MESH', False)
    assert find(selection.items(m), 'materials', 'MAT')['lockedBy'] == []


def test_toggling_an_unknown_item_reports_it():
    changed, error = selection.set_enabled(manifest(), 'meshes', 'NOPE', False)
    assert not changed and 'NOPE' in error


def test_group_toggle_reports_what_it_could_not_switch_off():
    """
    Turning off a whole group cannot break the rule for items another group still
    needs, so it does what it can and says what it could not.
    """
    m = manifest()
    errors = selection.set_group(m, 'materialTextures', False)
    assert errors and 'MAT' in errors[0]
    assert not selection.is_enabled(m['materialTextures'][1]), 'the spare went off'
    assert selection.is_enabled(m['materialTextures'][0]), 'the needed one did not'


def test_group_toggle_succeeds_once_the_dependents_are_off():
    m = manifest()
    selection.set_group(m, 'buildings', False)
    selection.set_group(m, 'meshes', False)
    selection.set_group(m, 'materials', False)
    assert selection.set_group(m, 'materialTextures', False) == []
    assert not any(selection.is_enabled(r) for r in m['materialTextures'])


# --- what the build sees --------------------------------------------------

def test_apply_removes_disabled_items():
    m = manifest()
    selection.set_enabled(m, 'uiTextures', 'icon', False)
    assert selection.apply(m)['uiTextures'] == []
    assert m['uiTextures'], 'the manifest keeps it, so this is reversible'


def test_apply_drops_an_item_whose_dependency_is_missing():
    """
    The UI prevents this, but a hand-edited manifest can reach it. Emitting a material
    with a slot pointing at a texture that is not in the package is worse than not
    emitting the material.
    """
    m = manifest()
    m['materialTextures'][0]['enabled'] = False      # bypassing set_enabled
    out = selection.apply(m)
    assert out['materialTextures'] == [{'name': 'TEXTURE_SPARE'}]
    assert out['materials'] == []
    assert out['meshes'] == [], 'and the mesh that needed the material goes too'


def test_apply_leaves_a_healthy_manifest_alone():
    m = manifest()
    assert selection.apply(m) == m


def test_summary_counts():
    m = manifest()
    selection.set_enabled(m, 'materialTextures', 'TEXTURE_SPARE', False)
    s = selection.summary(m)
    assert s['materialTextures'] == {'enabled': 1, 'total': 2}


# --- through the build ----------------------------------------------------

GAME = os.environ.get('CIV7_GAME_ROOT', '/workspace/reference/full_game')
needs_game = pytest.mark.skipif(not os.path.isdir(os.path.join(GAME, 'DLC')),
                                reason='game install not available')


@needs_game
def test_a_disabled_item_is_not_built(tmp_path):
    from civ7_art_studio import build as build_mod
    from civ7_art_studio.project import Project

    p = Project.create(str(tmp_path), 'SelBuild')
    p.manifest['buildings'] = [
        {'target': 'BIN_Monument_Scaled', 'expression': '[BUILDING:KEEP_ME]',
         'priority': 1, 'weight': 1.0},
        {'target': 'BIN_Market_Scaled', 'expression': '[BUILDING:DROP_ME]',
         'priority': 1, 'weight': 1.0},
    ]
    selection.set_enabled(p.manifest, 'buildings', '[BUILDING:DROP_ME]', False)
    p.save()

    r = build_mod.build(p, GAME, sync=False)
    assert r.ok, '\n'.join(r.log)
    assert r.skipped == {'buildings': 1}
    data = open(os.path.join(p.blp_dir, 'StandardAsset.blp'), 'rb').read()
    assert b'KEEP_ME' in data
    assert b'DROP_ME' not in data


@needs_game
def test_re_enabling_brings_it_back(tmp_path):
    from civ7_art_studio import build as build_mod
    from civ7_art_studio.project import Project

    p = Project.create(str(tmp_path), 'SelBuild2')
    p.manifest['buildings'] = [{'target': 'BIN_Monument_Scaled',
                                'expression': '[BUILDING:TOGGLE_ME]',
                                'priority': 1, 'weight': 1.0}]
    selection.set_enabled(p.manifest, 'buildings', '[BUILDING:TOGGLE_ME]', False)
    p.save()
    build_mod.build(p, GAME, sync=False)
    assert b'TOGGLE_ME' not in open(
        os.path.join(p.blp_dir, 'StandardAsset.blp'), 'rb').read()

    selection.set_enabled(p.manifest, 'buildings', '[BUILDING:TOGGLE_ME]', True)
    p.save()
    build_mod.build(p, GAME, sync=False)
    assert b'TOGGLE_ME' in open(
        os.path.join(p.blp_dir, 'StandardAsset.blp'), 'rb').read()


# --- generated packages are not donors ------------------------------------

@needs_game
def test_generated_deps_carry_the_marker(tmp_path):
    from civ7_art_studio.project import Project, GENERATED_MARKER
    p = Project.create(str(tmp_path), 'Marked')
    assert GENERATED_MARKER in p.dep_xml(['StandardAsset'])


@needs_game
def test_a_generated_package_is_skipped_as_a_donor(tmp_path):
    """
    An installed mod in DLC/ is a valid package and usually a small one, so it would
    win the smallest-sufficient-donor contest and make the next build depend on the
    last one's output.
    """
    sys.path.insert(0, os.environ.get('CIV7_ART_TOOLS', ''))
    from civ7_art_studio.tools import ensure_on_path
    ensure_on_path()
    import donors
    from civ7_art_studio.project import GENERATED_MARKER

    group = tmp_path / 'DLC' / 'FakeMod'
    blps = group / 'Platforms' / 'Windows' / 'BLPs'
    blps.mkdir(parents=True)
    (group / 'FakeMod.dep').write_text(f'<?xml version="1.0"?>\n{GENERATED_MARKER}\n')
    fake = blps / 'StandardAsset.blp'
    fake.write_bytes(b'not a real package')

    assert donors.is_generated(str(fake))
    assert donors.index([str(fake)]) == {}


@needs_game
def test_a_shipped_package_is_not_skipped():
    from civ7_art_studio.tools import ensure_on_path
    ensure_on_path()
    import donors
    shipped = os.path.join(GAME, 'DLC/joseon/Platforms/Windows/BLPs/StandardAsset.blp')
    assert not donors.is_generated(shipped)


# --- packaging -------------------------------------------------------------

def test_vendored_tools_are_current():
    """
    The wheel ships a copy of the binary-format tools. If the checkout moves ahead of
    it, an installed build quietly runs older code than the tests do.
    """
    import subprocess
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    script = os.path.join(root, 'vendor_tools.py')
    if not os.path.exists(script):
        pytest.skip('not a checkout')
    r = subprocess.run([sys.executable, script, '--check'],
                       capture_output=True, text=True, cwd=root)
    assert r.returncode == 0, r.stdout + r.stderr


def test_the_app_uses_the_vendored_copy():
    """What runs in development should be what ships."""
    from civ7_art_studio.tools import TOOLS_DIR
    assert TOOLS_DIR.endswith(os.path.join('civ7_art_studio', 'blp')), TOOLS_DIR


def test_the_package_imports_without_a_generated_skin_table():
    """
    skins.py is generated per game install, so a fresh install has none. Treating that
    as fatal made the whole package unimportable.
    """
    from civ7_art_studio.tools import ensure_on_path
    ensure_on_path()
    import build_blp
    assert isinstance(build_blp.SKIN_ENTRIES, list)


def test_the_frozen_entry_script_uses_an_absolute_import():
    """
    PyInstaller runs its entry script as __main__ with no package context, so an entry
    point using relative imports dies on the first one. civart.py exists to give the
    package a parent; if it ever starts importing relatively, a frozen build breaks
    while pip installs carry on working.
    """
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    script = os.path.join(root, 'civart.py')
    if not os.path.exists(script):
        pytest.skip('not a checkout')
    # Parse rather than grep: the docstring quotes the very error it prevents, so a
    # substring check finds "from ." in prose and fails on a correct file.
    import ast
    tree = ast.parse(open(script).read())
    relative = [n for n in ast.walk(tree)
                if isinstance(n, ast.ImportFrom) and (n.level or 0) > 0]
    assert not relative, f'relative imports at lines {[n.lineno for n in relative]}'
    absolute = [n for n in ast.walk(tree)
                if isinstance(n, ast.ImportFrom)
                and (n.module or '').startswith('civ7_art_studio')]
    assert absolute, 'the launcher must import the package by name'.replace('  ', ' ')


def test_the_entry_script_runs_as_a_plain_script():
    """The actual property, checked by running it the way PyInstaller would."""
    import subprocess
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    script = os.path.join(root, 'civart.py')
    if not os.path.exists(script):
        pytest.skip('not a checkout')
    r = subprocess.run([sys.executable, script, '--help'],
                       capture_output=True, text=True, cwd=root)
    assert r.returncode == 0, r.stderr
    assert 'civart' in r.stdout


def test_vendored_tools_declare_their_dependencies():
    """
    The vendored blp/ modules are shipped as *data*, not as imports, so nothing traces
    what they need: a PyInstaller build simply omits it, and the failure is a
    ModuleNotFoundError at the moment a user imports their first mesh.

    So enumerate their third-party imports and require each to be a declared
    dependency. A new import in the tools fails here instead of in someone's exe.
    """
    import ast
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    blp = os.path.join(root, 'civ7_art_studio', 'blp')
    if not os.path.isdir(blp):
        pytest.skip('tools not vendored')

    stdlib = set(sys.stdlib_module_names)
    local = {f[:-3] for f in os.listdir(blp) if f.endswith('.py')}
    external = set()
    for f in os.listdir(blp):
        if not f.endswith('.py'):
            continue
        for node in ast.walk(ast.parse(open(os.path.join(blp, f)).read())):
            if isinstance(node, ast.Import):
                names = [a.name.split('.')[0] for a in node.names]
            elif isinstance(node, ast.ImportFrom) and not node.level and node.module:
                names = [node.module.split('.')[0]]
            else:
                continue
            external.update(n for n in names if n not in stdlib and n not in local)

    # skins is the generated table, optional by design and absent from a fresh install
    external.discard('skins')

    declared = open(os.path.join(root, 'pyproject.toml')).read()
    missing = [m for m in external if m not in declared]
    assert not missing, (f'{missing} imported by the vendored tools but not declared '
                         f'in pyproject.toml — a frozen build will not bundle them')


def test_tests_are_not_vendored():
    """Shipping a test file drags pytest into the package's dependency surface."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    blp = os.path.join(root, 'civ7_art_studio', 'blp')
    if not os.path.isdir(blp):
        pytest.skip('tools not vendored')
    assert not [f for f in os.listdir(blp) if f.startswith('test_')]


# --- frozen-build safety ---------------------------------------------------

def test_the_build_does_not_shell_out():
    """
    In a PyInstaller build sys.executable is the app's own exe, not a Python
    interpreter, so `subprocess.run([sys.executable, some_script, ...])` re-invokes the
    app with the script as an argument and it dies on its own argument parser:

        civart: error: unrecognized arguments: ...\\blp\\sync_blobs.py --blps ...

    Everything the build needs is importable, so nothing should be spawned.
    """
    import ast
    from civ7_art_studio import build as build_mod
    tree = ast.parse(open(build_mod.__file__).read())
    names = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)}
    attrs = {n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)}
    assert 'subprocess' not in names, 'the build must not spawn processes'
    assert 'executable' not in attrs, 'sys.executable is not an interpreter when frozen'


@needs_game
def test_a_build_works_with_no_usable_interpreter(tmp_path, monkeypatch):
    """
    The property the check above is a proxy for, exercised end to end: make
    sys.executable point at something that is not Python and build anyway.
    """
    from civ7_art_studio import build as build_mod
    from civ7_art_studio.project import Project

    monkeypatch.setattr(sys, 'executable', str(tmp_path / 'not-python.exe'))

    p = Project.create(str(tmp_path), 'Frozen')
    p.manifest['buildings'] = [{'target': 'BIN_Monument_Scaled',
                                'expression': '[BUILDING:FROZEN_TEST]',
                                'priority': 1, 'weight': 1.0}]
    p.save()

    r = build_mod.build(p, GAME)          # sync and validate both on
    assert r.ok, '\n'.join(r.log)
    assert any('OK' in line for line in r.log), 'validation should have run'
    assert b'FROZEN_TEST' in open(
        os.path.join(p.blp_dir, 'StandardAsset.blp'), 'rb').read()
