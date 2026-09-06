// europe-map.js
// Map script: Europe & the Mediterranean (Urals to Iceland, Morocco to Sinai).
// Geography comes from europe-geo.js and is rasterized by europe-raster.js;
// rivers, natural wonders, features, resources and discoveries use the base game generators.

import { GEO } from '/europe-mediterranean-map/maps/europe-geo.js';
import { buildEuropeGrid, hexDistance, hexNeighbors, T, B } from '/europe-mediterranean-map/maps/europe-raster.js';
import * as globals from '/base-standard/maps/map-globals.js';
import { addNaturalWonders } from '/base-standard/maps/natural-wonder-generator.js';
import { addFeatures } from '/base-standard/maps/feature-biome-generator.js';
import { generateResources } from '/base-standard/maps/resource-generator.js';
import { generateDiscoveries } from '/base-standard/maps/discovery-generator.js';
import { assignAdvancedStartRegions } from '/base-standard/maps/assign-advanced-start-region.js';
import { dumpContinents, dumpTerrain, dumpBiomes, dumpFeatures, dumpResources } from '/base-standard/maps/map-debug-helpers.js';

console.log("Loading europe-map.js");

// Grid dimensions per map size. Width/height ratio keeps Europe's real proportions on a hex grid.
const SIZES = {
    MAPSIZE_TINY: [56, 50],
    MAPSIZE_SMALL: [66, 60],
    MAPSIZE_STANDARD: [78, 70],
    MAPSIZE_LARGE: [90, 80],
    MAPSIZE_HUGE: [102, 92]
};

function pickDims(initParams) {
    let dims = null;
    try {
        const info = GameInfo.Maps.lookup(initParams.mapSize);
        if (info && SIZES[info.MapSizeType]) {
            dims = SIZES[info.MapSizeType];
            console.log("Europe map: size " + info.MapSizeType);
        }
    } catch (e) {
        console.log("Europe map: map size lookup failed, " + e);
    }
    if (!dims) {
        // fall back to the size whose tile count is closest to the requested one
        const area = (initParams.width || 84) * (initParams.height || 54);
        let bestKey = "MAPSIZE_STANDARD", bestDiff = Infinity;
        for (const key in SIZES) {
            const diff = Math.abs(SIZES[key][0] * SIZES[key][1] - area);
            if (diff < bestDiff) { bestDiff = diff; bestKey = key; }
        }
        dims = SIZES[bestKey];
        console.log("Europe map: size by tile count -> " + bestKey);
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
    console.log("Europe map: " + initParams.width + "x" + initParams.height);
    engine.call("SetMapInitData", initParams);
}

// ---------------------------------------------------------------------------

function terrainIndex(code) {
    switch (code) {
        case T.OCEAN: return globals.g_OceanTerrain;
        case T.COAST: return globals.g_CoastTerrain;
        case T.HILL: return globals.g_HillTerrain;
        case T.MOUNTAIN: return globals.g_MountainTerrain;
        default: return globals.g_FlatTerrain;
    }
}

function biomeIndex(code) {
    switch (code) {
        case B.MARINE: return globals.g_MarineBiome;
        case B.PLAINS: return globals.g_PlainsBiome;
        case B.DESERT: return globals.g_DesertBiome;
        case B.TUNDRA: return globals.g_TundraBiome;
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
    console.log("Europe map: landmass regions west=" + west + " east=" + east);
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
        console.log("Europe map: volcano " + v.name + " at (" + v.x + ", " + v.y + ")");
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
    console.log("Europe map: arctic snow tiles " + count);
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
                    console.log("Europe map: could not remove ice at (" + x + ", " + y + "): " + e);
                    return;
                }
            }
        }
    }
    if (removed > 0) console.log("Europe map: removed stray ice " + removed);
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

// Features a settlement cannot replace: the impassable ones (ice, volcanoes and most natural
// wonders) and the non-removable scenery. Anything the database marks Removable is fine, since
// founding a city clears it. Read from GameInfo so DLC wonders are covered too.
function featureBlocksSettlement(x, y) {
    const f = GameplayMap.getFeatureType(x, y);
    if (f == FeatureTypes.NO_FEATURE) return false;
    const info = GameInfo.Features.lookup(f);
    if (!info) return false;
    return !!info.Impassable || !info.Removable;
}

