#!/usr/bin/env bash
# Copies the mod into the Civilization VII Mods folder (mirror: removed files are removed there too).
# Restart the game afterwards; it re-reads mods only at startup.
# macOS/Linux port of install.ps1 (robocopy /MIR -> rsync --delete).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$ROOT/EuropeMediterranean"

if [ "$(uname -s)" = "Darwin" ]; then
    DST="$HOME/Library/Application Support/Civilization VII/Mods/EuropeMediterranean"
else
    DST="${XDG_DATA_HOME:-$HOME/.local/share}/Civilization VII/Mods/EuropeMediterranean"
fi

[ -d "$SRC" ] || { echo "source not found: $SRC" >&2; exit 1; }

mkdir -p "$DST"
rsync -a --delete \
    --exclude='.DS_Store' --exclude='._*' --exclude='.git/' \
    "$SRC"/ "$DST"/

# Downloaded files carry a quarantine flag the game can trip over.
xattr -dr com.apple.quarantine "$DST" 2>/dev/null || true

echo "installed to $DST"
