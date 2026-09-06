#!/usr/bin/env node
// Count how many regional resource areas cover each hex of a Europe map, offline.
// Usage: node tools/resource-overlap.mjs <large|alt> [W H]
// Water areas (only sea resources) count on water hexes, land areas on land hexes.
import { mkdtempSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const [geoName, W = "128", H = "112"] = process.argv.slice(2);
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "EuropeMediterranean", "maps");
const geoFile = { europe: "europe-geo.js", large: "europe-large-geo.js", alt: "europe-alt-geo.js" }[geoName];
const tmp = mkdtempSync(join(tmpdir(), "civ7-ov-"));
copyFileSync(join(root, "europe-raster.js"), join(tmp, "europe-raster.mjs"));
copyFileSync(join(root, geoFile), join(tmp, "geo.mjs"));
const { buildEuropeGrid, T } = await import(pathToFileURL(join(tmp, "europe-raster.mjs")).href);
const { GEO } = await import(pathToFileURL(join(tmp, "geo.mjs")).href);
let s = 7; const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const grid = buildEuropeGrid(Number(W), Number(H), GEO, rnd);
const SEA = new Set(["RESOURCE_FISH", "RESOURCE_CRABS", "RESOURCE_TURTLES", "RESOURCE_PEARLS", "RESOURCE_WHALES", "RESOURCE_DYES", "RESOURCE_COWRIE"]);   // cowrie sits on coast water
// A mixed area (land and sea resources) counts on both kinds of hex. A `fill` area is a catch-all:
// the map script applies it only to hexes no other area of the same kind covers.
const areas = (GEO.resourceAreas || []).map((a) => ({ name: a.name, pts: a.pts, fill: !!a.fill, water: a.resources.every((r) => SEA.has(r)), land: a.resources.some((r) => !SEA.has(r)), sea: a.resources.some((r) => SEA.has(r)) }));
const inside = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const combos = new Map(); let maxN = 0; const hist = [0, 0, 0, 0, 0, 0, 0];
for (let i = 0; i < grid.W * grid.H; i++) {
    const water = grid.terrain[i] === T.OCEAN || grid.terrain[i] === T.COAST;
    if (grid.terrain[i] === T.MOUNTAIN) continue;
    const covering = areas.filter((a) => (water ? a.sea : a.land) && inside(a.pts, grid.lonC[i], grid.latC[i]));
    const specific = covering.filter((a) => !a.fill);
    const hit = (specific.length ? specific : covering).map((a) => a.name);
    hist[Math.min(hit.length, 6)]++; if (hit.length > maxN) maxN = hit.length;
    if (hit.length >= 3) { const k = (water ? "WATER: " : "LAND:  ") + hit.join(" + "); combos.set(k, (combos.get(k) || 0) + 1); }
}
console.log(`${geoName} ${W}x${H}: max areas on one hex = ${maxN}; hexes covered by 0/1/2/3/4/5+ areas: ${hist.slice(0, 5).join("/")}/${hist[5] + hist[6]}`);
for (const [k, n] of [...combos.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)} hexes  ${k}`);
