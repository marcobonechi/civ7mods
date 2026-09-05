# macOS / Linux toolchain

The project's build and editor scripts were written for Windows PowerShell. These are the
ported equivalents. The originals are left in place untouched, so the repo still works on Windows.

| Windows | macOS / Linux | What it does |
|---|---|---|
| `run-editor.ps1` / `open-editor.bat` | `./run-editor.sh` | starts the editor server and opens the browser |
| `editor/server.ps1` | `editor/server.py` | the companion HTTP server |
| `install.ps1` | `./install.sh` | mirrors the mod into the Civ VII Mods folder |
| `release.ps1` | `./release.sh` | bumps the version, installs, writes a versioned zip |
| `preview/build-preview.ps1` | `preview/build-preview.sh` | rebuilds the standalone preview pages |
| `editor/build-defaults.ps1` | `editor/build-defaults.sh` | regenerates `editor/js/default-maps.js` |
| `editor/setup-launchers.ps1` | *(not ported)* | one-off Windows workspace bootstrap, hardcoded `C:\` paths |

## Usage

```bash
./run-editor.sh                 # editor at http://localhost:8080
./run-editor.sh --port 9000     # different port
./run-editor.sh --no-open       # don't launch a browser
./run-editor.sh --no-mirror     # skip the ' - Copy' mirror (no-op now it is gone)

./install.sh                    # install into the game
./release.sh                    # bump version + install + zip
./release.sh --no-bump          # re-zip the current version
./preview/build-preview.sh --open
./editor/build-defaults.sh
```

## Requirements

`python3` (server), plus `rsync` and `zip`, which ship with macOS. No third-party packages.

## Install path

Windows used `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\`.
On macOS the game reads `~/Library/Application Support/Civilization VII/Mods/`.
`install.sh` also clears the `com.apple.quarantine` attribute, which downloaded files carry
and which can stop the game reading them.

## Deliberate differences from the PowerShell originals

- **The server binds `127.0.0.1` only** and refuses API calls from another origin. It writes
  files and runs the installer, so it must not be drivable by an arbitrary page in your browser.
  `server.ps1` sent `Access-Control-Allow-Origin: *`.
- **Static paths are contained** inside `editor/`. The original joined the request path
  onto the root without checking, so `..` escaped the directory.
- **`build-defaults.sh` finds the maps folder** at `../maps` *or* `../EuropeMediterranean/maps`.
  The PowerShell version only handled the first, which is why it silently read the stale
  `EuropeMediterranean - Copy` geography once `editor/` moved to the project root.
- **Output files are written without a UTF-8 BOM** (the PowerShell `build-defaults.ps1` emitted one).
- `robocopy /MIR` becomes `rsync -a --delete`; `.DS_Store` and `._*` are excluded everywhere.

## Note on the mirror save

`/api/save` writes to `EuropeMediterranean/maps`, and also to `EuropeMediterranean - Copy/maps`
if that folder is ever recreated (matching the Windows behaviour). That folder was deleted on
2026-09-04; its unique work-in-progress files are preserved in
`EuropeMediterranean-Copy-archive-20260904-2032.zip`. With it gone, saves go to the primary
folder only and `--no-mirror` is a no-op.
