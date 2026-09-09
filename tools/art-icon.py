#!/usr/bin/env python3
"""Turn a generated icon into the PNG the game wants.

The image generator gives you a square painting on a flat grey field, off-centre, with a small
sparkle watermark in a corner. The game wants a centred subject on transparency at 256 square.
This does the four steps: paint out the watermark, key the background from the corners, trim to
the subject, re-centre it on a square canvas.

    tools/art-icon.py raw.png Etruscans/icons/buildicon_cuniculus.png

Options worth knowing:
    --bg '#7e7e7e'    background colour to key (default: sampled from the top-left pixel)
    --fuzz 18         how far from that colour still counts as background, per cent
    --size 256        output size
    --margin 6        per cent of the subject's longest side left as breathing room
    --no-watermark    skip the watermark step (nothing to paint out)
    --watermark X,Y,W,H   paint out a different box (default: the bottom-right sparkle)
    --silhouette      instead of keying: threshold to a white mask on transparency, for the
                      civ symbol and unit flags, which the game recolours itself
    --keep            leave a copy of each intermediate beside the output, to see what happened

Needs ImageMagick 7 (`magick`).
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile


def magick(*args):
    result = subprocess.run(["magick", *[str(a) for a in args]], capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit("magick failed: %s\n%s" % (" ".join(str(a) for a in args), result.stderr.strip()))
    return result.stdout.strip()


def identify(path, fmt):
    return magick("identify", "-format", fmt, path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source")
    ap.add_argument("output")
    ap.add_argument("--bg", help="background colour to key (default: the top-left pixel)")
    ap.add_argument("--fuzz", type=float, default=18.0)
    ap.add_argument("--size", type=int, default=256)
    ap.add_argument("--margin", type=float, default=6.0, help="per cent of the longest side")
    ap.add_argument("--watermark", default=None, help="X,Y,W,H box to paint out")
    ap.add_argument("--no-watermark", action="store_true")
    ap.add_argument("--silhouette", action="store_true")
    ap.add_argument("--threshold", type=float, default=50.0, help="--silhouette only, per cent")
    ap.add_argument("--keep", action="store_true")
    args = ap.parse_args()

    if not os.path.exists(args.source):
        sys.exit("no such file: " + args.source)
    w, h = (int(x) for x in identify(args.source, "%w %h").split())
    tmp = tempfile.mkdtemp(prefix="art-icon-")
    step = lambda n: os.path.join(tmp, "%d.png" % n)

    if args.silhouette:
        # White shape on black -> white shape on transparency. The game recolours the civ symbol
        # through fxs-color-mask and draws unit flags white, so only the alpha matters.
        magick(args.source, "-colorspace", "gray", "-threshold", "%f%%" % args.threshold,
               "-alpha", "copy", "-channel", "RGB", "-evaluate", "set", "100%", "+channel",
               "-colorspace", "sRGB", step(2))
    else:
        bg = args.bg or "#" + identify(args.source, "%[hex:p{2,2}]")[:6]
        source = args.source
        if not args.no_watermark:
            # The sparkle sits in the bottom-right corner, about 5% of the side, inset ~5%.
            if args.watermark:
                x, y, bw, bh = (int(v) for v in args.watermark.split(","))
            else:
                bw = bh = int(max(w, h) * 0.075)
                x, y = w - int(w * 0.04) - bw, h - int(h * 0.04) - bh
            magick(source, "-fill", bg, "-draw",
                   "rectangle %d,%d %d,%d" % (x, y, x + bw, y + bh), step(1))
            source = step(1)
        # Key from all four corners, so an enclosed grey inside the subject is left alone.
        corners = []
        for cx, cy in ((2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)):
            corners += ["-fill", "none", "-floodfill", "+%d+%d" % (cx, cy), bg]
        magick(source, "-alpha", "set", "-fuzz", "%f%%" % args.fuzz, *corners, step(2))

    magick(step(2), "-trim", "+repage", step(3))
    tw, th = (int(x) for x in identify(step(3), "%w %h").split())
    side = int(max(tw, th) * (1 + args.margin / 100.0))
    os.makedirs(os.path.dirname(os.path.abspath(args.output)) or ".", exist_ok=True)
    magick(step(3), "-background", "none", "-gravity", "center",
           "-extent", "%dx%d" % (side, side), "-resize", "%dx%d" % (args.size, args.size),
           "-define", "png:color-type=6", args.output)

    print("%s  %s -> %s (subject was %dx%d)"
          % (args.output, identify(args.output, "%wx%h %[channels]"), os.path.basename(args.source), tw, th))
    if args.keep:
        for n, label in ((1, "nomark"), (2, "keyed"), (3, "trimmed")):
            if os.path.exists(step(n)):
                shutil.copy(step(n), os.path.splitext(args.output)[0] + ".%s.png" % label)
    else:
        shutil.rmtree(tmp, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
