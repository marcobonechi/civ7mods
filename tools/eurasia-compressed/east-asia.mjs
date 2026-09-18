#!/usr/bin/env node
// East Asia for the Eurasia Compressed map (EuropeMediterranean/maps/europe-alt-geo.js).
//
// Russia, the North Caucasus, the Caspian and the Central Asian steppe are replaced by an
// "Eastern Ocean", and China, Korea, Manchuria, Mongolia and Japan are fitted into the space it
// frees. Everything East Asian here is written in REAL longitude/latitude; this script fits it
// into the map and writes plain coordinates into the geo file, between marker comments:
//
//     // @east-asia:begin ... // @east-asia:end
//
// so the geo file stays pure data (the map editor edits it as text) and a re-run replaces the
// blocks it wrote before. Edit this file, not the blocks, then:
//
//     node tools/eurasia-compressed/east-asia.mjs && ./preview/build-preview.sh
//
// The fit works in hex space on the 128x112 grid (the projection is the same at every size):
// real latitude maps linearly to a row, and at each row real longitude from WEST_LON to the
// east end of the land at that latitude (EAST_LON) is stretched between the moat on the west
// (LEFT, which keeps a sea gap from the South Caucasus, the Black Sea strip and Europe) and the
// map's right edge. The Eastern Ocean itself is drawn in the map's own coordinates.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAPS = path.join(HERE, "..", "..", "EuropeMediterranean", "maps");
const GEO_FILE = path.join(MAPS, "europe-alt-geo.js");
const { makeProjection } = await import(pathToFileURL(path.join(MAPS, "europe-raster.js")).href);
const { GEO } = await import(pathToFileURL(GEO_FILE).href + "?" + Date.now());

// ---- the fit ---------------------------------------------------------------------------------
const W = 128, H = 112;
const P = makeProjection(GEO, W, H);
const REAL_LAT = [18, 58.5], ROWS = [51, 104];        // real latitude -> row
const WEST_LON = 104;                                   // everything west of this is cut
const EAST_LON = [[18, 123], [25, 123], [30, 132], [34, 141.5], [41, 142.5], [45, 146], [58.5, 146]];
const RIGHT = 125.0;                                    // east end of the land, in columns
const LEFT = [[40, 118.5], [53, 118], [57, 114], [62, 109], [69, 105], [76, 100.5],
              [81, 96.5], [88, 92.5], [95, 90], [112, 90]];   // moat edge, row -> column
const lerpTable = (tab, v) => {
    if (v <= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) if (v <= tab[i][0]) {
        const t = (v - tab[i - 1][0]) / (tab[i][0] - tab[i - 1][0]);
        return tab[i - 1][1] + t * (tab[i][1] - tab[i - 1][1]);
    }
    return tab[tab.length - 1][1];
};
const toTile = (lon, lat) => {
    const row = ROWS[0] + (lat - REAL_LAT[0]) * (ROWS[1] - ROWS[0]) / (REAL_LAT[1] - REAL_LAT[0]);
    const east = lerpTable(EAST_LON, lat), left = lerpTable(LEFT, row);
    return [left + (lon - WEST_LON) / (east - WEST_LON) * (RIGHT - left), row];
};
// hex space -> map lon/lat (north of 33N there is no southern warp, so a row is a latitude)
const toMap = (xf, yf) => {
    const lat = P.latOf(yf);
    let lo = -40, hi = 140;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (P.toTile(mid, lat)[0] < xf) lo = mid; else hi = mid; }
    return [+((lo + hi) / 2).toFixed(2), +lat.toFixed(2)];
};
const fit = ([lon, lat]) => toMap(...toTile(lon, lat));
// Long edges are subdivided before fitting: the fit is not linear, so a straight edge in real
// coordinates (the 104E cut, the 58.5N cut, a polygon box) must follow it rather than cut a chord.
const densify = (pts, step = 0.75, closed = true) => {
    const out = [];
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
        const [a, b] = [pts[i], pts[(i + 1) % pts.length]];
        const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
        for (let j = 0; j < k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
    }
    if (!closed) out.push(pts[pts.length - 1]);
    return out;
};
const fitAll = (pts, closed = true) => densify(pts, 0.75, closed).map(fit);

