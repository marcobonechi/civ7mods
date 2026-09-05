// europe-large-map.js
// Map script: Europe, Mediterranean & Sahel (large variant: Urals to Iceland, Sahel to Arctic).
// Geography comes from europe-large-geo.js and is rasterized by europe-raster.js;
// rivers, natural wonders, features, resources and discoveries use the base game generators.

import { GEO } from '/europe-mediterranean-map/maps/europe-large-geo.js';
import { buildEuropeGrid, hexDistance, hexNeighbors, T, B } from '/europe-mediterranean-map/maps/europe-raster.js';
import * as globals from '/base-standard/maps/map-globals.js';
import { addNaturalWonders } from '/base-standard/maps/natural-wonder-generator.js';
import { addFeatures } from '/base-standard/maps/feature-biome-generator.js';
import { generateResources } from '/base-standard/maps/resource-generator.js';
import { generateDiscoveries } from '/base-standard/maps/discovery-generator.js';
import { assignAdvancedStartRegions } from '/base-standard/maps/assign-advanced-start-region.js';
import { dumpContinents, dumpTerrain, dumpBiomes, dumpFeatures, dumpResources } from '/base-standard/maps/map-debug-helpers.js';

console.log("Loading europe-large-map.js");

// Grid dimensions per map size. Width/height ratio keeps Europe's real proportions on a hex grid.
const SIZES = {
    MAPSIZE_EUROPE_LARGE_STD: [112, 98],
    MAPSIZE_EUROPE_LARGE_LRG: [128, 112],
    MAPSIZE_EUROPE_LARGE_HUGE: [144, 126],
    // base sizes, in case a saved configuration still points at one (the engine keeps its own grid then)
    MAPSIZE_TINY: [60, 38],
    MAPSIZE_SMALL: [74, 46],
    MAPSIZE_STANDARD: [84, 54],
    MAPSIZE_LARGE: [96, 60],
    MAPSIZE_HUGE: [106, 66]
};

function pickDims(initParams) {
    let dims = null;
    try {
        const info = GameInfo.Maps.lookup(initParams.mapSize);
        if (info && SIZES[info.MapSizeType]) {
            dims = SIZES[info.MapSizeType];
            console.log("Europe large map: size " + info.MapSizeType);
        }
    } catch (e) {
        console.log("Europe large map: map size lookup failed, " + e);
    }
    if (!dims) {
        // fall back to the size whose tile count is closest to the requested one
        const area = (initParams.width || 84) * (initParams.height || 54);
        let bestKey = "MAPSIZE_EUROPE_LARGE_STD", bestDiff = Infinity;
        for (const key in SIZES) {
            const diff = Math.abs(SIZES[key][0] * SIZES[key][1] - area);
            if (diff < bestDiff) { bestDiff = diff; bestKey = key; }
        }
        dims = SIZES[bestKey];
        console.log("Europe large map: size by tile count -> " + bestKey);
    }
    return dims;
}

function requestMapData(initParams) {
    const dims = pickDims(initParams);
    initParams.width = dims[0];
    initParams.height = dims[1];
    initParams.wrapX = false;
    initParams.wrapY = false;
    initParams.topLatitude = GEO.latTop;
    initParams.bottomLatitude = GEO.latBottom;
    console.log("Europe large map: " + initParams.width + "x" + initParams.height);
    engine.call("SetMapInitData", initParams);
}

// ---------------------------------------------------------------------------

function terrainIndex(code) {
    switch (code) {
        case T.OCEAN: return globals.g_OceanTerrain;
        case T.COAST: return globals.g_CoastTerrain;
        case T.HILL: return globals.g_HillTerrain;
        case T.MOUNTAIN: return globals.g_MountainTerrain;
        case T.RIVER: return globals.g_FlatTerrain;   // river courses are flat valleys; the engine's river modeller makes them navigable
        default: return globals.g_FlatTerrain;
    }
}

function biomeIndex(code) {
    switch (code) {
        case B.MARINE: return globals.g_MarineBiome;
        case B.PLAINS: return globals.g_PlainsBiome;
        case B.DESERT: return globals.g_DesertBiome;
        case B.TUNDRA: return globals.g_TundraBiome;
        case B.TROPICAL: return globals.g_TropicalBiome;
        default: return globals.g_GrasslandBiome;
    }
}

