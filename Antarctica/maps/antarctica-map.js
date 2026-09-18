// antarctica-map.js
// Map script: Antarctica. The frozen continent in the middle of a south polar map, with South
// America, Southern Africa, Australia and New Zealand across the Southern Ocean as Distant Lands.
// Antarctica is icy inland, but a band of BAND_DEPTH hexes along its whole coast is open ground,
// and every civilization starts somewhere in that band: no fixed starts, the game picks the sites.
//
// The geography and its rasterizer live in antarctica-geo.js (no engine calls, so the offline
// preview in tools/preview.mjs draws the same map). Rivers are painted hex by hex the way the
// Europe map in this repository does it for Civilization VII 1.5 (setRiverInfo, finalizeRivers,
// setRiverInfo again), with modelRivers as the fallback on an older game.

import { buildAntarcticaGrid, SIZES, T, B, REGION, BAND_DEPTH, hexNeighbors, hexDistance, directionName } from '/antarctica-map/maps/antarctica-geo.js';
import * as globals from '/base-standard/maps/map-globals.js';
import { addNaturalWonders } from '/base-standard/maps/natural-wonder-generator.js';
import { addFeatures } from '/base-standard/maps/feature-biome-generator.js';
import { generateResources } from '/base-standard/maps/resource-generator.js';
import { generateDiscoveries } from '/base-standard/maps/discovery-generator.js';
import { assignStartPositionsFromTiles, PlayerRegion } from '/base-standard/maps/assign-starting-plots.js';
import { assignAdvancedStartRegions } from '/base-standard/maps/assign-advanced-start-region.js';
import { dumpContinents, dumpTerrain, dumpBiomes, dumpFeatures, dumpResources } from '/base-standard/maps/map-debug-helpers.js';

const TAG = "Antarctica map: ";
console.log("Loading antarctica-map.js");

function pickDims(initParams) {
    try {
        const info = GameInfo.Maps.lookup(initParams.mapSize);
        if (info && SIZES[info.MapSizeType]) return SIZES[info.MapSizeType];
    } catch (e) {
        console.log(TAG + "map size lookup failed, " + e);
    }
    // a base size (an old saved setup): the one of ours closest in tile count
    const area = (initParams.width || 84) * (initParams.height || 54);
    let best = SIZES.MAPSIZE_ANTARCTICA_STD, diff = Infinity;
    for (const k in SIZES) {
        const d = Math.abs(SIZES[k][0] * SIZES[k][1] - area);
        if (d < diff) { diff = d; best = SIZES[k]; }
    }
    return best;
}

function requestMapData(initParams) {
    const [w, h] = pickDims(initParams);
    initParams.width = w;
    initParams.height = h;
    initParams.wrapX = false;
    initParams.wrapY = false;
    // The engine's latitude runs straight from the bottom row to the top one, which cannot describe
    // a pole in the middle of the map. Keep it mild everywhere, so nothing the engine derives from
    // it (sea ice, reefs) lands in the wrong place; this script places those itself from the real
    // latitude of each hex.
    initParams.topLatitude = 20;
    initParams.bottomLatitude = -20;
    console.log(TAG + w + "x" + h);
    engine.call("SetMapInitData", initParams);
}

// ---------------------------------------------------------------------------

function terrainIndex(t) {
    switch (t) {
        case T.OCEAN: return globals.g_OceanTerrain;
        case T.COAST: case T.LAKE: return globals.g_CoastTerrain;
        case T.HILL: return globals.g_HillTerrain;
        case T.MOUNTAIN: return globals.g_MountainTerrain;
        default: return globals.g_FlatTerrain;
    }
}

function biomeIndex(b) {
    switch (b) {
        case B.MARINE: return globals.g_MarineBiome;
        case B.PLAINS: return globals.g_PlainsBiome;
        case B.DESERT: return globals.g_DesertBiome;
        case B.TUNDRA: return globals.g_TundraBiome;
        case B.TROPICAL: return globals.g_TropicalBiome;
        default: return globals.g_GrasslandBiome;
    }
}