// ---- real geography --------------------------------------------------------------------------
// Coastlines simplified to a few dozen points each; the mainland's west side is the 104E cut and
// its north side the 58.5N cut, both of which become the moat and the Arctic shore.
const MAINLAND = [
    [104.0, 17.8], [106.6, 17.5], [105.9, 18.8], [105.8, 19.6], [106.2, 20.2], [106.8, 20.8], [107.5, 21.3],
    [108.3, 21.6], [109.0, 21.5], [109.7, 21.5], [110.1, 20.9], [110.2, 20.3], [110.6, 20.9], [111.3, 21.5],
    [112.3, 21.7], [113.1, 22.1], [113.6, 22.5], [114.3, 22.3], [115.5, 22.8], [116.6, 23.2], [117.5, 23.8],
    [118.2, 24.5], [118.7, 25.0], [119.5, 25.7], [119.6, 26.6], [120.2, 27.4], [120.8, 28.0], [121.5, 28.8],
    [121.9, 29.9], [121.3, 30.4], [121.9, 30.9], [121.9, 31.6], [121.4, 32.3], [120.9, 32.8], [120.5, 33.6],
    [120.2, 34.3], [119.3, 34.8], [119.7, 35.6], [120.4, 36.1], [121.2, 36.7], [122.6, 37.1], [122.2, 37.6],
    [121.3, 37.6], [120.3, 37.6], [119.2, 37.2], [118.9, 37.9], [118.0, 38.6], [117.7, 39.1], [118.6, 39.2],
    [119.5, 39.8], [120.7, 40.4], [121.3, 40.9], [122.2, 40.6], [121.7, 39.6], [121.2, 38.8], [121.9, 39.0],
    [122.8, 39.6], [124.3, 39.9],
    // Korea
    [124.8, 39.6], [125.3, 39.0], [125.1, 38.6], [125.7, 38.0], [126.5, 37.7], [126.6, 37.3], [126.3, 36.8],
    [126.5, 36.1], [126.4, 35.1], [126.3, 34.6], [127.4, 34.6], [128.3, 34.8], [129.0, 35.1], [129.4, 35.5],
    [129.5, 36.1], [129.4, 36.8], [129.0, 37.6], [128.6, 38.3], [127.9, 38.9], [127.5, 39.3], [127.7, 39.8],
    [128.5, 40.3], [129.3, 40.8], [129.8, 41.3], [130.2, 42.0], [130.7, 42.3],
    // Primorye, the Amur mouth and the Okhotsk shore
    [131.2, 42.6], [131.9, 43.1], [132.4, 42.8], [133.2, 42.7], [134.2, 43.2], [135.3, 43.9], [136.3, 44.7],
    [137.3, 45.6], [138.2, 46.7], [138.8, 47.5], [139.6, 48.4], [140.3, 49.2], [140.5, 50.2], [140.6, 51.3],
    [141.4, 52.3], [141.2, 53.2], [140.2, 53.6], [139.0, 54.1], [137.8, 54.3], [136.8, 54.6], [137.4, 55.3],
    [138.2, 56.2], [139.5, 57.2], [141.0, 58.0], [142.0, 58.5],
    [104.0, 58.5],
];
const ISLANDS = {
    "Honshu": [[130.9, 34.0], [131.5, 34.5], [132.4, 35.3], [133.3, 35.6], [134.4, 35.6], [135.3, 35.7], [136.0, 35.9],
        [136.7, 36.9], [137.3, 37.5], [137.0, 36.8], [138.5, 37.4], [139.5, 38.4], [139.9, 39.4], [140.0, 40.4],
        [140.3, 41.2], [141.2, 41.2], [141.5, 40.4], [142.0, 39.5], [141.6, 38.3], [141.0, 37.2], [140.8, 36.2],
        [140.9, 35.4], [140.4, 35.1], [139.8, 34.9], [139.2, 35.2], [138.8, 34.6], [138.2, 34.6], [137.3, 34.6],
        [136.9, 34.3], [136.2, 34.0], [135.7, 33.5], [135.1, 34.0], [135.4, 34.7], [134.5, 34.7], [133.6, 34.5],
        [132.4, 34.2], [131.3, 33.9]],
    "Kyushu": [[129.7, 33.3], [130.1, 33.9], [130.9, 34.0], [131.7, 33.4], [131.9, 32.4], [131.4, 31.4], [130.7, 31.0],
        [130.2, 31.3], [130.3, 32.1], [129.8, 32.7]],
    "Shikoku": [[132.5, 33.0], [132.7, 33.8], [133.4, 34.2], [134.3, 34.3], [134.7, 33.8], [134.2, 33.3], [133.6, 33.4], [133.0, 32.8]],
    "Hokkaido": [[140.0, 41.5], [140.6, 41.7], [141.1, 41.8], [141.6, 42.6], [142.5, 42.2], [143.3, 41.9], [144.3, 42.9],
        [145.6, 43.3], [145.3, 44.3], [144.3, 44.1], [143.3, 44.5], [142.3, 45.4], [141.6, 45.3], [141.8, 44.3],
        [141.4, 43.3], [140.4, 43.3], [140.0, 42.3]],
    "Sakhalin": [[141.9, 46.1], [142.1, 47.2], [142.1, 48.6], [142.0, 50.0], [142.2, 51.5], [142.2, 53.2], [142.7, 54.3],
        [143.3, 53.4], [143.2, 52.0], [143.1, 50.5], [144.2, 49.2], [143.1, 49.3], [142.6, 47.7], [143.5, 46.8],
        [143.2, 46.5], [142.5, 46.6]],
    "Taiwan": [[120.1, 23.0], [120.3, 22.5], [120.7, 22.0], [121.0, 22.2], [121.4, 23.2], [121.9, 24.6], [121.9, 25.1],
        [121.5, 25.3], [121.0, 25.1], [120.6, 24.5], [120.2, 23.6]],
    "Hainan": [[108.6, 19.2], [108.7, 18.5], [109.6, 18.2], [110.4, 18.6], [111.0, 19.6], [110.6, 20.1], [109.9, 20.0], [109.2, 19.9]],
};
// One interior point per landmass, so each is its own Distant Land.
const ANCHORS = { "East Asia mainland": [114.0, 36.0], "Honshu": [138.2, 36.6], "Kyushu": [131.0, 32.8],
    "Shikoku": [133.5, 33.7], "Hokkaido": [142.5, 43.5], "Sakhalin": [142.8, 50.0], "Taiwan": [120.9, 23.8], "Hainan": [109.8, 19.2] };

