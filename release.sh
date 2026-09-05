#!/usr/bin/env bash
# Bump one mod's version and install it into the game.
# Distribution goes through the git repository, not a zip: publish a version by
# committing and pushing, then tagging a GitHub release.
# Usage: ./release.sh <ModFolder>             (bumps 1 -> 2 -> 3 ...)
#        ./release.sh <ModFolder> --no-bump   (reinstall at the current version)
# The folder argument may be omitted when the repository holds a single mod.
# macOS/Linux port of release.ps1, which still writes a zip.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BUMP=1
NAME=""
for arg in "$@"; do
    case "$arg" in
        --no-bump|-NoBump) BUMP=0 ;;
        -*) echo "unknown option: $arg" >&2; exit 2 ;;
        *) NAME="${arg%/}" ;;
    esac
done

if [ -z "$NAME" ]; then
    FOUND=()
    for d in "$ROOT"/*/; do
        d="${d%/}"
        if compgen -G "$d/*.modinfo" > /dev/null; then FOUND+=("$(basename "$d")"); fi
    done
    if [ "${#FOUND[@]}" -eq 1 ]; then
        NAME="${FOUND[0]}"
    else
        echo "usage: ./release.sh <ModFolder> [--no-bump]   (mods here: ${FOUND[*]:-none})" >&2
        exit 2
    fi
fi

MOD="$ROOT/$NAME"
MODINFO="$(ls "$MOD"/*.modinfo 2>/dev/null | head -1 || true)"
[ -n "$MODINFO" ] && [ -f "$MODINFO" ] || { echo "no .modinfo in $MOD" >&2; exit 1; }

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

bash "$ROOT/install.sh" "$NAME" | tail -1

echo "$NAME version $VERSION"
echo
echo "next: commit and push, then cut the GitHub release"
echo "  jj describe -m \"Release $NAME v$VERSION\" && jj new"
echo "  jj bookmark set main -r @- && jj git push --bookmark main"
echo "  gh release create $(echo "$NAME" | tr '[:upper:]' '[:lower:]')-v$VERSION --target main --title \"$NAME v$VERSION\" --notes \"...\""
