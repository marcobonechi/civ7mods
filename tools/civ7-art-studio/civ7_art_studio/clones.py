"""
Reuse a shipped asset's geometry and animation under your own material.

Nothing here is specific to banners, though that was the first thing it was used for.
The operation is general: take any shipped asset, copy it wholesale into your package
under a new name, and repoint the materials its meshes reference.

Why copy rather than author. A model asset is tens of geometry records, dozens of
animation and stateset records, and a handful of components -- and every one of those
values should be identical to the shipped asset. Only the material hash is meant to
change. Writing emitters for the rest would be a lot of code whose entire job is to
reproduce bytes that can simply be copied.

Why the material can be repointed at all comes down to one asymmetry:

  * Materials bind by NAME HASH, which resolves across packages. So a cloned mesh can
    point at a material in your own Material.blp.
  * Geometry buffers do not -- pVB/pIB are allocation pointers. So the GB_*_MB buffer
    is cloned into your package too, and its blob has to be copied to SHARED_DATA.

That second point is why renaming matters. If the clone keeps the original's buffer
name, two assets end up sharing one blob, and sync_blobs cannot tell which of them
should own the file.
"""
import os
import re

from . import guards
from .tools import ensure_on_path

# Blob suffixes that belong to the asset rather than being shared. These are what a
# rename has to cover; a texture the asset merely references is usually shared on
# purpose and renaming it would just duplicate it.
OWNED_SUFFIXES = ('_MB', '_StateSetBlob0', '_StateSetBlob', '_Blob0')


def inspect(game_root, index, asset_name):
    """
    What cloning this asset would involve, without writing anything.

    Runs the clone into a throwaway package and reports what it touched: record counts,
    the blobs it owns, and -- the part that matters -- which materials its meshes
    currently point at, resolved from hashes back to names.
    """
    ensure_on_path()
    import clone_asset
    from build_blp import fnv1a32

    entry = index['assets'].get(asset_name)
    if entry is None:
        return None, [guards.Finding(guards.ERROR, 'clone-unknown-asset',
                                     f'{asset_name} is not in the installed game',
                                     asset_name)]
    src = os.path.join(game_root, entry['packages'][0])
    try:
        cloner = clone_asset.Cloner(src, {}, {})
        found = cloner.find(asset_name)
        if found is None:
            return None, [guards.Finding(
                guards.ERROR, 'clone-not-an-asset',
                f'{asset_name} is in {entry["packages"][0]} but is not an asset entry, '
                f'so there is nothing to clone.', asset_name)]
        cloner.clone(found)
    except Exception as e:
        return None, [guards.Finding(guards.ERROR, 'clone-failed',
                                     f'{type(e).__name__}: {e}', asset_name)]

    stats = cloner.stats
    # Reverse the hashes through the index over *every* name, not just the material
    # entries. A material hash does not always name a PackageMaterialEntry: the jinja
    # building's meshes point at M_Wall_Limestone_ANT_Base_002_GEN_001 and friends,
    # which are ordinary asset entries. Restricting the lookup to role 'material'
    # leaves those showing as bare hashes. Materials still win a collision, since that
    # is the commoner case and fnv1a32 over 36k names is not injective.
    by_hash = {}
    for name, e in index['assets'].items():
        h = fnv1a32(name)
        if h not in by_hash or e['role'] == 'material':
            by_hash[h] = name

    used = []
    for h in sorted(stats.get('material_hashes', ())):
        used.append({'hash': f'0x{h:08X}', 'name': by_hash.get(h, '')})

    blobs = [{'name': n, 'type': t, 'owned': n.endswith(OWNED_SUFFIXES)}
             for n, t in stats.get('blobs', [])]

    counts = {k: v for k, v in stats.items() if isinstance(v, int)}
    return {
        'asset': asset_name,
        'package': entry['packages'][0],
        'type': entry['type'],
        'allocations': sum(counts.values()),
        'geometry': sum(v for k, v in counts.items() if 'Geometry' in k),
        'animation': sum(v for k, v in counts.items() if 'Anim' in k),
        'stateSets': sum(v for k, v in counts.items() if 'StateSet' in k),
        'materials': used,
        'blobs': blobs,
        'records': sorted(((k, v) for k, v in counts.items() if v > 1),
                          key=lambda kv: -kv[1])[:12],
    }, []


