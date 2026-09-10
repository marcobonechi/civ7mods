"""
Local web server: JSON API plus the single-page UI.

A browser UI rather than a desktop toolkit because this has to run wherever the game
does without asking a modder to install Qt, and because the pipeline is full of things
worth *showing* -- a texture preview, a seven-hex pattern, a build log.

Everything is local. There is no auth and no remote access by design: the server reads
and writes the user's own files and talks to a game install on the same machine.
"""
import os, json, asyncio, threading, webbrowser

from starlette.applications import Starlette
from starlette.responses import JSONResponse, FileResponse, PlainTextResponse
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles

from . import build as build_mod
from . import clones, gameinfo, guards, importers, materials, selection, settings, units
from .project import Project

WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web')

_saved = settings.load()
STATE = {
    'root': _saved['projectsRoot'],
    'game': _saved['gameRoot'],
    'settings': _saved,
    'project': None,        # Project
    'index': None,          # asset index, loaded lazily
}


def _persist():
    STATE['settings']['projectsRoot'] = STATE['root']
    STATE['settings']['gameRoot'] = STATE['game']
    STATE['settings']['lastProject'] = (STATE['project'].path
                                        if STATE['project'] else '')
    settings.save(STATE['settings'])


def ok(**kw):
    return JSONResponse({'ok': True, **kw})


def err(message, status=400):
    return JSONResponse({'ok': False, 'error': message}, status_code=status)


def _findings(items):
    return [{'level': f.level, 'code': f.code, 'message': f.message,
             'where': f.where, 'detail': f.detail} for f in items]


def _require_project():
    p = STATE.get('project')
    if p is None:
        raise LookupError('no project is open')
    return p


# --- settings -------------------------------------------------------------

async def get_settings(request):
    game = STATE['game']
    return ok(root=STATE['root'], game=game,
              gameValid=settings.looks_like_game(game),
              project=STATE['project'].name if STATE['project'] else None,
              projectPath=STATE['project'].path if STATE['project'] else None,
              projects=Project.list(STATE['root']),
              recentGames=STATE['settings'].get('recentGames', []),
              detected=settings.detect_game(),
              configPath=settings.config_path())


async def set_settings(request):
    body = await request.json()
    if 'root' in body:
        STATE['root'] = body['root']
    if 'game' in body:
        game = body['game']
        # Probe rather than trust. A path that merely exists is the commonest way to
        # end up with an empty asset index and no explanation, and pointing one level
        # too high or too low both look plausible in a file picker.
        if game and not settings.looks_like_game(game):
            return err(f'{game} does not contain Base/ and DLC/ -- '
                       f'that is not a Civ VII install folder')
        STATE['game'] = game
        STATE['index'] = None
        if game:
            settings.remember_game(STATE['settings'], game)
    _persist()
    return await get_settings(request)


# --- projects -------------------------------------------------------------

async def create_project(request):
    body = await request.json()
    try:
        p = Project.create(STATE['root'], body['name'],
                           body.get('displayName'), body.get('author', ''))
    except (ValueError, FileExistsError) as e:
        return err(str(e))
    STATE['project'] = p
    _persist()
    return ok(project=p.manifest, path=p.path)


async def open_project(request):
    body = await request.json()
    try:
        p = Project.open(body['path'])
    except FileNotFoundError as e:
        return err(str(e))
    STATE['project'] = p
    _persist()
    return ok(project=p.manifest, path=p.path)


async def get_manifest(request):
    try:
        p = _require_project()
    except LookupError as e:
        return err(str(e))
    return ok(project=p.manifest, path=p.path,
              findings=_findings(guards.check_project(p.manifest)))


async def save_manifest(request):
    try:
        p = _require_project()
    except LookupError as e:
        return err(str(e))
    body = await request.json()
    p.manifest = body['project']
    p.save()
    return ok(findings=_findings(guards.check_project(p.manifest)))


# --- assets ---------------------------------------------------------------

def _index():
    if STATE['index'] is None:
        if not STATE['game']:
            raise LookupError('no game install configured')
        STATE['index'] = gameinfo.load_index(STATE['game'])
    return STATE['index']


