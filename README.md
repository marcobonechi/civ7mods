# civ7mods — Civilization VII mods

Civilization VII mods by genginsbon: a map of Europe, the Mediterranean and Africa, three civilizations to play on it, a south polar Antarctica map, and a small gameplay mod. Each lives in its own folder with a `.modinfo` inside and its own README:

| Folder | Mod | Status |
|---|---|---|
| [`EuropeMediterranean/`](EuropeMediterranean/README.md) | Europe & Mediterranean map scripts: four map types in two pairs (Europe & Mediterranean with and without Distant Lands, Eurasia Compressed with and without), historical starts for every civilization of every age, and a browser-based geography editor | version 61, released as [v9](https://github.com/marcobonechi/civ7mods/releases/tag/v9) |
| [`Byzantium/`](Byzantium/README.md) | Byzantium, an Exploration Age civilization (Rome and Greece lead to it); also playable Time-Tested from an Antiquity or Modern start, listed as "Eastern Roman Empire" in Antiquity with its own Late Roman kit (Clibanarii, Liburna, Cistern and Milion forming the Mese) | version 1 |
| [`Etruscans/`](Etruscans/README.md) | The Etruscans, an Antiquity Age civilization of engineers and banqueters, with Lars Porsenna of Clusium | version 1 |
| [`Tuscany/`](Tuscany/README.md) | Tuscany, an Exploration Age civilization of bankers, navigators and painters, with Lorenzo il Magnifico and the Maestri | version 1 |
| [`Antarctica/`](Antarctica/README.md) | Antarctica map script: a south polar map with every civilization starting on the ice-free coast of Antarctica, and South America, Southern Africa, Australia and New Zealand as Distant Lands | version 1, not yet released |
| [`ChangeCapital/`](ChangeCapital/README.md) | Relocate your capital freely at every age transition, or any time for a price | version 1 |

Further civilizations follow the recipe in `.claude/skills/new-civilization/`, and leaders the one in
`.claude/skills/new-leader/`.

The civilizations work on any map; with the map mod installed they start at their historical
city. Everything is free and open, distributed through this repository rather than the Steam
Workshop. Project pages with screenshots: https://marcobonechi.github.io/civ7mods/ (source in
`docs/`; GitHub Pages serves the `docs` folder of `main`).

**Layout of the repository**

| Path | What it is |
|---|---|
| `<Mod>/` | one folder per mod, copied as-is into the game's Mods folder |
| `install.sh`, `install.ps1`, `uninstall.ps1`, `release.sh`, `release.ps1` | install, remove and release the mods (below) |
| `editor/`, `run-editor.sh` | the browser-based geography editor for the map mod |
| `preview/` | standalone preview pages of the maps and the screenshot script |
| `tools/` | checks and generators (map sizes, rivers, mod data, the Eurasia geography, the map's description; the Antarctica map's check and preview) |
| `3d_art/`, `tools/civ7-art-studio/`, `textures/` | the art pipeline for the civilizations' 3D models and icons |
| `skills/`, `.claude/skills/` | written-up techniques: new civilizations, new leaders, 3D models, UI extension |
| `plans/` | design sheets and work logs |
| `docs/` | the project web pages |

---

## Install

The mods are distributed through this repository. Get the files, copy the mod folders you want
(`EuropeMediterranean/`, `Byzantium/`, `Etruscans/`, `Tuscany/`) into the game's `Mods` folder, and restart the game.

### Get the files

```bash
git clone https://github.com/marcobonechi/civ7mods.git
```

