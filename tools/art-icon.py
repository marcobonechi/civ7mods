#!/usr/bin/env python3
"""Turn a generated icon into the PNG the game wants.

The image generator gives you a square painting on a flat grey field, off-centre, with a small
sparkle watermark in a corner. The game wants a centred subject on transparency at 256 square.
This does four steps: key the background from the corners, drop every opaque island that is not
the subject (which is how the watermark goes, and any keying speckle with it), trim to the
subject, and re-centre it on a square canvas.

    tools/art-icon.py raw.png Etruscans/icons/buildicon_cuniculus.png

Options worth knowing:
    --bg '#7e7e7e'    background colour to key (default: sampled from the top-left pixel)
    --fuzz auto       how far from that colour still counts as background, per cent. "auto"
                      (the default) sweeps and stops before the key starts eating the subject:
                      dry grass and pale stone sit close enough to a mid grey that a fixed 18
                      took a bite out of the Tumulus mound.
    --size 256        output size
    --margin 6        per cent of the subject's longest side left as breathing room
    --no-watermark    keep every island, even ones detached from the subject
    --watermark X,Y,W,H   paint out this box instead of the one found automatically
    --silhouette      instead of keying: threshold to a white mask on transparency, for the
                      civ symbol and unit flags, which the game recolours itself
    --keep            leave a copy of each intermediate beside the output, to see what happened

Needs ImageMagick 7 (`magick`).
"""
import argparse
import os
import shutil
import re
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


def opaque_fraction(path):
    """Share of pixels that survived the key. A sudden drop means it ate into the subject."""
    raw = subprocess.run(["magick", path, "-resize", "200x200!", "-depth", "8", "rgba:-"],
                         capture_output=True).stdout
    if not raw:
        return 0.0
    alphas = raw[3::4]
    return sum(1 for a in alphas if a > 200) / len(alphas)


def islands(path):
    """Every separately-connected opaque blob in a keyed image, as (area, x, y, w, h), largest
    first. ImageMagick does the labelling; the subject is the biggest one and anything else is
    the generator's signature or keying speckle."""
    out = subprocess.run(
        ["magick", path, "-alpha", "extract", "-threshold", "50%",
         "-define", "connected-components:verbose=true", "-connected-components", "8", "null:"],
        capture_output=True, text=True).stdout
    found = []
    for line in out.splitlines():
        m = re.match(r"\s*\d+:\s+(\d+)x(\d+)\+(\d+)\+(\d+)\s+\S+\s+(\d+)\s+(\S+)", line)
        if m and m.group(6).endswith("(255,255,255)"):
            w, h, x, y, area = (int(m.group(i)) for i in (1, 2, 3, 4, 5))
            found.append((area, x, y, w, h))
    found.sort(reverse=True)
    return found


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source")
    ap.add_argument("output")
    ap.add_argument("--bg", help="background colour to key (default: the top-left pixel)")
    ap.add_argument("--fuzz", default="auto", help="per cent, or 'auto'")
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
        bg_rgb = tuple(int(bg.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
        source = args.source

        # Key from all four corners, so an enclosed grey inside the subject is left alone.
        def key(fuzz, out):
            corners = []
            for cx, cy in ((2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)):
                corners += ["-fill", "none", "-floodfill", "+%d+%d" % (cx, cy), bg]
            magick(source, "-alpha", "set", "-fuzz", "%f%%" % fuzz, *corners, out)

        if str(args.fuzz).lower() == "auto":
            # Sweep, and take the largest fuzz before the subject starts disappearing.
            probe = os.path.join(tmp, "probe.png")
            steps = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24]
            coverage = []
            for f in steps:
                key(f, probe)
                coverage.append(opaque_fraction(probe))
            baseline = sorted(coverage[:3])[1]
            chosen = steps[0]
            for f, c in zip(steps, coverage):
                if c >= baseline - 0.0075:
                    chosen = f
                else:
                    break
            print("  fuzz %d%% (coverage held at %.1f%%, fell to %.1f%% beyond it)"
                  % (chosen, baseline * 100, min(coverage) * 100))
        else:
            chosen = float(args.fuzz)
        key(chosen, step(2))

        # The generator signs its work with a small sparkle, and a key always leaves a little
        # speckle. Both survive as opaque islands separate from the subject; the subject is the
        # largest island, so everything else goes. Doing this after the key rather than before
        # is what makes it reliable: before, the subject often reaches into the same corner and
        # there is no way to tell the mark from a piece of the painting.
        blobs = islands(step(2))
        if not args.no_watermark and len(blobs) > 1:
            biggest = blobs[0][0]
            strays = [b for b in blobs[1:] if b[0] < biggest * 0.05]
            if args.watermark:
                x, y, bw, bh = (int(v) for v in args.watermark.split(","))
                strays = [(0, x, y, bw, bh)]
            if strays:
                draw = []
                for _, x, y, bw, bh in strays:
                    draw += ["-draw", "rectangle %d,%d %d,%d" % (x - 2, y - 2, x + bw + 2, y + bh + 2)]
                magick(step(2), "(", "-size", "%dx%d" % (w, h), "xc:none", "-fill", "white",
                       *draw, ")", "-alpha", "set", "-compose", "DstOut", "-composite", step(4))
                shutil.copy(step(4), step(2))
                sizes = ", ".join("%dx%d at %d,%d" % (b[3], b[4], b[1], b[2]) for b in strays[:3])
                print("  removed %d stray island(s): %s%s"
                      % (len(strays), sizes, " ..." if len(strays) > 3 else ""))

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
