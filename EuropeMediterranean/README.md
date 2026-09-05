# Europe & Mediterranean map for Civilization VII

A map script covering the Mediterranean basin and Europe: Urals to Iceland, Morocco to the Sinai.

## Install

Copy this folder to `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\EuropeMediterranean`.
The game discovers and enables it on the next start. In game setup pick the map type
**Europe & Mediterranean**.

## Two maps

| Map type | Extent | Grids |
|---|---|---|
| Europe & Mediterranean | Urals–Iceland, Morocco–Sinai (27.5N–71N) | uses the standard map sizes (Tiny 60x38 ... Huge 106x66) |
| Europe, Mediterranean & Sahel (Large) | same west/east, but 10N–71N | its own sizes: 112x98, 128x112, 144x126 |

Note: the engine takes the grid from the map-size database rows (`data/maps.xml`), not from the
map script, so the first map renders on whatever standard size is picked and the large map declares
its own three sizes.

The large map (`maps/europe-large-geo.js`, `maps/europe-large-map.js`) adds the Sahel, Ethiopia and
Arabia, compresses the Arctic and the Sahara vertically (piecewise latitude mapping), trims the Atlantic
on the left, makes Russia north of ~57N taiga with a cold mixed-forest band down to ~53N, and adds
true starts for Aksum (Axum) and Songhai (Gao). Its fallback ranking favours Morocco and Scandinavia.

## How it works

- `maps/europe-geo.js` holds the geography as longitude/latitude data: coastlines, inland seas,
  straits, lakes, mountain ranges, biome and rainfall zones, volcanoes, and true start locations.
- `maps/europe-raster.js` projects that data onto the hex grid at generation time (any grid size).
- `maps/europe-map.js` applies the grid through the engine and then runs the base-game generators
  for rivers, natural wonders, features, resources and discoveries.

Distant Lands: tiles west of roughly 19.5°E belong to the west landmass region, the rest to the
east region, so the Exploration Age treasure and distant-lands mechanics still work.

## Start locations

Civilizations from the region start at historical sites (Rome, Athens, Memphis, Carthage, Nineveh,
Susa, Pliska, Toledo, Rouen, Baghdad, Bursa, Reykjavik, Tehran, Sarai, Algiers, Paris, Berlin,
Moscow, London). Other civilizations are placed on curated sites (Kyiv, Krakow, Budapest, Uppsala,
Dublin, Lisbon, ...) as far apart as possible.

## Editing and previewing

1. Edit `maps/europe-large-geo.js` (large map) or `maps/europe-geo.js` (first map). All shapes are
   plain `[lon, lat]` lists in degrees (east and north positive); widths and radii are in hex tiles.
2. Rebuild the previews: run `..\preview\build-preview.ps1` (add `-Open` to open the page). It writes
   `preview\europe-large.html` and `preview\europe.html`; open them in any browser. Mouse wheel zooms at
   the cursor, drag pans, the +/−/fit buttons do the same, and hovering a hex prints its grid coordinates,
   longitude/latitude, terrain, biome, rainfall, region, start and volcano. Zoomed in past about 2x the
   hex coordinates are drawn on the map. Append `?w=128&h=112` to the URL to preview another grid size,
   `?seed=7` for a different random roll. Below the picture is a text dump of the grid:
   `.` ocean, `,` coast, `V` planned river course, `^` mountain, lowercase = flat, uppercase = hills, with
   `g` grassland, `p` plains, `d` desert, `t` tundra, `r` tropical.
3. Install with `..\install.ps1` and restart the game (mods are read at startup only).
4. To share it, run ..\release.ps1: it bumps the version in the .modinfo, installs, and writes a new
   EuropeMediterranean-v<version>-<date>.zip next to the mod folder (add -NoBump to re-zip the current version).

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
| `resourceAreas` | (large map) historical resources per region: polygon, resource types, `density` = hexes per resource; placed in-game after the engine's random pass, which is topped up to a 20% share |
| `hillAreas`, `passes`, `flatAreas`, `roughAreas` | mountains→hills in areas / along corridors, hills→flat, flat→hills (optional `biome`) |
| `shallowLines` | corridors where ocean becomes shallow coast (island hopping) |
| `lonSqueeze`, `lonSqueezeWest` | horizontal squeezes east / west of a longitude |
| `volcanoes` | `[lon, lat, name]` |
| `tsl` | true start location per civilization type |
| `fallbackSites` | ranked start sites for civilizations without a true start |
