"""
Build a Wwise SoundBank containing one sound, by cloning a minimal shipped bank
and swapping its audio.

Why clone rather than author: a HIRC Sound object carries NodeBaseParams -- bus
routing, positioning, effects, RTPC slots -- that we neither need to change nor want
to reconstruct. Cloning keeps every one of those bytes and rewrites only what must
differ: the object IDs, the codec, and the audio payload.

Wwise object IDs are FNV-1 32-bit over the LOWERCASED name -- verified exactly against
four shipped banks, where both the bank ID and its Event ID equal fnv1(bank name).
Note this is FNV-1 (multiply then xor), NOT the FNV-1a the BLP layer uses.

Codec plugin id is (codecId << 16) | 1: Vorbis is 4 -> 0x00040001, Opus WEM is
20 -> 0x00140001, PCM is 1 -> 0x00010001.

PCM DOES NOT WORK. A survey of all 14,556 shipped banks found 134,469 sound sources:
124,363 Vorbis, 10,103 Opus, 2 Motion, and zero PCM. A hand-built PCM bank loads and
returns a playing id from Sound.play, but is silent -- the graph resolves, the source
does not decode. Real .wem files also carry an extended fmt chunk (tag 0xFFFF, 66
bytes) plus hash/junk/akd chunks that a bare RIFF/WAVE lacks.

So audio must be converted by Wwise Authoring 2022.1 (bank version 145, matching the
shipped BKHD). Convert as Sound SFX, Vorbis, non-streaming, and take the .wem that
lands in <Project>/.cache/Windows/SFX/. Wwise is used purely as a codec here: we keep
the donor bank's own structure, because its bus routing is known to resolve against
the Init bank the game has already loaded. A bank generated wholesale by Wwise would
carry bus ids hashed from the modder's own hierarchy, which resolve to nothing.

.wav input is still accepted and still produces PCM, kept only so the negative result
stays reproducible.

    python3 make_soundbank.py <in.wem|in.wav> <BankName> [-o SHARED_DATA]
"""
import sys, os, struct, argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_texture import write_civbig

CIVBIG_TYPE_SOUNDBANK = 3
PLUGIN_PCM = (1 << 16) | 1
PLUGIN_VORBIS = (4 << 16) | 1

DONOR = ('/workspace/reference/full_game/DLC/asia-wonders'
         '/Platforms/Windows/BLPs/SHARED_DATA/SOUNDBANK_Play_Wonder_SFX_Braziers')


def fnv1_32(name):
    """Wwise name hash: FNV-1 (multiply then xor) over the lowercased name."""
    h = 2166136261
    for c in name.lower().encode('utf-8'):
        h = ((h * 16777619) & 0xFFFFFFFF) ^ c
    return h


def read_wav(path):
    d = open(path, 'rb').read()
    if d[:4] != b'RIFF' or d[8:12] != b'WAVE':
        raise SystemExit(f'{path}: not a RIFF/WAVE file')
    fmt = data = None
    o = 12
    while o + 8 <= len(d):
        ck, cs = d[o:o + 4], struct.unpack_from('<I', d, o + 4)[0]
        if ck == b'fmt ':
            fmt = struct.unpack_from('<HHIIHH', d, o + 8)
        elif ck == b'data':
            data = d[o + 8:o + 8 + cs]
        o += 8 + cs + (cs & 1)
    if not fmt or data is None:
        raise SystemExit(f'{path}: missing fmt or data chunk')
    tag, ch, rate, byterate, align, bits = fmt
    if tag != 1:
        raise SystemExit(f'{path}: not uncompressed PCM (formatTag 0x{tag:04X})')
    return ch, rate, bits, data


def build_pcm_wem(ch, rate, bits, data):
    """A .wem is a RIFF/WAVE; for PCM the fmt chunk is the ordinary 16-byte one."""
    align = ch * bits // 8
    fmt = struct.pack('<HHIIHH', 1, ch, rate, rate * align, align, bits)
    body = b'WAVE'
    body += b'fmt ' + struct.pack('<I', len(fmt)) + fmt
    body += b'data' + struct.pack('<I', len(data)) + data
    return b'RIFF' + struct.pack('<I', len(body)) + body


def read_wem(path):
    """
    A Wwise-converted .wem is already the exact payload the DATA section wants, so it
    is copied verbatim. Only sanity-check the shape: a real one is a RIFF/WAVE whose
    fmt chunk uses the extension tag 0xFFFF, which is what distinguishes it from the
    plain WAVE that the PCM attempt produced.
    """
    w = open(path, 'rb').read()
    if w[:4] != b'RIFF' or w[8:12] != b'WAVE':
        raise SystemExit(f'{path}: not a RIFF/WAVE .wem')
    found, o = {}, 12
    while o + 8 <= len(w):
        ck, cs = w[o:o + 4], struct.unpack_from('<I', w, o + 4)[0]
        found[ck] = (o + 8, cs)
        o += 8 + cs + (cs & 1)
    if b'fmt ' not in found:
        raise SystemExit(f'{path}: no fmt chunk')
    fo, fs = found[b'fmt ']
    tag, ch, rate = struct.unpack_from('<HHI', w, fo)
    if tag != 0xFFFF:
        raise SystemExit(f'{path}: fmt tag 0x{tag:04X}, expected 0xFFFF -- this looks '
                         f'like a plain WAV renamed, not a Wwise-converted .wem')
    return w, ch, rate, fs


