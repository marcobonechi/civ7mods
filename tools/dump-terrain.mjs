#!/usr/bin/env node
// Offline terrain dump of a window of one Europe map, without the game.
// Usage: node tools/dump-terrain.mjs <geo: europe|large|alt> <W> <H> <lon1> <lat1> <lon2> <lat2> [seed]
// Prints one row per hex row, top = north: '.' ocean, ',' coast, '^' mountain,
// lowercase = flat, UPPERCASE = hills, letter = biome (g grassland, p plains, d desert, t tundra, r tropical).
import { mkdtempSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [geoName, W, H, lon1, lat1, lon2, lat2, seedArg] = process.argv.slice(2);
if (!lat2) { console.error("usage: dump-terrain.mjs <europe|large|alt> W H lon1 lat1 lon2 lat2 [seed]"); process.exit(2); }
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "EuropeMediterranean", "maps");
const geoFile = { europe: "europe-geo.js", large: "europe-large-geo.js", alt: "europe-alt-geo.js" }[geoName];
// The map files are ES modules with a .js extension; copy them as .mjs so node accepts them.
const tmp = mkdtempSync(join(tmpdir(), "civ7-dump-"));
copyFileSync(join(root, "europe-raster.js"), join(tmp, "europe-raster.mjs"));
copyFileSync(join(root, geoFile), join(tmp, "geo.mjs"));
const { buildEuropeGrid, T } = await import(pathToFileURL(join(tmp, "europe-raster.mjs")).href);
const { GEO } = await import(pathToFileURL(join(tmp, "geo.mjs")).href);

let s = Number(seedArg ?? 7) >>> 0;
const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const grid = buildEuropeGrid(Number(W), Number(H), GEO, rnd);
const [x1, y1] = grid.P.nearestTile(Number(lon1), Number(lat2));
const [x2, y2] = grid.P.nearestTile(Number(lon2), Number(lat1));
const glyph = (i) => {
    const t = grid.terrain[i];
    if (t === T.OCEAN) return ".";
    if (t === T.COAST) return ",";
    if (t === T.MOUNTAIN) return "^";
    const b = (grid.biome[i] || "g").toLowerCase();
    return t === T.HILL ? b.toUpperCase() : b;
};
console.log(`${geoName} ${W}x${H}: columns ${x1}..${x2}, rows ${y1}..${y2} (row ${y1} is north)`);
for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
    let line = String(y).padStart(4) + " ";
    for (let x = x1; x <= x2; x++) line += grid.inBounds(x, y) ? glyph(grid.idx(x, y)) : " ";
    console.log(line + "   lat " + grid.latC[grid.idx(x1, y)].toFixed(2));
}
const lonRow = (y) => { let line = "     "; for (let x = x1; x <= x2; x++) line += ((x - x1) % 5 === 0) ? "|" : " "; return line; };
console.log(lonRow(y1) + "   every 5th column from lon " + grid.lonC[grid.idx(x1, Math.min(y1,y2))].toFixed(2));