function applyTerrain(grid) {
    const { W, H } = grid;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            TerrainBuilder.setPlotTag(x, y, PlotTags.PLOT_TAG_NONE);
            TerrainBuilder.setTerrainType(x, y, terrainIndex(grid.terrain[grid.idx(x, y)]));
        }
    }
}

function applyLandmassRegions(grid) {
    const { W, H } = grid;
    let west = 0, east = 0;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (GameplayMap.getTerrainType(x, y) == globals.g_OceanTerrain) continue;
            const isWest = grid.region[grid.idx(x, y)] === "W";
            TerrainBuilder.setLandmassRegionId(x, y, isWest ? LandmassRegion.LANDMASS_REGION_WEST : LandmassRegion.LANDMASS_REGION_EAST);
            if (isWest) west++; else east++;
        }
    }
    console.log("Europe large map: landmass regions west=" + west + " east=" + east);
}

function applyRainfall(grid) {
    const { W, H } = grid;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (GameplayMap.isWater(x, y)) continue;
            TerrainBuilder.setRainfall(x, y, grid.rain[grid.idx(x, y)]);
        }
    }
}

function applyBiomes(grid) {
    const { W, H } = grid;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const code = GameplayMap.isWater(x, y) ? B.MARINE : grid.biome[grid.idx(x, y)];
            TerrainBuilder.setBiomeType(x, y, biomeIndex(code));
        }
    }
}

function placeVolcanoes(grid) {
    let placed = 0;
    for (const v of grid.volcanoes) {
        TerrainBuilder.setTerrainType(v.x, v.y, globals.g_MountainTerrain);
        const featureParam = { Feature: globals.g_VolcanoFeature, Direction: -1, Elevation: 0 };
        TerrainBuilder.setFeatureType(v.x, v.y, featureParam);
        console.log("Europe large map: volcano " + v.name + " at (" + v.x + ", " + v.y + ")");
        placed++;
    }
    return placed;
}

// The base snow generator assumes a pole at both map edges; we only have an Arctic edge.
function generateArcticSnow(grid) {
    const light = MapPlotEffects.getPlotEffectTypesContainingTags(["SNOW", "LIGHT", "PERMANENT"]);
    const medium = MapPlotEffects.getPlotEffectTypesContainingTags(["SNOW", "MEDIUM", "PERMANENT"]);
    const heavy = MapPlotEffects.getPlotEffectTypesContainingTags(["SNOW", "HEAVY", "PERMANENT"]);
    const effects = [light ? light[0] : -1, medium ? medium[0] : -1, heavy ? heavy[0] : -1];
    const { W, H } = grid;
    let count = 0;
    for (let y = 0; y < H; y++) {
        const lat = grid.P.latOf(y);
        if (lat < 65.5) continue;
        const t = Math.min(1, (lat - 65.5) / (GEO.latTop - 65.5));
        const chanceAny = 20 + 70 * t;
        for (let x = 0; x < W; x++) {
            if (GameplayMap.isWater(x, y)) continue;
            if (TerrainBuilder.getRandomNumber(100, "Arctic Snow") >= chanceAny) continue;
            const roll = TerrainBuilder.getRandomNumber(100, "Arctic Snow Weight");
            let weight = 0;
            if (roll < 20 + 50 * t) weight = 2;
            else if (roll < 60 + 30 * t) weight = 1;
            if (effects[weight] >= 0) {
                MapPlotEffects.addPlotEffect(GameplayMap.getIndexFromXY(x, y), effects[weight]);
                count++;
            }
        }
    }
    console.log("Europe large map: arctic snow tiles " + count);
}

// Remove sea ice that the base feature generator may have put on southern rows.
function removeStrayIce(grid) {
    const iceRow = GameInfo.Features.find((f) => f.FeatureType == "FEATURE_ICE");
    if (!iceRow) return;
    const ice = iceRow.$index;
    const { W, H } = grid;
    let removed = 0;
    for (let y = 0; y < H; y++) {
        if (grid.P.latOf(y) >= 66) continue;
        for (let x = 0; x < W; x++) {
            if (GameplayMap.getFeatureType(x, y) == ice) {
                try {
                    TerrainBuilder.setFeatureType(x, y, { Feature: FeatureTypes.NO_FEATURE, Direction: -1, Elevation: 0 });
                    removed++;
                } catch (e) {
                    console.log("Europe large map: could not remove ice at (" + x + ", " + y + "): " + e);
                    return;
                }
            }
        }
    }
    if (removed > 0) console.log("Europe large map: removed stray ice " + removed);
}

