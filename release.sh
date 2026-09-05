#!/usr/bin/env bash
# Bump the mod version, install it into the game, and write a new versioned zip to share.
# Usage: ./release.sh             (bumps 1 -> 2 -> 3 ...)
#        ./release.sh --no-bump   (rebuild the zip for the current version)
# macOS/Linux port of release.ps1.
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

STAMP="$(date +%Y%m%d-%H%M)"
ZIP="$ROOT/EuropeMediterranean-v${VERSION}-${STAMP}.zip"
rm -f "$ZIP"
# Zip from the project root so the archive root is EuropeMediterranean/, matching the Windows zips.
( cd "$ROOT" && zip -r -q -X "$ZIP" EuropeMediterranean \
    -x '*.DS_Store' -x '*._*' -x '*/.git/*' )

SIZE="$(wc -c < "$ZIP" | tr -d ' ')"
if command -v md5 >/dev/null; then MD5="$(md5 -q "$ZIP")"; else MD5="$(md5sum "$ZIP" | cut -d' ' -f1)"; fi

echo "mod version $VERSION"
echo "zip: $ZIP ($SIZE bytes)"
echo "md5: $MD5"
