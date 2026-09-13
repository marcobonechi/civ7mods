"""
Builds a project. .blp files build by manifest, and then .dep generated.
"""
import os, shutil
from dataclasses import dataclass, field

from . import guards, selection
from .tools import ensure_on_path


@dataclass
class BuildResult:
    ok: bool = True
    packages: list = field(default_factory=list)     # package names actually built
    log: list = field(default_factory=list)
    findings: list = field(default_factory=list)     # guards.Finding
    donors: dict = field(default_factory=dict)
    skipped: dict = field(default_factory=dict)      # kind -> how many are switched off

    def say(self, message):
        self.log.append(message)

    def fail(self, message):
        self.ok = False
        self.log.append(f'ERROR: {message}')


def _donor_candidates(pinned):
    """A pin names one platform's copy of a donor ('DLC/joseon/Platforms/Mac/BLPs/x.blp'), but a
    game install only ships the platform it runs on. Offer the pin first, then the same path under
    the other platform folders, so one manifest builds the same package on any OS."""
    yield pinned
    parts = pinned.replace(os.sep, '/').split('/')
    if 'Platforms' not in parts:
        return
    i = parts.index('Platforms')
    if i + 1 >= len(parts):
        return
    for plat in ('Windows', 'Mac', 'Linux'):
        if parts[i + 1] != plat:
            yield '/'.join(parts[:i + 1] + [plat] + parts[i + 2:])


def _pick_donor(game_root, manifest, package, log):
    """
    To not have to fiddle with all the little bits, need a donor BLP package to use, from the base game.
    StandardAsset donors are chosen by measurement; the others by first fit.
    StandardAssets can be real big, so it tries find small ones.

    A manifest may pin a donor per package. The stripe is copied verbatim, so two
    equally valid donors give byte-different packages; pinning is what makes a build
    reproducible across machines and game patches. Auto-selection fills the pin in on
    first build rather than re-deciding every time.
    """
    ensure_on_path()
    import donors as D

    pinned = (manifest.get('donors') or {}).get(package)
    if pinned:
        for cand in _donor_candidates(pinned):
            path = cand if os.path.isabs(cand) else os.path.join(game_root, cand)
            if os.path.exists(path):
                log(f'  donor {package}: {cand} (pinned)')
                return path
        log(f'  donor {package}: pinned {pinned} is missing, re-selecting')

    if package == 'StandardAsset':
        chosen, needed, ok = D.select(game_root, manifest)
        log(f'  donor {package}: {os.path.relpath(chosen, game_root)} '
            f'({len(needed)} types needed, {len(ok)} candidates)')
        return chosen

    required = {
        'UI': {'BLP::TextureEntry', 'UIPackageEntry_Texture'},
        'Material': {'MaterialDesc_Aniso0', 'MaterialDesc_Standard2',
                     'PackageMaterialEntry_Aniso', 'PackageMaterialEntry_Standard'},
    }[package]
    idx = D.index(D.candidates(game_root, package))
    ok = sorted((p for p, types in idx.items() if required <= types),
                key=lambda p: (len(idx[p]), p))
    if not ok:
        raise RuntimeError(f'no {package} package declares {sorted(required)}')
    log(f'  donor {package}: {os.path.relpath(ok[0], game_root)} '
        f'({len(ok)} candidates)')
    return ok[0]


