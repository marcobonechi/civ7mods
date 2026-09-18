# Europe & Mediterranean — a map mod for Civilization VII

Map scripts covering the Mediterranean basin and Europe: Urals to Iceland, Morocco to the Sinai.
Four map types in two pairs, historical start locations, and a browser-based geography editor with live preview.

Current mod version: **61**.

Project page with screenshots and the map types explained: https://marcobonechi.github.io/civ7mods/europe-mediterranean/
(source in `docs/europe-mediterranean/index.html`; the `docs/` landing page lists all mods; GitHub Pages must serve the `docs` folder of `main`).

---

Installing, game versions, the toolchain, version control and releasing are shared by every mod in this repository and described in the [main README](../README.md). Commands below are run from the repository root.

---

## The four maps

All four offer the same three grids: **112x98 (Standard), 128x112 (Large), 144x126 (Huge)**.

| Map type | Extent | Distant Lands | Geography file |
|---|---|---|---|
| Europe & Mediterranean (Distant Lands) | Urals–Iceland, Morocco–Sinai, 10N–71N | Africa, Scandinavia, Iceland | `maps/europe-large-geo.js` |
| Europe & Mediterranean (One Landmass) | identical geography | none | `maps/europe-large-geo.js` |
| Eurasia Compressed | Russia, the North Caucasus and the Caspian become an Eastern Ocean; China, Korea, Mongolia and Japan fill the space; the Suez Canal at Suez | none | `maps/europe-alt-geo.js` (files keep the old `europe-alt` name) |
| Eurasia Compressed (Distant Lands) | identical geography | East Asia, Scandinavia, Iceland | `maps/europe-alt-geo.js` |

`maps/europe-map.js` and `maps/europe-geo.js` (the original smaller-extent map on the base game's
sizes) are still in the repo but are no longer registered in `config/config.xml`, so they do not
appear in the map picker.

The Distant Lands and One Landmass maps share all their geography (`maps/europe-large-geo.js`) and
generation code (`maps/europe-large-core.js`). One Landmass is derived from the same geography by
`oneLandmassGeo()` in `maps/europe-raster.js`, which empties `distantLandsAnchors` and drops every
`waterLines` entry marked `separatesDistantLands: true` - the Karelian passage, so Finland joins
Russia, and the Palestine channel, so Egypt joins the Levant over Sinai. Those channels exist only to
cut the land into Distant Lands; with no distant lands they would be an arbitrary sea. So an edit to
the geography reaches both maps, and the one place they differ is that flag. `tools/check-map-sizes.mjs`
and `tools/check-rivers.mjs` build both maps the way the game does and check that the two joins are
sea on Distant Lands and land on One Landmass. Pick **Distant Lands** for the full Exploration Age —
Africa sits across the Mediterranean, so treasure fleets and the distant-lands legacy paths work.
Pick **One Landmass** if you would rather reach every civilization overland from turn one; the
cost is that the Exploration Age Economic (treasure) and Military legacy paths cannot score,
because both award victory points only in distant lands.

**Eurasia Compressed** reads `maps/europe-alt-geo.js`, and so does its twin: `europe-alt-map.js` passes it
through `oneLandmassGeo()` (no Distant Lands), `europe-alt-distant-map.js` uses its anchors as they stand
(East Asia, Scandinavia, Iceland). That file is **generated** from `maps/europe-large-geo.js` by
`tools/eurasia-compressed/build.mjs`, so the four maps share one geography:

- **Shared ground** - Italy, the Alps, France, Africa, everything the two pairs have in common - is edited
  in `europe-large-geo.js`, and reaches all four maps. The map editor rebuilds the Eurasia file every
  time it saves `europe-large-geo.js`, and refuses to save into the generated file.
- **What only the Europe & Mediterranean maps have** - Russia, the Caspian, the steppe - is edited in
  `europe-large-geo.js` too, and stays out of Eurasia: the build leaves out the named Russian entries,
  and drops (and reports) anything else it finds under the Eastern Ocean or on East Asia, so a lake
  added near Moscow never appears there.