// [name, core, fringe, points] - core/fringe are hex radii as everywhere else in the geo file
const RANGES = [
    ["Hengduan (the Sichuan rim)", 0.7, 1.3, [[104.4, 24.5], [104.6, 28.5], [104.4, 33.0], [104.6, 36.0]]],
    ["Qinling", 0.6, 1.3, [[104.8, 33.8], [108.0, 34.0], [111.0, 33.8]]],
    ["Taihang", 0.4, 1.1, [[113.5, 35.2], [114.0, 37.5], [115.3, 39.8]]],
    ["Yin Shan", 0.3, 1.0, [[107.0, 41.2], [111.0, 41.2], [113.5, 41.8]]],
    ["Greater Khingan", 0.4, 1.2, [[119.5, 43.5], [121.0, 47.0], [122.0, 50.5], [121.5, 53.0]]],
    ["Changbai", 0.5, 1.1, [[127.0, 41.5], [128.1, 42.0], [129.5, 43.0]]],
    ["Sikhote-Alin", 0.4, 1.1, [[133.0, 44.0], [135.5, 46.0], [138.0, 48.5]]],
    ["Nanling", 0.2, 1.1, [[110.0, 25.0], [113.0, 25.2], [116.0, 24.8]]],
    ["Wuyi", 0.3, 1.1, [[116.5, 26.5], [118.0, 27.8], [119.0, 28.8]]],
    ["Khentii", 0.3, 1.0, [[107.5, 48.0], [109.5, 48.8]]],
    ["Stanovoy", 0.15, 1.1, [[112.0, 56.5], [122.0, 56.0], [130.0, 56.5], [136.0, 57.0]]],
    ["Taebaek", 0.35, 1.0, [[128.3, 38.6], [128.8, 37.0], [129.0, 35.8]]],
    ["Japanese Alps", 0.6, 1.1, [[136.8, 35.6], [137.6, 36.3], [138.2, 37.0]]],
    ["Ou Mountains", 0.35, 0.9, [[140.6, 37.5], [140.9, 39.5], [140.9, 41.0]]],
    ["Hidaka", 0.3, 0.8, [[142.6, 42.3], [143.0, 43.3]]],
    ["Taiwan", 0.5, 0.9, [[120.8, 22.5], [121.3, 24.5]]],
];
const VOLCANOES = [[138.73, 35.36, "Fuji"], [128.08, 42.0, "Paektu"]];
// rivers: mouth first
const RIVERS = [
    ["Yellow River", [[118.9, 37.75], [117.0, 36.7], [114.3, 34.8], [111.2, 34.8], [110.3, 34.6], [110.4, 36.5],
        [110.5, 39.5], [109.8, 40.6], [107.0, 40.8], [106.4, 39.0], [105.5, 37.4], [104.3, 36.2]]],
    ["Yangtze", [[121.8, 31.4], [118.8, 32.1], [117.0, 30.5], [114.3, 30.6], [113.1, 29.4], [112.2, 30.3],
        [111.3, 30.7], [106.6, 29.6], [104.7, 28.8]]],
    ["Amur", [[140.7, 53.1], [137.0, 50.6], [135.1, 48.5], [131.0, 47.7], [127.5, 50.3], [124.0, 53.2]]],
    ["Red", [[106.6, 20.3], [105.8, 21.0], [104.6, 22.2]]],
];
// [name, biome or null, rain or null, prob, polygon] - appended after the European areas, so they win
const BIOMES = [
    ["East Asia", "G", 110, undefined, [[103, 17], [147, 17], [147, 59], [103, 59]]],
    ["South China (subtropical)", "G", 150, undefined, [[103, 17], [124, 17], [124, 30], [103, 30]]],
    ["South China coast (tropical)", "R", 160, 0.6, [[103, 17], [124, 17], [124, 23.5], [103, 23.5]]],
    ["North China Plain and the Loess", "P", 70, undefined, [[104, 33.5], [118, 33.5], [122, 40.5], [112, 41], [104, 40]]],
    ["Mongolian steppe", "P", 45, undefined, [[104, 40.5], [117, 42], [119.5, 44], [119.5, 50], [104, 52]]],
    ["Gobi", "D", 15, undefined, [[104, 40.3], [111, 41.8], [113.5, 44], [108, 45.8], [104, 45]]],
    ["Manchuria", "G", 100, undefined, [[119.5, 41], [135, 42], [135, 50], [119.5, 50]]],
    ["Siberian taiga", "T", 90, 0.7, [[103, 53], [147, 53], [147, 59], [103, 59]]],
];
// first match wins in resourceAreas, so these are written at the top of the list
const RESOURCES = [
    ["Japan", 9, ["RESOURCE_FISH", "RESOURCE_SILVER", "RESOURCE_GOLD", "RESOURCE_WHALES", "RESOURCE_SILK", "RESOURCE_HARDWOOD", "RESOURCE_PEARLS"],
        [[129, 30.5], [146.5, 30.5], [146.5, 46], [129, 46]]],
    ["Korea", 9, ["RESOURCE_IRON", "RESOURCE_GOLD", "RESOURCE_SILK", "RESOURCE_FISH", "RESOURCE_KAOLIN"], [[124.5, 34], [130.5, 34], [130.5, 42.5], [124.5, 42.5]]],
    ["South China", 9, ["RESOURCE_SILK", "RESOURCE_KAOLIN", "RESOURCE_CITRUS", "RESOURCE_DYES", "RESOURCE_PEARLS", "RESOURCE_TIN", "RESOURCE_COTTON", "RESOURCE_SPICES"],
        [[103, 17], [124, 17], [124, 30.5], [103, 30.5]]],
    ["North China", 9, ["RESOURCE_SILK", "RESOURCE_IRON", "RESOURCE_COAL", "RESOURCE_SALT", "RESOURCE_HORSES", "RESOURCE_COTTON", "RESOURCE_KAOLIN"],
        [[103, 30.5], [124.5, 30.5], [124.5, 41], [103, 41]]],
    ["Mongolia", 11, ["RESOURCE_HORSES", "RESOURCE_HIDES", "RESOURCE_WOOL", "RESOURCE_SALT", "RESOURCE_CAMELS"], [[103, 41], [119.5, 41], [119.5, 53], [103, 53]]],
    ["Manchuria and the Amur", 11, ["RESOURCE_FURS", "RESOURCE_HARDWOOD", "RESOURCE_HIDES", "RESOURCE_WILD_GAME", "RESOURCE_GOLD", "RESOURCE_IRON"],
        [[119.5, 41], [147, 41], [147, 59], [103, 59], [103, 53], [119.5, 53]]],
];
// true starts (real coordinates); the geo file's own entries for these keys are removed once
const STARTS = {
    CIVILIZATION_HAN: [108.94, 34.26, "Chang'an (Xi'an), on the Wei - the Han capital"],
    CIVILIZATION_MING: [118.80, 32.06, "Nanjing, on the Yangtze - the first Ming capital"],
    CIVILIZATION_QING: [116.40, 39.90, "Beijing - the Qing capital"],
    CIVILIZATION_HEIAN: [135.77, 35.01, "Heian-kyo (Kyoto)"],
    CIVILIZATION_SENGOKU: [135.77, 35.01, "Kyoto - the capital the warlords fought over"],
    CIVILIZATION_MEIJI: [139.69, 35.69, "Tokyo"],
    CIVILIZATION_SILLA: [128.20, 36.30, "the upper Nakdong, Silla's heartland - Gyeongju itself lands 4 hexes from Kyoto across the compressed strait"],
    CIVILIZATION_GORYEO: [126.55, 37.97, "Kaesong - the Goryeo capital"],
    CIVILIZATION_JOSEON: [126.98, 37.57, "Hanseong (Seoul) - the Joseon capital"],
    CIVILIZATION_MONGOLIA: [106.90, 47.90, "the Tuul valley, the Khans' home steppe (Karakorum lies west of the cut)"],
};
// fallback sites, appended after Europe's
const SITES = [[113.26, 23.13, "Guangzhou"], [114.30, 30.59, "Wuhan"], [120.15, 30.27, "Hangzhou"], [114.31, 34.80, "Kaifeng"],
    [123.43, 41.80, "Shenyang"], [126.63, 45.75, "Harbin"], [125.75, 39.02, "Pyongyang"], [129.04, 35.10, "Busan"],
    [140.87, 38.27, "Sendai"], [141.35, 43.06, "Sapporo"], [130.40, 33.59, "Fukuoka"], [121.56, 25.04, "Taipei"],
    [131.90, 43.12, "Vladivostok"], [105.85, 21.03, "Hanoi"], [118.59, 24.91, "Quanzhou"], [113.30, 40.08, "Datong"],
    [111.67, 40.82, "Hohhot"]];