async def search_assets(request):
    q = request.query_params
    try:
        index = _index()
    except LookupError as e:
        return err(str(e))
    hits = gameinfo.search(index, q.get('q', ''),
                           limit=int(q.get('limit', 40)),
                           role=q.get('role') or None,
                           suffix=q.get('suffix') or None)
    return ok(results=hits, total=len(index['assets']))


async def describe_asset(request):
    try:
        index = _index()
    except LookupError as e:
        return err(str(e))
    detail = gameinfo.describe(STATE['game'], request.path_params['name'], index)
    if detail is None:
        return err('no such asset', 404)
    return ok(asset=detail)


# --- imports --------------------------------------------------------------

async def inspect_file(request):
    """Report what an imported file is, before it is committed to the manifest."""
    body = await request.json()
    path, kind = body['path'], body['kind']
    if kind == 'audio':
        info, findings = guards.inspect_wem(path)
    elif kind in ('textures', 'materials'):
        # A material slot decides which formats are reasonable: a normal map is BC5, a
        # tint or occlusion mask BC4 or BC1. Only UI textures are all BC7.
        tex_class = materials.SLOT_CLASS.get(body.get('slot') or '', 'UITexture')
        info, findings = guards.inspect_dds(path, tex_class)
        # The name is as much a source of silent failure as the pixels: a texture
        # called my_icon.png is a valid BC7 file that never resolves.
        if body.get('name'):
            findings = list(findings) + guards.check_texture_name(body['name'])
    else:
        return err(f'cannot inspect {kind} files yet')
    return ok(info=info, findings=_findings(findings))


async def import_file(request):
    """
    Convert an imported file into a blob plus the manifest row describing it.

    The row is only kept if the importer produced one; a rejected file leaves the
    manifest untouched so a failed import cannot half-register something.
    """
    try:
        p = _require_project()
    except LookupError as e:
        return err(str(e))
    body = await request.json()
    kind = body.get('kind')

    try:
        if kind == 'audio':
            row, findings = importers.import_audio(
                p, body['path'], body.get('name', '').strip(), STATE['game'],
                donor=body.get('donor', '3d'))
            key = 'soundbanks'
        elif kind == 'texture':
            row, findings = importers.import_texture(
                p, body['path'], body.get('name', '').strip())
            key = 'uiTextures'
        elif kind == 'mesh':
            row, findings = importers.import_mesh(
                p, body['path'], body.get('name', '').strip(),
                scale=float(body.get('scale', 10.0)),
                material=body.get('material', '').strip(),
                wrapper_scale=float(body.get('wrapperScale', 1.0)),
                flip_winding=bool(body.get('flipWinding')),
                ground=bool(body.get('ground', True)))
            key = 'meshes'
        else:
            return err(f'cannot import {kind} files')
    except Exception as e:
        return err(f'{type(e).__name__}: {e}')

    if row is None:
        return ok(imported=False, findings=_findings(findings))

    rows = p.manifest.setdefault(key, [])
    name_key = 'ui_name' if key == 'uiTextures' else \
               ('asset' if key == 'meshes' else 'name')
    rows[:] = [r for r in rows if r.get(name_key) != row.get(name_key)]
    rows.append(row)
    p.save()
    return ok(imported=True, row=row, findings=_findings(findings),
              project=p.manifest)


# --- units ----------------------------------------------------------------

async def list_unit_donors(request):
    """
    Every shipped unit that has art, i.e. an asset whose metadata class is
    UnitMetaData. 304 of them ship, 250 in Base and 54 more from DLC.

    Filtering on the class matters: metadata assets all share one entry type but mean
    entirely different things, and a UNIT_ name prefix is neither necessary nor
    sufficient.
    """
    try:
        index = _index()
    except LookupError as e:
        return err(str(e))
    q = (request.query_params.get('q') or '').lower()
    names = sorted(n for n, e in index['assets'].items()
                   if e.get('cls') == 'UnitMetaData' and (not q or q in n.lower()))
    return ok(units=names)


async def describe_unit(request):
    """A donor's members and formations, so the choice is made on what it looks like."""
    try:
        index = _index()
    except LookupError as e:
        return err(str(e))
    name = request.path_params['name']
    data = gameinfo.read_metadata(STATE['game'], name, index)
    if data is None or data['cls'] != 'UnitMetaData':
        return err(f'{name} is not a unit art asset', 404)
    return ok(unit={'name': name, 'package': data['package'],
                    'members': units.read_members(data['params']),
                    **units.summarise(data['params'])})