function applyTerrain(grid) {
    for (let y = 0; y < grid.H; y++) for (let x = 0; x < grid.W; x++) {
        TerrainBuilder.setPlotTag(x, y, PlotTags.PLOT_TAG_NONE);
        TerrainBuilder.setTerrainType(x, y, terrainIndex(grid.terrain[grid.idx(x, y)]));
    }
}

// Antarctica (and any islet within reach of it) is the homeland, everything else Distant Lands.
function applyLandmassRegions(grid) {
    let home = 0, distant = 0;
    for (let y = 0; y < grid.H; y++) for (let x = 0; x < grid.W; x++) {
        if (GameplayMap.isWater(x, y)) continue;
        const isHome = grid.region[grid.idx(x, y)] === REGION.HOME;
        TerrainBuilder.setLandmassRegionId(x, y, isHome ? LandmassRegion.LANDMASS_REGION_WEST : LandmassRegion.LANDMASS_REGION_EAST);
        if (isHome) home++; else distant++;
    }
    console.log(TAG + "landmass regions: homeland (Antarctica) " + home + ", distant lands " + distant);
}

function applyRainfall(grid) {
    for (let y = 0; y < grid.H; y++) for (let x = 0; x < grid.W; x++) {
        if (!GameplayMap.isWater(x, y)) TerrainBuilder.setRainfall(x, y, grid.rain[grid.idx(x, y)]);
    }
}

function applyBiomes(grid) {
    for (let y = 0; y < grid.H; y++) for (let x = 0; x < grid.W; x++) {
        const b = GameplayMap.isWater(x, y) ? B.MARINE : grid.biome[grid.idx(x, y)];
        TerrainBuilder.setBiomeType(x, y, biomeIndex(b));
    }
}

function placeVolcanoes(grid) {
    for (const v of grid.volcanoes) {
        TerrainBuilder.setTerrainType(v.x, v.y, globals.g_MountainTerrain);
        TerrainBuilder.setFeatureType(v.x, v.y, { Feature: globals.g_VolcanoFeature, Direction: -1, Elevation: 0 });
        console.log(TAG + "volcano " + v.name + " at (" + v.x + ", " + v.y + ")");
    }
}

// ---------------------------------------------------------------------------
// Rivers, painted where antarctica-geo.js runs them. See europe-large-core.js in the Europe map
// for the measurements behind this: setRiverInfo() stores the plan but gives navigable hexes no
// river terrain; finalizeRivers() does, but first drops hexes that are not downhill and keeps only
// part of the navigable network; setRiverInfo() again restores the plan, and the navigable hexes
// get their terrain by hand.

function carveRiverValleys(grid, elevation) {
    const W = grid.W, at = (x, y) => y * W + x, key = (x, y) => x + "," + y;
    const isWater = (x, y) => GameplayMap.isWater(x, y);
    const inflows = new Map();
    for (const t of grid.riverTiles.values()) {
        const [tx, ty] = t.to;
        if (!isWater(tx, ty)) inflows.set(key(tx, ty), (inflows.get(key(tx, ty)) || 0) + 1);
    }
    const ceiling = new Map();
    const queue = [...grid.riverTiles.values()].filter((t) => !inflows.has(key(t.x, t.y)));
    let changed = 0;
    for (let q = 0; q < queue.length; q++) {
        const t = queue[q], i = at(t.x, t.y), k = key(t.x, t.y);
        const [tx, ty] = t.to;
        let want = elevation[i];
        if (ceiling.has(k)) want = Math.min(want, ceiling.get(k) - 1);
        if (isWater(tx, ty)) want = Math.max(want, elevation[at(tx, ty)] + 1);
        if (want !== elevation[i]) { elevation[i] = want; changed++; }
        if (isWater(tx, ty)) continue;
        const dk = key(tx, ty);
        ceiling.set(dk, Math.min(ceiling.has(dk) ? ceiling.get(dk) : Infinity, want));
        inflows.set(dk, inflows.get(dk) - 1);
        if (inflows.get(dk) === 0 && grid.riverTiles.has(dk)) queue.push(grid.riverTiles.get(dk));
    }
    return changed;
}

