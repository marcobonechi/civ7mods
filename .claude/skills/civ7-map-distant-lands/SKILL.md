---
name: civ7-map-distant-lands
description: Change which lands are Distant Lands and what the continents are on the Europe map mod (EuropeMediterranean) for Civilization VII - anchors, sea channels, a mountain wall as a Distant Lands border, continent polygons, and how to verify it in the game. Use when asked to move a region across the water, cut or join landmasses, redraw continents, or when the Caucasus/Middle East question comes up again.
---

# Distant Lands, walls and continents on the Europe map

Everything here is in `EuropeMediterranean/maps/europe-large-geo.js` (the geography the four Europe
maps share) and `europe-raster.js` (how it becomes a hex grid). One Landmass, Eurasia Compressed and
the compact map are generated from it, so edit that one file and rebuild (below). The mod's README,
section *Continents*, is the user-facing account; this is the how-to.

## How Distant Lands work in this mod

- The engine reads a **landmass region** per hex (WEST = home, EAST = distant). Where two land hexes
  a unit can stand on have different regions, the engine puts an invisible wall between them: units
  cannot cross and the civilizations beyond cannot be met before the Exploration Age. So a region
  boundary may only ever run through water or through mountains.
- The rasterizer therefore assigns regions to **whole water-separated landmasses**
  (`assignLandmassRegions`), never by longitude. A landmass is distant if it contains one of
  `GEO.distantLandsAnchors` (`[lon, lat]`, one per landmass; the search widens a few hexes if the
  anchor lands in the sea).
- To make part of a landmass distant, cut it off first, with one of:
  - a **`waterLines` entry** with `separatesDistantLands: true` - a one-hex sea channel (the Karelian
    passage, the Suez channel through Palestine, the Uzboy east of the Caspian). Cheap, always
    works, but it is a sea that is not there.
  - a **`mountainWalls` entry** with `separatesDistantLands: true` - a line of `[lon, lat]` points
    from shore to shore. The rasterizer forces every hex on the line to mountain, keeps it mountain
    (start-site preparation will not flatten a wall hex), and treats the line as sea when it decides
    what is connected. The boundary then runs along an impassable range that really exists: no sea
    has to be dug. The wall's own hexes take the region of the nearer side, which is harmless -
    nobody can stand on a mountain.
- `oneLandmassGeo()` (europe-raster.js) drops every channel and wall marked
  `separatesDistantLands` and empties the anchors: that is the One Landmass map. Anything you add
  must carry the flag, or it appears there too.

### The worked example: the Middle East

It is all in the geo file, **commented out**, ready to put back. It ran in the game (1.5) and the
log reported the walls sound; it was taken out again because it moves half the Antiquity roster
(Persia, Assyria, Babylon, Abbasids, Ottomans, Silla, Inca, Nepal) across the water.

1. `distantLandsAnchors`: uncomment `[44.4, 33.3]` (Baghdad) and `[33.2, 35.0]` (Cyprus).
2. `waterLines`: uncomment `Uzboy` (the desert east of the Caspian, to the map edge).
3. `mountainWalls`: uncomment `Caucasus crest` (Tuapse to Derbent). Together with the Bosporus
   (already one hex) and the Suez channel the ring is closed; the Black Sea and the Caspian stay
   two seas.
4. `distantLandsShare: [45, 60]` (it is [25, 50] now; the share becomes about 52%).
5. `tools/check-map-sizes.mjs`: uncomment the two `JOINS` lines (Anatolia/Pontic steppe,
   Persia/Kazakh steppe) so the checker proves both cuts on every size and their absence on One
   Landmass.
6. `data/maps.xml`: think about `PlayersLandmass1/2` - many more civilizations now start on
   landmass 2.
7. Map descriptions in `text/en_us/MapText.xml` and the eleven `l10n/*_Text.xml`: add the Middle
   East to the Distant Lands sentence.

To wall off something else, draw the line along a real crest, points every degree or so, starting
and ending in the sea, and keep it clear of true starts (`tsl`): a start within a hex of the wall
gets its own tile flattened but the wall stays, which can box the start in.

## Continents

`GEO.continents` is a list of `{ name, key, pts }` polygons; the first that contains a hex's centre
wins, the last is a catch-all. Continents are independent of regions and may divide connected
land (a continent border stops nobody). Land borders follow rivers and ranges; at sea run them down
the middle of the water.

The engine only has `TerrainBuilder.stampContinents()`, which makes as many continents as the map
size's `Continents` column (`data/maps.xml`, 7 for all four sizes) and lets each spread over land
and shallow water until it meets another. `stampGeoContinents` (europe-large-core.js) shows it a
different map for that one call - mountains along every land border, deep ocean down the middle of
the water between continents, causeways tying islands to their mainland, other mountains flattened -
then restores the terrain. Found by trial, keep in mind:

- water at a land border leaves the border hexes with no continent at all; mountains do not;
- without the deep-water strips Iceland and western Norway went to Britain's continent and Yemen
  to East Africa's (continents spread through coast);
- `Continents` lower than the number of polygons merges them;
- names are picked by the engine at random from `Continents`; no way to choose them was found.

Adding a continent: a polygon here and `Continents` up by one in every `Maps` row. The Eurasia
maps get `continents: []` from the build and use the engine's own.

## After editing

```bash
node tools/eurasia-compressed/build.mjs        # Eurasia geography (drops what lies under its ocean)
node tools/europe-compact/build.mjs            # compact geography
node tools/check-map-sizes.mjs                 # regions: no walkable seam, share in range, joins as declared
node tools/check-rivers.mjs
./preview/build-preview.sh                     # then open preview/europe-large.html:
                                               # "continents" button, or ?regions=1 / ?continents=1 in ?shot=1 mode
```

`tools/check-map-sizes.mjs` counts a walkable seam between regions as a failure and ignores wall
hexes; `GEO.expectLand` / `JOINS` prove named places apart or joined.

## Verifying in the game

Install (`install.ps1 EuropeMediterranean`; the local version must be higher than the Workshop
copy's or the Workshop copy loads), start a game on the map, then read `Scripting.log`
(`%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Logs`, wiped at each start):

- `Europe large map: region walls - N wall hexes, 0 of them walkable; walkable neighbours in
  different regions: 0  - sound` - computed from the engine's finished terrain, after volcanoes,
  rivers, wonders and its own fixes. `<-- BROKEN` lists the hexes.
- `Europe large map: continent <name> - CONTINENT_X xN, ...` - one line per polygon; one dominant
  engine continent each, a few dozen border hexes under a neighbour's name is normal.
- `landmass regions west=.. east=..`, `N starts placed, M on their exact tile`.

In play: a scout at the wall finds no way through; the hex tooltip shows the continent.
