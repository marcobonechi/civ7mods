"""
Input checks for things the engine fails silently on.

This pipeline's characteristic failure is not an error, it is nothing happening: a
building renders as empty air, an improvement does not appear, a sound returns a play
id and stays silent, a texture is a blank square. Each rule here corresponds to one of
those, found the hard way, and exists so the app can say what is wrong while the user
is still looking at the field that caused it.

Rules return findings rather than raising. Nothing here blocks a build -- a warning
the author knowingly ignores is still a legitimate package, and several of these are
judgement calls rather than certainties. The app decides what to surface.
"""
import os, re, struct
from dataclasses import dataclass, field

ERROR = 'error'
WARNING = 'warning'


@dataclass
class Finding:
    level: str
    code: str
    message: str
    where: str = ''
    detail: str = ''

    def __str__(self):
        head = f'[{self.level}] {self.where}: ' if self.where else f'[{self.level}] '
        return head + self.message


# ---------------------------------------------------------------------------
# Buildings
# ---------------------------------------------------------------------------

# The waterline-vs-sea-floor seat is a model-spawn parameter, not package data, so a
# skin can swap the art but cannot change how it sits. A land model on a water
# building ends up on the sea floor. These six are the whole water-seated set.
WATER_SEATED_BUILDINGS = {
    'BUILDING_ANCIENT_BRIDGE', 'BUILDING_COTHON', 'BUILDING_DOCKYARD',
    'BUILDING_FISHING_QUAY', 'BUILDING_HARBOR', 'BUILDING_LIGHTHOUSE',
}
# BIN_Bridge_Scaled is deliberately absent: all three bridges render from it and only
# the ancient one is water-seated, so the bin implies nothing about the seat.
WATER_SEATED_BINS = {
    'BIN_Cothon_Scaled', 'BIN_Dockyard_Scaled',
    'BIN_Fishing_Quay_Scaled', 'BIN_Harbor_Scaled', 'BIN_Lighthouse_Scaled',
}

_TAG = re.compile(r'\[([A-Z_]+):([^\]]+)\]')


def expression_subject(expression, namespace='BUILDING'):
    """The type named by [BUILDING:X] in an expression, or None."""
    for ns, value in _TAG.findall(expression or ''):
        if ns == namespace:
            return value
    return None


def _skinned_source(building):
    """BUILDING_HARBOR_SKIN -> BUILDING_HARBOR. Non-skin tags return themselves."""
    return building[:-5] if building and building.endswith('_SKIN') else building


def bin_seats(reference):
    """
    Work out each art bin's seat from a reference table of native bindings.

    `reference` must be entries that map a building to *its own* art -- the generated
    skin table is exactly that. Deriving the index from the entries being checked
    instead would make every entry self-consistent: bind BUILDING_HARBOR_SKIN to
    monument art and the monument bin is recorded as water-seated, so nothing is ever
    flagged.

    The seat belongs to the building, not the bin, and a bin can serve both: all three
    bridges render from BIN_Bridge_Scaled but only the ancient one sits at the
    waterline. A bin used by buildings of differing seats therefore tells us nothing
    and is recorded as None rather than guessed at.
    """
    seats = {}
    for e in reference:
        subject = expression_subject(e.get('expression', ''))
        target = e.get('target')
        if not subject or not target:
            continue
        seat = ('water' if _skinned_source(subject) in WATER_SEATED_BUILDINGS
                else 'land')
        if target in seats and seats[target] != seat:
            seats[target] = None            # ambiguous; never flag it
        elif target not in seats:
            seats[target] = seat
    return seats


def default_art_seats():
    """
    bin -> seat, from the generated skin table.

    That table is native by construction (BUILDING_X_SKIN renders BUILDING_X), which
    makes it the one trustworthy source for which seat a given bin's art belongs to.
    Absent -- no game install scanned yet -- the static water bins still cover the
    unambiguous cases.
    """
    try:
        from .tools import ensure_on_path
        ensure_on_path()
        from skins import SKIN_ENTRIES
    except Exception:
        return {b: 'water' for b in WATER_SEATED_BINS}
    return bin_seats([{'target': a, 'expression': e} for a, e, _p, _w in SKIN_ENTRIES])


