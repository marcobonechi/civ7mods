#!/bin/sh
# Build a modded leader's lp_hex_<leader>_{256,128,64}.png the way the shipped ones are drawn:
# a cut-out bust whose head rises above the diplomacy-ribbon hex frame.
#
#   tools/leader-hex.sh <painting> <out dir> <leader id>
#   tools/leader-hex.sh Etruscans/icons/src/leader_porsenna.raw.jpg Etruscans/icons porsenna
#
# The subject is lifted off its background and the face found with macOS Vision
# (tools/lift-subject.swift, macOS 14+). The face box is scaled to 30% of the canvas and
# centred at (50%, 63%); below the frame's upper edge the bust is trimmed to the hex so the
# shoulders stay inside it. Numbers measured on the 1.5 ribbon, see the skill reference.md.
# Needs ImageMagick 7 (`magick`).
set -e
src=$1; out=$2; id=$3
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
here=$(cd "$(dirname "$0")" && pwd)
face=$(swift "$here/lift-subject.swift" "$src" "$tmp/cut.png" | awk '/^face/{print $2, $3, $4}')
[ -n "$face" ] || { echo "no face found in $src" >&2; exit 1; }
set -- $face
geom=$(magick identify -format "%w" "$tmp/cut.png" | awk -v fx="$1" -v fy="$2" -v fw="$3" '{
  s = 0.30 * 256 / fw
  printf "%.0f %+.0f%+.0f", $1 * s, 128 - (fx + fw / 2) * s, 161 - (fy + fw / 2) * s }')
set -- $geom
magick -size 256x256 xc:none \( "$tmp/cut.png" -resize "$1x$1" \) -geometry "$2" -compose over -composite \
  \( -size 256x256 xc:none -fill white -draw "rectangle 0,0 255,146" \
     -draw "polygon 128,110 188,145 188,215 128,250 68,215 68,145" \) -compose DstIn -composite "$tmp/hex.png"
for n in 256 128 64; do
  magick "$tmp/hex.png" -resize "${n}x${n}" -depth 8 "PNG32:$out/lp_hex_${id}_$n.png"
done
echo "wrote $out/lp_hex_${id}_{256,128,64}.png"
