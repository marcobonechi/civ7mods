#!/usr/bin/env bash
# Copies every mod in this repository into the Civilization VII Mods folder (mirror: files
# removed here are removed there too). A mod is any top-level folder holding a .modinfo file.
# A mod's dlc/ subfolder holds binary art packages, which go into the game install's DLC/.
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

# The game install (for art packages). CIV7_GAME_ROOT overrides the Steam default; it is the
# folder that holds Base/ and DLC/ (on macOS that is inside the app bundle).
if [ -n "${CIV7_GAME_ROOT:-}" ]; then
    GAME_ROOT="$CIV7_GAME_ROOT"
elif [ "$(uname -s)" = "Darwin" ]; then
    GAME_ROOT="$HOME/Library/Application Support/Steam/steamapps/common/Sid Meier's Civilization VII/CivilizationVII.app/Contents/Resources"
else
    GAME_ROOT="$HOME/.steam/steam/steamapps/common/Sid Meier's Civilization VII"
fi
GAME_DLC=""
[ -d "$GAME_ROOT/DLC" ] && GAME_DLC="$GAME_ROOT/DLC"

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
        --exclude='.DS_Store' --exclude='._*' --exclude='.git/' --exclude='dlc/' \
        "$SRC"/ "$DST"/

    # Downloaded files carry a quarantine flag the game can trip over.
    xattr -dr com.apple.quarantine "$DST" 2>/dev/null || true

    echo "installed to $DST"

    # Binary art packages (<Mod>/dlc/<Group>/<Group>.dep + Platforms/<OS>/BLPs) are only
    # found by the game inside its own install, under DLC/. Mirror each one there.
    for GROUP in "$SRC"/dlc/*/; do
        GROUP="${GROUP%/}"
        [ -d "$GROUP" ] || continue
        compgen -G "$GROUP/*.dep" > /dev/null || continue
        if [ -z "${GAME_DLC:-}" ]; then
            echo "  art package $(basename "$GROUP") not installed: game DLC folder not found (set CIV7_GAME_ROOT)" >&2
            continue
        fi
        mkdir -p "$GAME_DLC/$(basename "$GROUP")"
        rsync -a --delete --exclude='.DS_Store' --exclude='._*' "$GROUP"/ "$GAME_DLC/$(basename "$GROUP")"/
        xattr -dr com.apple.quarantine "$GAME_DLC/$(basename "$GROUP")" 2>/dev/null || true
        echo "  art package installed to $GAME_DLC/$(basename "$GROUP")"
    done
done