// ---------------------------------------------------------------------------
// Regional resources: after the engine's random pass, place historically placed resources per
// region (GEO.resourceAreas), then top up random ones so that about randomShare of all resources
// stay random.

function pointInPoly(lon, lat, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if ((yi > lat) !== (yj > lat)) {
            const xInt = xi + (lat - yi) * (xj - xi) / (yj - yi);
            if (lon < xInt) inside = !inside;
        }
    }
    return inside;
}

function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = TerrainBuilder.getRandomNumber(i + 1, "Resource Shuffle");
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
}

function sameResourceAdjacent(x, y, resourceIdx) {
    for (const n of hexNeighbors(x, y)) {
        if (n[0] < 0 || n[1] < 0 || n[0] >= GameplayMap.getGridWidth() || n[1] >= GameplayMap.getGridHeight()) continue;
        if (GameplayMap.getResourceType(n[0], n[1]) == resourceIdx) return true;
    }
    return false;
}

function resourceAllowedHere(x, y, resourceIdx, landmassOf) {
    const assigned = landmassOf[resourceIdx];
    const here = GameplayMap.getLandmassRegionId(x, y);
    if (assigned == LandmassRegion.LANDMASS_REGION_ANY) return true;
    if (assigned == LandmassRegion.LANDMASS_REGION_NONE) return false;
    if (here == LandmassRegion.LANDMASS_REGION_DEFAULT) return false;
    return assigned % here == 0;
}

function placeRegionalResources(grid, randomShare) {
    const W = grid.W, H = grid.H;
    // resources available in this age/game
    const available = [];
    const byType = {};
    const landmassOf = {};
    try {
        const list = ResourceBuilder.getGeneratedMapResources(3);
        for (let i = 0; i < list.length; i++) {
            const info = GameInfo.Resources.lookup(list[i]);
            if (!info || !info.Tradeable) continue;
            available.push(info.$index);
            byType[info.ResourceType] = info.$index;
            landmassOf[info.$index] = ResourceBuilder.getResourceLandmass(info.$index);
        }
    } catch (e) {
        console.log("Europe large map: resource list failed, " + e);
        return;
    }
    // resources placed by the engine's random pass
    const randomTiles = [];
    let totalBefore = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (GameplayMap.getResourceType(x, y) != ResourceTypes.NO_RESOURCE) { randomTiles.push([x, y]); totalBefore++; }
    }
    // regional pass
    let regionalPlaced = 0;
    for (const area of GEO.resourceAreas || []) {
        const types = area.resources.map((t) => byType[t]).filter((i) => i !== undefined);
        if (!types.length) { console.log("Europe large map: resources '" + area.name + "' - none of its resources exist in this age"); continue; }
        const candidates = [];
        let hexes = 0;
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
            const i = grid.idx(x, y);
            if (!pointInPoly(grid.lonC[i], grid.latC[i], area.pts)) continue;
            const t = GameplayMap.getTerrainType(x, y);
            if (t == globals.g_OceanTerrain) continue;
            hexes++;
            if (GameplayMap.getResourceType(x, y) == ResourceTypes.NO_RESOURCE) candidates.push([x, y]);
        }
        const target = Math.floor(hexes / (area.density || 8));
        shuffleInPlace(candidates);
        let placed = 0, rot = 0;
        for (const c of candidates) {
            if (placed >= target) break;
            for (let k = 0; k < types.length; k++) {
                const r = types[(rot + k) % types.length];
                if (!resourceAllowedHere(c[0], c[1], r, landmassOf)) continue;
                if (!ResourceBuilder.canHaveResource(c[0], c[1], r, false)) continue;
                if (sameResourceAdjacent(c[0], c[1], r)) continue;
                ResourceBuilder.setResourceType(c[0], c[1], r);
                placed++; rot++;
                break;
            }
        }
        regionalPlaced += placed;
        console.log("Europe large map: resources '" + area.name + "' " + placed + "/" + target + " on " + hexes + " hexes");
    }
    // top up random resources so the random share reaches randomShare of the total
    let randomCount = randomTiles.length;
    const wantRandom = Math.round(randomShare * regionalPlaced / (1 - randomShare));
    let added = 0;
    if (randomCount < wantRandom && available.length) {
        const pool = [];
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
            if (GameplayMap.getTerrainType(x, y) == globals.g_OceanTerrain) continue;
            if (GameplayMap.getResourceType(x, y) == ResourceTypes.NO_RESOURCE) pool.push([x, y]);
        }
        shuffleInPlace(pool);
        for (const c of pool) {
            if (randomCount >= wantRandom) break;
            const r = available[TerrainBuilder.getRandomNumber(available.length, "Random Resource")];
            if (!resourceAllowedHere(c[0], c[1], r, landmassOf)) continue;
            if (!ResourceBuilder.canHaveResource(c[0], c[1], r, false)) continue;
            if (sameResourceAdjacent(c[0], c[1], r)) continue;
            ResourceBuilder.setResourceType(c[0], c[1], r);
            randomCount++; added++;
        }
    }
    const total = randomCount + regionalPlaced;
    console.log("Europe large map: resources - engine random " + totalBefore + ", regional " + regionalPlaced + ", random top-up " + added + ", total " + total + ", random share " + (total ? Math.round(100 * randomCount / total) : 0) + "%");
}