// ---- Eastern Ocean (map coordinates, not fitted) ------------------------------------------
// The sea that replaces Russia, the North Caucasus, the Caspian and the steppe. Its west side
// follows Finland's, Estonia's, Latvia's, Belarus's and Ukraine's borders with Russia; around
// the Sea of Azov and the Kuban it keeps a strip of land about two hexes wide; then it runs along
// the Greater Caucasus crest (north of Elbrus), down Azerbaijan's Caspian shore, along Iran's
// Caspian coast and the Kopet Dag, and out past the map's east edge.
const OCEAN = [
    [30.9, 75.0], [30.9, 69.75], [28.9, 69.05], [28.4, 68.5], [29.5, 68.0], [30.0, 67.7], [29.1, 66.9], [30.1, 65.7],
    [29.7, 64.8], [30.5, 64.2], [30.0, 63.7], [31.5, 62.9], [31.0, 62.2], [29.6, 61.3], [28.6, 60.9], [27.8, 60.55],
    [28.05, 59.45], [28.1, 59.0], [27.7, 58.0], [27.5, 57.52], [27.9, 57.2], [28.1, 56.6], [28.2, 56.15],
    [29.4, 55.95], [30.9, 55.6], [31.2, 54.6], [31.8, 53.8], [32.7, 53.3], [32.3, 52.8], [31.8, 52.1],
    [33.2, 52.35], [34.1, 51.9], [34.4, 51.3], [35.3, 51.1], [35.6, 50.4], [36.6, 50.2], [37.5, 50.3],
    [38.2, 49.95], [39.2, 49.8], [40.1, 49.6], [40.0, 48.9], [39.8, 48.3],
    // the strip round the Sea of Azov and the Kuban
    [40.6, 47.7], [41.0, 47.0], [40.8, 46.2], [41.2, 45.4], [41.6, 44.6], [42.2, 44.1],
    // the Greater Caucasus crest, north of Elbrus
    [42.5, 43.8], [43.5, 43.5], [44.6, 43.1], [45.6, 42.95], [46.5, 42.6], [47.3, 42.2], [48.0, 41.95],
    // Azerbaijan's and Iran's Caspian shores, then the Kopet Dag
    [48.6, 41.8], [49.5, 41.5], [49.8, 40.7], [50.3, 40.3], [48.85, 38.8], [48.9, 38.4], [49.5, 37.5],
    [51.0, 36.75], [52.0, 36.7], [53.9, 37.0], [54.2, 37.4], [55.5, 38.0], [56.5, 38.2], [57.4, 37.95],
    [58.4, 37.7], [59.3, 37.3], [60.4, 36.6], [61.2, 36.6], [85.0, 36.6], [85.0, 75.0],
];