function canPaintRivers() {
    return typeof TerrainBuilder.setRiverInfo === "function" &&
        typeof TerrainBuilder.finalizeRivers === "function" &&
        typeof TerrainBuilder.setElevation === "function" &&
        typeof RiverTypes !== "undefined" && typeof DirectionTypes !== "undefined";
}

function paintRivers(grid) {
    const elevation = new Array(grid.W * grid.H);
    for (let y = 0; y < grid.H; y++) for (let x = 0; x < grid.W; x++) elevation[y * grid.W + x] = GameplayMap.getElevation(x, y);
    const carved = carveRiverValleys(grid, elevation);
    TerrainBuilder.setElevation(elevation);
    const apply = () => {
        for (const t of grid.riverTiles.values()) {
            TerrainBuilder.setRiverInfo(t.x, t.y, DirectionTypes[directionName(t.x, t.y, t.to)],
                t.nav ? RiverTypes.RIVER_NAVIGABLE : RiverTypes.RIVER_MINOR);
        }
    };
    apply();
    TerrainBuilder.finalizeRivers(false, 25, 2, 2);
    apply();
    let navigable = 0, minor = 0;
    for (const t of grid.riverTiles.values()) {
        if (t.nav) { TerrainBuilder.setTerrainType(t.x, t.y, globals.g_NavigableRiverTerrain); navigable++; }
        else minor++;
    }
    console.log(TAG + "rivers painted - " + navigable + " navigable hexes, " + minor + " minor, " + carved + " hexes lowered to keep them downhill");
    return true;
}

// Before 1.5: drench the drawn courses in rain and let the engine model rivers along them.
function paintRiversLegacy(grid) {
    for (let y = 0; y < grid.H; y++) for (let x = 0; x < grid.W; x++) if (!GameplayMap.isWater(x, y)) TerrainBuilder.setRainfall(x, y, 0);
    for (const t of grid.riverTiles.values()) TerrainBuilder.setRainfall(t.x, t.y, 2500);
    TerrainBuilder.modelRivers(5, 30, globals.g_NavigableRiverTerrain);
    applyRainfall(grid);
    console.log(TAG + "rivers modelled by the engine along the drawn courses (pre-1.5 method)");
}

function reportRivers(grid) {
    const parts = grid.riverList.map((r) => {
        let nav = 0, minor = 0;
        for (const [x, y] of r.tiles) { if (GameplayMap.isNavigableRiver(x, y)) nav++; else if (GameplayMap.isRiver(x, y)) minor++; }
        return r.name + " " + (nav + minor) + "/" + r.tiles.length + (nav ? " (" + nav + " navigable)" : "");
    });
    console.log(TAG + "rivers - " + parts.join("; "));
}

// ---------------------------------------------------------------------------
// Natural wonders at their real sites; the rest go to the base game's random pass.

const namedWonderTiles = {};