def build(project, game_root, run_guards=True, sync=True, validate=True):
    """
    Build `project` (a Project) into its built/ tree. Returns a BuildResult.

    Guard findings never block the build -- several are judgement calls, and a package
    the author knowingly ships with a warning is still a valid package.
    """
    ensure_on_path()
    import build_blp, build_ui_blp

    r = BuildResult()
    # Build what is switched on, not everything the project holds. Disabled items stay
    # in the manifest so a bisection is reversible.
    manifest = selection.apply(project.manifest)
    r.skipped = {k: v['total'] - v['enabled']
                 for k, v in selection.summary(project.manifest).items()
                 if v['total'] != v['enabled']}
    if r.skipped:
        r.say('  building a subset: ' +
              ', '.join(f'{n} {k} disabled' for k, n in sorted(r.skipped.items())))

    if run_guards:
        r.findings = guards.check_project(manifest)
        errors = [f for f in r.findings if f.level == guards.ERROR]
        for f in r.findings:
            r.say(f'  {f}')
        if errors:
            r.fail(f'{len(errors)} error(s) in the manifest; not building')
            return r

    os.makedirs(project.shared_data_dir, exist_ok=True)
    os.makedirs(os.path.join(project.mods_dir, 'modules'), exist_ok=True)

    # --- StandardAsset: always built, even when empty. A project with only UI
    # textures still needs the art group to exist for the .dep to point at.
    try:
        donor = _pick_donor(game_root, manifest, 'StandardAsset', r.say)
        try:
            data, b = build_blp.build_package(manifest, donor, game_root, log=r.say)
        except KeyError as e:
            # A pinned donor can go stale in one direction only: it was chosen for
            # whatever the project contained at the time, and adding content -- or
            # switching content back on -- can need a type it does not declare. The pin
            # exists for reproducible rebuilds, not to block a build, so drop it and
            # choose again rather than failing.
            if not (manifest.get('donors') or {}).get('StandardAsset'):
                raise
            r.say(f'  pinned donor is no longer sufficient ({e}); re-selecting')
            project.manifest.get('donors', {}).pop('StandardAsset', None)
            manifest.get('donors', {}).pop('StandardAsset', None)
            donor = _pick_donor(game_root, manifest, 'StandardAsset', r.say)
            data, b = build_blp.build_package(manifest, donor, game_root, log=r.say)
        r.donors['StandardAsset'] = donor
        path = os.path.join(project.blp_dir, 'StandardAsset.blp')
        with open(path, 'wb') as f:
            f.write(data)
        r.packages.append('StandardAsset')
        r.say(f'  wrote StandardAsset.blp ({len(data)} bytes, {len(b.allocs)} allocs)')
    except Exception as e:
        r.fail(f'StandardAsset: {e}')
        return r

    # --- UI
    if manifest.get('uiTextures'):
        try:
            donor = _pick_donor(game_root, manifest, 'UI', r.say)
            r.donors['UI'] = donor
            data, b = build_ui_blp.build_ui_package(manifest['uiTextures'], donor,
                                                    log=r.say)
            with open(os.path.join(project.blp_dir, 'UI.blp'), 'wb') as f:
                f.write(data)
            r.packages.append('UI')
            r.say(f'  wrote UI.blp ({len(data)} bytes)')
        except Exception as e:
            r.fail(f'UI: {e}')

    # --- Material
    if manifest.get('materials'):
        try:
            donor = _pick_donor(game_root, manifest, 'Material', r.say)
            r.donors['Material'] = donor
            data = _build_materials(manifest, donor, r.say)
            with open(os.path.join(project.blp_dir, 'Material.blp'), 'wb') as f:
                f.write(data)
            r.packages.append('Material')
            r.say(f'  wrote Material.blp ({len(data)} bytes)')
        except Exception as e:
            r.fail(f'Material: {e}')

    # --- descriptors, generated from what was actually built
    with open(os.path.join(project.dlc_dir, f'{project.name}.dep'), 'w') as f:
        f.write(project.dep_xml(r.packages))
    r.say(f"  wrote {project.name}.dep ({', '.join(r.packages)})")

    modinfo = os.path.join(project.mods_dir, 'modules', f'{project.name}.modinfo')
    with open(modinfo, 'w') as f:
        f.write(project.modinfo_xml())
    r.say(f'  wrote {project.name}.modinfo')

    # Record which donors were used so the next build reproduces these bytes exactly,
    # even if the game gains a DLC with a smaller qualifying package.
    pins = project.manifest.setdefault('donors', {})
    changed = False
    for package, path in r.donors.items():
        rel = os.path.relpath(path, game_root)
        if pins.get(package) != rel:
            pins[package] = rel
            changed = True
    if changed:
        project.save()
        r.say('  pinned donors in the manifest for reproducible rebuilds')

    if sync:
        _sync_blobs(project, game_root, r)
    if validate:
        _validate(project, r)
    return r


