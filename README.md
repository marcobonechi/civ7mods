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

---

## The three maps

| Map type | Extent | Distant Lands | Grids |
|---|---|---|---|
| Europe & Mediterranean | Urals–Iceland, Morocco–Sinai (27.5N–71N) | none (one landmass) | standard sizes (Tiny 60x38 ... Huge 106x66) |
| Europe, Mediterranean & Sahel (Large, Distant Lands) | same west/east, but 10N–71N | Africa | 112x98, 128x112, 144x126 |
| Europe, Mediterranean & Sahel (Large, One Landmass) | identical geography | none | 112x98, 128x112, 144x126 |

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
   another grid size, `?seed=7` for a different random roll. Below the picture is a text dump of the grid:
   `.` ocean, `,` coast, `V` planned river course, `^` mountain, lowercase = flat, uppercase = hills, with
   `g` grassland, `p` plains, `d` desert, `t` tundra, `r` tropical.
3. Install with `./install.sh` and restart the game (mods are read at startup only).
4. Share it: see [Releasing](#releasing).

There is also an interactive editor — `./run-editor.sh` starts a local server at
http://localhost:8080 and opens a browser. It reads and writes the geography files directly.

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

| Windows | macOS / Linux | What it does |
|---|---|---|
| `run-editor.ps1` / `open-editor.bat` | `./run-editor.sh` | starts the editor server and opens the browser |
| `editor/server.ps1` | `editor/server.py` | the companion HTTP server |
| `install.ps1` | `./install.sh` | mirrors every mod folder (or the named ones) into the Civ VII Mods folder |
| `release.ps1` | `./release.sh` | bumps one mod's version and installs it |
| *(none)* | `tools/check-mod.py` | static checks for a mod folder: XML syntax, modinfo file list, text tags and type ids against the game data |
| `preview/build-preview.ps1` | `preview/build-preview.sh` | rebuilds the standalone preview pages |
| `editor/build-defaults.ps1` | `editor/build-defaults.sh` | regenerates `editor/js/default-maps.js` |
| `editor/setup-launchers.ps1` | *(not ported)* | one-off Windows workspace bootstrap, hardcoded `C:\` paths |

```bash
./run-editor.sh                 # editor at http://localhost:8080
./run-editor.sh --port 9000     # different port
./run-editor.sh --no-open       # don't launch a browser
./run-editor.sh --no-mirror     # skip the ' - Copy' mirror (no-op now it is gone)

./install.sh                    # install every mod into the game
./install.sh Byzantium          # install one mod
./release.sh EuropeMediterranean  # bump version + install
python3 tools/check-mod.py Byzantium   # before installing a data mod
./preview/build-preview.sh --open
./editor/build-defaults.sh
```

**Requirements:** `python3` (server) and `rsync`, both of which ship with macOS. No third-party packages.

### Deliberate differences from the PowerShell originals

- **The server binds `127.0.0.1` only** and refuses API calls from another origin. It writes
  files and runs the installer, so it must not be drivable by an arbitrary page in your browser.
  `server.ps1` sent `Access-Control-Allow-Origin: *`.
- **Static paths are contained** inside `editor/`. The original joined the request path
  onto the root without checking, so `..` escaped the directory.
- **`build-defaults.sh` finds the maps folder** at `../maps` *or* `../EuropeMediterranean/maps`.
  The PowerShell version only handled the first, which is why it silently read the stale
  `EuropeMediterranean - Copy` geography once `editor/` moved to the project root.
- **Output files are written without a UTF-8 BOM** (the PowerShell `build-defaults.ps1` emitted one).
- **`release.sh` bumps the version and installs**, leaving publication to git; `release.ps1` also
  writes a local archive next to the mod folder.
- `robocopy /MIR` becomes `rsync -a --delete`; `.DS_Store` and `._*` are excluded everywhere.

### Note on the mirror save

`/api/save` writes to `EuropeMediterranean/maps`, and also to `EuropeMediterranean - Copy/maps`
if that folder is ever recreated (matching the Windows behaviour). That folder was removed in
2026-09, and everything it held is superseded by the current tree. With it gone, saves go to the
primary folder only and `--no-mirror` is a no-op.

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
  (`tools/make-icons.py`, `tools/make-backgrounds.py`); units, buildings and wonders borrow the
  models of what they replace through `data/visual-remaps.xml`. Neither mod ships a binary art
  package, so neither touches the game install.
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
