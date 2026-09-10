"""
Turn individual pieces of a project on and off, to bisect a problem.

When a package loads but the game misbehaves, the only reliable way to find the cause
is to remove things until it stops. Doing that by deleting content is destructive and
slow -- you lose the work and have to redo the import. So every item carries an
`enabled` flag instead, absent meaning on, and the build simply skips what is off.

The wrinkle is that items depend on each other. A material's texture slots are
package-local pointers, so a material whose texture has been switched off is not a
smaller material, it is a broken one. Rather than let that happen and report it
afterwards, anything an enabled item depends on is locked: you disable the material,
and the texture becomes free to disable in turn.

Dependencies point from the thing that needs, to the thing needed:

    material     -> its materialTextures
    mesh         -> the material it names
    clone        -> the materials it repoints to
    building     -> the mesh wrapper it targets, when that wrapper is ours
    audio event  -> the soundbank behind it
"""
import copy

# (manifest key, key field, human label for the group)
KINDS = [
    ('buildings',        'expression', 'Buildings'),
    ('improvements',     'asset',      'Improvements'),
    ('wonders',          'asset',      'Wonders'),
    ('units',            'name',       'Units'),
    ('meshes',           'asset',      '3D assets'),
    ('soundbanks',       'name',       'Soundbanks'),
    ('audioEvents',      'wwiseEvent', 'Audio events'),
    ('uiTextures',       'ui_name',    'UI textures'),
    ('materials',        'name',       'Materials'),
    ('materialTextures', 'name',       'Material textures'),
    ('clones',           'newName',    'Reused assets'),
    ('binArt',           'type',       'Bins'),
]
KEY_FIELD = {kind: field for kind, field, _label in KINDS}


def key_of(kind, row):
    field = KEY_FIELD.get(kind)
    return row.get(field, '') if field else ''


def is_enabled(row):
    """Absent means on, so an existing manifest needs no migration."""
    return row.get('enabled', True) is not False


def _label(kind, row):
    if kind == 'buildings':
        return f"{row.get('expression', '')} → {row.get('target', '')}"
    if kind == 'meshes':
        return f"{row.get('asset', '')} ({row.get('primitive_count', '?')} tris)"
    if kind == 'materials':
        return f"{row.get('name', '')} ({len(row.get('slots') or {})} slots)"
    if kind == 'clones':
        return f"{row.get('newName', '')} ← {row.get('asset', '')}"
    if kind == 'units':
        return f"{row.get('name', '')} ← {row.get('copiedFrom', '?')}"
    if kind == 'audioEvents':
        return f"{row.get('wwiseEvent', '')}"
    return key_of(kind, row)


def dependencies(manifest):
    """
    {(kind, key): [(kind, key), ...]} -- what each item needs present.

    Only in-package relationships count. A building pointing at a shipped bin depends
    on nothing here; one pointing at a mesh this project builds does.
    """
    deps = {}
    mesh_wrappers = {m['asset'] + '_Scaled': m['asset']
                     for m in manifest.get('meshes', []) if m.get('asset')}
    our_materials = {m['name'] for m in manifest.get('materials', []) if m.get('name')}
    our_textures = {t['name'] for t in manifest.get('materialTextures', [])
                    if t.get('name')}
    our_banks = {b['name'] for b in manifest.get('soundbanks', []) if b.get('name')}

    for m in manifest.get('materials', []):
        needs = [('materialTextures', t) for t in (m.get('slots') or {}).values()
                 if t in our_textures]
        deps[('materials', m.get('name', ''))] = needs

    for m in manifest.get('meshes', []):
        mat = m.get('material')
        deps[('meshes', m.get('asset', ''))] = (
            [('materials', mat)] if mat in our_materials else [])

    for c in manifest.get('clones', []):
        deps[('clones', c.get('newName', ''))] = [
            ('materials', v) for v in (c.get('materials') or {}).values()
            if v in our_materials]

    for bld in manifest.get('buildings', []):
        target = bld.get('target', '')
        deps[('buildings', bld.get('expression', ''))] = (
            [('meshes', mesh_wrappers[target])] if target in mesh_wrappers else [])

    for e in manifest.get('audioEvents', []):
        bank = 'SOUNDBANK_' + (e.get('wwiseEvent') or '')
        deps[('audioEvents', e.get('wwiseEvent', ''))] = (
            [('soundbanks', bank)] if bank in our_banks else [])

    return deps