// Russian features the ocean replaces: removed from the geo file once, by name.
const REMOVE = {
    lakes: ["Ladoga", "Onega", "Ilmen", "Beloye", "Imandra"],
    landBlobs: ["Kolguyev"],
    rivers: ["Volga", "Don"],
    ranges: ["Valdai Hills", "Central Russian Upland", "Urals", "Valdai", "Volga Upland", "Timan Ridge", "Khibiny"],
    fallbackSites: ["Moscow", "Kazan", "Novgorod", "Petersburg", "Sarai", "Smolensk"],
    tsl: Object.keys(STARTS).concat(["CIVILIZATION_RUSSIA"]),
};
// Russia keeps a European start on the one piece of Russia left: Rostov-on-Don, on the strip.
const RUSSIA = [39.72, 47.23, "Rostov-on-Don, the one piece of Russia the Eastern Ocean leaves"];

// ---- writing ---------------------------------------------------------------------------------
const f = (n) => +n.toFixed(2);
const pts = (a) => "[" + a.map(([x, y]) => `[${f(x)}, ${f(y)}]`).join(", ") + "]";
const q = (s) => JSON.stringify(s);
const I = "        ";
const blocks = {
    land: [
        `${I}{ name: "East Asia", late: true, pts: ${pts(fitAll(MAINLAND))} },`,
        ...Object.entries(ISLANDS).map(([n, p]) => `${I}{ name: ${q(n)}, late: true, pts: ${pts(fitAll(p))} },`),
    ],
    water: [`${I}{ name: "Eastern Ocean", pts: ${pts(OCEAN)} },`],
    distantLandsAnchors: Object.entries(ANCHORS).map(([n, p]) => { const [x, y] = fit(p); return `${I}[${x}, ${y}],   // ${n}`; }),
    ranges: RANGES.map(([n, c, fr, p]) => `${I}{ name: ${q(n)}, core: ${c}, fringe: ${fr}, pts: ${pts(densify(p, 2.0, false).map(fit))} },`),
    rivers: RIVERS.map(([n, p]) => `${I}{ name: ${q(n)}, pts: ${pts(p.map(fit))} },`),
    volcanoes: [VOLCANOES.map(([lo, la, n]) => { const [x, y] = fit([lo, la]); return `[${x}, ${y}, ${q(n)}]`; }).join(", ") + ","].map((l) => I + l),
    biomeAreas: BIOMES.filter((b) => b[1]).map(([n, b, , pr, p]) => `${I}{ name: ${q(n)}, biome: ${q(b)},${pr !== undefined ? ` prob: ${pr},` : ""} pts: ${pts(densify(p, 2.0).map(fit))} },`),
    rainAreas: BIOMES.filter((b) => b[2] !== null).map(([n, , r, , p]) => `${I}{ name: ${q(n)}, rain: ${r}, pts: ${pts(densify(p, 2.0).map(fit))} },`),
    resourceAreas: RESOURCES.map(([n, d, r, p]) => `${I}{ name: ${q(n)}, density: ${d}, resources: ${JSON.stringify(r).replace(/","/g, '", "')}, pts: ${pts(densify(p, 2.0).map(fit))} },`),
    tsl: [...Object.entries(STARTS).map(([k, [lo, la, c]]) => { const [x, y] = fit([lo, la]); return `${I}${k}: [${x}, ${y}],   // ${c}`; }),
          `${I}CIVILIZATION_RUSSIA: [${RUSSIA[0]}, ${RUSSIA[1]}],   // ${RUSSIA[2]}`],
    fallbackSites: [SITES.map(([lo, la, n]) => { const [x, y] = fit([lo, la]); return `[${x}, ${y}, ${q(n)}]`; }).join(", ") + ","].map((l) => I + l),
};
// where each block goes: "start" of the array/object, or "end" (for lists where later entries win)
const PLACE = { land: "start", water: "start", distantLandsAnchors: "end", ranges: "start", rivers: "start", volcanoes: "end",
                 biomeAreas: "end", rainAreas: "end", resourceAreas: "start", tsl: "start", fallbackSites: "end" };

