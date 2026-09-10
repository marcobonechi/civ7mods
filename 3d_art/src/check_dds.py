#!/usr/bin/env python3
"""Check DDS maps against the DXGI format Civ 7 expects for each texture class.

The trap this exists to catch: make_texture.py takes the format from the DDS header and
copies the payload through untouched, and a legacy FourCC header can only express the
non-sRGB variants (DXT1 -> 71). So a BaseColor written as plain DXT1 ships as BC1_UNORM
instead of BC1_UNORM_SRGB, the shader skips the sRGB decode, and the albedo renders with
the wrong gamma. Nothing in the toolchain warns about it.

The expected formats come from make_texture.py's own survey of the shipped game packages
(~22,000 model textures), where each class is near-uniform.

    3d_art/.venv/bin/python 3d_art/src/check_dds.py 3d_art/dds/*.dds

Class is inferred from the filename suffix (_B, _N, _ORM, _TINT); override with --kind.
Exit status is 1 if any map is wrong.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "..", "..", "tools", "civ7-art-studio"))
from civ7_art_studio.blp.make_texture import read_dds, BLOCK_BYTES  # noqa: E402

EXPECT = {
    "B":    (72, "BC1_UNORM_SRGB", "base colour must decode from sRGB"),
    "N":    (83, "BC5_UNORM", "two-channel tangent normal"),
    "ORM":  (71, "BC1_UNORM", "linear data, must NOT be sRGB"),
    "TINT": (80, "BC4_UNORM", "single-channel mask"),
}


def kind_of(path):
    stem = os.path.splitext(os.path.basename(path))[0].upper()
    for k in ("ORM", "TINT", "B", "N"):
        if stem.endswith("_" + k):
            return k
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dds", nargs="+")
    ap.add_argument("--kind", choices=sorted(EXPECT),
                    help="force the texture class instead of inferring from the filename")
    a = ap.parse_args()

    bad = 0
    for path in a.dds:
        kind = a.kind or kind_of(path)
        try:
            _, _, w, h, mips, dxgi = read_dds(path)
        except SystemExit as e:
            print("  FAIL %-34s %s" % (os.path.basename(path), e))
            bad += 1
            continue
        got = BLOCK_BYTES.get(dxgi, ("unknown",))[0]
        name = os.path.basename(path)

        if kind is None:
            print("  note %-34s %4dx%-4d mips %-2d %s (%d) - unknown class, not checked"
                  % (name, w, h, mips, got, dxgi))
            continue

        want_id, want, why = EXPECT[kind]
        full = max(1, (max(w, h)).bit_length())
        if dxgi != want_id:
            print("  FAIL %-34s %4dx%-4d %s (%d), want %s (%d) - %s"
                  % (name, w, h, got, dxgi, want, want_id, why))
            bad += 1
        elif mips == 1 and full > 1:
            print("  warn %-34s %4dx%-4d %s (%d) ok, but only 1 mip (expected %d) - "
                  "will shimmer at distance" % (name, w, h, got, dxgi, full))
        else:
            print("  ok   %-34s %4dx%-4d mips %-2d %s (%d)"
                  % (name, w, h, mips, got, dxgi))

    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