// ---------------------------------------------------------------------------
// Start positions: true start locations where available, curated sites otherwise.

function civTypeOf(playerId) {
    try {
        const uiCivType = Players.getEverAlive()[playerId].civilizationType;
        const row = GameInfo.Civilizations.lookup(uiCivType);
        return row ? row.CivilizationType : "UNKNOWN";
    } catch (e) {
        return "UNKNOWN";
    }
}

function isValidStartTile(x, y) {
    if (GameplayMap.isWater(x, y)) return false;
    if (GameplayMap.isMountain(x, y)) return false;
    if (GameplayMap.isNavigableRiver(x, y)) return false;
    if (GameplayMap.isImpassable(x, y)) return false;
    return true;
}

// Find a valid start tile near a lon/lat, expanding outwards up to maxR hexes.
function findStartTile(grid, lon, lat, maxR) {
    const [nx, ny] = grid.P.nearestTile(lon, lat);
    let best = null, bestD = Infinity;
    for (let y = ny - maxR; y <= ny + maxR; y++) {
        for (let x = nx - maxR; x <= nx + maxR; x++) {
            if (!grid.inBounds(x, y) || x < 2 || x > grid.W - 3 || y < 1 || y > grid.H - 2) continue;
            const dd = hexDistance(nx, ny, x, y);
            if (dd > maxR || dd >= bestD) continue;
            if (!isValidStartTile(x, y)) continue;
            bestD = dd;
            best = [x, y];
        }
    }
    return best;
}

function minDistanceTo(taken, x, y) {
    let m = Infinity;
    for (const t of taken) {
        const d = hexDistance(t[0], t[1], x, y);
        if (d < m) m = d;
    }
    return m;
}

