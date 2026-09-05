#!/usr/bin/env bash
# Copies every mod in this repository into the Civilization VII Mods folder (mirror: files
# removed here are removed there too). A mod is any top-level folder holding a .modinfo file.
# Restart the game afterwards; it re-reads mods only at startup.
# Usage: ./install.sh                 (all mods)
#        ./install.sh Byzantium ...   (only the named mod folders)
# macOS/Linux port of install.ps1 (robocopy /MIR -> rsync --delete).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$(uname -s)" = "Darwin" ]; then
    MODS="$HOME/Library/Application Support/Civilization VII/Mods"
else
    MODS="${XDG_DATA_HOME:-$HOME/.local/share}/Civilization VII/Mods"
fi

# Discover mod folders: top-level directories that contain a .modinfo.
discover() {
    local d
    for d in "$ROOT"/*/; do
        d="${d%/}"
        if compgen -G "$d/*.modinfo" > /dev/null; then basename "$d"; fi
    done
}

if [ "$#" -gt 0 ]; then
    NAMES=("$@")
else
    NAMES=()
    while IFS= read -r n; do NAMES+=("$n"); done < <(discover)
fi
[ "${#NAMES[@]}" -gt 0 ] || { echo "no mod folders found (a mod folder holds a .modinfo)" >&2; exit 1; }

for NAME in "${NAMES[@]}"; do
    SRC="$ROOT/${NAME%/}"
    DST="$MODS/${NAME%/}"
    [ -d "$SRC" ] || { echo "source not found: $SRC" >&2; exit 1; }
    compgen -G "$SRC/*.modinfo" > /dev/null || { echo "no .modinfo in $SRC" >&2; exit 1; }

    mkdir -p "$DST"
    rsync -a --delete \
        --exclude='.DS_Store' --exclude='._*' --exclude='.git/' \
        "$SRC"/ "$DST"/

    # Downloaded files carry a quarantine flag the game can trip over.
    xattr -dr com.apple.quarantine "$DST" 2>/dev/null || true

    echo "installed to $DST"
done
