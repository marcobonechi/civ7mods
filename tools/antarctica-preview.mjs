#!/usr/bin/env node
// Renders the Antarctica map offline, from the same geography module the game loads.
// Usage: node tools/antarctica-preview.mjs [STD|LRG|HUGE] [seed] [out.svg]
// Writes an SVG (and a PNG next to it when ImageMagick is installed) and prints a summary.
// Colours: blue ocean/coast/lake, green grassland, olive plains, sand desert, grey-green tundra,
// dark green tropical; white = Antarctica's icy interior; hills are darker, mountains brown,
// volcanoes red, rivers blue lines (thick = navigable), the band's outline gold.
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GEO } from "../Antarctica/maps/antarctica-geo.js";
import { buildAntarcticaGrid, SIZES, T, B, hexNeighbors } from "../Antarctica/maps/antarctica-raster.js";

const [sizeArg = "STD", seedArg = "7", outArg] = process.argv.slice(2);
const [W, H] = SIZES["MAPSIZE_ANTARCTICA_" + sizeArg.toUpperCase()];
let s = Number(seedArg) >>> 0;
const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const g = buildAntarcticaGrid(W, H, GEO, rnd, (m) => console.log(m));

const R = 8, DX = R * Math.sqrt(3), DY = R * 1.5;
const cx = (x, y) => DX * (x + 0.5 * (y & 1)) + DX / 2 + 4;
const cy = (y) => DY * (H - 1 - y) + R + 4;
const hexPts = (x, y) => [...Array(6)].map((_, k) => {
    const a = Math.PI / 180 * (60 * k - 30);
    return (cx(x, y) + R * Math.cos(a)).toFixed(1) + "," + (cy(y) + R * Math.sin(a)).toFixed(1);
}).join(" ");
const BIOME = { [B.GRASSLAND]: "#6fae4a", [B.PLAINS]: "#b5b35a", [B.DESERT]: "#e3cf8e", [B.TUNDRA]: "#8e9f86", [B.TROPICAL]: "#2f7d3a" };
const shade = (hex, f) => "#" + [1, 3, 5].map((k) => Math.round(parseInt(hex.slice(k, k + 2), 16) * f).toString(16).padStart(2, "0")).join("");

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(DX * (W + 1) + 8)}" height="${Math.ceil(DY * H + R + 8)}" style="background:#123">`;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = g.idx(x, y), t = g.terrain[i];
    let fill;
    if (t === T.OCEAN) fill = "#1d3f6e";
    else if (t === T.COAST) fill = "#3c6fa6";
    else if (t === T.LAKE) fill = "#58a6d6";
    else {
        const icy = g.owner[i] === 0 && !g.band[i];
        fill = icy ? "#eef3f7" : BIOME[g.biome[i]];
        if (t === T.HILL) fill = shade(fill, icy ? 0.86 : 0.75);
        if (t === T.MOUNTAIN) fill = icy ? "#8a8f99" : "#6b5440";
    }
    svg += `<polygon points="${hexPts(x, y)}" fill="${fill}" stroke="${fill}" stroke-width="0.5"/>`;
}
// band outline: edges between band and non-band land
for (const [x, y] of g.bandTiles) {
    for (const [a, b] of hexNeighbors(x, y)) {
        if (!g.inBounds(a, b)) continue;
        const j = g.idx(a, b);
        if (g.band[j] || !g.isLand(a, b)) continue;
        const ax = cx(x, y), ay = cy(y), bx = cx(a, b), by = cy(b);
        const mx = (ax + bx) / 2, my = (ay + by) / 2, L = Math.hypot(bx - ax, by - ay);
        const px = -(by - ay) / L * R / 2, py = (bx - ax) / L * R / 2;
        svg += `<line x1="${(mx + px).toFixed(1)}" y1="${(my + py).toFixed(1)}" x2="${(mx - px).toFixed(1)}" y2="${(my - py).toFixed(1)}" stroke="#d4a017" stroke-width="2"/>`;
    }
}
for (const t of g.riverTiles.values()) {
    svg += `<line x1="${cx(t.x, t.y).toFixed(1)}" y1="${cy(t.y).toFixed(1)}" x2="${cx(t.to[0], t.to[1]).toFixed(1)}" y2="${cy(t.to[1]).toFixed(1)}" stroke="#1560d0" stroke-width="${t.nav ? 4 : 2}" stroke-linecap="round"/>`;
}
for (const v of g.volcanoes) svg += `<circle cx="${cx(v.x, v.y)}" cy="${cy(v.y)}" r="4" fill="#e03020"/>`;
for (const w of g.wonders) svg += `<circle cx="${cx(w.x, w.y)}" cy="${cy(w.y)}" r="4" fill="none" stroke="#ff0" stroke-width="2"/>`;
svg += "</svg>";

const here = dirname(fileURLToPath(import.meta.url));
const out = outArg || join(here, "..", "preview", "antarctica-" + sizeArg.toLowerCase() + ".svg");
writeFileSync(out, svg);
console.log("wrote " + out);
for (const r of g.riverList) console.log("river " + r.name + ": " + r.tiles.length + " hexes, " + (r.toOcean ? "to the sea" : "to a lake or river") + ", navigable " + r.tiles.filter((t) => g.riverTiles.get(t.join(","))?.nav).length);
// PNG through ImageMagick when it is installed
try {
    const png = out.replace(/\.svg$/, "") + ".png";
    execFileSync("magick", [out, png], { stdio: "ignore" });
    console.log("png " + png);
} catch (e) { console.log("no png (ImageMagick 'magick' not found)"); }
