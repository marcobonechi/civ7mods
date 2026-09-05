#!/usr/bin/env bash
# Bump the mod version and install it into the game.
# Distribution goes through the git repository, not a zip: publish a version by
# committing and pushing, then tagging a GitHub release.
# Usage: ./release.sh             (bumps 1 -> 2 -> 3 ...)
#        ./release.sh --no-bump   (reinstall at the current version)
# macOS/Linux port of release.ps1, which still writes a zip.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOD="$ROOT/EuropeMediterranean"
MODINFO="$MOD/europe-mediterranean.modinfo"

BUMP=1
for arg in "$@"; do
    case "$arg" in
        --no-bump|-NoBump) BUMP=0 ;;
        *) echo "unknown option: $arg" >&2; exit 2 ;;
    esac
done

[ -f "$MODINFO" ] || { echo "no modinfo at $MODINFO" >&2; exit 1; }

VERSION="$(sed -n 's/.*<Version>\([0-9]\{1,\}\)<\/Version>.*/\1/p' "$MODINFO" | head -1)"
[ -n "$VERSION" ] || { echo "no <Version> in $MODINFO" >&2; exit 1; }

if [ "$BUMP" -eq 1 ]; then
    VERSION=$((VERSION + 1))
    # Update both the <Version> element and the version="" attribute on <Mod>.
    sed -i '' -E \
        -e "s|<Version>[0-9]+</Version>|<Version>${VERSION}</Version>|" \
        -e "s|version=\"[0-9]+\"|version=\"${VERSION}\"|" \
        "$MODINFO" 2>/dev/null || sed -i -E \
        -e "s|<Version>[0-9]+</Version>|<Version>${VERSION}</Version>|" \
        -e "s|version=\"[0-9]+\"|version=\"${VERSION}\"|" \
        "$MODINFO"
fi

bash "$ROOT/install.sh" | tail -1

echo "mod version $VERSION"
echo
echo "next: commit and push, then cut the GitHub release"
echo "  jj describe -m \"Release v$VERSION\" && jj new"
echo "  jj bookmark set main -r @- && jj git push --bookmark main"
echo "  gh release create v$VERSION --target main --title \"v$VERSION\" --notes \"...\""