// Clear a removable feature (forest, marsh, ...) from a chosen start so the settler founds on
// open ground instead of having to clear it first.
function clearStartFeature(x, y) {
    const f = GameplayMap.getFeatureType(x, y);
    if (f == FeatureTypes.NO_FEATURE) return;
    const info = GameInfo.Features.lookup(f);
    if (!info || !info.Removable || info.Impassable) return;
    // Floodplains are flagged removable but a city founds on them fine; keep them.
    if (info.FeatureClassType == "FEATURE_CLASS_FLOODPLAIN") return;
    TerrainBuilder.setFeatureType(x, y, { Feature: FeatureTypes.NO_FEATURE, Direction: -1, Elevation: 0 });
}

// Historical capitals grew into big cities, so every true start gets a workable amount of food.
// Inside TSL_FOOD_RADIUS the poorest land is lifted towards flat grassland (2 food) until the
// ring holds TSL_FOOD_MIN high-food tiles. Biomes are raised first and hills are only flattened
// if that was not enough, so the map keeps its shape: Egypt stays desert apart from a few hexes
// beside Memphis. Runs before features and floodplains, so those grow on the improved ground.
const TSL_FOOD_RADIUS = 2;
const TSL_FOOD_MIN = 5;

function boostStartFood(grid) {
    if (!GEO.tsl) return;
    const radius = GEO.tslFoodRadius !== undefined ? GEO.tslFoodRadius : TSL_FOOD_RADIUS;
    const want = GEO.tslFoodMin !== undefined ? GEO.tslFoodMin : TSL_FOOD_MIN;
    const isRich = (x, y) => GameplayMap.getTerrainType(x, y) == globals.g_FlatTerrain &&
                             GameplayMap.getBiomeType(x, y) == globals.g_GrasslandBiome;
    let lifted = 0, flattened = 0, sites = 0;

    for (const civ in GEO.tsl) {
        const ll = GEO.tsl[civ];
        const t = findStartTile(grid, ll[0], ll[1], 3);
        if (!t) continue;
        sites++;

        const cells = [];
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const x = t[0] + dx, y = t[1] + dy;
                if (!grid.inBounds(x, y) || x < 1 || x >= grid.W - 1) continue;
                if (hexDistance(t[0], t[1], x, y) > radius) continue;
                if (GameplayMap.isWater(x, y) || GameplayMap.isMountain(x, y)) continue;
                if (GameplayMap.isNavigableRiver(x, y)) continue;
                cells.push([x, y]);
            }
        }
        // nearest tiles first, so the city centre is improved before its outskirts
        cells.sort((a, b) => hexDistance(t[0], t[1], a[0], a[1]) - hexDistance(t[0], t[1], b[0], b[1]));

        // Small islands must not be flattened wholesale: never improve more than half the ring.
        const target = Math.min(want, Math.max(2, Math.floor(cells.length / 2)));
        let rich = cells.filter(c => isRich(c[0], c[1])).length;
        const setGrass = (x, y) => {
            TerrainBuilder.setBiomeType(x, y, globals.g_GrasslandBiome);
            grid.biome[grid.idx(x, y)] = B.GRASSLAND;
        };
        // pass 1: biome only, keeping the terrain shape
        for (const [x, y] of cells) {
            if (rich >= target) break;
            if (isRich(x, y)) continue;
            if (GameplayMap.getTerrainType(x, y) != globals.g_FlatTerrain) continue;
            setGrass(x, y); rich++; lifted++;
        }
        // pass 2: only if still short, flatten hills next to the start
        for (const [x, y] of cells) {
            if (rich >= target) break;
            if (isRich(x, y)) continue;
            TerrainBuilder.setTerrainType(x, y, globals.g_FlatTerrain);
            grid.terrain[grid.idx(x, y)] = T.FLAT;
            setGrass(x, y); rich++; flattened++;
        }
    }
    console.log("Europe map" + ": start food - " + lifted + " biomes lifted, " + flattened +
        " hills flattened across " + sites + " true starts");
}

function isValidStartTile(x, y) {
    if (GameplayMap.isWater(x, y)) return false;
    if (GameplayMap.isMountain(x, y)) return false;
    if (GameplayMap.isNavigableRiver(x, y)) return false;
    if (GameplayMap.isImpassable(x, y)) return false;
    if (featureBlocksSettlement(x, y)) return false;
    return true;
}