function assignEuropeStartPositions(grid) {
    const aliveMajorIds = Players.getAliveMajorIds();
    const startPositions = [];
    const taken = [];
    const usedSites = new Set();
    const MIN_SPACING = Math.max(5, Math.round(grid.W / 14));   // fallback sites: 8 hexes on the 112-wide grid
    const TSL_SPACING = 5;                                       // historical starts may sit closer together

    const place = (index, playerId, x, y, label) => {
        const plotIndex = GameplayMap.getIndexFromXY(x, y);
        StartPositioner.setStartPosition(plotIndex, playerId);
        startPositions[index] = plotIndex;
        taken.push([x, y]);
        console.log("Europe large map: start for player " + playerId + " (" + civTypeOf(playerId) + ") at (" + x + ", " + y + ") " + label);
    };

    // Pass 1: true start locations
    const pending = [];
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const playerId = aliveMajorIds[i];
        const civ = civTypeOf(playerId);
        const ll = GEO.tsl[civ];
        let done = false;
        if (ll) {
            const t = findStartTile(grid, ll[0], ll[1], 3);
            if (t && minDistanceTo(taken, t[0], t[1]) >= TSL_SPACING) {
                place(i, playerId, t[0], t[1], "TSL");
                usedSites.add(civ);
                done = true;
            } else {
                console.log("Europe large map: TSL for " + civ + " unavailable, using a fallback site");
            }
        }
        if (!done) pending.push(i);
    }

    // Pass 2: curated fallback sites, spread out from already placed starts
    for (const i of pending) {
        const playerId = aliveMajorIds[i];
        let best = null, bestScore = -Infinity;
        for (let s = 0; s < GEO.fallbackSites.length; s++) {
            const site = GEO.fallbackSites[s];
            if (usedSites.has(site[2])) continue;
            const t = findStartTile(grid, site[0], site[1], 3);
            if (!t) continue;
            const d = minDistanceTo(taken, t[0], t[1]);
            if (d < MIN_SPACING) continue;
            const score = Math.min(d, 12) * 100 - s;
            if (score > bestScore) { bestScore = score; best = { t, site }; }
        }
        if (best) {
            usedSites.add(best.site[2]);
            place(i, playerId, best.t[0], best.t[1], best.site[2]);
            continue;
        }
        // Last resort: any valid land tile as far from the others as possible
        let fx = -1, fy = -1, fd = -1;
        for (let y = 2; y < grid.H - 2; y++) {
            for (let x = 2; x < grid.W - 2; x++) {
                if (!isValidStartTile(x, y)) continue;
                if (GameplayMap.getBiomeType(x, y) == globals.g_DesertBiome) continue;
                const d = minDistanceTo(taken, x, y);
                if (d > fd) { fd = d; fx = x; fy = y; }
            }
        }
        if (fx >= 0) place(i, playerId, fx, fy, "open land");
        else console.log("Europe large map: FAILED to place player " + playerId);
    }
    return startPositions;
}

// ---------------------------------------------------------------------------

// Rainfall used only while the engine models rivers (the YnAMP Earth maps steer rivers the same
// way): the hand-drawn courses get a torrent and the headwaters even more, so the engine's flow
// accumulation picks those courses for its navigable rivers. Real rainfall is re-applied afterwards.
const RIVER_COURSE_RAIN = 2500;
const RIVER_HEAD_RAIN = 3500;

function touchesWater(x, y) {
    for (const n of hexNeighbors(x, y)) {
        if (n[0] < 0 || n[1] < 0 || n[0] >= GameplayMap.getGridWidth() || n[1] >= GameplayMap.getGridHeight()) continue;
        if (GameplayMap.isWater(n[0], n[1])) return true;
    }
    return false;
}

function steerRiverRainfall(grid) {
    // Dry out everything else first: with rainfall elsewhere the engine chose long rivers in the
    // Urals and Scandinavia as its navigable ones and left the courses as minor rivers.
    const W = GameplayMap.getGridWidth(), H = GameplayMap.getGridHeight();
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (!GameplayMap.isWater(x, y)) TerrainBuilder.setRainfall(x, y, 0);
        }
    }
    for (const chain of grid.riverChains || []) {

        const tiles = chain.tiles;
        const n = tiles.length;
        if (!n) continue;
        // The end that touches the sea is the mouth; the other end is the headwater.
        const firstIsMouth = touchesWater(tiles[0][0], tiles[0][1]);
        const lastIsMouth = touchesWater(tiles[n - 1][0], tiles[n - 1][1]);
        const headLen = Math.max(2, Math.floor(n / 4));
        for (let k = 0; k < n; k++) {
            const [x, y] = tiles[k];
            if (GameplayMap.isWater(x, y)) continue;
            let rain = RIVER_COURSE_RAIN;
            if (firstIsMouth && !lastIsMouth && k >= n - headLen) rain = RIVER_HEAD_RAIN;
            if (lastIsMouth && !firstIsMouth && k < headLen) rain = RIVER_HEAD_RAIN;
            TerrainBuilder.setRainfall(x, y, rain);
        }
    }
}

function reportRivers(grid) {
    let nav = 0, minor = 0, none = 0;
    const perRiver = [];
    for (const chain of grid.riverChains || []) {
        let cn = 0, cm = 0;
        for (const [x, y] of chain.tiles) {
            if (GameplayMap.isNavigableRiver(x, y)) { nav++; cn++; }
            else if (GameplayMap.isRiver(x, y)) { minor++; cm++; }
            else none++;
        }
        perRiver.push(chain.name + " " + cn + "/" + chain.tiles.length + (cm ? " (+" + cm + " minor)" : ""));
    }
    console.log("Europe large map: river courses - navigable " + nav + ", minor " + minor + ", none " + none);
    console.log("Europe large map: navigable per course - " + perRiver.join("; "));
}

