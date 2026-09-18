#!/usr/bin/env bash
# Launcher for the Civilization VII Visual Map Editor.
# Starts the companion server and opens the visual editor in your browser.
# macOS/Linux port of run-editor.ps1 / open-editor.bat.
#
#   ./run-editor.sh                            # opens the first map in the list
#   ./run-editor.sh --map europe-alt-geo.js    # opens that one instead
#   ./run-editor.sh --port 8090 --no-open
#
# Any *-geo.js in EuropeMediterranean/maps can also be picked from the dropdown
# in the browser; --map only chooses which one is open at startup.
#
#   ./run-editor.sh antarctica                 # the Antarctica map's own editor (editor-antarctica/)
#   ./run-editor.sh --map antarctica           # the same
#
# The Antarctica map keeps each continent in its own projection, which the Europe editor cannot
# draw, so it has a separate editor; this script only picks which one to start.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "${1:-}" = "antarctica" ]; then
    shift
    exec python3 "$ROOT/editor-antarctica/server.py" "$@"
fi
if [ "${1:-}" = "--map" ] && [ "${2:-}" = "antarctica" ]; then
    shift 2
    exec python3 "$ROOT/editor-antarctica/server.py" "$@"
fi
exec python3 "$ROOT/editor/server.py" "$@"