def plan_renames(asset_name, new_name, blobs):
    """
    Derive the rename map from what the asset owns.

    Hand-maintaining this is where clones go wrong: a missed buffer name leaves the
    clone sharing the original's blob. Everything the asset owns is renamed by
    substituting the new asset name for the old one, which keeps the suffixes
    (_MB, _StateSetBlob0) that the engine and sync_blobs both key off.
    """
    renames = {asset_name: new_name}
    stem = _stem(asset_name)
    new_stem = _stem(new_name)
    for b in blobs:
        name = b['name'] if isinstance(b, dict) else b
        owned = b.get('owned', True) if isinstance(b, dict) else True
        if not owned or name in renames:
            continue
        if stem and stem in name:
            renames[name] = name.replace(stem, new_stem)
    return renames


def _stem(name):
    """
    The distinguishing part of an asset name.

    Blob names rarely repeat the asset name exactly -- the banner asset is
    CIVILIZATION_HEIAN_BANNER_GAME_ASSET while its buffer is
    GB_CIVILIZATION_HEIAN_BANNER_MB -- so the shared part is what a rename keys on.
    """
    stem = re.sub(r'_(GAME_ASSET|ASSET|GAME)$', '', name or '')
    return stem


def make_clone(asset_name, new_name, source_package, materials=None, blobs=None,
               asset_list='assets'):
    """Build a manifest clone row. Returns (row, findings)."""
    findings = []
    new_name = (new_name or '').strip()
    if not new_name:
        return None, [guards.Finding(guards.ERROR, 'clone-unnamed',
                                     'the copy needs its own name')]
    if not re.fullmatch(r'[A-Za-z0-9_]+', new_name):
        return None, [guards.Finding(guards.ERROR, 'clone-name-charset',
                                     f'"{new_name}" is not a valid asset name',
                                     new_name)]
    if new_name == asset_name:
        return None, [guards.Finding(
            guards.ERROR, 'clone-same-name',
            'the copy needs a different name from the original, or it would collide '
            'with it and share its blobs.', new_name)]

    renames = plan_renames(asset_name, new_name, blobs or [])
    if len(renames) == 1 and blobs:
        findings.append(guards.Finding(
            guards.WARNING, 'clone-blobs-not-renamed',
            f'none of this asset\'s blobs could be renamed automatically, so the copy '
            f'will share them with {asset_name}. That works, but the two can no longer '
            f'be given different geometry.', new_name))

    materials = {k: v for k, v in (materials or {}).items() if k and v}
    if not materials:
        findings.append(guards.Finding(
            guards.WARNING, 'clone-no-material-change',
            'no material is being repointed, so this is an exact copy under a new '
            'name.', new_name))

    return {'source': source_package, 'asset': asset_name,
            'newName': new_name, 'renames': renames,
            'materials': materials, 'assetList': asset_list}, findings


def check_clones(rows, project_materials=None):
    """
    A clone's new material has to exist somewhere by the time the game loads it.

    Materials resolve by hash across packages, so pointing at one this project defines
    is the normal case -- but pointing at a name that exists nowhere leaves the mesh
    with an unresolved hash, which renders white.
    """
    out = []
    known = {m.get('name') for m in (project_materials or [])}
    seen = set()
    for row in rows:
        name = row.get('newName') or row.get('renames', {}).get(row.get('asset', ''))
        if name in seen:
            out.append(guards.Finding(guards.ERROR, 'clone-duplicate',
                                      f'{name} is cloned twice', name))
        seen.add(name)
        for _old, new in (row.get('materials') or {}).items():
            if project_materials is not None and new not in known:
                out.append(guards.Finding(
                    guards.WARNING, 'clone-unknown-material',
                    f'{new} is not defined in this project. Materials resolve by hash '
                    f'across packages, so this is fine if another mod provides it -- '
                    f'otherwise the mesh renders white.', name))
    return out
