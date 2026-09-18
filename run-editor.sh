#!/usr/bin/env bash
# Launcher for the Civilization VII Visual Map Editor.
# Starts the companion server and opens the visual editor in your browser.
# macOS/Linux port of run-editor.ps1 / open-editor.bat.
#
#   ./run-editor.sh                            # opens the first map in the list
#   ./run-editor.sh --map europe-geo.js        # opens that one instead
#   ./run-editor.sh --port 8090 --no-open
#
# Any *-geo.js in EuropeMediterranean/maps can also be picked from the dropdown
# in the browser; --map only chooses which one is open at startup.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$ROOT/editor/server.py" "$@"