- **What only the Eurasia maps have** - the Eastern Ocean, East Asia fitted from real coastlines, its
  ranges, rivers, biomes, resources and starts, the Suez canal - lives in the build script.

```bash
node tools/eurasia-compressed/build.mjs && ./preview/build-preview.sh
```

`tools/check-map-sizes.mjs` fails if the Eurasia file is out of date with the Europe file.

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
- `maps/europe-large-core.js` applies the grid through the engine and then runs the base-game
  generators for natural wonders, features, resources and discoveries.
- `maps/europe-rivers.js` plans every river hex by hex - the drawn courses, a little per-game
  variance, and generated minor rivers - and the map script paints it with
  `TerrainBuilder.setRiverInfo()` and `finalizeRivers()`, the way the base game's Earth map does,
  instead of letting `modelRivers()` pick courses. `finalizeRivers()` drops any river hex that runs
  uphill and keeps only part of the navigable network (a different part each game), so the script
  first lowers only the river hexes that are not already downhill of the ones above them, by as
  little as needed, then after finalizing puts the plan back and sets navigable-river terrain itself.
  (Cutting navigable rivers to one elevation unit per hex from the sea, as the Earth map does, made
  every river a gorge.)
  `node tools/check-rivers.mjs` plans every map at every shipped size over several seeds and checks
  each river drains to the sea and runs downhill.

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

**Every playable civilization of every age has a true start**: 19 of 19 in Antiquity, 21 of 21 in
Exploration, 17 of 17 in Modern (Civilization VII 1.5 rosters). The game's own legacy table (`civilizations-legacy.xml`) runs Rome
to Great Britain, America, Prussia and France, and Greece to Russia. Civilization VII 1.5 added
Gaul, England and Babylon, which sit exactly where they belong, so the British line can now be
played from where it happened: Gaul on Lake Geneva, England on the Thames, then Great Britain or
America. Everywhere the game still leaves empty, a stand-in waits - the Mississippians at the
royal mounds of Gamla Uppsala, the Maya on the north European plain who become Prussia in Germany.
Only one age is ever live, so the ages share sites deliberately: Uppsala holds the Mississippians in
Antiquity and Meiji Japan in the Modern age, Warsaw the Shawnee in Exploration and the Mughals in
the Modern age, and London is England's and then Great Britain's.

Civilizations with no historical business in Europe are placed by terrain rather than by story, and
matched to their unlock conditions where those are geographic: Inca and Nepal in the Caucasus
(mountain settlements), Hawaii on Sicily (island settlements), Buganda in the Ethiopian highlands
(lakes). The full list, with the reason for every placement, is in `GEO.tsl` and in the mod
description, which `tools/module-description/build.py` generates from `GEO.tsl` in all twelve
languages and refuses to write if the two disagree.

Anyone left over is placed on a curated site - 95 of them, London and Dublin first, then Kyiv,
Uppsala, Fez, Krakow and the rest. Pass 2 caps its distance term at 12 hexes, and the sites near the
top of the list are all further than that from any Antiquity start, so that order alone decides who
gets settled; Britain leads it because the isles were otherwise empty in every Antiquity game. The
Sahel, the Horn of Africa and the Ukrainian steppe carry their own sets so those regions are not
left empty when off-map civilizations play.

---

## Editing and previewing