async def create_unit(request):
    """Copy a shipped unit's parameters under a new UnitType, swapping the members."""
    try:
        p = _require_project()
    except LookupError as e:
        return err(str(e))
    try:
        index = _index()
    except LookupError as e:
        return err(str(e))

    body = await request.json()
    donor = (body.get('donor') or '').strip()
    data = gameinfo.read_metadata(STATE['game'], donor, index)
    if data is None or data['cls'] != 'UnitMetaData':
        return err(f'{donor!r} is not a unit art asset')

    count = body.get('memberCount')
    row, findings = units.make_unit(
        body.get('name', ''), donor, data['params'],
        member_asset=(body.get('memberAsset') or '').strip() or None,
        member_count=int(count) if count else None,
        scale=float(body['scale']) if body.get('scale') not in (None, '') else None,
        promotion=int(body['promotion']) if body.get('promotion') not in (None, '') else None,
        sound_switches=data.get('soundSwitches'),
        profile=body.get('profile', 'minimal'))
    if row is None:
        return ok(created=False, findings=_findings(findings))

    findings += units.check_units([row], set(index['assets']))
    rows = p.manifest.setdefault('units', [])
    rows[:] = [r for r in rows if r.get('name') != row['name']]
    rows.append(row)
    p.save()
    return ok(created=True, row={'name': row['name'], 'copiedFrom': row['copiedFrom'],
                                 'profile': row.get('profile', 'minimal'),
                                 **units.summarise(row['params'])},
              findings=_findings(findings), project=p.manifest)


async def delete_unit(request):
    try:
        p = _require_project()
    except LookupError as e:
        return err(str(e))
    name = request.path_params['name']
    rows = p.manifest.setdefault('units', [])
    rows[:] = [r for r in rows if r.get('name') != name]
    p.save()
    return ok(project=p.manifest)


async def list_project_units(request):
    """The project's own units, summarised the same way donors are."""
    try:
        p = _require_project()
    except LookupError as e:
        return err(str(e))
    return ok(units=[{'name': u['name'], 'copiedFrom': u.get('copiedFrom'),
                      'profile': u.get('profile', 'full'),
                      **units.summarise(u.get('params', []))}
                     for u in p.manifest.get('units', [])])


# --- materials ------------------------------------------------------------

async def material_slots(request):
    """Slot names and the texture class each normally takes, per material kind."""
    kind = request.query_params.get('kind', 'standard')
    if kind not in materials.KINDS:
        return err(f'unknown material kind {kind!r}')
    return ok(kind=kind, slots=materials.describe_slots(kind))


async def search_textures(request):
    """
    Shipped textures, for filling a slot from the game's own art.

    Filtered by texture class by default, because the useful question is "what
    occlusion maps are there", not "what textures are there" -- there are 27,000.
    """
    try:
        index = _index()
    except LookupError as e:
        return err(str(e))
    q = request.query_params
    needle = (q.get('q') or '').lower()
    want_class = q.get('class') or None
    slot = q.get('slot')
    if slot and not want_class:
        want_class = materials.SLOT_CLASS.get(slot)

    hits = []
    for name, info in (index.get('textures') or {}).items():
        if want_class and info['tex_class'] != want_class:
            continue
        if needle and needle not in name.lower():
            continue
        if not info['external']:
            continue
        hits.append({'name': name, **info})
    hits.sort(key=lambda h: (not h['name'].lower().startswith(needle),
                             len(h['name']), h['name']))
    return ok(results=hits[:int(q.get('limit', 40))], total=len(hits))


async def add_material(request):
    try:
        p = _require_project()
    except LookupError as e:
        return err(str(e))
    body = await request.json()
    row, findings = materials.make_material(
        body.get('name', ''), body.get('kind', 'standard'),
        body.get('slots') or {},
        int(body['tintMode']) if body.get('tintMode') not in (None, '') else None)
    if row is None:
        return ok(created=False, findings=_findings(findings))

    rows = p.manifest.setdefault('materials', [])
    rows[:] = [r for r in rows if r.get('name') != row['name']]
    rows.append(row)
    p.save()
    findings += materials.check_materials(rows,
                                          p.manifest.get('materialTextures', []))
    return ok(created=True, row=row, findings=_findings(findings),
              project=p.manifest)