def sections(bnk):
    out, off = {}, 0
    while off + 8 <= len(bnk):
        tag = bnk[off:off + 4].decode('ascii', 'replace')
        size = struct.unpack_from('<I', bnk, off + 4)[0]
        out[tag] = (off + 8, size)
        off += 8 + size
    return out


def build_bank(donor_path, bank_name, wem, plugin=PLUGIN_VORBIS, verbose=True):
    d = open(donor_path, 'rb').read()
    bnk = d[16:16 + struct.unpack_from('<I', d, 8)[0]]
    s = sections(bnk)

    bkhd = bytearray(bnk[s['BKHD'][0]:s['BKHD'][0] + s['BKHD'][1]])
    hirc = bytearray(bnk[s['HIRC'][0]:s['HIRC'][0] + s['HIRC'][1]])
    old_bank_id = struct.unpack_from('<I', bkhd, 4)[0]
    old_src_id = struct.unpack_from('<I', bnk, s['DIDX'][0])[0]

    # Collect the donor's HIRC object ids so each can be given a fresh, derived id.
    # Remapping every 4-byte occurrence inside HIRC keeps the Event -> Action ->
    # Sound -> parent graph intact without having to parse each object's layout.
    ids, o, n = [], 4, struct.unpack_from('<I', hirc, 0)[0]
    for _ in range(n):
        t = hirc[o]
        size = struct.unpack_from('<I', hirc, o + 1)[0]
        ids.append((t, struct.unpack_from('<I', hirc, o + 5)[0]))
        o += 5 + size

    new_bank_id = fnv1_32(bank_name)
    remap = {old_bank_id: new_bank_id, old_src_id: fnv1_32(bank_name + '_media')}
    for t, oid in ids:
        # The Event must hash from the bank name, since that is how the game calls it.
        remap[oid] = new_bank_id if t == 4 else fnv1_32(f'{bank_name}_obj{oid}')

    for old, new in remap.items():
        hirc = bytearray(hirc.replace(struct.pack('<I', old), struct.pack('<I', new)))

    # Codec and payload size live in the Sound object at fixed offsets.
    o = 4
    for _ in range(n):
        t = hirc[o]
        size = struct.unpack_from('<I', hirc, o + 1)[0]
        if t == 2:
            struct.pack_into('<I', hirc, o + 9, plugin)
            hirc[o + 13] = 0                       # streamType 0 = in-bank DATA
            struct.pack_into('<I', hirc, o + 18, len(wem))
        o += 5 + size

    struct.pack_into('<I', bkhd, 4, new_bank_id)
    didx = struct.pack('<3I', remap[old_src_id], 0, len(wem))

    out = b''
    for tag, payload in (('BKHD', bytes(bkhd)), ('DIDX', didx),
                         ('DATA', wem), ('HIRC', bytes(hirc))):
        out += tag.encode() + struct.pack('<I', len(payload)) + payload

    if verbose:
        print(f'  bankId   0x{new_bank_id:08X}  = fnv1({bank_name!r})')
        print(f'  event id 0x{new_bank_id:08X}  (same hash -- how the game calls it)')
        print(f'  media id 0x{remap[old_src_id]:08X}')
        print(f'  codec    0x{plugin:08X}  '
              f'({ {PLUGIN_VORBIS: "Vorbis", PLUGIN_PCM: "PCM"}.get(plugin, "?") })')
        print(f'  HIRC objects remapped: {len(ids)}')
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('source', help='a Wwise-converted .wem (preferred), or a .wav for PCM')
    ap.add_argument('bank', help='Wwise bank/event name, e.g. Play_PB_Yamatai_First_Meet')
    ap.add_argument('-o', '--out-dir', default='../Platforms/Windows/BLPs/SHARED_DATA')
    ap.add_argument('--donor', default=DONOR)
    args = ap.parse_args()

    if args.source.lower().endswith('.wem'):
        wem, ch, rate, fmtlen = read_wem(args.source)
        plugin = PLUGIN_VORBIS
        print(f'{args.source}: Wwise .wem, {ch}ch {rate}Hz, '
              f'fmt ext {fmtlen}B, {len(wem)} bytes')
    else:
        ch, rate, bits, pcm = read_wav(args.source)
        secs = len(pcm) / (rate * ch * bits // 8)
        print(f'{args.source}: {ch}ch {rate}Hz {bits}-bit, {len(pcm)} bytes ({secs:.2f}s)')
        print('  WARNING: PCM sources load but play silent -- see the module docstring')
        wem = build_pcm_wem(ch, rate, bits, pcm)
        plugin = PLUGIN_PCM
    if ch != 1:
        print('  note: shipped VO is mono; stereo will still play but doubles the size')

    bank = build_bank(args.donor, args.bank, wem, plugin=plugin)

    os.makedirs(args.out_dir, exist_ok=True)
    name = 'SOUNDBANK_' + args.bank
    path = os.path.join(args.out_dir, name)
    total = write_civbig(path, bank, type_flag=CIVBIG_TYPE_SOUNDBANK)
    print(f'\nwrote {path}  ({total} bytes on disk, {len(bank)} bank)')
    print('\npaste into build_blp.py SOUNDBANKS:\n')
    print(f"    dict(name={name!r}, size={len(bank)}),")


if __name__ == '__main__':
    main()
