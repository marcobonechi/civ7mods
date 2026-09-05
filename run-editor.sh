#!/usr/bin/env bash
# Launcher for the Civilization VII Visual Map Editor.
# Starts the companion server and opens the visual editor in your browser.
# macOS/Linux port of run-editor.ps1 / open-editor.bat.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$ROOT/editor/server.py" "$@"