def _build_materials(manifest, donor, say):
    """
    Materials and their textures, in one package.

    A material's texture slots are BLPPtr<TextureEntry> -- allocation pointers, so
    package-local. Every texture a material references must be declared in this same
    package and its blob copied alongside; unlike a material, which resolves across
    packages by name hash, a texture cannot be aliased from elsewhere.
    """
    ensure_on_path()
    from build_blp import PackageBuilder

    b = PackageBuilder(donor)
    declared = {}
    for t in manifest.get('materialTextures', []):
        declared[t['name']] = b.add_texture(
            t['name'][len('TEXTURE_'):], t['size'], t['width'], t['height'],
            t['mips'], fmt=t['fmt'], tex_class=t['tex_class'], flags=t['flags'],
            ui_entry=False)
        say(f"  material texture {t['name']} ({t['slot']}, fmt {t['fmt']})")

    for m in manifest['materials']:
        slots = {slot: declared[name] for slot, name in m['slots'].items()
                 if name in declared}
        missing = [n for n in m['slots'].values() if n not in declared]
        if missing:
            raise RuntimeError(f"material {m['name']} references undeclared "
                               f"textures: {missing}")
        if m.get('kind') == 'standard':
            b.add_material_standard(m['name'], slots,
                                    tint_mode=m.get('tint_mode', 8))
        else:
            b.add_material(m['name'], slots)
        say(f"  material {m['name']} ({m.get('kind', 'aniso')}, "
            f"{len(slots)} slots)")
    return b.build()


def _sync_blobs(project, game_root, r):
    """
    Fetch referenced blobs we do not already have.

    Called in-process rather than as a subprocess. A frozen build has no Python
    interpreter to hand: sys.executable is the app's own exe, so spawning
    `sys.executable sync_blobs.py --blps ...` re-invokes the app with the script as an
    argument and it dies on its own argument parser.
    """
    ensure_on_path()
    import sync_blobs

    # The module picks a default game root from the environment at import time, which
    # suits the CLI; the app learns it at runtime.
    sync_blobs.set_game_root(game_root)

    try:
        summary = sync_blobs.sync(project.blp_dir, project.manifest, log=r.say)
    except Exception as e:
        r.fail(f'blob sync failed: {type(e).__name__}: {e}')
        return
    if summary['unresolved']:
        r.fail(f"{len(summary['unresolved'])} blob(s) could not be found: "
               f"{', '.join(summary['unresolved'][:5])}")


def _validate(project, r):
    """Structural invariants, again in-process for the same reason."""
    ensure_on_path()
    import validate as validator

    for name in r.packages:
        path = os.path.join(project.blp_dir, f'{name}.blp')
        if not os.path.exists(path):
            continue
        try:
            okay = validator.validate(path)
        except Exception as e:
            r.fail(f'{name}.blp could not be validated: {type(e).__name__}: {e}')
            continue
        r.say(f'  {name}.blp {"OK" if okay else "FAILED validation"}')
        if not okay:
            r.fail(f'{name}.blp failed structural validation')


def missing_blobs(project):
    """
    Every SHARED_DATA blob the built packages reference but do not have.

    Reported separately from the build because it is the check that matters after
    someone copies the tree somewhere by hand, and because a dangling entry is
    otherwise completely silent. sync_blobs already knows how to read the requirement
    out of a package -- including that only entries with flags bit 0x02 live in
    SHARED_DATA at all -- so this asks it rather than re-deriving the rule.
    """
    ensure_on_path()
    import sync_blobs

    if not os.path.isdir(project.blp_dir):
        return []
    wanted = set(sync_blobs.required(project.blp_dir))
    have = set(os.listdir(project.shared_data_dir)) \
        if os.path.isdir(project.shared_data_dir) else set()
    return sorted(wanted - have)
