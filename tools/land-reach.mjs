#!/usr/bin/env node
// How far can a land unit actually walk from a true start, on one of the Europe maps, offline?
//
// Mountains are Impassable="true" in the base game (base-standard/data/terrain.xml), so a range
// with no gap is a wall, not slow ground. That is easy to write into a geo file without noticing:
// europe-geo.js had the Apennines running down the spine of Italy with an unbroken mountain core
// and the Alps closing the top, which left Rome, Etruria and Florence sharing a pocket of seven to
// thirty-seven tiles with no land route to the rest of Europe at any grid size. Nothing in the
// map output says so; you have to flood-fill for it.
//
//   node tools/land-reach.mjs <europe|large|alt> <W> <H> <lon> <lat> [seed]
//
// Prints the walkable-tile count and the northernmost latitude reached. On a healthy start the
// count is in the thousands and the map's own northern edge comes back as the latitude.
//
// Grid sizes, from the map scripts: europe-map.js uses 56x50, 66x60, 78x70, 90x80, 102x92;
// europe-large-core.js (the Large and Variant maps) uses 60x38, 74x46, 84x54, 96x60, 106x66 and
// 112x98, 128x112, 144x126. Terrain is seeded, so sweep a few seeds.
import { mkdtempSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [geoName, W, H, lon, lat, seedArg] = process.argv.slice(2);
if (!lat) { console.error("usage: land-reach.mjs <europe|large|alt> W H lon lat [seed]"); process.exit(2); }
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "EuropeMediterranean", "maps");
const geoFile = { europe: "europe-geo.js", large: "europe-large-geo.js", alt: "europe-alt-geo.js" }[geoName];
if (!geoFile) { console.error("unknown geo: " + geoName); process.exit(2); }
// The map files are ES modules with a .js extension; copy them as .mjs so node accepts them.
const tmp = mkdtempSync(join(tmpdir(), "civ7-reach-"));
copyFileSync(join(root, "europe-raster.js"), join(tmp, "europe-raster.mjs"));
copyFileSync(join(root, geoFile), join(tmp, "geo.mjs"));
const { buildEuropeGrid, T } = await import(pathToFileURL(join(tmp, "europe-raster.mjs")).href);
const { GEO } = await import(pathToFileURL(join(tmp, "geo.mjs")).href);

let s = Number(seedArg ?? 7) >>> 0;
const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const WW = Number(W), HH = Number(H);
const g = buildEuropeGrid(WW, HH, GEO, rnd);

const walkable = (x, y) => {
    if (!g.inBounds(x, y)) return false;
    const t = g.terrain[g.idx(x, y)];
    return t !== T.OCEAN && t !== T.COAST && t !== T.MOUNTAIN;
};
const neighbours = (x, y) => (y & 1
    ? [[1, 0], [-1, 0], [0, 1], [1, 1], [0, -1], [1, -1]]
    : [[1, 0], [-1, 0], [-1, 1], [0, 1], [-1, -1], [0, -1]]).map(([dx, dy]) => [x + dx, y + dy]);

// A true start is given in lon/lat and often lands on a coastal tile that is water at this
// resolution; take the nearest walkable tile, as the game's own start placement does.
let [sx, sy] = g.P.nearestTile(Number(lon), Number(lat));
if (!walkable(sx, sy)) {
    let best = null, bestD = Infinity;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        if (!walkable(sx + dx, sy + dy)) continue;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = [sx + dx, sy + dy]; }
    }
    if (!best) { console.log(`${geoName} ${W}x${H}: no walkable tile within 4 of ${lon},${lat}`); process.exit(0); }
    [sx, sy] = best;
}

const seen = new Set([sy * WW + sx]);
const stack = [[sx, sy]];
let maxLat = -Infinity, maxLatAt = null;
while (stack.length) {
    const [x, y] = stack.pop();
    const la = g.latC[g.idx(x, y)];
    if (la > maxLat) { maxLat = la; maxLatAt = [x, y]; }
    for (const [nx, ny] of neighbours(x, y)) {
        const key = ny * WW + nx;
        if (!seen.has(key) && walkable(nx, ny)) { seen.add(key); stack.push([nx, ny]); }
    }
}
const i = g.idx(sx, sy);
console.log(`${geoName} ${W}x${H} seed ${seedArg ?? 7}: start (${sx},${sy}) at `
    + `${g.lonC[i].toFixed(2)},${g.latC[i].toFixed(2)} -> ${seen.size} walkable tiles, `
    + `north to lat ${maxLat.toFixed(2)} at (${maxLatAt})`);
