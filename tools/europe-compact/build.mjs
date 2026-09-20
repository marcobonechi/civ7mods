#!/usr/bin/env node
// Builds EuropeMediterranean/maps/europe-compact-geo.js from europe-large-geo.js.
//
// Europe & Mediterranean (Compact): the same geography on a smaller grid, got by cutting and
// squeezing the empty parts far more than by scaling: Italy, France, Greece and the rest of the
// core are at 94% of the tile scale they have on the 112x98 map:
//   - east of 34E every screen degree covers 1.8 geographic degrees (1.35 from 35E on the large map):
//     Russia, the Caucasus and Iran take far fewer columns
//   - the Atlantic is trimmed on the left, and Iceland moves in towards the Faroes to fit
//   - the Sahel/Sahara band, the desert rows between 27N and 31N and everything north of 54N are squashed
//   - Iberia and West Africa are three columns narrower, which the Atlantic gains; Iceland is
//     smaller and sits level with northern Scotland
//   - Ireland is smaller, and the two Atlantic islets move in with the coast
// Islands are moved in TILE space (measured on the 112x98 grid, re-projected on the compact one),
// so they keep their shape whatever the projection does around them.
//
//   node tools/europe-compact/build.mjs            # rebuild (the map editor runs this on save)
//   node tools/europe-compact/build.mjs --check    # exit 1 if the file is out of date
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GEO as LARGE } from "../../EuropeMediterranean/maps/europe-large-geo.js";
import { makeProjection } from "../../EuropeMediterranean/maps/europe-raster.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "..", "EuropeMediterranean", "maps", "europe-compact-geo.js");

export const REF = { W: 112, H: 98 };      // the grid the large geography is measured on
export const SIZE = { W: 90, H: 76 };      // the compact grid: core Europe at 94% of the 112x98 tile scale

// ---- projection ------------------------------------------------------------
// Rows per latitude band on the compact grid. South of 54N this is the large map's spacing at 94%
// with the Sahel/Sahara band (12.6 rows there) and the desert strip 27-31N (8.7) squashed. North of
// 54N the rows run out fast - Scandinavia and northern Russia lose six more rows - and the top row
// is open sea (topWater), so the Arctic Ocean closes the map instead of land running off it.
const BANDS = [[10.0, 0], [27.0, 7.2], [31.0, 5.7], [46.0, 30.8], [54.0, 16.7], [60.0, 8.2], [66.0, 3.4], [71.0, 3.0]];
const rowsTotal = BANDS.reduce((s, b) => s + b[1], 0);
let acc = 0;
const latControl = BANDS.map(([lat, rows]) => { acc += rows; return [lat, +(acc / rowsTotal).toFixed(4)]; });

const PROJ = {
    lonCenter: 18.0,                         // screen -12 .. 48 at 47N
    spanRef: 60,
    lonSqueeze: { from: 34.0, k: 1.8 },
    latTop: 71.0,
    topWater: { rows: 1 },
    rangeScale: 1.36,                        // range widths are in hexes: the large map's 1.45 at this scale
    blobScale: 1.27,                         // likewise, from 1.35
    // West Africa south of 30N is squeezed harder (2.2 on the large map), so the bulge from Senegal
    // to Ghana clears the left edge with sea to spare.
    lonSqueezeWest: { segments: [[-2.0, 3.0]], latFull: 30.0, latNone: 33.0 },
    latControl,
};

// ---- islands, moved in tile space -------------------------------------------
// box: [lon0, lat0, lon1, lat1] in the large geography; anchor: a point of the island; to: where
// that point goes on the compact map; scale: tile-space scale about the anchor.
const MOVES = [
    { name: "Iceland", box: [-26, 61.6, -12.5, 70.5], anchor: [-19.0, 65.5], to: [-13.0, 60.8], scale: 0.75 },
    { name: "Ireland", box: [-11, 51.2, -5.45, 55.35], anchor: [-6.0, 53.4], to: [-6.0, 53.4], scale: 0.78 },
    { name: "Atlantic islets", box: [-13.5, 44, -11.5, 47.5], anchor: [-12.0, 47.0], to: [-9.6, 47.0], scale: 1.0 },
];