async def delete_material(request):
    try:
        p = _require_project()
    except LookupError as e:
        return err(str(e))
    name = request.path_params['name']
    rows = p.manifest.setdefault('materials', [])
    rows[:] = [r for r in rows if r.get('name') != name]
    p.save()
    return ok(project=p.manifest)


async def add_material_texture(request):
    """Bring a texture into the package, either borrowed from the game or imported."""
    try:
        p = _require_project()
    except LookupError as e:
        return err(str(e))
    body = await request.json()
    slot = body.get('slot', '')

    try:
        if body.get('borrow'):
            index = _index()
            row, findings = materials.borrow(p, STATE['game'], index,
                                             body['borrow'].strip(), slot)
        else:
            row, findings = materials.import_slot_texture(
                p, body['path'], body.get('name', '').strip(), slot)
    except LookupError as e:
        return err(str(e))
    except Exception as e:
        return err(f'{type(e).__name__}: {e}')

    if row is None:
        return ok(added=False, findings=_findings(findings))

    rows = p.manifest.setdefault('materialTextures', [])
    rows[:] = [r for r in rows if r.get('name') != row['name']]
    rows.append(row)
    p.save()
    return ok(added=True, row=row, findings=_findings(findings), project=p.manifest)


async def delete_material_texture(request):
    try:
        p = _require_project()
    except LookupError as e:
        return err(str(e))
    name = request.path_params['name']
    rows = p.manifest.setdefault('materialTextures', [])
    rows[:] = [r for r in rows if r.get('name') != name]
    p.save()
    return ok(project=p.manifest)


async def delete_imported(request):
    """
    Remove an imported row and the blob it wrote.

    Deleting the manifest row alone would leave the blob behind in SHARED_DATA, where
    sync_blobs reports it as stray and it ships as dead weight.
    """
    try:
        p = _require_project()
    except LookupError as e:
        return err(str(e))

    kind, name = request.path_params['kind'], request.path_params['name']
    spec = {
        'texture': ('uiTextures', 'ui_name', lambda n: 'TEXTURE_' + n),
        'mesh':    ('meshes', 'asset', None),
        'audio':   ('soundbanks', 'name', lambda n: n),
    }.get(kind)
    if spec is None:
        return err(f'cannot delete {kind}')
    key, name_key, blob_of = spec

    rows = p.manifest.setdefault(key, [])
    gone = [r for r in rows if r.get(name_key) == name]
    rows[:] = [r for r in rows if r.get(name_key) != name]

    removed = []
    for row in gone:
        blobs = [blob_of(name)] if blob_of else [row.get('buffer')]
        for blob in filter(None, blobs):
            path = os.path.join(p.shared_data_dir, blob)
            if os.path.exists(path):
                os.remove(path)
                removed.append(blob)
    p.save()
    return ok(project=p.manifest, removedBlobs=removed)


# --- reused assets --------------------------------------------------------

async def inspect_clone(request):
    """What copying this asset would involve, and which materials it currently uses."""
    try:
        index = _index()
    except LookupError as e:
        return err(str(e))
    info, findings = clones.inspect(STATE['game'], index,
                                    request.path_params['name'])
    if info is None:
        return ok(asset=None, findings=_findings(findings))
    return ok(asset=info, findings=_findings(findings))


async def add_clone(request):
    try:
        p = _require_project()
    except LookupError as e:
        return err(str(e))
    try:
        index = _index()
    except LookupError as e:
        return err(str(e))

    body = await request.json()
    source = (body.get('asset') or '').strip()
    info, findings = clones.inspect(STATE['game'], index, source)
    if info is None:
        return ok(created=False, findings=_findings(findings))

    row, more = clones.make_clone(source, body.get('newName', ''),
                                  info['package'], body.get('materials') or {},
                                  info['blobs'],
                                  asset_list=body.get('assetList', 'assets'))
    findings += more
    if row is None:
        return ok(created=False, findings=_findings(findings))

    rows = p.manifest.setdefault('clones', [])
    rows[:] = [r for r in rows if r.get('newName') != row['newName']]
    rows.append(row)
    p.save()
    findings += clones.check_clones(rows, p.manifest.get('materials', []))
    return ok(created=True, row=row, findings=_findings(findings),
              project=p.manifest)