// A resource on the start tile blocks founding the city, and resources are generated before
// starts are assigned, so a true start can land on cotton or wine. Clear it: the historical
// capital site matters more than one resource tile.
function clearStartResource(x, y) {
    const r = GameplayMap.getResourceType(x, y);
    if (r != ResourceTypes.NO_RESOURCE) {
        ResourceBuilder.setResourceType(x, y, ResourceTypes.NO_RESOURCE);
        console.log("Europe map: removed resource " + r + " from start tile (" + x + ", " + y + ")");
    }
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
    const MIN_SPACING = 5;

    const shifts = [];
    const place = (index, playerId, x, y, label, wantXY) => {
        clearStartFeature(x, y);
        clearStartResource(x, y);
        const plotIndex = GameplayMap.getIndexFromXY(x, y);
        StartPositioner.setStartPosition(plotIndex, playerId);
        startPositions[index] = plotIndex;
        taken.push([x, y]);
        // Verify: the settler must be able to found here on turn one, and a true start should sit
        // on its coordinates. Anything else is logged so a playthrough log shows it.
        const problems = [];
        if (!isValidStartTile(x, y)) problems.push("tile not valid");
        if (GameplayMap.getResourceType(x, y) != ResourceTypes.NO_RESOURCE) problems.push("resource left");
        const f = GameplayMap.getFeatureType(x, y);
        if (f != FeatureTypes.NO_FEATURE && featureBlocksSettlement(x, y)) problems.push("blocking feature");
        const shift = wantXY ? hexDistance(wantXY[0], wantXY[1], x, y) : 0;
        shifts.push(shift);
        if (problems.length) console.log("Europe map: WARNING start for player " + playerId + " at (" + x + ", " + y + ") " + problems.join(", "));
        if (shift > 0) console.log("Europe map: start for player " + playerId + " (" + label + ") is " + shift + " hex(es) from its coordinates");
        console.log("Europe map: start for player " + playerId + " (" + civTypeOf(playerId) + ") at (" + x + ", " + y + ") " + label);
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
            if (t && minDistanceTo(taken, t[0], t[1]) >= MIN_SPACING) {
                place(i, playerId, t[0], t[1], "TSL", grid.P.nearestTile(ll[0], ll[1]));
                usedSites.add(civ);
                done = true;
            } else {
                console.log("Europe map: TSL for " + civ + " unavailable, using a fallback site");
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
            place(i, playerId, best.t[0], best.t[1], best.site[2], grid.P.nearestTile(best.site[0], best.site[1]));
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
        else console.log("Europe map: FAILED to place player " + playerId);
    }
    const exact = shifts.filter((d) => d == 0).length;
    console.log("Europe map: " + shifts.length + " starts placed, " + exact + " on their exact tile, max shift " +
        (shifts.length ? Math.max.apply(null, shifts) : 0) + " hex(es)");
    return startPositions;
}

// ---------------------------------------------------------------------------

function generateMap() {
    console.log("Europe map: generating");
    console.log(`Age - ${GameInfo.Ages.lookup(Game.age).AgeType}`);
    const iWidth = GameplayMap.getGridWidth();
    const iHeight = GameplayMap.getGridHeight();
    const uiMapSize = GameplayMap.getMapSize();
    const mapInfo = GameInfo.Maps.lookup(uiMapSize);
    const iNumNaturalWonders = mapInfo ? mapInfo.NumNaturalWonders : 5;

    const rnd = () => TerrainBuilder.getRandomNumber(100000, "Europe Raster") / 100000;
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

    TerrainBuilder.modelRivers(5, 15, globals.g_NavigableRiverTerrain);
    TerrainBuilder.validateAndFixTerrain();
    TerrainBuilder.defineNamedRivers();

    applyBiomes(grid);
    boostStartFood(grid);
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
    const startPositions = assignEuropeStartPositions(grid);
    generateDiscoveries(iWidth, iHeight, startPositions, 1);
    dumpResources(iWidth, iHeight);
    FertilityBuilder.recalculate();
    assignAdvancedStartRegions();
    console.log("Europe map: done");
}

engine.on('RequestMapInitData', requestMapData);
engine.on('GenerateMap', generateMap);

console.log("Loaded europe-map.js");
