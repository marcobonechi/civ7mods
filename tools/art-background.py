#!/usr/bin/env python3
"""Turn a generated painting into the background PNGs the game wants.

One landscape generation feeds the loading screen at two sizes and the picker panel; one portrait
generation feeds the tall civ-select card and the civ detail card. This crops and resizes to all
of them, and patches out the generator's signature on the way.

    tools/art-background.py raw.png --civ etruscans --mod Etruscans --landscape --mark 919,464,38,38
    tools/art-background.py raw.png --civ etruscans --mod Etruscans --portrait  --mark 919,464,38,38

  --landscape   writes lsbg_<civ>_1080.png (1920x1080), lsbg_<civ>_720.png (1280x720)
                and bg-panel-<civ>.png (1301x732)
  --portrait    writes lsbg_<civ>_vert.png (1080x1920) and bg-card-<civ>.png (720x1080)

The signature. On an icon it can be found automatically, because after keying it is a small opaque
island sitting apart from the subject (see tools/art-icon.py). A painting has no transparency to
key, and looking for it by colour does not work: it is a pale translucent star, and on a warm
landscape the sunlit dirt reads exactly the same way - a saturation test on the Tarquinia painting
flagged five thousand pixels of footpath along with it. So pass --mark X,Y,W,H, read off a
magnified crop. `--inspect` writes those crops for you and stops:

    tools/art-background.py raw.png --inspect

It is patched by cloning a feathered ellipse of nearby ground over it, taken from just above by
default. Always look at the before/after crop the tool writes next to the source: whether the
clone lands on plain ground or on top of a building is luck, and --from-dy / --from-dx move it.

Needs ImageMagick 7 (`magick`).
"""
import argparse
import os
import subprocess
import sys

LANDSCAPE = [("lsbg_%s_1080", 1920, 1080), ("lsbg_%s_720", 1280, 720), ("bg-panel-%s", 1301, 732)]
PORTRAIT = [("lsbg_%s_vert", 1080, 1920), ("bg-card-%s", 720, 1080)]


def magick(*args):
    result = subprocess.run(["magick", *[str(a) for a in args]], capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit("magick failed: %s\n%s" % (" ".join(str(a) for a in args), result.stderr.strip()))
    return result.stdout.strip()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source")
    ap.add_argument("--civ", help="the <civ> in the file names, e.g. etruscans")
    ap.add_argument("--mod", help="the mod folder the files go into, e.g. Etruscans")
    ap.add_argument("--landscape", action="store_true")
    ap.add_argument("--portrait", action="store_true")
    ap.add_argument("--mark", help="X,Y,W,H of the generator's signature")
    ap.add_argument("--from-dy", type=int, default=None, help="clone from this many pixels above")
    ap.add_argument("--from-dx", type=int, default=0)
    ap.add_argument("--inspect", action="store_true", help="write magnified corner crops and stop")
    ap.add_argument("--quiet", action="store_true", help="skip the before/after crop")
    args = ap.parse_args()

    if not os.path.exists(args.source):
        sys.exit("no such file: " + args.source)
    w, h = (int(v) for v in magick("identify", "-format", "%w %h", args.source).split())
    stem = os.path.splitext(args.source)[0]

    if args.inspect:
        for label, x, y in (("br", int(w * .72), int(h * .60)), ("bl", 0, int(h * .60)),
                            ("tr", int(w * .72), 0), ("tl", 0, 0)):
            cw, ch = int(w * .28), int(h * .40)
            out = "%s.corner-%s.png" % (stem, label)
            magick(args.source, "-crop", "%dx%d+%d+%d" % (cw, ch, x, y), "+repage",
                   "-resize", "300%", out)
            print("%s  (this crop starts at %d,%d in the original; divide any position you read "
                  "off it by 3 and add that)" % (out, x, y))
        return 0

    if not (args.landscape or args.portrait):
        sys.exit("pass --landscape or --portrait")
    if not (args.civ and args.mod):
        sys.exit("pass --civ and --mod")

    clean = args.source
    if args.mark:
        mx, my, mw, mh = (int(v) for v in args.mark.split(","))
        cx, cy = mx + mw // 2, my + mh // 2
        # The patch has to be opaque well past the mark's corners, so size it from the diagonal.
        reach = int(((mw ** 2 + mh ** 2) ** 0.5) / 2) + 6
        side = reach * 2 + 44                       # room for the feather outside the opaque core
        # Clone from just far enough above that the source does not include the mark itself.
        # Reaching further is tempting but grabs whatever structure happens to be up there: the
        # first run on the Tarquinia painting pulled a tomb doorway down into the middle of a
        # footpath. Overlapping the patch is fine, since only its centre is opaque.
        dy = args.from_dy if args.from_dy is not None else -(reach + 30)
        px, py = cx - side // 2, cy - side // 2
        sx, sy = max(0, min(w - side, px + args.from_dx)), max(0, min(h - side, py + dy))
        tmp_mask, tmp_patch, tmp_out = stem + ".mask.tmp.png", stem + ".patch.tmp.png", stem + ".clean.png"
        magick("-size", "%dx%d" % (side, side), "xc:black", "-fill", "white",
               "-draw", "ellipse %d,%d %d,%d 0,360" % (side // 2, side // 2, reach + 10, reach + 10),
               "-blur", "0x10", tmp_mask)
        magick(args.source, "-crop", "%dx%d+%d+%d" % (side, side, sx, sy), "+repage", tmp_patch)
        magick(tmp_patch, tmp_mask, "-alpha", "off", "-compose", "CopyOpacity", "-composite", tmp_patch)
        magick(args.source, tmp_patch, "-geometry", "+%d+%d" % (px, py),
               "-compose", "over", "-composite", tmp_out)
        os.remove(tmp_mask)
        os.remove(tmp_patch)
        clean = tmp_out
        print("  patched a %dx%d mark at %d,%d by cloning from %d,%d" % (mw, mh, mx, my, sx, sy))
        if not args.quiet:
            check = stem + ".mark-check.png"
            box = "%dx%d+%d+%d" % (side + 80, side + 80, max(0, px - 40), max(0, py - 40))
            magick("(", args.source, "-crop", box, "+repage", "-resize", "300%", ")",
                   "(", clean, "-crop", box, "+repage", "-resize", "300%", ")",
                   "+append", check)
            print("  before/after: %s" % check)

    targets = (LANDSCAPE if args.landscape else PORTRAIT)
    for name, ow, oh in targets:
        out = os.path.join(args.mod, "icons", (name % args.civ) + ".png")
        magick(clean, "-filter", "Lanczos", "-resize", "%dx%d^" % (ow, oh),
               "-gravity", "center", "-extent", "%dx%d" % (ow, oh),
               "-define", "png:color-type=2", out)
        scale = max(ow / w, oh / h)
        note = "  (upscaled %.2fx)" % scale if scale > 1.05 else ""
        print("%s  %dx%d%s" % (out, ow, oh, note))
    return 0


if __name__ == "__main__":
    sys.exit(main())