let text = fs.readFileSync(GEO_FILE, "utf8");
const BEGIN = "// @east-asia:begin - generated by tools/eurasia-compressed/east-asia.mjs; edit that, not this",
      END = "// @east-asia:end";

// one-time removals (a no-op once they are gone)
const keyRange = (key) => {
    const open = new RegExp(`\\n    ${key}: [\\[{]\\n`).exec(text);
    if (!open) throw new Error("no key " + key);
    const start = open.index + open[0].length;
    const close = text.indexOf("\n    ]", start) >= 0 && key !== "tsl" ? text.indexOf("\n    ]", start) : text.indexOf("\n    }", start);
    return [start, close];
};
for (const [key, names] of Object.entries(REMOVE)) {
    let [a, b] = keyRange(key);
    let body = text.slice(a, b);
    for (const n of names) {
        if (key === "tsl") body = body.replace(new RegExp(`^ *${n}:\\s*\\[[^\\]]*\\],?[^\\n]*\\n`, "gm"), "");
        else if (key === "lakes" || key === "landBlobs" || key === "fallbackSites")
            body = body.replace(new RegExp(`\\s*\\[[^\\[\\]]*${q(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\],?`), "");
        else body = body.replace(new RegExp(`^ *\\{ name: ${q(n)}[^\\n]*\\n`, "m"), "");
    }
    text = text.slice(0, a) + body + text.slice(b);
}