async def delete_clone(request):
    try:
        p = _require_project()
    except LookupError as e:
        return err(str(e))
    name = request.path_params['name']
    rows = p.manifest.setdefault('clones', [])
    rows[:] = [r for r in rows if r.get('newName') != name]
    p.save()
    return ok(project=p.manifest)


# --- what to include ------------------------------------------------------

async def list_items(request):
    """Everything in the project, with what is on and what is locked."""
    try:
        p = _require_project()
    except LookupError as e:
        return err(str(e))
    return ok(groups=selection.items(p.manifest))


async def toggle_item(request):
    """Turn one item, or a whole group, on or off."""
    try:
        p = _require_project()
    except LookupError as e:
        return err(str(e))
    body = await request.json()
    kind, enabled = body.get('kind'), bool(body.get('enabled'))

    if body.get('group'):
        errors = selection.set_group(p.manifest, kind, enabled)
        p.save()
        return ok(groups=selection.items(p.manifest), errors=errors,
                  project=p.manifest)

    changed, error = selection.set_enabled(p.manifest, kind, body.get('key', ''),
                                           enabled)
    if error:
        return ok(changed=False, error=error, groups=selection.items(p.manifest))
    if changed:
        p.save()
    return ok(changed=changed, groups=selection.items(p.manifest),
              project=p.manifest)


# --- build ----------------------------------------------------------------

async def do_build(request):
    try:
        p = _require_project()
    except LookupError as e:
        return err(str(e))
    if not STATE['game']:
        return err('set the game install path first')

    # The build is CPU-bound and takes seconds; keep the event loop responsive so the
    # UI can still report progress rather than appearing hung.
    result = await asyncio.to_thread(build_mod.build, p, STATE['game'])
    return ok(built=result.ok, packages=result.packages, log=result.log,
              skipped=result.skipped,
              findings=_findings(result.findings),
              donors={k: os.path.relpath(v, STATE['game'])
                      for k, v in result.donors.items()},
              missingBlobs=build_mod.missing_blobs(p),
              dlcDir=p.dlc_dir, modsDir=p.mods_dir)


async def build_status(request):
    try:
        p = _require_project()
    except LookupError as e:
        return err(str(e))
    return ok(dlcDir=p.dlc_dir, modsDir=p.mods_dir,
              missingBlobs=build_mod.missing_blobs(p),
              packages=[f[:-4] for f in sorted(os.listdir(p.blp_dir))
                        if f.endswith('.blp')] if os.path.isdir(p.blp_dir) else [])


# --- filesystem helper ----------------------------------------------------

async def list_dir(request):
    """
    Directory listing, so the browser can offer a path picker for the game install.

    A web page cannot see server-side paths, and asking a modder to type their Steam
    directory from memory is the kind of small friction that stops people entirely.

    Each child is reported with whether it is itself an install, so the picker can mark
    the right folder rather than leaving the user to guess whether to stop at the Steam
    directory, `common`, or one level further in.
    """
    path = request.query_params.get('path') or os.path.expanduser('~')
    path = os.path.abspath(path)
    if not os.path.isdir(path):
        return err(f'{path} is not a directory')
    try:
        names = sorted(
            (e.name for e in os.scandir(path)
             if e.is_dir() and not e.name.startswith('.')),
            key=str.lower)
    except PermissionError:
        return err(f'no permission to read {path}')

    dirs = [{'name': n, 'isGame': settings.looks_like_game(os.path.join(path, n))}
            for n in names]

    # The same picker chooses source files, so it can list matching ones too. Filtered
    # by extension because a project folder holds hundreds of files and only a handful
    # are a valid .wem or .glb.
    files = []
    wanted = [e.strip().lower() for e in
              (request.query_params.get('files') or '').split(',') if e.strip()]
    if wanted:
        try:
            for e in sorted(os.scandir(path), key=lambda e: e.name.lower()):
                if e.is_file() and os.path.splitext(e.name)[1].lower() in wanted:
                    files.append({'name': e.name, 'size': e.stat().st_size})
        except OSError:
            pass

    parent = os.path.dirname(path)
    return ok(path=path, parent=parent if parent != path else None,
              dirs=dirs, files=files, isGame=settings.looks_like_game(path))


