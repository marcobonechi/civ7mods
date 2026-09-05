#!/usr/bin/env bash
# Regenerates editor/js/default-maps.js from the mod's two geography files, rewriting
# their `export const GEO` into the globals the editor expects.
# macOS/Linux port of build-defaults.ps1.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The Windows script assumed ../maps (editor lived inside the mod folder). Support both
# that layout and the current one, where editor/ sits at the project root.
if [ -d "$ROOT/../maps" ]; then
    MAPS="$(cd "$ROOT/../maps" && pwd)"
elif [ -d "$ROOT/../EuropeMediterranean/maps" ]; then
    MAPS="$(cd "$ROOT/../EuropeMediterranean/maps" && pwd)"
else
    echo "cannot find a maps folder near $ROOT" >&2; exit 1
fi

OUT="$ROOT/js/default-maps.js"
mkdir -p "$ROOT/js"

{
    printf '// default-maps.js\n// Preloaded map data for standalone and fallback use\n\n'
    sed 's/^export const GEO\([^A-Za-z0-9_]\)/window.DEFAULT_EUROPE_LARGE_GEO\1/' "$MAPS/europe-large-geo.js"
    printf '\n\n'
    sed 's/^export const GEO\([^A-Za-z0-9_]\)/window.DEFAULT_EUROPE_GEO\1/' "$MAPS/europe-geo.js"
} > "$OUT"

echo "Created default-maps.js, size: $(wc -c < "$OUT" | tr -d ' ')  (from $MAPS)"
