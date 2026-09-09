#!/usr/bin/env python3
"""Write placeholder background PNGs (loading screens, civ-select card, narrative panel).

Usage: tools/make-backgrounds.py <out dir> NAME:WIDTHxHEIGHT:R,G,B[:R,G,B] ...

Each file is a vertical two-colour gradient with a lighter band across the middle, enough for
the game to load and for the layout to read; replace with real art any time. No image library
is used, so it runs anywhere Python does.
"""
import os
import struct
import sys
import zlib


def png(path, w, h, rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    with open(path, "wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def gradient(w, h, top, bottom):
    rows = []
    for y in range(h):
        t = y / max(1, h - 1)
        # a soft band across the middle so the placeholder is not a flat wash
        band = 1.0 + 0.18 * (1.0 - min(1.0, abs(t - 0.55) * 4.0))
        px = []
        for c in range(3):
            v = top[c] + (bottom[c] - top[c]) * t
            px.append(max(0, min(255, int(v * band))))
        rows.append((px + [255]) * w)
    return rows


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for spec in sys.argv[2:]:
        parts = spec.split(":")
        name, size = parts[0], parts[1]
        top = tuple(int(x) for x in parts[2].split(","))
        bottom = tuple(int(x) for x in parts[3].split(",")) if len(parts) > 3 else tuple(int(x * 0.45) for x in top)
        w, h = (int(x) for x in size.lower().split("x"))
        path = os.path.join(out, name + ".png")
        png(path, w, h, gradient(w, h, top, bottom))
        print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
