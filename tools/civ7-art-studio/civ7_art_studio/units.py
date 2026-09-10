"""
Units: make one unit look like another.

A unit's art is a metadata asset named *exactly* its UnitType -- there is no
[UNIT:...] tag namespace and no bin dispatch, so nothing here resembles the building
path. The asset holds movement parameters, formation references and a MemberInfo
collection naming MEMBER_* assets, and the members are the visible part. Point them at
another unit's members and the unit looks like that unit, with no geometry, material or
bin work at all. Member assets are mostly named MEMBER_*, but not always -- some are
Member_*_Bin -- so nothing here assumes the prefix.

So the whole job is: read a shipped unit's ValueSet, rename it, and optionally swap the
members. Everything else is copied verbatim, because the ~49 parameters a unit carries
are all things we have no reason to change and no way to invent.
"""
import copy
import re

from . import guards

SA = 'StandardAsset'
SA_PKG = 'StandardAsset.blp'

# The parameters a working hand-authored unit used, before anything copied a donor
# wholesale. A unit built from exactly these has been placed on a map and moved around
# without incident; a 49-parameter copy of the same donor has not.
#
# So 'minimal' is the default, and it is the conservative choice rather than the
# obvious one: copying every parameter is more faithful in principle, and faithful is
# usually right, but "more of the donor" is also more of whatever the donor's other
# parameters make the engine go and look up.
MINIMAL_PARAMS = [
    'Movement', 'Formation', 'MemberInfo',
    'UseRangedCombatSelect', 'UseChargesForHealth', 'UsePromotionsForHealth',
    'MinNumMembers', 'PortraitCamera', 'RiverScale', 'PackedScale',
]
PROFILES = ('minimal', 'full')


def _as_dict(params):
    return {p: spec for p, spec in params}


def member(index, asset, scale=1.0, promotion=1):
    """One MemberInfo entry. The names are 1-based and zero-padded to three."""
    return [f'MemberInfo{index:03d}', ['tuple', [
        ['Asset', ['entry', {'library': SA, 'xlpClass': SA,
                             'entry': asset, 'package': SA_PKG}]],
        ['UniformScale', ['float', float(scale)]],
        ['PromotionLevel', ['int', int(promotion)]],
    ]]]


def read_members(params):
    """(asset, scale, promotion) for each member, for showing what a donor has."""
    spec = _as_dict(params).get('MemberInfo')
    if not spec or spec[0] != 'collection':
        return []
    out = []
    for _name, entry in spec[2]:
        fields = _as_dict(entry[1])
        asset = (fields.get('Asset') or ['entry', {}])[1].get('entry', '')
        scale = (fields.get('UniformScale') or ['float', 1.0])[1]
        promo = (fields.get('PromotionLevel') or ['int', 1])[1]
        out.append({'asset': asset, 'scale': scale, 'promotion': promo})
    return out


def summarise(params):
    """The handful of fields worth showing in a list, pulled out of the 49."""
    d = _as_dict(params)
    members = read_members(params)
    movement = _as_dict((d.get('Movement') or ['tuple', []])[1])
    entry_of = lambda k: (d.get(k) or ['entry', {}])[1].get('entry', '')
    return {
        'memberAsset': members[0]['asset'] if members else '',
        'memberCount': len(members),
        'formation': entry_of('Formation'),
        'combatFormation': entry_of('CombatFormation'),
        'visualAsset': entry_of('UnitVisualAsset'),
        'ageStyle': (d.get('AgeStyle') or ['string', ''])[1],
        'maxSpeed': (movement.get('MaxSpeed') or ['float', 0.0])[1],
        'movementType': (movement.get('MovementType') or ['string', ''])[1],
        'params': len(params),
    }


def derive(donor_params, member_asset=None, member_count=None,
           scale=None, promotion=None):
    """
    A copy of the donor's parameters, with the member list optionally rewritten.

    Only MemberInfo is touched. Formations, movement, embark/heal/sleep references and
    the rest come through unchanged -- a unit that moves like its donor and looks like
    whatever its members say is the whole point, and reconstructing those fields would
    be inventing values the engine already has correct ones for.
    """
    params = copy.deepcopy(donor_params)
    existing = read_members(params)
    if not (member_asset or member_count or scale is not None or promotion is not None):
        return params

    count = member_count or len(existing) or 1
    rows = []
    for i in range(count):
        was = existing[i] if i < len(existing) else (existing[-1] if existing else
                                                    {'asset': '', 'scale': 1.0,
                                                     'promotion': 1})
        rows.append(member(
            i + 1,
            member_asset or was['asset'],
            was['scale'] if scale is None else scale,
            was['promotion'] if promotion is None else promotion))

    for idx, (name, _spec) in enumerate(params):
        if name == 'MemberInfo':
            params[idx] = ['MemberInfo', ['collection', 'tuple', rows]]
            break
    else:
        params.append(['MemberInfo', ['collection', 'tuple', rows]])
    return params