function placeNamedWonders(grid) {
    const placed = [];
    for (const w of grid.wonders) {
        const def = GameInfo.Features.lookup(w.feature);
        if (!def) { console.log(TAG + "wonder " + w.feature + " is not in this ruleset"); continue; }
        const nw = GameInfo.Feature_NaturalWonders.lookup(def.$hash);
        let done = false;
        for (let r = 0; r <= 3 && !done; r++) {
            for (let y = w.y - r; y <= w.y + r && !done; y++) for (let x = w.x - r; x <= w.x + r && !done; x++) {
                if (!grid.inBounds(x, y) || hexDistance(w.x, w.y, x, y) !== r) continue;
                if (grid.band[grid.idx(x, y)]) continue;   // never in Antarctica's starting band
                const param = { Feature: def.$hash, Direction: nw ? nw.Direction : -1, Elevation: GameplayMap.getElevation(x, y) };
                if (!TerrainBuilder.canHaveFeatureParam(x, y, param)) continue;
                TerrainBuilder.setFeatureType(x, y, param);
                namedWonderTiles[w.feature] = [x, y];
                placed.push(w.feature);
                console.log(TAG + "wonder " + w.feature + " at (" + x + ", " + y + "), " + r + " hex from its site");
                done = true;
            }
        }
        if (!done) console.log(TAG + "wonder " + w.feature + " found no footprint near its site; left to the random pass");
    }
    return placed;
}

