#!/usr/bin/env python3
"""Write flat placeholder PNG icons for a mod, without any image library.

Usage: tools/make-icons.py <out dir> NAME:SIZE:STYLE ...
  STYLE is one of: disc, cross, horse, ship, building, dome.
Each file is a solid symbol on a transparent background, good enough for the game to load;
replace with real art later.
"""
import os
import struct
import sys
import zlib

PURPLE = (94, 33, 112)
GOLD = (222, 178, 60)


def png(path, size, pixels):
    raw = b"".join(b"\x00" + bytes(pixels[y]) for y in range(size))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    with open(path, "wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def render(size, style):
    c = size / 2
    r = size * 0.46
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            dx, dy = x - c, y - c
            d = (dx * dx + dy * dy) ** 0.5
            color = None
            if d <= r:
                color = PURPLE
                u, v = dx / r, dy / r             # -1..1 inside the disc
                if style == "cross" and (abs(u) < 0.14 or (abs(v) < 0.14 and abs(u) < 0.7)) and -0.75 < v < 0.75:
                    color = GOLD
                elif style == "horse" and (abs(v + 0.1) < 0.18 and abs(u) < 0.6 or abs(u - 0.45) < 0.14 and -0.7 < v < 0.1
                                            or (abs(u + 0.4) < 0.1 or abs(u - 0.2) < 0.1) and 0.0 < v < 0.65):
                    color = GOLD
                elif style == "ship" and ((abs(v - 0.35) < 0.14 and abs(u) < 0.7 - max(0.0, v - 0.35) * 2)
                                           or (abs(u) < 0.08 and -0.7 < v < 0.35)
                                           or (0.08 < u < 0.55 and -0.6 < v < 0.2 and u < (v + 0.6) * 0.7)):
                    color = GOLD
                elif style == "building" and (abs(u) < 0.55 and 0.0 < v < 0.65 or abs(v) < 0.08 and abs(u) < 0.7
                                               or abs(u) < 0.4 and -0.5 < v < 0.0 and abs(u) < (v + 0.5) * 0.8):
                    color = GOLD
                elif style == "dome" and ((v > 0.1 and abs(u) < 0.62) or (v <= 0.1 and (u * u + (v - 0.1) ** 2) ** 0.5 < 0.5)
                                           or (abs(u) < 0.05 and -0.8 < v < -0.4)):
                    color = GOLD
            if color is None:
                row += [0, 0, 0, 0]
            else:
                a = 255 if d <= r - 1 else max(0, min(255, int((r - d) * 255)))
                row += [*color, a]
        rows.append(row)
    return rows


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for spec in sys.argv[2:]:
        name, size, style = spec.split(":")
        path = os.path.join(out, name + ".png")
        png(path, int(size), render(int(size), style))
        print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