def restrict(params, profile='minimal'):
    """
    Keep only the parameters a profile asks for, in the donor's own order.

    Order is preserved rather than following MINIMAL_PARAMS, because the donor's
    ordering is the one the engine wrote and there is no reason to believe it is
    arbitrary.
    """
    if profile == 'full':
        return params
    wanted = set(MINIMAL_PARAMS)
    return [[p, spec] for p, spec in params if p in wanted]


def make_unit(unit_type, donor, donor_params, member_asset=None, member_count=None,
              scale=None, promotion=None, sound_switches=None, profile='minimal'):
    """
    Build a manifest unit row. Returns (row, findings).

    The name must be the UnitType character-for-character: the asset is found by a
    case-sensitive hash of its name, so a near-miss is not a near-miss, it is a unit
    with no art.
    """
    findings = []
    unit_type = (unit_type or '').strip()
    if not unit_type:
        findings.append(guards.Finding(guards.ERROR, 'unit-unnamed',
                                       'the asset must be named exactly the UnitType'))
        return None, findings
    if not re.fullmatch(r'[A-Za-z0-9_]+', unit_type):
        findings.append(guards.Finding(
            guards.ERROR, 'unit-name-charset',
            f'"{unit_type}" is not a valid UnitType', unit_type))
        return None, findings
    if not unit_type.startswith('UNIT_'):
        findings.append(guards.Finding(
            guards.WARNING, 'unit-name-convention',
            f'"{unit_type}" does not start with UNIT_. The asset name must match the '
            f'UnitType exactly, and the hash is case-sensitive.', unit_type))

    if profile not in PROFILES:
        return None, [guards.Finding(guards.ERROR, 'unit-profile',
                                     f'unknown parameter profile {profile!r}',
                                     unit_type)]
    params = restrict(derive(donor_params, member_asset, member_count, scale,
                             promotion), profile)
    missing = [p for p in MINIMAL_PARAMS
               if p not in {n for n, _ in params}]
    if profile == 'minimal' and missing:
        findings.append(guards.Finding(
            guards.WARNING, 'unit-missing-basics',
            f'{donor} has no {", ".join(missing)}, so the copy has none either.',
            unit_type))
    members = read_members(params)
    if not members:
        findings.append(guards.Finding(
            guards.ERROR, 'unit-no-members',
            'no members, so this unit renders nothing. Members are the visible part '
            'of a unit.', unit_type))
        return None, findings
    if any(not m['asset'] for m in members):
        findings.append(guards.Finding(
            guards.ERROR, 'unit-empty-member',
            'a member has no asset name.', unit_type))
        return None, findings

    row = {'name': unit_type, 'cls': 'UnitMetaData', 'copiedFrom': donor,
           'profile': profile, 'params': params}
    # A minimal unit is deliberately not a faithful copy, so it does not carry the
    # donor's components either -- the working reference had none.
    if profile == 'full' and sound_switches:
        row['soundSwitches'] = [list(s) for s in sound_switches]
    return row, findings


def check_units(rows, known_assets=None):
    """
    Manifest-level checks. `known_assets`, when given, catches a MEMBER_* name that
    does not exist -- which renders nothing and reports nothing.
    """
    out = []
    seen = set()
    for row in rows:
        name = row.get('name', '')
        if name in seen:
            out.append(guards.Finding(guards.ERROR, 'unit-duplicate',
                                      f'{name} is defined twice', name))
        seen.add(name)

        # A unit has up to a dozen members and they are nearly always the same asset,
        # so report each distinct name once. Eight identical warnings say no more than
        # one and bury anything else in the list.
        members = read_members(row.get('params', []))
        if known_assets is not None:
            unknown = {m['asset'] for m in members
                       if m['asset'] and m['asset'] not in known_assets}
            for asset in sorted(unknown):
                count = sum(1 for m in members if m['asset'] == asset)
                out.append(guards.Finding(
                    guards.WARNING, 'unit-unknown-member',
                    f'{asset} is not in the installed game '
                    f'({count} of {len(members)} members). If it is not something '
                    f'this package defines, the unit renders nothing.',
                    name))
    return out