for (const [key, lines] of Object.entries(blocks)) {
    const block = `${I}${BEGIN}\n${lines.join("\n")}\n${I}${END}\n`;
    const [a, b] = keyRange(key);
    const body = text.slice(a, b);
    const s = body.indexOf(`${I}${BEGIN}`);
    let nb;
    if (s >= 0) {
        // the end marker is followed by a newline, or ends the body when the block closes the list
        let e = body.indexOf(`${I}${END}`, s);
        if (e < 0) throw new Error("unterminated East Asia block in " + key);
        e += `${I}${END}`.length;
        const atEnd = e >= body.length;
        if (!atEnd && body[e] === "\n") e++;
        nb = body.slice(0, s) + (atEnd ? block.replace(/\n$/, "") : block) + body.slice(e);
    } else if (PLACE[key] === "start") {
        nb = block + body;
    } else {
        // append: the element before must end with a comma
        const trimmed = body.replace(/\s+$/, "");
        const lastLine = trimmed.slice(trimmed.lastIndexOf("\n") + 1);
        const code = lastLine.replace(/\/\/.*$/, "").trimEnd();
        let fixed = trimmed;
        if (code && !code.endsWith(",") && !code.endsWith("[") && !code.endsWith("{")) {
            const cut = trimmed.lastIndexOf("\n") + 1 + code.length;
            fixed = trimmed.slice(0, cut) + "," + trimmed.slice(cut);
        }
        nb = fixed + "\n" + block.replace(/\n$/, "");
    }
    text = text.slice(0, a) + nb + text.slice(b);
}
fs.writeFileSync(GEO_FILE, text);
console.log("wrote East Asia into " + path.relative(process.cwd(), GEO_FILE));
for (const [n, p] of Object.entries({ Beijing: [116.4, 39.9], Shanghai: [121.5, 31.2], Guangzhou: [113.3, 23.1], Seoul: [127, 37.6], Tokyo: [139.7, 35.7], Sapporo: [141.35, 43.06] })) {
    const [x, y] = toTile(...p); console.log(`  ${n.padEnd(10)} -> hex ${x.toFixed(1)},${y.toFixed(1)} (128x112)  map ${fit(p)}`);
}