// R navigable river, r minor river, . other land, blank water
function dumpRivers(iWidth, iHeight) {
    for (let y = iHeight - 1; y >= 0; y--) {
        let s = (y % 2 == 1) ? " " : "";
        for (let x = 0; x < iWidth; x++) {
            if (GameplayMap.isWater(x, y)) s += "  ";
            else if (GameplayMap.isNavigableRiver(x, y)) s += "R ";
            else if (GameplayMap.isRiver(x, y)) s += "r ";
            else s += ". ";
        }
        console.log(s);
    }
}

function generateMap() {
    console.log("Europe large map: generating");
    console.log(`Age - ${GameInfo.Ages.lookup(Game.age).AgeType}`);
    const iWidth = GameplayMap.getGridWidth();
    const iHeight = GameplayMap.getGridHeight();
    console.log("Europe large map: engine grid " + iWidth + "x" + iHeight);
    const uiMapSize = GameplayMap.getMapSize();
    const mapInfo = GameInfo.Maps.lookup(uiMapSize);
    const iNumNaturalWonders = mapInfo ? mapInfo.NumNaturalWonders : 5;

    // The engine caps getRandomNumber results at 32767, so two small draws are combined into one
    // uniform value in [0, 1). A single draw out of 100000 never exceeded 0.33 and skewed every
    // probability in the geography (hills, plains, tundra, coast jitter) towards "always".
    const rnd = () => (TerrainBuilder.getRandomNumber(1000, "Europe Raster") * 1000 + TerrainBuilder.getRandomNumber(1000, "Europe Raster")) / 1000000;
    const grid = buildEuropeGrid(iWidth, iHeight, GEO, rnd);

    // Reserve start sites before terrain goes in, so they are flat and not walled in.
    for (const civ in GEO.tsl) {
        const ll = GEO.tsl[civ];
        const t = grid.findLandTile(ll[0], ll[1], 2, false);
        if (t) grid.prepareStartTile(t[0], t[1]);
    }

    applyTerrain(grid);
    TerrainBuilder.validateAndFixTerrain();
    applyLandmassRegions(grid);
    AreaBuilder.recalculateAreas();
    TerrainBuilder.stampContinents();

    placeVolcanoes(grid);
    AreaBuilder.recalculateAreas();
    TerrainBuilder.buildElevation();
    applyRainfall(grid);

    // Hand-placed navigable-river terrain only looks like a river: the engine keeps no river data
    // for it (isNavigableRiver is false, settlers can even start on it). Instead the courses are flat
    // valleys drenched in rainfall while the engine models rivers, so its biggest flows follow them.
    steerRiverRainfall(grid);
    TerrainBuilder.modelRivers(5, 30, globals.g_NavigableRiverTerrain);   // 15 in the base maps: more minor rivers
    TerrainBuilder.validateAndFixTerrain();
    TerrainBuilder.defineNamedRivers();
    applyRainfall(grid);   // back to the real rainfall for biomes and features
    reportRivers(grid);
    dumpRivers(iWidth, iHeight);

    applyBiomes(grid);
    addNaturalWonders(iWidth, iHeight, iNumNaturalWonders);
    TerrainBuilder.addFloodplains(4, 10);
    addFeatures(iWidth, iHeight);
    removeStrayIce(grid);
    TerrainBuilder.validateAndFixTerrain();
    AreaBuilder.recalculateAreas();
    TerrainBuilder.storeWaterData();
    generateArcticSnow(grid);

    dumpContinents(iWidth, iHeight);
    dumpTerrain(iWidth, iHeight);
    dumpBiomes(iWidth, iHeight);
    dumpFeatures(iWidth, iHeight);

    generateResources(iWidth, iHeight);
    try {
        placeRegionalResources(grid, 0.2);
    } catch (e) {
        console.log("Europe large map: regional resources failed, " + e);
    }
    const startPositions = assignEuropeStartPositions(grid);
    generateDiscoveries(iWidth, iHeight, startPositions, 1);
    dumpResources(iWidth, iHeight);
    FertilityBuilder.recalculate();
    assignAdvancedStartRegions();
    console.log("Europe large map: done");
}

engine.on('RequestMapInitData', requestMapData);
engine.on('GenerateMap', generateMap);

console.log("Loaded europe-large-map.js");
