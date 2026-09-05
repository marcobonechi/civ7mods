#!/usr/bin/env bash
# Rebuilds the two preview pages from the mod's geography files and (optionally) opens them.
#   ./build-preview.sh          -> writes europe-large.html and europe.html next to this script
#   ./build-preview.sh --open   -> also opens europe-large.html
# The pages are self-contained (data + rasterizer inlined), so they work from a file:// URL.
# macOS/Linux port of build-preview.ps1.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAPS="$(dirname "$ROOT")/EuropeMediterranean/maps"
TPL="$ROOT/templates"

OPEN=0
for arg in "$@"; do
    case "$arg" in
        --open|-Open) OPEN=1 ;;
        *) echo "unknown option: $arg" >&2; exit 2 ;;
    esac
done

[ -d "$MAPS" ] || { echo "maps folder not found: $MAPS" >&2; exit 1; }

# The map files are ES modules; the preview inlines them, so drop the `export` keywords.
strip_exports() { sed 's/^export //' "$1"; }

build() {
    geo="$1"; tail_tpl="$2"; out="$3"
    { cat "$TPL/head.html"
      strip_exports "$MAPS/$geo"
      printf '\n'
      strip_exports "$MAPS/europe-raster.js"
      cat "$TPL/$tail_tpl"
    } > "$ROOT/$out"
    echo "built $out"
}

build "europe-large-geo.js" "tail-large.html"    "europe-large.html"
build "europe-geo.js"       "tail-standard.html" "europe.html"

if [ "$OPEN" -eq 1 ]; then
    if command -v open >/dev/null; then open "$ROOT/europe-large.html"
    elif command -v xdg-open >/dev/null; then xdg-open "$ROOT/europe-large.html"
    fi
fi
