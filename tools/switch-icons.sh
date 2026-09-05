#!/usr/bin/env bash
# Swap a mod's icon set: copies <Mod>/icons-<set>/*.png over <Mod>/icons/*.png and reinstalls.
# Usage: tools/switch-icons.sh Byzantium mixed    (default: painted eagle and buildings, vector unit silhouettes)
#        tools/switch-icons.sh Byzantium alt      (painted set from the concept sheet)
#        tools/switch-icons.sh Byzantium vector   (rendered from icons/src/*.svg)
# The vector set is regenerated from the SVG sources with tools/icon-render; the alt set is
# kept as PNGs in icons-alt/. Restart the game after switching.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOD="${1:?mod folder}"; SET="${2:?set name: mixed | alt | vector}"
case "$SET" in
    vector) SRC="$ROOT/$MOD/icons-vector" ;;
    *)      SRC="$ROOT/$MOD/icons-$SET" ;;
esac
[ -d "$SRC" ] || { echo "no such icon set: $SRC" >&2; exit 1; }
cp "$SRC"/*.png "$ROOT/$MOD/icons/"
echo "icons: $SET -> $MOD/icons/"
bash "$ROOT/install.sh" "$MOD" | tail -1