function dropDuplicateWonders(grid) {
    for (const feature in namedWonderTiles) {
        const def = GameInfo.Features.lookup(feature);
        const keep = namedWonderTiles[feature];
        for (let y = 0; y < grid.H; y++) for (let x = 0; x < grid.W; x++) {
            if ((x !== keep[0] || y !== keep[1]) && GameplayMap.getFeatureType(x, y) === def.$hash) {
                TerrainBuilder.setFeatureType(x, y, { Feature: FeatureTypes.NO_FEATURE, Direction: -1, Elevation: 0 });
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Features the engine placed by its own (straight-line) latitude are put right here:
//  - the frozen interior keeps no forest, marsh or bog: it is ice;
//  - sea ice and reefs are cleared and placed again by each hex's real latitude: pack ice in the
//    Southern Ocean (never next to land, so every coast stays reachable), cold reefs off
//    Antarctica and the sub-Antarctic islands, warm reefs and atolls only in warm water.

const NO_FEATURE = () => ({ Feature: FeatureTypes.NO_FEATURE, Direction: -1, Elevation: 0 });

function fixFeatures(grid) {
    const f = (name) => { const r = GameInfo.Features.lookup(name); return r ? r.$index : -1; };
    const ICE = f("FEATURE_ICE"), REEF = f("FEATURE_REEF"), COLD_REEF = f("FEATURE_COLD_REEF"), ATOLL = f("FEATURE_ATOLL");
    const isNaturalWonder = (x, y) => {
        const ft = GameplayMap.getFeatureType(x, y);
        if (ft === FeatureTypes.NO_FEATURE) return false;
        const info = GameInfo.Features.lookup(ft);
        return !!info && !!GameInfo.Feature_NaturalWonders.lookup(info.$hash);
    };
    let clearedIce = 0, clearedLand = 0, ice = 0, cold = 0, warm = 0;
    for (let y = 0; y < grid.H; y++) for (let x = 0; x < grid.W; x++) {
        const i = grid.idx(x, y);
        const ft = GameplayMap.getFeatureType(x, y);
        if (ft === FeatureTypes.NO_FEATURE || isNaturalWonder(x, y)) continue;
        if (GameplayMap.isWater(x, y)) {
            if (ft === ICE || ft === REEF || ft === COLD_REEF || ft === ATOLL) { TerrainBuilder.setFeatureType(x, y, NO_FEATURE()); clearedIce++; }
        } else if (grid.owner[i] === 0 && !grid.band[i]) {
            const info = GameInfo.Features.lookup(ft);
            if (info && info.Removable) { TerrainBuilder.setFeatureType(x, y, NO_FEATURE()); clearedLand++; }
        }
    }
    const roll = (n) => TerrainBuilder.getRandomNumber(n, "Antarctica features");
    for (let y = 0; y < grid.H; y++) for (let x = 0; x < grid.W; x++) {
        if (!GameplayMap.isWater(x, y) || GameplayMap.getFeatureType(x, y) !== FeatureTypes.NO_FEATURE) continue;
        if (GameplayMap.isLake(x, y)) continue;
        const lat = grid.plat[grid.idx(x, y)];
        const nearLand = GameplayMap.isAdjacentToLand(x, y);
        if (ICE >= 0 && lat < -62 && !nearLand && GameplayMap.getTerrainType(x, y) === globals.g_OceanTerrain) {
            // denser towards the continent, and never a solid wall
            const chance = Math.min(18, Math.round((-62 - lat) * 3));
            if (roll(100) < chance && TerrainBuilder.canHaveFeature(x, y, ICE)) {
                TerrainBuilder.setFeatureType(x, y, { Feature: ICE, Direction: -1, Elevation: 0 }); ice++;
            }
            continue;
        }
        if (!nearLand || GameplayMap.getTerrainType(x, y) !== globals.g_CoastTerrain) continue;
        if (lat < -52) {
            if (COLD_REEF >= 0 && roll(100) < 8 && TerrainBuilder.canHaveFeature(x, y, COLD_REEF)) {
                TerrainBuilder.setFeatureType(x, y, { Feature: COLD_REEF, Direction: -1, Elevation: 0 }); cold++;
            }
        } else if (REEF >= 0 && roll(100) < 8 && TerrainBuilder.canHaveFeature(x, y, REEF)) {
            TerrainBuilder.setFeatureType(x, y, { Feature: REEF, Direction: -1, Elevation: 0 }); warm++;
        }
    }
    console.log(TAG + "features - " + clearedLand + " cleared from the ice, " + clearedIce + " sea features cleared; placed " +
        ice + " pack ice, " + cold + " cold reefs, " + warm + " reefs");
}

// Antarctica is ice beyond its coastal band: permanent snow, heavier further in. The band stays clear.
function paintSnow(grid) {
    const tags = (w) => { const e = MapPlotEffects.getPlotEffectTypesContainingTags(["SNOW", w, "PERMANENT"]); return e ? e[0] : -1; };
    const light = tags("LIGHT"), medium = tags("MEDIUM"), heavy = tags("HEAVY");
    let n = 0;
    for (let y = 0; y < grid.H; y++) for (let x = 0; x < grid.W; x++) {
        const i = grid.idx(x, y);
        if (grid.owner[i] !== 0 || grid.band[i] || GameplayMap.isWater(x, y)) continue;
        const depth = grid.coastDist[i] - BAND_DEPTH;   // 1 = first hex of ice
        const r = TerrainBuilder.getRandomNumber(100, "Antarctic Snow");
        const effect = depth <= 1 ? (r < 60 ? light : medium) : depth <= 3 ? (r < 60 ? medium : heavy) : (r < 15 ? medium : heavy);
        if (effect >= 0) { MapPlotEffects.addPlotEffect(GameplayMap.getIndexFromXY(x, y), effect); n++; }
    }
    console.log(TAG + "snow on " + n + " interior hexes");
}

// ---------------------------------------------------------------------------
// Starts: the band is cut into one arc per player, going round the coast from a random point, and
// the base game picks the best site in each arc with its usual scoring and start biases. Nothing
// is fixed, so every game starts somewhere else.

function assignBandStarts(grid) {
    const players = Players.getAliveMajorIds().length;
    const tiles = grid.bandTiles.filter(([x, y]) => !GameplayMap.isWater(x, y) && !GameplayMap.isMountain(x, y) && !GameplayMap.isNavigableRiver(x, y));
    const [cx, cy] = grid.centre;
    const [ccx, ccy] = grid.toCanvas(cx, cy);
    const angle = ([x, y]) => { const [X, Y] = grid.toCanvas(x, y); return Math.atan2(X - ccx, Y - ccy); };
    tiles.sort((a, b) => angle(a) - angle(b));
    const offset = TerrainBuilder.getRandomNumber(tiles.length, "Antarctica start rotation");
    const ring = tiles.slice(offset).concat(tiles.slice(0, offset));
    const regions = [];
    for (let r = 0; r < players; r++) {
        const pr = new PlayerRegion();
        pr.regionId = r;
        pr.landmassId = 0;
        const from = Math.floor(r * ring.length / players), to = Math.floor((r + 1) * ring.length / players);
        for (let k = from; k < to; k++) pr.tiles.push({ x: ring[k][0], y: ring[k][1] });
        regions.push(pr);
    }
    console.log(TAG + players + " players, " + ring.length + " band hexes, about " + Math.floor(ring.length / Math.max(1, players)) + " each");
    const starts = assignStartPositionsFromTiles(regions);
    // report, and make sure the ice never claims a start
    for (const id of Players.getAliveMajorIds()) {
        const p = StartPositioner.getStartPosition(id);
        if (p < 0) { console.log(TAG + "WARNING no start for player " + id); continue; }
        const loc = GameplayMap.getLocationFromIndex(p);
        const b = grid.band[grid.idx(loc.x, loc.y)];
        console.log(TAG + "start for player " + id + " at (" + loc.x + ", " + loc.y + "), " + b + " hex(es) from the sea" + (b ? "" : " - WARNING outside the band"));
    }
    return starts;
}

// ---------------------------------------------------------------------------

function generateMap() {
    console.log(TAG + "generating, age " + GameInfo.Ages.lookup(Game.age).AgeType);
    const iWidth = GameplayMap.getGridWidth(), iHeight = GameplayMap.getGridHeight();
    const mapInfo = GameInfo.Maps.lookup(GameplayMap.getMapSize());
    const iNumNaturalWonders = mapInfo ? mapInfo.NumNaturalWonders : 8;
    // getRandomNumber tops out at 32767: combine two draws for a uniform value in [0, 1)
    const rnd = () => (TerrainBuilder.getRandomNumber(1000, "Antarctica Raster") * 1000 + TerrainBuilder.getRandomNumber(1000, "Antarctica Raster")) / 1000000;
    const grid = buildAntarcticaGrid(iWidth, iHeight, rnd, (m) => console.log(TAG + m));

    applyTerrain(grid);
    TerrainBuilder.validateAndFixTerrain();
    applyLandmassRegions(grid);
    AreaBuilder.recalculateAreas();
    TerrainBuilder.stampContinents();
    placeVolcanoes(grid);
    AreaBuilder.recalculateAreas();
    TerrainBuilder.buildElevation();
    applyRainfall(grid);

    let painted = false;
    if (canPaintRivers()) {
        try { painted = paintRivers(grid); }
        catch (e) { console.log(TAG + "painting rivers failed (" + e + "), using the pre-1.5 rivers"); }
    }
    if (!painted) paintRiversLegacy(grid);
    TerrainBuilder.validateAndFixTerrain();
    reportRivers(grid);

    applyBiomes(grid);
    const named = placeNamedWonders(grid);
    addNaturalWonders(iWidth, iHeight, Math.max(0, iNumNaturalWonders - named.length), false, []);
    dropDuplicateWonders(grid);
    TerrainBuilder.addFloodplains(4, 10);
    addFeatures(iWidth, iHeight);
    fixFeatures(grid);
    TerrainBuilder.validateAndFixTerrain();
    AreaBuilder.recalculateAreas();
    TerrainBuilder.storeWaterData();
    paintSnow(grid);

    dumpContinents(iWidth, iHeight);
    dumpTerrain(iWidth, iHeight);
    dumpBiomes(iWidth, iHeight);
    dumpFeatures(iWidth, iHeight);

    generateResources(iWidth, iHeight);
    const startPositions = assignBandStarts(grid);
    generateDiscoveries(iWidth, iHeight, startPositions, 1);
    dumpResources(iWidth, iHeight);
    FertilityBuilder.recalculate();
    assignAdvancedStartRegions();
    console.log(TAG + "done");
}

engine.on('RequestMapInitData', requestMapData);
engine.on('GenerateMap', generateMap);
console.log("Loaded antarctica-map.js");
