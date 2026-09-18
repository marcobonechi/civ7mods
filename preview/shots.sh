#!/usr/bin/env bash
# Renders the showcase screenshots from the preview pages with headless Chrome.
#   ./shots.sh          -> writes PNGs into ../EuropeMediterranean/screenshots (shipped with the mod,
#                          listed in its modinfo, and shown on the docs page)
# Views are lon/lat boxes; the page's screenshot mode (?shot=1) frames them, see tail-large.html.
# macOS/Linux port of shots.ps1 (headless Edge), with the Eurasia Compressed views added.
# Run ./build-preview.sh first so the pages carry the current geography.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$(dirname "$ROOT")/EuropeMediterranean/screenshots"
mkdir -p "$OUT"

CHROME="${CHROME:-}"
for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
         "/Applications/Chromium.app/Contents/MacOS/Chromium" \
         "$(command -v google-chrome || true)" "$(command -v chromium || true)"; do
    if [ -z "$CHROME" ] && [ -n "$c" ] && [ -x "$c" ]; then CHROME="$c"; fi
done
[ -n "$CHROME" ] || { echo "no Chrome or Chromium found (set CHROME=/path/to/chrome)" >&2; exit 1; }
PROFILE="$(mktemp -d)"
trap 'rm -rf "$PROFILE"' EXIT

# name | page | width | height | query. The full-map views stay under 1 MiB (jj refuses larger new files).
VIEWS=(
  "01-global|europe-large.html|1400|1076|title=Europe, Mediterranean %26 Sahel (Large) - 112x98"
  "02-home-distant|europe-large.html|1400|1076|regions=1&title=Home lands (west) and distant lands (east)"
  "03-france|europe-large.html|1600|1100|view=-5,42,9,51.5&title=France"
  "04-italy|europe-large.html|1600|1100|view=6,36,19,47&title=Italy"
  "05-greece|europe-large.html|1600|1100|view=19,34.5,29,42&title=Greece and the Aegean"
  "06-ukraine|europe-large.html|1600|1100|view=22,44,42,53&title=Ukraine and the Pontic steppe"
  "07-egypt|europe-large.html|1600|1100|view=24,21,37,33&title=Egypt, the Nile and the Sinai"
  "08-africa-sea-lane|europe-large.html|1600|1100|view=-24,4,14,26&title=West Africa - the sea lane around the continent"
  "09-eurasia-compressed|europe-alt.html|1400|1076|title=Eurasia Compressed - 112x98"
  "10-eurasia-distant-lands|europe-alt.html|1400|1076|regions=1&title=Eurasia Compressed (Distant Lands) - home lands and distant lands"
  "11-eurasia-east|europe-alt.html|1600|1100|w=128&h=112&view=24,36,68,70&title=Eurasia Compressed - the Eastern Ocean and East Asia, 128x112"
)

for v in "${VIEWS[@]}"; do
    IFS='|' read -r name page cw ch q <<< "$v"
    url="file://$ROOT/$page?shot=1&cw=$cw&ch=$ch&${q// /%20}"
    png="$OUT/$name.png"
    rm -f "$png"
    # Chrome on macOS writes the screenshot but does not always exit afterwards, so run it in the
    # background, wait for the file to appear and stop growing, then stop it.
    "$CHROME" --headless --disable-gpu --hide-scrollbars --no-first-run --no-default-browser-check \
        --user-data-dir="$PROFILE" --window-size="$cw,$ch" --screenshot="$png" "$url" >/dev/null 2>&1 &
    pid=$!
    last=-1
    for _ in $(seq 1 120); do
        sleep 0.5
        if [ -f "$png" ]; then
            size=$(wc -c < "$png" | tr -d ' ')
            [ "$size" = "$last" ] && [ "$size" -gt 0 ] && break
            last=$size
        fi
    done
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    if [ -f "$png" ]; then echo "wrote $name.png ($(wc -c < "$png" | tr -d ' ') bytes)"; else echo "FAILED $name"; fi
done