def check_buildings(entries, art_seats=None):
    """
    `entries` are manifest building rows: target, expression, priority, weight.

    `art_seats` maps an art bin to the seat its models are built for; pass None to
    derive it from the generated skin table.
    """
    out = []
    seen = {}
    seats = default_art_seats() if art_seats is None else art_seats

    for i, e in enumerate(entries):
        where = e.get('expression') or f'buildings[{i}]'
        target = e.get('target') or ''
        subject = expression_subject(e.get('expression', ''))

        # A bare geometry asset renders through WorldUI but not through the footprint.
        # Bins are fine -- the shipped footprint points straight at BIN_Cityhall and
        # BIN_Palace with no wrapper -- so the thing to catch is geometry, i.e. a
        # target that is neither a wrapper nor a bin.
        if target and not target.endswith('_Scaled') and not target.startswith('BIN_'):
            out.append(Finding(
                WARNING, 'target-not-renderable',
                f'{target} looks like raw geometry. Footprint targets must be a bin '
                f'or a wrapper -- geometry renders through WorldUI but not here. '
                f'Did you mean {target}_Scaled?',
                where))

        # Rescanning an installed package re-ingests its own generated tags. The
        # guard is cheap and the failure compounds on every rebuild.
        if subject and subject.endswith('_SKIN_SKIN'):
            out.append(Finding(
                ERROR, 'double-skin',
                f'{subject} looks like a skin tag generated from another skin tag. '
                f'Regenerate the skin table with the art group excluded.',
                where))

        if subject and target:
            source = _skinned_source(subject)
            seat_s = 'water' if source in WATER_SEATED_BUILDINGS else 'land'
            seat_t = seats.get(target) or (
                'water' if target in WATER_SEATED_BINS else None)
            if seat_t and seat_s != seat_t:
                out.append(Finding(
                    WARNING, 'seat-mismatch',
                    f'{source} is {seat_s}-seated but {target} is {seat_t} art. '
                    f'The model will sit at the wrong height -- the seat is a spawn '
                    f'parameter and cannot be corrected from the package.',
                    where))

        # Highest priority wins and weight breaks ties, so two entries matching the
        # same thing at the same priority is a coin flip rather than an override.
        key = (e.get('expression'), e.get('priority'))
        if key in seen and e.get('expression'):
            out.append(Finding(
                WARNING, 'ambiguous-priority',
                f"two entries match {e['expression']} at priority {e.get('priority')}; "
                f'raise one of them or the winner is arbitrary',
                where, detail=f'also at buildings[{seen[key]}]'))
        seen[key] = i

    return out


# ---------------------------------------------------------------------------
# Textures
# ---------------------------------------------------------------------------

_IMAGE_EXT = ('.dds', '.png', '.jpg', '.jpeg', '.tga', '.bmp', '.tif', '.tiff')


def check_name(name, what, prefix=''):
    """
    A name is required, and has to be usable as one.

    Empty slipped through everywhere at first, because every individual check tolerated
    it: the result was a blob called `TEXTURE_` or `GB__MB` written to SHARED_DATA and a
    manifest row that could never be found again.
    """
    name = (name or '').strip()
    if not name:
        return [Finding(ERROR, f'{what}-unnamed',
                        f'a name is required — without one this is written as '
                        f'"{prefix}" and nothing can reference it.')]
    if not re.fullmatch(r'[A-Za-z0-9_]+', name):
        return [Finding(ERROR, f'{what}-name-charset',
                        f'"{name}" must be letters, digits and underscores only.',
                        name)]
    return []