// ---- the western squeeze ------------------------------------------------------
// Iberia and West Africa give up SHIFT columns to the Atlantic: everything RAMP columns or more west
// of ANCHOR_LON moves east by SHIFT hexes, the land between is compressed evenly, and nothing east
// of the anchor (Cap de Creus) moves. Full strength up to the north coast of Spain, fading out
// over the Bay of Biscay so France keeps its coast.
const WEST = { anchorLon: 3.3, ramp: 20, shift: 3, latFull: 43.9, latNone: 45.4 };

const geo = JSON.parse(JSON.stringify(LARGE));
Object.assign(geo, PROJ);
geo.gridSizes = [[SIZE.W, SIZE.H]];      // europe-large-core.js uses this geography on this grid only
const P0 = makeProjection(LARGE, REF.W, REF.H);
const P1 = makeProjection(geo, SIZE.W, SIZE.H);

// continuous tile -> lon/lat on the compact grid. toTile is monotonic in each axis; the row depends
// on the longitude south of 33N (southWarp), so the two bisections are repeated until they agree.
function fromTile(xf, yf) {
    let lon = 10, lat = 45;
    for (let pass = 0; pass < 6; pass++) {
        let lo = -30, hi = 89;
        for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (P1.toTile(lon, m)[1] < yf) lo = m; else hi = m; }
        lat = (lo + hi) / 2;
        lo = -80; hi = 120;
        for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (P1.toTile(m, lat)[0] < xf) lo = m; else hi = m; }
        lon = (lo + hi) / 2;
    }
    return [lon, lat];
}
const inBox = (p, b) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
const isPoint = (a) => Array.isArray(a) && a.length >= 2 && typeof a[0] === "number" && typeof a[1] === "number";
const round = (v) => Math.round(v * 1000) / 1000;

function mover(m) {
    const a0 = P0.toTile(m.anchor[0], m.anchor[1]), a1 = P1.toTile(m.to[0], m.to[1]);
    return (p) => {
        const t = P0.toTile(p[0], p[1]);
        const ll = fromTile(a1[0] + m.scale * (t[0] - a0[0]), a1[1] + m.scale * (t[1] - a0[1]));
        p[0] = round(ll[0]); p[1] = round(ll[1]);
    };
}
const SKIP = new Set(["latControl", "southWarp", "lonSqueeze", "lonSqueezeWest"]);
const moved = {};
for (const m of MOVES) {
    const move = mover(m);
    moved[m.name] = 0;
    // A list of points (a coastline, a river, a biome area) moves only if all of it is in the box,
    // so an area that merely overlaps the island is left where it is rather than torn.
    // Only a `pts` list is a shape; every other list of points (blobs, lakes, volcanoes, sites,
    // anchors) holds independent places.
    const walk = (node, key) => {
        if (isPoint(node)) { if (inBox(node, m.box)) { move(node); moved[m.name]++; } return; }
        if (Array.isArray(node)) {
            if (key === "pts") {
                if (node.every((p) => inBox(p, m.box))) { node.forEach(move); moved[m.name] += node.length; }
                return;
            }
            node.forEach((c) => walk(c, null)); return;
        }
        if (node && typeof node === "object") {
            // A { lon, lat } record is a place too: the natural wonder pins and the wonder sites
            // are written that way, and one in Iceland has to travel with Iceland.
            if (typeof node.lon === "number" && typeof node.lat === "number" && inBox([node.lon, node.lat], m.box)) {
                const p = [node.lon, node.lat]; move(p);
                node.lon = p[0]; node.lat = p[1]; moved[m.name]++;
            }
            for (const k of Object.keys(node)) if (!SKIP.has(k)) walk(node[k], k);
        }
    };
    walk(geo, null);
}