async def fs_roots(request):
    """
    Sensible places to start browsing: detected installs, recent picks, drives, home.

    On Windows the install is usually on whichever drive Steam had room for, so the
    drive letters matter -- a picker rooted at the home directory can't reach E:\\ at all.
    """
    roots = []
    seen = set()

    def add(path, label, kind):
        if path and path not in seen and os.path.isdir(path):
            seen.add(path)
            roots.append({'path': path, 'label': label, 'kind': kind})

    for p in settings.detect_game():
        add(p, 'Detected install', 'game')
    for p in STATE['settings'].get('recentGames', []):
        add(p, 'Recently used', 'game')
    add(os.path.expanduser('~'), 'Home', 'home')
    add(STATE['root'], 'Projects', 'projects')

    if os.name == 'nt':
        for letter in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
            add(f'{letter}:\\', f'{letter}:', 'drive')
    else:
        add('/', 'Filesystem root', 'drive')
    return ok(roots=roots)


async def index_html(request):
    return FileResponse(os.path.join(WEB, 'index.html'))


routes = [
    Route('/api/settings', get_settings, methods=['GET']),
    Route('/api/settings', set_settings, methods=['POST']),
    Route('/api/projects/create', create_project, methods=['POST']),
    Route('/api/projects/open', open_project, methods=['POST']),
    Route('/api/manifest', get_manifest, methods=['GET']),
    Route('/api/manifest', save_manifest, methods=['POST']),
    Route('/api/assets/search', search_assets, methods=['GET']),
    Route('/api/assets/{name}', describe_asset, methods=['GET']),
    Route('/api/inspect', inspect_file, methods=['POST']),
    Route('/api/import', import_file, methods=['POST']),
    Route('/api/import/{kind}/{name}', delete_imported, methods=['DELETE']),
    Route('/api/units', list_project_units, methods=['GET']),
    Route('/api/units', create_unit, methods=['POST']),
    Route('/api/units/donors', list_unit_donors, methods=['GET']),
    Route('/api/units/donors/{name}', describe_unit, methods=['GET']),
    Route('/api/units/{name}', delete_unit, methods=['DELETE']),
    Route('/api/materials/slots', material_slots, methods=['GET']),
    Route('/api/materials/textures/search', search_textures, methods=['GET']),
    Route('/api/materials/textures', add_material_texture, methods=['POST']),
    Route('/api/materials/textures/{name}', delete_material_texture, methods=['DELETE']),
    Route('/api/materials', add_material, methods=['POST']),
    Route('/api/materials/{name}', delete_material, methods=['DELETE']),
    Route('/api/clones', add_clone, methods=['POST']),
    Route('/api/clones/inspect/{name}', inspect_clone, methods=['GET']),
    Route('/api/clones/{name}', delete_clone, methods=['DELETE']),
    Route('/api/build', do_build, methods=['POST']),
    Route('/api/build/status', build_status, methods=['GET']),
    Route('/api/build/items', list_items, methods=['GET']),
    Route('/api/build/items', toggle_item, methods=['POST']),
    Route('/api/fs/list', list_dir, methods=['GET']),
    Route('/api/fs/roots', fs_roots, methods=['GET']),
    Route('/', index_html, methods=['GET']),
]

def _restore_last_project():
    """Reopen whatever was last open, so a restart is not a fresh start."""
    last = STATE['settings'].get('lastProject')
    if last and os.path.exists(os.path.join(last, 'civart.json')):
        try:
            STATE['project'] = Project.open(last)
        except Exception:
            pass                      # a project that moved or broke is not fatal


_restore_last_project()

app = Starlette(routes=routes)


def serve(host='127.0.0.1', port=8765, open_browser=True):
    import uvicorn
    url = f'http://{host}:{port}'
    print(f'Civ7 Art Studio -> {url}')
    if open_browser:
        threading.Timer(0.7, lambda: webbrowser.open(url)).start()
    uvicorn.run(app, host=host, port=port, log_level='warning')