def check_texture_name(name):
    """
    Texture names carry no file extension. `pb_yamatai_bg_1080` renders;
    `lsbg_assyria_1080.png` does not, and gives no clue why.
    """
    out = []
    if not (name or '').strip():
        return [Finding(ERROR, 'texture-unnamed',
                        'a texture name is required — without one the blob is written '
                        'as "TEXTURE_" and no UI reference can resolve to it.')]
    lowered = (name or '').lower()
    if lowered.endswith(_IMAGE_EXT):
        stem = os.path.splitext(name)[0]
        out.append(Finding(
            ERROR, 'texture-name-extension',
            f'texture name "{name}" has a file extension. The reference will not '
            f'resolve -- use "{stem}".', name))
    if name and not re.fullmatch(r'[A-Za-z0-9_]+', name):
        out.append(Finding(
            WARNING, 'texture-name-charset',
            f'texture name "{name}" has characters outside [A-Za-z0-9_]; shipped '
            f'names never do.', name))
    return out


def inspect_dds(path, texture_class='UITexture'):
    """
    Read a DDS and report what it is. Returns (info_dict, findings).

    The heavy lifting is make_texture.read_dds, which already knows the legacy FourCC
    headers, the DX10 block, and how to reconcile a declared mip count against the
    payload actually present. Reimplementing that here would be a second, worse
    parser; this only turns its refusals into findings.

    `texture_class` decides which formats are reasonable. UI textures really are all
    BC7, but model textures are not: normals are BC5, occlusion is BC1, masks are BC4.
    Checking everything against BC7 would reject a correctly authored normal map.
    """
    from .tools import ensure_on_path
    ensure_on_path()
    import make_texture

    if not os.path.exists(path):
        return None, [Finding(ERROR, 'texture-missing', f'{path} does not exist', path)]

    try:
        kind, payload, width, height, mips, dxgi = make_texture.read_dds(path)
    except SystemExit as e:
        # read_dds is a CLI tool and exits rather than raising; its message is the
        # useful part, so keep it verbatim instead of inventing a worse one.
        return None, [Finding(ERROR, 'texture-unreadable', str(e), path)]
    except Exception as e:
        return None, [Finding(ERROR, 'texture-unreadable', f'{path}: {e}', path)]

    findings = []
    from . import materials
    preferred, accepted = materials.CLASS_FORMATS.get(texture_class, (None, None))

    if kind != 'bc':
        want = (f'Import a {materials.format_name(preferred)}-compressed DDS'
                if preferred else 'Import a BC-compressed DDS')
        findings.append(Finding(
            ERROR, 'texture-not-compressed',
            f'{os.path.basename(path)} is uncompressed. {want} -- every texture the '
            f'game ships is block-compressed.', path))
        return None, findings

    info = {'width': width, 'height': height, 'mips': mips, 'dxgi': dxgi,
            'format': materials.format_name(dxgi), 'textureClass': texture_class,
            'size': len(payload), 'path': path}

    if accepted and dxgi not in accepted:
        findings.append(Finding(
            WARNING, 'texture-unexpected-format',
            f'{materials.format_name(dxgi)} for a {texture_class}. Every shipped '
            f'{texture_class} is {materials.format_name(preferred)} — this will load, '
            f'but check it is what you meant.', path))
    if width & (width - 1) or height & (height - 1):
        findings.append(Finding(
            WARNING, 'texture-not-power-of-two',
            f'{width}x{height} is not a power of two; mip generation may be lossy.',
            path))
    return info, findings


# ---------------------------------------------------------------------------
# Audio
# ---------------------------------------------------------------------------

