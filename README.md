# civ7mods — Civilization VII mods

Two mods live here, each in its own folder with a `.modinfo` inside:

| Folder | Mod | Status |
|---|---|---|
| `EuropeMediterranean/` | Europe & Mediterranean map scripts (this page) | released |
| `Byzantium/` | Byzantium, an Exploration Age civilization (Rome and Greece lead to it); also playable Time-Tested from an Antiquity or Modern start, listed as "Eastern Roman Empire" in Antiquity with its own Late Roman kit (Clibanarii, Liburna, Cistern and Milion forming the Mese) | version 1, see [Byzantium](#byzantium) below |
| `Etruscans/` | The Etruscans, an Antiquity Age civilization of engineers and banqueters, with Lars Porsenna of Clusium | version 1, see [Etruscans](#etruscans) below |
| `Tuscany/` | Tuscany, an Exploration Age civilization of bankers, navigators and painters, with Lorenzo il Magnifico and the Maestri | version 1, see [Tuscany](#tuscany) below |

Further civilizations follow the recipe in `.claude/skills/new-civilization/`.

# Europe & Mediterranean — a map mod for Civilization VII

Map scripts covering the Mediterranean basin and Europe: Urals to Iceland, Morocco to the Sinai.
Three map types, historical start locations, and a browser-based geography editor with live preview.

Current mod version: **52**.

Project page with screenshots and the map types explained: https://marcobonechi.github.io/civ7mods/europe-mediterranean/
(source in `docs/europe-mediterranean/index.html`; the `docs/` landing page lists all mods; GitHub Pages must serve the `docs` folder of `main`).

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
the three map types below.

The three civilization mods also ship a binary art package each (`<Mod>/dlc/<Mod>Art/`), which is
what puts their unique buildings and the Hagia Sophia on the map. The game finds art packages only
inside its own install, so the install scripts mirror each one into `<game>/DLC/<Mod>Art/`. That is
the one thing installed outside the Mods folder; set `CIV7_GAME_ROOT` if the game is not in a
default Steam library.

### Removing the mods

`uninstall.ps1` (Windows) removes every mod folder this repository installs, together with the art
packages it mirrored into the game's `DLC/`. It never touches shipped game content: a `DLC/` folder
is removed only when this repository declares an art package of that name *and* the installed copy
carries the matching `.dep`. Run it with `-DryRun` to list what it would remove without removing
anything, or name a single mod (`uninstall.ps1 Byzantium`). Restart the game afterwards.

---

## The three maps

All three offer the same three grids: **112x98 (Standard), 128x112 (Large), 144x126 (Huge)**.

| Map type | Extent | Distant Lands | Geography file |
|---|---|---|---|
| Europe, Mediterranean & Sahel (Large, Distant Lands) | Urals–Iceland, Morocco–Sinai, 10N–71N | Africa, Scandinavia, Iceland | `maps/europe-large-geo.js` |
| Europe, Mediterranean & Sahel (Large, One Landmass) | identical geography | none | `maps/europe-large-geo.js` |
| Europe & Mediterranean (Variant) | identical geography, separate copy to reshape freely | Africa, Scandinavia, Iceland | `maps/europe-alt-geo.js` |

`maps/europe-map.js` and `maps/europe-geo.js` (the original smaller-extent map on the base game's
sizes) are still in the repo but are no longer registered in `config/config.xml`, so they do not
appear in the map picker.

The two Large variants share all their geography and generation code (`maps/europe-large-core.js`);
they differ only in `distantLandsAnchors`. Pick **Distant Lands** for the full Exploration Age —
Africa sits across the Mediterranean, so treasure fleets and the distant-lands legacy paths work.
Pick **One Landmass** if you would rather reach every civilization overland from turn one; the
cost is that the Exploration Age Economic (treasure) and Military legacy paths cannot score,
because both award victory points only in distant lands.

Note: the engine takes the grid from the map-size database rows (`data/maps.xml`), not from the
map script, so the first map renders on whatever standard size is picked and the large map declares
its own three sizes.

The large map (`maps/europe-large-geo.js`, `maps/europe-large-map.js`) adds the Sahel, Ethiopia and
Arabia, compresses the Arctic and the Sahara vertically (piecewise latitude mapping), trims the Atlantic
on the left, makes Russia north of ~57N taiga with a cold mixed-forest band down to ~53N, and adds
true starts for Aksum (Axum) and Songhai (Gao). Its fallback ranking favours Morocco and Scandinavia.

---

## How it works

- `maps/europe-geo.js` holds the geography as longitude/latitude data: coastlines, inland seas,
  straits, lakes, mountain ranges, biome and rainfall zones, volcanoes, and true start locations.
- `maps/europe-raster.js` projects that data onto the hex grid at generation time (any grid size).
- `maps/europe-map.js` applies the grid through the engine and then runs the base-game generators
  for rivers, natural wonders, features, resources and discoveries.

Distant Lands: landmass regions are assigned to whole water-separated landmasses, never by
longitude. The engine treats a region change as a distant-lands boundary, so a boundary running
through connected land is an invisible wall: land units cannot cross it and the civilizations
beyond it cannot be contacted until the Exploration Age. On the large map three landmasses are Distant Lands: Africa (across the Mediterranean and the Suez channel), Scandinavia with Finland (cut from Russia by the Karelian passage, a one-hex channel from the Gulf of Finland through Ladoga and Onega to the White Sea), and Iceland, plus two small Atlantic islets west of France. Denmark stays in the home lands. The standard map has no anchors: north of 27.5N Europe, North Africa and the Near East form one
connected landmass, so it runs as a single region and the Exploration Age distant-lands and
treasure mechanics do not apply there.

## Start locations

Start tiles are validated against the feature database before use: a tile carrying an impassable or
non-removable feature (ice, a volcano, a natural wonder) is rejected and the search moves outwards,
and a removable feature such as forest or marsh, or a resource (resources are generated before
starts are assigned), is cleared from the tile finally chosen, so a settler can always found on the spot.
Floodplains are kept. Because an urban district cannot be placed on a resource tile, the ring around
every start is opened as well: at least three resource-free land hexes adjacent and five within two
hexes, clearing resources nearest-first where the map is dense. Historic sites that no player starts on
(Constantinople in an Antiquity game, for example) get the same treatment, so they can be settled later. Every placed start is then re-checked, and the game's console log reports any
start that is not foundable or that sits away from its coordinates, plus a summary line
(`Europe map: N starts placed, M on their exact tile, max shift K hex(es)`).

Every true start is also given workable food. Within `tslFoodRadius` (2 hexes) the poorest land is
raised towards flat grassland until `tslFoodMin` (5) high-food tiles are present; biomes are lifted
first and hills flattened only if that was not enough, and never more than half the ring, so small
islands such as Iceland keep their shape. On the large map this changes about 36 tiles, under 0.5%
of the land.

Civilizations from the region start at historical sites (Rome, Athens, Memphis, Carthage, Nineveh,
Susa, Pliska, Toledo, Rouen, Baghdad, Bursa, Reykjavik, Tehran, Sarai, Algiers, Paris, Berlin,
Moscow, London). Other civilizations are placed on curated sites (81 of them: Kyiv, Krakow, Budapest, Uppsala,
Dublin, Lisbon, ...) as far apart as possible. The Sahel, the Horn of Africa and the Ukrainian
steppe carry their own sets so those regions are not left empty when off-map civilizations play.

---

## Editing and previewing

1. Edit `EuropeMediterranean/maps/europe-large-geo.js` (large maps) or `europe-geo.js` (first map).
   All shapes are plain `[lon, lat]` lists in degrees (east and north positive); widths and radii
   are in hex tiles.
2. Rebuild the previews with `./preview/build-preview.sh --open` (Windows: `preview\build-preview.ps1 -Open`).
   It writes `preview/europe-large.html` and `preview/europe.html`; open them in any browser. Mouse
   wheel zooms at the cursor, drag pans, the +/−/fit buttons do the same, and hovering a hex prints its
   grid coordinates, longitude/latitude, terrain, biome, rainfall, region, start and volcano. Zoomed in
   past about 2x the hex coordinates are drawn on the map. Append `?w=128&h=112` to the URL to preview
   another grid size, `?seed=7` for a different random roll. Screenshot mode: `?shot=1&cw=1600&ch=1100&view=lon0,lat0,lon1,lat1&regions=1&title=...`
   hides the toolbar, frames a lon/lat box, tints home/distant lands and prints a caption (`preview/shots.ps1` uses it). Below the picture is a text dump of the grid:
   `.` ocean, `,` coast, `V` planned river course, `^` mountain, lowercase = flat, uppercase = hills, with
   `g` grassland, `p` plains, `d` desert, `t` tundra, `r` tropical.
3. Install with `./install.sh` and restart the game (mods are read at startup only).
4. Share it: see [Releasing](#releasing).

There is also an interactive editor — `./run-editor.sh` starts a local server at
http://localhost:8080 and opens a browser. See *Editing maps in the editor* below.

### What the geography file contains (large map)

| Key | What it is |
|---|---|
| `lonCenter`, `spanRef`, `latRef`, `scaleExp` | projection: centre longitude, degrees of longitude across the map at `latRef`, polar widening |
| `latControl` | `[latitude, row fraction]` pairs: how many rows each latitude band gets |
| `southWarp.zones` | per-longitude remaps of latitudes below 33N (Africa squeezed/stretched by region) |
| `lonSqueeze` | `{from, k}`: east of `from` each column covers `k` degrees |
| `bottomWater`, `leftWater` | forced sea lanes along the bottom / left edge |
| `land` | coastline polygons (mainland first, then islands) |
| `landBlobs`, `landBlobsLate` | small islands `[lon, lat, radius, name]` (late = painted after the straits) |
| `water` | inland seas painted over land (Caspian, Persian Gulf, Red Sea, Marmara) |
| `waterLines` | straits kept open as one-hex water lines |
| `lakes` | `[lon, lat, radius, name]` |
| `shallow` | polygons where all water is coast (sailable in Antiquity) |
| `ranges` | mountain ranges: polyline, `core` radius (mountains), `fringe` radius (hills) |
| `biomeAreas` | biome overrides in order; add `prob: 0.4` for random patches (`G` grassland, `P` plains, `D` desert, `T` tundra, `R` tropical) |
| `rainAreas` | rainfall overrides (more rain = more forest/jungle features) |
| `biomeBlobs` | circular biome patches `[lon, lat, radius, biome, rainfall, name]` (oases) |
| `rivers` | navigable river courses as `[lon, lat]` lists; each becomes a hex-connected flat valley that is drenched in rainfall while the engine models rivers, so the engine's own navigable rivers follow it (painting river terrain directly only looks like a river: the engine keeps no river data for it) |
| `rivers[].strength` | optional 0..1 (default 1) scaling the rainfall poured along that course. Lower values make the engine much less likely to pick the river as navigable, while still carving its flat valley. Currently: Tiber 0.2, Garonne 0.35, Don 0.35 |
| `resourceAreas` | (large map) historical resources per region: polygon, resource types, `density` = hexes per resource; placed in-game after the engine's random pass, which is then thinned or topped up to a 20% share |
| `resourceScale` | (large map, optional) multiplies every area's `density`; 1.5 places a third fewer resources everywhere, 0.8 a quarter more |
| `resourceAreas[].fill` | catch-all area (the two open-sea areas): places only on hexes no specific area of the same kind covers, so no hex is under more than two areas (`node tools/resource-overlap.mjs large` checks) |
| `hillAreas`, `passes`, `flatAreas`, `roughAreas` | mountains→hills in areas / along corridors, hills→flat, flat→hills (optional `biome`) |
| `lowAreas` | hills and mountains→flat inside polygons, applied after every other terrain step (the Asian shore of the Bosporus) |
| `shallowLines` | corridors where ocean becomes shallow coast (island hopping) |
| `lonSqueeze`, `lonSqueezeWest` | horizontal squeezes east / west of a longitude |
| `volcanoes` | `[lon, lat, name]` |
| `tsl` | true start location per civilization type |
| `fallbackSites` | ranked start sites for civilizations without a true start |
| `hexPatches` | single-hex overrides: `{ lon, lat, land?, terrain?, biome?, rain?, name? }`. Only the fields you give are pinned. `land` is applied before the coast, mountain and Distant Lands passes so the shape change is seen everywhere; `terrain`, `biome` and `rain` are applied after the biome blobs and before the rivers, so a river still carves through. Written by Hex Edit in the editor |

---

## Releasing

`./release.sh <Folder>` bumps the version in that mod's `.modinfo` and installs the result locally.
Distribution goes through this repository, so publishing a version means pushing the commit and
tagging it:

```bash
./release.sh EuropeMediterranean            # bump version + install
./release.sh EuropeMediterranean --no-bump  # reinstall at the current version
```

Then commit, push, and cut a GitHub release for the new version. Players update with `git pull`
followed by `./install.sh`.

---

## Toolchain

The build and editor scripts were originally written for Windows PowerShell. The macOS/Linux ports
sit alongside them; the originals are left in place, so the repo still works on Windows.

**The visual map editor now works on macOS.** `./run-editor.sh` is a full port of the Windows
launcher and server, and the editor itself has been brought back in line with the mod: it renders
through the mod's own rasterizer rather than a stale copy of it, saving patches the geography file
instead of regenerating it (so nothing is silently dropped), the file being edited is chosen with
`--map` or from a dropdown, and single hexes can be edited directly with **Hex Edit**. See
[Editing maps in the editor](#editing-maps-in-the-editor).

| Windows | macOS / Linux | What it does |
|---|---|---|
| `run-editor.ps1` / `open-editor.bat` | `./run-editor.sh` | starts the editor server and opens the browser |
| `editor/server.ps1` | `editor/server.py` | the companion HTTP server |
| `install.ps1` | `./install.sh` | mirrors every mod folder (or the named ones) into the Civ VII Mods folder |
| `release.ps1` | `./release.sh` | bumps one mod's version and installs it |
| *(none)* | `tools/check-mod.py` | static checks for a mod folder: XML syntax, modinfo file list, text tags and type ids against the game data |
| *(none)* | `tools/check-map-sizes.mjs` | generates every grid size the mod ships and checks land share, Distant Lands split, start positions, sea connectivity and that the islands stay islands |
| `preview/build-preview.ps1` | `preview/build-preview.sh` | rebuilds the standalone preview pages |
| `preview/shots.ps1` | *(not ported)* | renders showcase PNGs of the large map into `EuropeMediterranean/screenshots/` with headless Edge (global, home/distant lands, regional close-ups) |
| `editor/build-defaults.ps1` | *(no longer needed)* | the editor imports `maps/*-geo.js` live; there is no generated snapshot to rebuild |
| `editor/setup-launchers.ps1` | *(not ported)* | one-off Windows workspace bootstrap, hardcoded `C:\` paths |

```bash
./run-editor.sh                 # editor at http://localhost:8080
./run-editor.sh --map europe-alt-geo.js   # open this map instead of the first one
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
- **Saving patches the file instead of regenerating it** - see *Editing maps* below.
- **Output files are written without a UTF-8 BOM** (the PowerShell scripts emitted one).
- **`release.sh` bumps the version and installs**, leaving publication to git; `release.ps1` also
  writes a local archive next to the mod folder.
- `robocopy /MIR` becomes `rsync -a --delete`; `.DS_Store` and `._*` are excluded everywhere.

### Editing maps in the editor

`./run-editor.sh` serves the editor at http://localhost:8080. It lists every `*-geo.js` in
`EuropeMediterranean/maps` in the dropdown at the top; `--map europe-alt-geo.js` picks which
one opens first. Switching maps warns if the current one has unsaved changes.

Two things make it safe to save from:

- **It renders the real map.** The page imports `maps/europe-raster.js` and the chosen geography
  module over HTTP, so the canvas runs the same passes the game does. It used to carry its own
  copy of the rasterizer, which had drifted nine passes behind.
- **Saving patches, it does not regenerate.** The page keeps the text it loaded and rewrites only
  the smallest spans whose value actually changed, so moving one lake rewrites one
  `[lon, lat, r, name]` and leaves the other 28 - and every comment in the file - byte for byte
  as they were. The badge next to the map name names the top-level keys a save would touch.
  Keys the editor does not model are never at risk, because they are never rewritten.

  The old serializer rebuilt the whole file from an allow-list of keys it knew, so on every save
  it silently dropped `distantLandsAnchors`, `narrowStraits`, `flatAreas`, `hillAreas`,
  `lowAreas`, `roughAreas`, `passes`, `shallowLines`, `resourceAreas`, `wonders`,
  `requestedWonders`, `baseHillProb` and `lonSqueezeWest`, along with every comment and optional
  per-item field (`strength` on a river, `coastDist` on a shallow area). That is Distant Lands,
  the one-hex Bosphorus, Italy's flatness, the natural wonders and every resource area.

**Hex Edit** (the `⬡ Hex Edit` button, or `H`) turns clicks into hex picks instead of feature
picks. Click any hex and the panel shows its terrain, biome, rainfall, land/water and region;
set any of those and *Pin this hex* writes a `hexPatches` entry at that hex's own centre. The
map redraws immediately and the panel re-reads the result, so you see what the generator
actually produced rather than what you asked for. *Remove patch* takes it back out. Feature
editing (dragging coastlines, rivers, ranges) works as before with the mode off.

**Save** (leftmost in the toolbar, or Ctrl+S) writes the file in
`EuropeMediterranean/maps` and nothing else. **Install to Game** is the separate step that
rsyncs the whole mod into Civ VII's Mods folder, and it copies what is on disk - so save
first. The game only reads mods at startup, so restart it afterwards.

Undo works after a save: it rolls the map back and the badge lights up again, so saving once
more writes the rollback to the file. A collection the editor created from nothing
(`hexPatches`) is written back as `[]` rather than deleted, keeping the file's key set stable.
The previous contents are always kept as `<file>.bak`.

`node editor/test-geo-io.mjs` checks all of that against every `*-geo.js` in the maps folder:
the key spans match what the module exports, a no-op save is byte-identical, an edit rewrites
only the keys it touched, the thirteen keys above survive, and no comment is lost. Run it after
changing anything in `editor/js/geo-io.js`.

`/api/save` writes to `EuropeMediterranean/maps` only, keeps the previous contents as
`<file>.bak`, and refuses the write outright if the incoming text has lost a top-level key the
file on disk has. The `EuropeMediterranean - Copy` mirror was removed in 2026-09; `--no-mirror`
is accepted and ignored.

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

---

# Byzantium — a civilization mod for Civilization VII

An Exploration Age civilization that can also be picked at an Antiquity or Modern start. Install
`Byzantium/` like the map mod (`./install.sh Byzantium`); with the map mod installed it starts at
Constantinople on all four Europe maps.

| Item | What it is |
|---|---|
| Ability: Queen of Cities | +1 Influence and +1 Gold per Great Work displayed in a settlement; +3 Combat Strength when defending your districts and +20 district health where a fortification stands; +30% Production toward Hagia Sophia |
| Cataphract | Cavalry line replacing Courser, Knight and Lancer (+2 Combat Strength, +3 against infantry); an Antiquity variant replaces the Horseman |
| Dromon | Replaces the Cog (Greek fire: +5 against naval units); an Antiquity variant replaces the Galley |
| Augustaion | Unique quarter of Hippodrome (Culture) and Great Palace (Influence): +2 Happiness per Great Work displayed in the city |
| Hagia Sophia | Associated wonder: +4 Culture, +2 Influence, 3 Great Work slots, a Relic on completion |
| Civics | Themata, Pentarchy, Porphyrogennetos, each with a tradition; Test of Time nodes for Antiquity and Modern |
| Unlocks | From Rome and Greece, or with Augustus, Catherine, Charlemagne, Xerxes; in Antiquity by holding Ancient Walls in three settlements. Leads to Russia (and the Ottomans when that DLC is present) |

Antiquity (Time-Tested) uniques: the Clibanarii (heavy cavalry on the Horseman, Iron Working), the Liburna (fast
galley on the Galley, Sailing), and the Cistern and Milion, which form the Mese quarter (Gold per settlement); the
Origins civic unlocks the buildings and the Themata I and Foederati traditions. Exploration uniques: Cataphract,
Dromon, Hippodrome and Great Palace (Augustaion), Hagia Sophia. Unique units and buildings borrow the models of the base units and buildings they replace
(`data/visual-remaps.xml`). Icons: the default set in `Byzantium/icons/` mixes the painted eagle
and building medallions (cut from a concept sheet, kept in `icons-alt/`) with vector unit
silhouettes (`icons-vector/`, sources in `icons/src/`); `tools/switch-icons.sh Byzantium alt|vector|mixed`
swaps between them; all icons are 256 px, and `portrait_*.png` are full-colour unit portraits awaiting the
unit-panel hook described in `plans/byzantium-art.md`. `Byzantium/dlc/ByzantiumArt/` is a binary art package
(a `.dep` plus `Platforms/<OS>/BLPs/StandardAsset.blp`, identical bytes for Mac and Windows) that gives Hagia
Sophia its own wonder art, copied from the Blue Mosque's attachment set, and renders the Hippodrome with the
Arena's model; it was built with Smayo's Civ Art
Tools from `Byzantium/dlc/civart.json`, and `install.sh` / `install.ps1` mirror it into the game install's
`DLC/` folder because the engine only looks for art packages there (set `CIV7_GAME_ROOT` if the Steam
library is elsewhere). The modinfo switches it on with `<UpdateArt><Item>ByzantiumArt</Item></UpdateArt>`
in both scopes. `Byzantium/loading/` holds the painted loading screen (1080 and 720 variants) and the
civilization-select card; the `source-*.png` files are the untouched generations. `lsbg_byzantium_emperor_1080.png` is an
alternate loading painting (emperor portrait); point `data/loading-info.xml` and the BACKGROUND rows in
`data/icons/icons.xml` at it to use it. Design notes and the verification record are in `plans/byzantium.md`; the recipe for the
next civilization is `.claude/skills/new-civilization/`.

---

# Etruscans — an Antiquity Age civilization

Twelve peoples between the Tiber and the Arno: engineering and the good life. Install `Etruscans/`
like the other mods (`./install.sh Etruscans`); with the map mod installed it starts at Populonia
on all four Europe maps. Pickable at an Exploration or Modern start too, listed there as
"Etruscans (Time-Tested)".

| Item | What it is |
|---|---|
| Ability: Disciplina Etrusca | +1 Production and +2 Happiness in every Settlement; +15% Production toward Buildings; +45% toward the Fanum Voltumnae |
| Biga | Replaces the Chariot: faster, stronger, +4 Combat Strength on flat ground |
| Tyrrhenian Galley | Replaces the Galley: +1 Movement, +1 Sight, +5 Combat Strength against ships |
| Spura | Unique quarter of Cuniculus (Food, Production) and Tumulus (Culture, Happiness): +1 Production, Culture and Happiness in this Settlement for every Settlement you own |
| Fanum Voltumnae | Associated wonder, the League's federal sanctuary: Culture, Influence per Settlement, a Relic on completion, 2 Great Work slots |
| Civics | Cuniculi, Dodecapolis, Haruspicina; six traditions, plus Test of Time nodes for Exploration and Modern |
| Leader: Porsenna | Militaristic + Scientific. Lars of Clusium: +2 Production in Cities, +20 Health on Districts with a Fortification, +3 Combat Strength defending one of your Districts |
| Unlocks | Leaders Porsenna and Augustus, or holding a Bath in three Settlements. Leads to the Normans, and to Tuscany when that mod is installed |

# Tuscany — an Exploration Age civilization

Economy, Discovery and Renaissance art. Install `Tuscany/` (`./install.sh Tuscany`); it starts at
Florence. Pickable at an Antiquity or Modern start as "Tuscany (Time-Tested)".

| Item | What it is |
|---|---|
| Ability: Rinascimento | +2 Gold and +1 Culture in every Settlement; +1 Culture per Great Work; +45% Production toward Santa Maria del Fiore |
| Maestro | A unique Great Person class, available once you have a Piazza. Ten named individuals: Leonardo (a free Technology), Raffaello, Michelangelo, Botticelli, Donatello, Brunelleschi, Dante, Machiavelli, Galileo, and Amerigo Vespucci (reveals the Distant Lands waters) |
| Condottiero | Replaces Swordsman, Man-at-Arms and Pikeman: +2 Combat Strength, +4 more when attacking |
| Galea di Santo Stefano | Replaces the Cog: +1 Movement, +1 Sight, +5 Combat Strength against ships |
| Piazza | Unique quarter of Bottega (Culture, a Great Work slot) and Banco (Gold, Influence): Gold and Culture per Settlement, Happiness per Great Work, and it is what makes the Maestro available |
| Santa Maria del Fiore | Associated wonder, Brunelleschi's dome: Culture, Gold, Happiness, Science, a Relic on completion, 3 Great Work slots |
| Civics | Mecenatismo, Umanesimo, Navigatori; eight traditions, plus Test of Time nodes for Antiquity and Modern |
| Leader: Lorenzo | Cultural + Economic. Il Magnifico: +2 Gold and +1 Happiness per Great Work, +1 Culture in every Settlement |
| Unlocks | Rome, Greece, or the Etruscans when that mod is installed; leaders Lorenzo, Machiavelli, Isabella, Ibn Battuta; or holding a Bank in three Settlements. Leads to America (Amerigo Vespucci's hemisphere) and the French Empire |

## Notes on both

- **They know about each other, but neither needs the other.** The Etruscans-to-Tuscany link lives
  behind `ModInUse` / `ModIsEnabled` criteria in both modinfos, so either folder installs alone.
- **Central Italy is crowded.** The map script keeps starts apart — five hexes on the standard
  grids, eight to ten on the large ones — and no Etruscan city is that far from Rome; Italy is
  barely three hexes wide at the smaller sizes. Etruria starts at Populonia, which is the furthest
  any of its cities gets (two hexes from Rome on Tiny, six on the largest grid) without landing on
  top of Florence the way Volaterrae would. When Rome is also in play one of the two still takes a
  fallback site; Populonia, Tarquinia and Florence are all in the fallback list, so a displaced
  player stays in Italy. Etruria and Tuscany are meant to be played one after the other rather
  than side by side.
- **Art is placeholder.** Icons and loading screens are flat generated PNGs
  (`tools/make-icons.py`, `tools/make-backgrounds.py`); units and wonders borrow the models of what
  they replace through `data/visual-remaps.xml`. Buildings cannot: a `VisualRemap`'s `To` has to
  name something in the art data, and unit and wonder assets are named after their type while a
  building's model is chosen by a rule in `BIN_Hero_Building_Footprint` keyed on
  `[BUILDING:<type>]`. So each mod ships a small binary art package
  (`Tuscany/dlc/TuscanyArt/`, `Etruscans/dlc/EtruscansArt/`, ~40 KB, no geometry of its own) that
  adds those rules: the Bottega renders as the Guildhall and the Banco as the Bank, the Cuniculus
  as the Bath and the Tumulus as the Mastaba. Rebuild either with
  `python3 tools/build-art.py Tuscany Etruscans`, and check a deployed one with
  `tools/check-art.py <Mod>`. Because it is an art package it installs into the game's `DLC/`
  folder rather than `Mods/` — the install scripts do that, and `uninstall.ps1` removes it.
- **The shell finds that art through a UI script.** `ui/<mod>-images.js` rewrites the
  naming-convention lookups the shell uses for civ and leader art (`bg-panel-<civ>`,
  `bg-card-<civ>`, `civ_sym_<civ>`, `lp_circ_<leader>_256` and the rest) to the
  `fs://game/<modid>/<file>` URLs a mod can actually serve. It hooks the CSSOM and Image
  prototypes rather than watching the DOM, because a MutationObserver does not see programmatic
  style changes here and the age-transition screens assign `style.backgroundImage` directly. The
  same file, with a different CONFIG block, is in all three civ mods and they share one set of
  hooks. `plans/byzantium-art.md` §4 has the detail.
- **The leaders borrow a persona.** A mod cannot add a leader model: the shell asks the engine for
  `<LEADER_TYPE>_GAME_ASSET` and falls back to a generic one. `Leaders.BasePersonaType` points
  Porsenna at Xerxes and Lorenzo at Machiavelli, which is the mechanism Firaxis's own alternate
  personas use; whether it carries the model through is the first thing to check in game.
- Design sheets, the running work log, and the art brief with a generation prompt for every PNG:
  [`plans/etruscans.md`](plans/etruscans.md), [`plans/tuscany.md`](plans/tuscany.md),
  [`plans/etruscans-tuscany-log.md`](plans/etruscans-tuscany-log.md),
  [`plans/etruscans-tuscany-art.md`](plans/etruscans-tuscany-art.md).