def dependents(manifest):
    """The inverse: {(kind, key): [(kind, key) that need it]}."""
    out = {}
    for item, needs in dependencies(manifest).items():
        for need in needs:
            out.setdefault(need, []).append(item)
    return out


def items(manifest):
    """
    Every toggleable item, grouped, with why it is locked if it is.

    An item is locked when something still enabled depends on it. Turning that
    dependent off unlocks it, which makes the order of operations obvious in the UI
    without needing to explain the rule.
    """
    deps = dependencies(manifest)
    revs = dependents(manifest)
    groups = []

    for kind, _field, label in KINDS:
        rows = manifest.get(kind) or []
        if not rows:
            continue
        entries = []
        for row in rows:
            key = key_of(kind, row)
            enabled = is_enabled(row)
            blockers = [k for k in revs.get((kind, key), [])
                        if _enabled_by_key(manifest, k)]
            entries.append({
                'kind': kind, 'key': key, 'label': _label(kind, row),
                'enabled': enabled,
                'lockedBy': [{'kind': b[0], 'key': b[1]} for b in blockers],
                'needs': [{'kind': n[0], 'key': n[1]}
                          for n in deps.get((kind, key), [])],
            })
        groups.append({'kind': kind, 'label': label, 'items': entries,
                       'enabled': sum(1 for e in entries if e['enabled']),
                       'total': len(entries)})
    return groups


def _enabled_by_key(manifest, item):
    kind, key = item
    for row in manifest.get(kind) or []:
        if key_of(kind, row) == key:
            return is_enabled(row)
    return False


def set_enabled(manifest, kind, key, enabled):
    """
    Toggle one item. Returns (changed, error).

    Disabling is refused while something enabled needs it, rather than cascading:
    a cascade silently switches off work the user did not point at, and during a
    bisection that is the one thing that must not happen.
    """
    if kind not in KEY_FIELD:
        return False, f'unknown item kind {kind!r}'
    rows = manifest.get(kind) or []
    row = next((r for r in rows if key_of(kind, r) == key), None)
    if row is None:
        return False, f'no {kind} called {key!r}'

    if not enabled:
        blockers = [b for b in dependents(manifest).get((kind, key), [])
                    if _enabled_by_key(manifest, b)]
        if blockers:
            names = ', '.join(f'{b[1]}' for b in blockers)
            return False, (f'{key} is still used by {names}. Turn '
                           f'{"those" if len(blockers) > 1 else "that"} off first.')

    if enabled:
        row.pop('enabled', None)          # absent means on; keeps the manifest clean
    else:
        row['enabled'] = False
    return True, None


def set_group(manifest, kind, enabled):
    """Toggle a whole group, innermost dependents first so nothing blocks."""
    rows = manifest.get(kind) or []
    order = rows if enabled else list(reversed(rows))
    errors = []
    for row in order:
        okay, error = set_enabled(manifest, kind, key_of(kind, row), enabled)
        if not okay and error:
            errors.append(error)
    return errors


def apply(manifest):
    """
    A copy of the manifest with disabled items removed.

    Defensive about the case the UI prevents: if a manifest is hand-edited so an
    enabled material's texture is off, the material goes too rather than being emitted
    with a slot pointing at nothing.
    """
    out = copy.deepcopy(manifest)
    for kind, _field, _label in KINDS:
        if kind in out and isinstance(out[kind], list):
            out[kind] = [r for r in out[kind] if is_enabled(r)]

    deps = dependencies(manifest)
    changed = True
    while changed:
        changed = False
        present = {(kind, key_of(kind, r))
                   for kind, _f, _l in KINDS for r in out.get(kind) or []}
        for kind, _field, _label in KINDS:
            keep = []
            for row in out.get(kind) or []:
                needs = deps.get((kind, key_of(kind, row)), [])
                if all(n in present for n in needs):
                    keep.append(row)
                else:
                    changed = True
            if kind in out:
                out[kind] = keep
    return out


def summary(manifest):
    """One line per group: how much is switched on."""
    return {kind: {'enabled': sum(1 for r in manifest.get(kind) or [] if is_enabled(r)),
                   'total': len(manifest.get(kind) or [])}
            for kind, _f, _l in KINDS if manifest.get(kind)}