def inspect_wem(path):
    """
    Confirm a file is a Wwise-converted .wem and not a renamed .wav.

    This distinction is invisible at every later stage: a PCM source builds into a
    valid bank, loads, and returns a real play id from Sound.play -- then plays
    silence. The fmt chunk's extension tag is what separates them.
    """
    if not os.path.exists(path):
        return None, [Finding(ERROR, 'audio-missing', f'{path} does not exist', path)]

    w = open(path, 'rb').read()
    if w[:4] != b'RIFF' or w[8:12] != b'WAVE':
        return None, [Finding(ERROR, 'audio-not-riff',
                              f'{os.path.basename(path)} is not a RIFF/WAVE file', path)]

    chunks, o = {}, 12
    while o + 8 <= len(w):
        ck, cs = w[o:o + 4], struct.unpack_from('<I', w, o + 4)[0]
        chunks[ck] = (o + 8, cs)
        o += 8 + cs + (cs & 1)

    if b'fmt ' not in chunks:
        return None, [Finding(ERROR, 'audio-no-fmt',
                              f'{os.path.basename(path)} has no fmt chunk', path)]

    fo, fs = chunks[b'fmt ']
    tag, channels, rate = struct.unpack_from('<HHI', w, fo)
    if tag != 0xFFFF:
        return None, [Finding(
            ERROR, 'audio-not-wem',
            f'{os.path.basename(path)} has fmt tag 0x{tag:04X}, not 0xFFFF -- this is '
            f'a plain WAV, not a Wwise-converted .wem. It would build into a bank that '
            f'loads and plays silence. Convert it in Wwise 2022.1 as Sound SFX, '
            f'Vorbis, non-streaming.', path)]

    info = {'channels': channels, 'rate': rate, 'size': len(w),
            'fmt_ext': fs - 16, 'path': path}
    findings = []
    if channels != 1:
        findings.append(Finding(
            WARNING, 'audio-not-mono',
            f'{channels} channels. Shipped voice lines are mono; stereo plays but '
            f'doubles the size.', path))
    return info, findings


# ---------------------------------------------------------------------------
# Whole-manifest
# ---------------------------------------------------------------------------

def check_project(project):
    """Every check that needs only the manifest, no filesystem access."""
    out = list(check_buildings(project.get('buildings', [])))

    name = (project.get('project') or {}).get('name') or ''
    if not name:
        out.append(Finding(ERROR, 'project-unnamed',
                           'the art group has no name; it must match the folder '
                           'installed under DLC/'))
    elif not re.fullmatch(r'[A-Za-z0-9_-]+', name):
        out.append(Finding(ERROR, 'project-name-charset',
                           f'art group name "{name}" must be letters, digits, '
                           f'dashes and underscores only'))

    for t in project.get('uiTextures', []):
        out.extend(check_texture_name(t.get('ui_name', '')))

    # An improvement or wonder that is not registered in a ROOT_ASSETS_* list is
    # never loaded. build_package emits the list automatically, so this only catches
    # a hand-edited manifest.
    for kind in ('improvements', 'wonders'):
        for item in project.get(kind, []):
            if not item.get('asset'):
                out.append(Finding(ERROR, f'{kind}-unnamed',
                                   f'a {kind[:-1]} entry has no asset name'))
            if not item.get('type'):
                out.append(Finding(ERROR, f'{kind}-untyped',
                                   f"{item.get('asset')} has no ConstructibleType; "
                                   f'its region pattern would match nothing'))

    # Imported here rather than at module scope: materials imports guards for Finding,
    # and units does the same, so a top-level import either way is a cycle.
    from . import materials, units
    out.extend(materials.check_materials(project.get('materials', []),
                                         project.get('materialTextures', [])))
    out.extend(units.check_units(project.get('units', [])))

    banks = {b.get('name') for b in project.get('soundbanks', [])}
    for e in project.get('audioEvents', []):
        wwise = e.get('wwiseEvent') or ''
        if wwise and f'SOUNDBANK_{wwise}' not in banks:
            out.append(Finding(
                WARNING, 'audio-event-unbacked',
                f'event {wwise} has no matching SOUNDBANK_{wwise} in this package; '
                f'Sound.play would return 0.', wwise))

    return out