1. Edit `EuropeMediterranean/maps/europe-large-geo.js` - the geography all four maps share (see
   [Four maps, one geography](#four-maps-one-geography-where-to-edit-what) below for what goes where).
   All shapes are plain `[lon, lat]` lists in degrees (east and north positive); widths and radii
   are in hex tiles.
2. Rebuild the previews with `./preview/build-preview.sh --open` (Windows: `preview\build-preview.ps1 -Open`).
   It writes `preview/europe-large.html`, `preview/europe-alt.html` (Eurasia Compressed) and
   `preview/europe.html`; open them in any browser. Mouse
   wheel zooms at the cursor, drag pans, the +/−/fit buttons do the same, and hovering a hex prints its
   grid coordinates, longitude/latitude, terrain, biome, rainfall, region, start and volcano. Zoomed in
   past about 2x the hex coordinates are drawn on the map. Append `?w=128&h=112` to the URL to preview
   another grid size, `?seed=7` for a different random roll. Screenshot mode: `?shot=1&cw=1600&ch=1100&view=lon0,lat0,lon1,lat1&regions=1&title=...`
   hides the toolbar, frames a lon/lat box, tints home/distant lands and prints a caption (`preview/shots.sh`, or `shots.ps1` on Windows, uses it to retake `EuropeMediterranean/screenshots/`). Below the picture is a text dump of the grid:
   `.` ocean, `,` coast, `V` planned river course, `^` mountain, lowercase = flat, uppercase = hills, with
   `g` grassland, `p` plains, `d` desert, `t` tundra, `r` tropical.
3. Install with `./install.sh` and restart the game (mods are read at startup only).
4. Share it: see [Releasing](../README.md#releasing).

There is also an interactive editor — `./run-editor.sh` starts a local server at
http://localhost:8080 and opens a browser. See [Editing maps in the editor](#editing-maps-in-the-editor) below.

### Four maps, one geography: where to edit what

The mod ships four map types in two pairs, and they share one geography:

| Map type | Script | Geography |
|---|---|---|
| Europe & Mediterranean (Distant Lands) | `europe-large-map.js` | `europe-large-geo.js` as it stands |
| Europe & Mediterranean (One Landmass) | `europe-large-united-map.js` | the same, through `oneLandmassGeo()` |
| Eurasia Compressed | `europe-alt-map.js` | `europe-alt-geo.js`, through `oneLandmassGeo()` |
| Eurasia Compressed (Distant Lands) | `europe-alt-distant-map.js` | `europe-alt-geo.js` as it stands |

`oneLandmassGeo()` (in `europe-raster.js`) empties the Distant Lands anchors and drops every channel
marked `separatesDistantLands`, so each pair's two maps can never drift apart. And
**`europe-alt-geo.js` is generated**: `tools/eurasia-compressed/build.mjs` builds it from
`europe-large-geo.js`, leaves out what the Eastern Ocean replaces, and adds what is Eurasia's own.
Never edit it by hand - the next build overwrites it, and the map editor refuses to save it.

**What goes where:**

| You want to change... | Edit | It reaches |
|---|---|---|
| Anything the pairs share: Italy, the Alps, France, Africa, the Mediterranean, a shared start | `europe-large-geo.js` (by hand or in the editor), then rebuild Eurasia | all four maps |
| Russia, the Caspian, the steppe - land that only the Europe maps have | `europe-large-geo.js` | the Europe pair only: the build drops anything under the Eastern Ocean or on East Asia and says so |
| The Eastern Ocean's coast, East Asia's shape, ranges, rivers, biomes, resources, sites; the starts that move to East Asia; the Suez canal | `tools/eurasia-compressed/build.mjs` | the Eurasia pair only |
| Which Russian features Eurasia leaves out by name | `REMOVE` in `build.mjs` | the Eurasia pair |
| Which lands are Distant Lands | `distantLandsAnchors` in `europe-large-geo.js` (Europe pair) or `ANCHOR_COMMENT` / `ANCHORS` in `build.mjs` (Eurasia pair) | that pair |
| A start or a stand-in's reason in the mod description | `europe-large-geo.js` and `tools/module-description/` | the description (it lists the Europe maps' starts) |

**After editing, rebuild what is generated from it.** Everything below is derived, so it is rebuilt
rather than edited:

| Generated file | Built by | When |
|---|---|---|
| `maps/europe-alt-geo.js` | `node tools/eurasia-compressed/build.mjs` | after any edit to `europe-large-geo.js` or `build.mjs` (the editor runs it for you on save) |
| the mod description (modinfo, `text/en_us/ModuleText.xml`, `l10n/ModuleText.xml`) | `python3 tools/module-description/build.py` | after moving a start, changing a fallback site or the description's wording |
| `preview/*.html` | `./preview/build-preview.sh` | after any geography edit |
| `EuropeMediterranean/screenshots/*.png` | `./preview/shots.sh` (after the previews) | when the map has changed visibly |

**Then check it.** `node tools/check-map-sizes.mjs` builds all four maps at every size and fails if
`europe-alt-geo.js` is out of date, if a start lands too close to another, if the Distant Lands share
or a land connection the geography declares (`expectLand`) is wrong. `node tools/check-rivers.mjs`
plans every river on all four maps and fails if one runs uphill, through a mountain pass or onto a
start. `python3 tools/module-description/build.py --check` fails if the description no longer
matches the starts.

**Worked examples.**

- *Add a lake in Tuscany.* Draw it in the editor with the Europe file open and save: the save
  message says the Eurasia maps were rebuilt, and the lake is on all four maps.
- *Add a lake near Moscow.* Same steps: the save message says it was left out of Eurasia, because it
  sits under the Eastern Ocean. It appears on the Europe pair only.
- *Move a Japanese civilization's Eurasia start.* Edit `STARTS` in `build.mjs` (real longitude and
  latitude - the script fits them to the map), run `node tools/eurasia-compressed/build.mjs`, then
  `node tools/check-map-sizes.mjs`. Its Europe start is the `tsl` entry in `europe-large-geo.js`.
- *Reshape East Asia.* The fit is controlled by `LAT_ROWS` (real latitude to rows), `LEFT` (the moat
  on the west, per row), `EAST_LON`, `KNEE` and `GROW` (Korea and Japan enlarged) at the top of
  `build.mjs`; coastlines are the `MAINLAND` and `ISLANDS` point lists in real coordinates.
  Rebuild, then look at `preview/europe-alt.html`.

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
| `rivers` | river courses as `[lon, lat]` lists, drawn in either direction (the end on the sea, or failing that the end meeting another river, becomes the mouth). Each becomes a hex-connected flat valley carrying exactly that river, navigable from the mouth. Per game a course bends through a neighbouring hex here and there, its navigable stretch can end up to two hexes short of the head, and a short minor headwater can continue uphill. A course drawn a hex or so short of the coast is bridged to it |
| `rivers[].strength` | optional 0..1 (default 1). Below 0.5 the whole course is a minor river instead of a navigable one. Currently: Tiber 0.2, Garonne 0.35, Don 0.25 |
| `rivers[].navigable` | optional hex count: only that many hexes from the mouth are navigable, the rest of the course is a minor river. Currently: Po 2 |
| `rivers[].mouth` | optional `"first"` or `"last"`: which end of `pts` is the mouth. Needed when a river's source is a lake, which would otherwise be taken for the mouth and turn the river backwards (`tools/check-rivers.mjs` flags it). Currently: Blue Nile `"first"` |
| `riverAreas` | `{ name, minorShare, pts }` polygons scaling how many generated minor rivers may start inside (0.5 = half as many sources; drawn courses are unaffected). Currently: Ukraine 0.45 |
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

### Editing maps in the editor

`./run-editor.sh` serves the editor at http://localhost:8080. It lists every `*-geo.js` in
`EuropeMediterranean/maps` in the dropdown at the top; `--map europe-geo.js` picks which
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
`EuropeMediterranean/maps`. Saving `europe-large-geo.js` - labelled *shared by all four maps* in the
dropdown - also rebuilds `europe-alt-geo.js` for the Eurasia maps, and the save message says so and
names anything it left out of Eurasia because it lies under the Eastern Ocean. `europe-alt-geo.js`
can be opened to look at but not saved: it is generated (see
[Four maps, one geography](#four-maps-one-geography-where-to-edit-what)), so edit the Europe file or
`tools/eurasia-compressed/build.mjs` instead. **Install to Game** is the separate step that
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

## Before a release

Make sure everything generated is current and every check passes, then follow
[Releasing](../README.md#releasing) in the main README:

```bash
node tools/eurasia-compressed/build.mjs          # the Eurasia geography
python3 tools/module-description/build.py        # the mod description, twelve languages
./preview/build-preview.sh && ./preview/shots.sh # previews and screenshots
node tools/check-map-sizes.mjs && node tools/check-rivers.mjs && node editor/test-geo-io.mjs
```