Or, without git, use **Code → Download ZIP** on the GitHub page and unpack it.
To update later: `git pull` (or `jj git fetch && jj new main` if you use jj — see
[Version control](#version-control)).

### Copy it into place

| OS | Mods folder |
|---|---|
| macOS | `~/Library/Application Support/Civilization VII/Mods/` |
| Windows | `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/Civilization VII/Mods/` |

Each folder you copy must land as `Mods/<Folder>/` (for example `Mods/EuropeMediterranean/`),
with the `.modinfo` file directly inside it. On macOS and Linux `./install.sh` does this for every
mod in the repository, or `./install.sh Byzantium` for one of them; on Windows use `install.ps1`
the same way.

**macOS note:** files that arrive via a downloaded ZIP carry Apple's `com.apple.quarantine`
attribute, and the game will silently fail to read the mod while it is set. `install.sh` clears it.
If you copy the folder by hand instead, run:

```bash
xattr -dr com.apple.quarantine ~/Library/Application\ Support/Civilization\ VII/Mods/EuropeMediterranean
```

The game reads mods **only at startup**, so restart it after installing. In game setup, pick one of
the map types described in the [map's README](EuropeMediterranean/README.md).

The three civilization mods also ship a binary art package each (`<Mod>/dlc/<Mod>Art/`), which is
what puts their unique buildings and the Hagia Sophia on the map. The game finds art packages only
inside its own install, so the install scripts mirror each one into `<game>/DLC/<Mod>Art/`. That is
the one thing installed outside the Mods folder; set `CIV7_GAME_ROOT` if the game is not in a
default Steam library.

### Game version

The map mod is written for **Civilization VII 1.5**, which added the calls it uses to draw every
river exactly where the geography file puts it. On an older game it does not crash: it checks for
those calls (`canPaintRivers()` in `maps/europe-large-core.js`) and, when they are missing or fail,
falls back to the pre-1.5 rivers, where the engine models rivers along the drawn courses and picks
the navigable ones itself. Everything else in the map works the same on either version. For a game
older than 1.5 the last release built for it is [v6](https://github.com/marcobonechi/civ7mods/releases/tag/v6).

The civilization mods need no particular version. Their true starts on the base game's Earth map
(1.5) are a replacement for that map's script, which an older game never loads.

### Removing the mods

`uninstall.ps1` (Windows) removes every mod folder this repository installs, together with the art
packages it mirrored into the game's `DLC/`. It never touches shipped game content: a `DLC/` folder
is removed only when this repository declares an art package of that name *and* the installed copy
carries the matching `.dep`. Run it with `-DryRun` to list what it would remove without removing
anything, or name a single mod (`uninstall.ps1 Byzantium`). Restart the game afterwards.

---

## Releasing

Mods are distributed through this repository, not as zips or on the Workshop. A release is a
commit on `main` plus a GitHub release; tags are repository-wide (`v6`, `v7`, `v8`, `v9`, ...),
not per mod, and each release names the mod versions it carries.

1. **Check the mod.** Each mod's README lists what to rebuild and check before a release - for the
   map, [Before a release](EuropeMediterranean/README.md#before-a-release); for a data mod,
   `python3 tools/check-mod.py <Folder>`.
2. **Bump its version.** `./release.sh <Folder>` bumps the version in that mod's `.modinfo` (both the
   `<Version>` element and the `version=""` attribute) and installs the result locally;
   `./release.sh <Folder> --no-bump` reinstalls at the current version. Bump every mod that changed
   since the last release.
3. **Commit** with the message `Release v<n>: <Folder> <version>` (for example
   `Release v9: EuropeMediterranean 61`), saying in the body what changed.
4. **Push `main`:**
   ```bash
   jj bookmark set main -r @- && jj git push --bookmark main
   ```
5. **Cut the GitHub release** on that commit, titled `v<n> — <headline>`, with no zip attached:
   ```bash
   gh release create v<n> --target main --title "v<n> — <headline>" --notes-file notes.md
   ```
   The notes follow the earlier ones: a line naming the mod version and the game version it is
   built for, an **Install** section (clone or download, copy the folder or run `./install.sh`,
   restart, and check *Additional Content → Add-Ons* because the game can leave an updated mod
   switched off, plus anything that breaks old saves), then what changed, grouped by topic, with
   a short **For modders** section last.

Players update with `git pull` followed by `./install.sh`.

---

## Toolchain

The build and editor scripts were originally written for Windows PowerShell. The macOS/Linux ports
sit alongside them; the originals are left in place, so the repo still works on Windows.

**The visual map editor now works on macOS.** `./run-editor.sh` is a full port of the Windows
launcher and server, and the editor itself has been brought back in line with the mod: it renders
through the mod's own rasterizer rather than a stale copy of it, saving patches the geography file
instead of regenerating it (so nothing is silently dropped), the file being edited is chosen with
`--map` or from a dropdown, and single hexes can be edited directly with **Hex Edit**. See
[Editing maps in the editor](EuropeMediterranean/README.md#editing-maps-in-the-editor).

| Windows | macOS / Linux | What it does |
|---|---|---|
| `run-editor.ps1` / `open-editor.bat` | `./run-editor.sh` | starts the editor server and opens the browser |
| `editor/server.ps1` | `editor/server.py` | the companion HTTP server |
| `install.ps1` | `./install.sh` | mirrors every mod folder (or the named ones) into the Civ VII Mods folder |
| `release.ps1` | `./release.sh` | bumps one mod's version and installs it |
| *(none)* | `tools/check-mod.py` | static checks for a mod folder: XML syntax, modinfo file list, text tags and type ids against the game data |
| *(none)* | `tools/check-map-sizes.mjs` | builds all four map types at every grid size and checks land share, Distant Lands split, start positions, declared land connections, sea connectivity, that the islands stay islands, and that the Eurasia geography is up to date |
| *(none)* | `tools/check-rivers.mjs` | plans every river on all four maps and checks each drains downhill to the sea, avoids starts and mountain passes |
| *(none)* | `tools/eurasia-compressed/build.mjs` | builds the Eurasia maps' geography from the Europe file |
| *(none)* | `tools/module-description/build.py` | writes the map mod's description in twelve languages from its start table |
| `preview/build-preview.ps1` | `preview/build-preview.sh` | rebuilds the standalone preview pages |
| `preview/shots.ps1` | `preview/shots.sh` | renders the showcase PNGs into `EuropeMediterranean/screenshots/` with headless Edge / Chrome (global, home/distant lands, regional close-ups, Eurasia Compressed) |
| `editor/build-defaults.ps1` | *(no longer needed)* | the editor imports `maps/*-geo.js` live; there is no generated snapshot to rebuild |
| `editor/setup-launchers.ps1` | *(not ported)* | one-off Windows workspace bootstrap, hardcoded `C:\` paths |

```bash
./run-editor.sh                 # editor at http://localhost:8080
./run-editor.sh --map europe-geo.js       # open this map instead of the first one
./run-editor.sh --port 9000     # different port
./run-editor.sh --no-open       # don't launch a browser

./install.sh                    # install every mod into the game
./install.sh Byzantium          # install one mod
./release.sh EuropeMediterranean  # bump version + install
python3 tools/check-mod.py Byzantium   # before installing a data mod
node tools/check-map-sizes.mjs         # before shipping a map change
./preview/build-preview.sh --open
```

**Requirements:** `python3` (server) and `rsync`, both of which ship with macOS. No third-party packages.

### Deliberate differences from the PowerShell originals

- **The server refuses a port that is already in use**, naming the process holding it.
  `server.ps1` walked up to the next free port instead, which reads fine in the startup
  banner and then silently splits you in two: a second editor answers on 8081 while the
  browser tab still points at 8080, and the two disagree about what is on disk.
- **Nothing is cached** (`Cache-Control: no-store`), and the page carries a build stamp it
  checks against `/api/status` on load. A page restored from the browser's disk cache shows
  a banner saying so instead of coming up half-broken with no map. If in doubt, open the
  editor on `http://127.0.0.1:<port>/` rather than `localhost` - the browser caches the two
  as separate origins, so that sidesteps a stale entry without a hard reload.
- **The server binds `127.0.0.1` only** and refuses API calls from another origin. It writes
  files and runs the installer, so it must not be drivable by an arbitrary page in your browser.
  `server.ps1` sent `Access-Control-Allow-Origin: *`.
- **Static paths are contained** inside `editor/`. The original joined the request path
  onto the root without checking, so `..` escaped the directory.
- **The editor reads the live map files.** It imports `maps/europe-raster.js` and the chosen
  `maps/*-geo.js` over HTTP instead of a generated `default-maps.js` snapshot, so it cannot
  drift from the mod. The old copies had fallen nine passes behind (`narrowStraits`, the
  connected-landmass regions, `flatAreas`, `hillAreas`, `lowAreas`, `roughAreas`, `passes`,
  `shallowLines`), which made the canvas draw a map the game would never generate.
- **Saving patches the file instead of regenerating it** - see [Editing maps in the editor](EuropeMediterranean/README.md#editing-maps-in-the-editor).
- **Output files are written without a UTF-8 BOM** (the PowerShell scripts emitted one).
- **`release.sh` bumps the version and installs**, leaving publication to git; `release.ps1` also
  writes a local archive next to the mod folder.
- `robocopy /MIR` becomes `rsync -a --delete`; `.DS_Store` and `._*` are excluded everywhere.

---

## Version control

This repository uses [jj (Jujutsu)](https://jj-vcs.github.io/jj/) rather than git directly. It was
created with a plain `jj git init`, so there is no top-level `.git` directory and raw `git` commands
will not work in a local checkout made this way. Contributors cloning from GitHub with `git` are
unaffected.

```bash
jj status
jj describe -m "message" && jj new
jj bookmark set main -r @- && jj git push --bookmark main
```

`.gitignore` keeps local build output and scratch files out of the repository. Nothing binary has
ever been committed here; the largest tracked file is a generated preview page at ~105 KB.