// ---- starts that the smaller scale pushes under the 5-hex spacing (europe-large-core.js) -------
// At 94% scale three pairs of true starts land 3-4 hexes apart, and the later civ of each pair
// would fall back to a generic site. Each moves to another seat of the same people.
const STARTS = {
    CIVILIZATION_ETRUSCANS: [12.10, 44.70],   // Spina, the Etruscan port on the Adriatic (Populonia is 3 hexes from Rome here)
    CIVILIZATION_PERSIA: [50.0, 32.3],        // up the Karun into Elam, clear of Babylon
    CIVILIZATION_ABBASID: [44.0, 34.2],       // Samarra, the Abbasid capital upriver: Baghdad is hemmed in by both rivers here
    CIVILIZATION_NORMAN: [0.09, 48.43],       // Alencon, on the southern march of Normandy, clear of London
    // Not spacing: at three quarters scale the start landed on the same hex as Iceland's wonder
    // site and on the Hvita's course. One hex west onto the coast leaves both room.
    CIVILIZATION_ICELAND: [-14.14, 58.83],
};
for (const [civ, ll] of Object.entries(STARTS)) {
    if (!geo.tsl[civ]) throw new Error("no such start: " + civ);
    geo.tsl[civ] = ll;
}

// ---- room around starts the squeeze has walled in ------------------------------------------
// Ethiopia has half the rows it has on the large map, so its ranges close round Axum and Gondar
// and leave a city there nothing to build on. A pass corridor turns those mountains into hills.
geo.passes.push({ name: "Axum-Gondar plateau (compact)", radius: 1.3, pts: [[37.2, 12.4], [38.0, 13.2], [38.8, 14.2]] });

// the western squeeze, applied to every coordinate in the file
{
    let n = 0;
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const shiftOf = (lon, lat) => {
        const w = clamp01((WEST.latNone - lat) / (WEST.latNone - WEST.latFull));
        if (w <= 0) return null;
        const t = P1.toTile(lon, lat), xA = P1.toTile(WEST.anchorLon, lat)[0];
        const dx = WEST.shift * w * clamp01((xA - t[0]) / WEST.ramp);
        return dx > 1e-6 ? fromTile(t[0] + dx, t[1]) : null;
    };
    const walk = (node) => {
        if (isPoint(node)) { const ll = shiftOf(node[0], node[1]); if (ll) { node[0] = round(ll[0]); node[1] = round(ll[1]); n++; } return; }
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (node && typeof node === "object") {
            if (typeof node.lon === "number" && typeof node.lat === "number") {
                const ll = shiftOf(node.lon, node.lat); if (ll) { node.lon = round(ll[0]); node.lat = round(ll[1]); n++; }
            }
            for (const k of Object.keys(node)) if (!SKIP.has(k)) walk(node[k]);
        }
    };
    walk(geo);
    moved["western squeeze"] = n;
}

// where tools/check-map-sizes.mjs should look for the islands this file has moved
geo.checkIslands = {};
for (const [name, ll] of [["Ireland", [-8.0, 53.3]], ["Iceland", [-19.0, 64.8]]]) {
    const p = [...ll]; mover(MOVES.find((m) => m.name === name))(p); geo.checkIslands[name] = p;
}

const header = `// europe-compact-geo.js - GENERATED by tools/europe-compact/build.mjs from europe-large-geo.js.
// Do not edit by hand: edit europe-large-geo.js (shared geography) or the build script (what is
// compact-only: the projection, Iceland, Ireland, the Atlantic islets), then rebuild.
// Authored for a ${SIZE.W}x${SIZE.H} grid.
`;
const text = `${header}\nexport const GEO = ${JSON.stringify(geo, null, 1)};\n`;
if (process.argv.includes("--check")) {
    const rel = path.relative(process.cwd(), OUT);
    const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
    if (now !== text) { console.log(`${rel} is out of date with europe-large-geo.js - run: node tools/europe-compact/build.mjs`); process.exit(1); }
    console.log(`${rel} is up to date`);
    process.exit(0);
}
fs.writeFileSync(OUT, text);
console.log(`wrote ${path.relative(process.cwd(), OUT)}  ${SIZE.W}x${SIZE.H} = ${SIZE.W * SIZE.H} tiles, ` +
    `${(100 * SIZE.W * SIZE.H / (REF.W * REF.H)).toFixed(1)}% of ${REF.W}x${REF.H}`);
console.log("latControl", JSON.stringify(latControl));
console.log("points moved", JSON.stringify(moved));
