#!/usr/bin/env node
// Builds every Antarctica map size offline, over several seeds, and checks what the map promises:
//  - the grids in data/maps.xml are the ones antarctica-raster.js knows;
//  - South America and Africa reach the top edge, Australia and New Zealand the bottom one;
//  - Antarctica is cut off from every Distant Land by deep ocean (no coast-only route, so it
//    really takes the Exploration Age to get there);
//  - the band is BAND_DEPTH deep, all on Antarctica, with room for the most players the size allows,
//    split into arcs the way antarctica-map.js splits it, each arc with open ground to settle;
//  - every river is a connected chain of land hexes, none on a mountain or volcano, ending in water;
//  - lakes are inland; inner seas are landlocked in Antarctica and leave the band alone;
//  - an atoll has a lagoon with exactly two openings to the sea, at any cut angle.
// Usage: node tools/antarctica-check.mjs [seeds=5]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GEO } from "../Antarctica/maps/antarctica-geo.js";
import { buildAntarcticaGrid, SIZES, T, hexNeighbors, hexDistance } from "../Antarctica/maps/antarctica-raster.js";

const LANDS = GEO.lands, BAND_DEPTH = GEO.bandDepth;

const HERE = dirname(fileURLToPath(import.meta.url));
const MOD = join(HERE, "..", "Antarctica");
const seeds = Number(process.argv[2] || 5);
let failures = 0;
const fail = (m) => { failures++; console.log("  FAIL " + m); };

const xml = readFileSync(join(MOD, "data", "maps.xml"), "utf8");
const shipped = [...xml.matchAll(/MapSizeType="(\w+)"[^>]*GridWidth="(\d+)" GridHeight="(\d+)"/g)].map((m) => [m[1], +m[2], +m[3]]);
const config = readFileSync(join(MOD, "config", "config.xml"), "utf8");
const maxPlayers = {};
for (const m of config.matchAll(/MapSizeType="(\w+)"[^>]*MaxPlayers="(\d+)"/g)) maxPlayers[m[1]] = Math.max(maxPlayers[m[1]] || 0, +m[2]);
for (const [name, w, h] of shipped) {
    if (!SIZES[name] || SIZES[name][0] !== w || SIZES[name][1] !== h) fail(name + " is " + w + "x" + h + " in data/maps.xml but " + JSON.stringify(SIZES[name]) + " in antarctica-raster.js");
}

// Separate openings of the atoll lagoons: groups of open water (not lagoon) touching a lagoon.
function atollOpenings(g) {
    const W = g.W, lag = new Set(), exits = new Set();
    for (let i = 0; i < W * g.H; i++) if (g.lagoon[i]) lag.add(i);
    if (!lag.size) return 0;
    for (const i of lag) for (const [a, b] of hexNeighbors(i % W, Math.floor(i / W))) {
        if (g.inBounds(a, b) && !g.isLand(a, b) && !lag.has(g.idx(a, b))) exits.add(g.idx(a, b));
    }
    const seen = new Set();
    let groups = 0;
    for (const e of exits) {
        if (seen.has(e)) continue;
        groups++;
        const q = [e];
        seen.add(e);
        while (q.length) {
            const u = q.pop();
            for (const [a, b] of hexNeighbors(u % W, Math.floor(u / W))) {
                const j = g.idx(a, b);
                if (g.inBounds(a, b) && exits.has(j) && !seen.has(j)) { seen.add(j); q.push(j); }
            }
        }
    }
    return groups;
}

const EDGE = { "south-america": "top", "africa": "top", "australia": "bottom", "new-zealand": "bottom" };

for (const [name, W, H] of shipped) {
    for (let seed = 1; seed <= seeds; seed++) {
        let s = seed * 7919 >>> 0;
        const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        const logs = [];
        const g = buildAntarcticaGrid(W, H, GEO, rnd, (m) => logs.push(m));
        const tag = name + " seed " + seed;
        const before = failures;
        for (const m of logs) if (/not on land|no land course|no mouth/.test(m)) fail(tag + ": " + m);
        const water = (x, y) => !g.isLand(x, y);

        // continents on their edges
        LANDS.forEach((L, l) => {
            const want = EDGE[L.id];
            if (!want) return;
            const row = want === "top" ? H - 1 : 0;
            let n = 0;
            for (let x = 0; x < W; x++) if (g.owner[g.idx(x, row)] === l && g.isLand(x, row)) n++;
            if (n < 2) fail(tag + ": " + L.id + " has " + n + " hexes on the " + want + " edge");
        });

        // homeland cut off by ocean: flood the shallow water (coast, lake) from Antarctica's shore
        const seen = new Set();
        const q = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            if (g.owner[g.idx(x, y)] !== 0 || !g.isLand(x, y)) continue;
            for (const [a, b] of hexNeighbors(x, y)) {
                if (g.inBounds(a, b) && g.terrain[g.idx(a, b)] === T.COAST && !seen.has(a + "," + b)) { seen.add(a + "," + b); q.push([a, b]); }
            }
        }
        let touched = new Set();
        for (let k = 0; k < q.length; k++) {
            for (const [a, b] of hexNeighbors(q[k][0], q[k][1])) {
                if (!g.inBounds(a, b)) continue;
                const j = g.idx(a, b);
                if (g.isLand(a, b)) { if (g.owner[j] !== 0) touched.add(g.owner[j] >= 0 ? LANDS[g.owner[j]].id : "island"); continue; }
                if (g.terrain[j] === T.COAST && !seen.has(a + "," + b)) { seen.add(a + "," + b); q.push([a, b]); }
            }
        }
        if (touched.size) fail(tag + ": Antarctica reaches " + [...touched].join(", ") + " over coast water alone");

        // the band
        let bad = 0;
        for (const [x, y] of g.bandTiles) {
            const i = g.idx(x, y);
            if (g.owner[i] !== 0 || g.band[i] < 1 || g.band[i] > BAND_DEPTH) bad++;
        }
        if (bad) fail(tag + ": " + bad + " band hexes are not Antarctica or out of depth");
        const open = g.bandTiles.filter(([x, y]) => g.terrain[g.idx(x, y)] === T.FLAT || g.terrain[g.idx(x, y)] === T.HILL)
            .filter(([x, y]) => !g.riverTiles.get(x + "," + y)?.nav);
        const players = maxPlayers[name] || 8;
        const [ccx, ccy] = g.toCanvas(...g.centre);
        const angle = ([x, y]) => { const [X, Y] = g.toCanvas(x, y); return Math.atan2(X - ccx, Y - ccy); };
        open.sort((a, b) => angle(a) - angle(b));
        let worst = Infinity, span = Infinity;
        for (let r = 0; r < players; r++) {
            const arc = open.slice(Math.floor(r * open.length / players), Math.floor((r + 1) * open.length / players));
            worst = Math.min(worst, arc.length);
            // the longest distance along the arc: two starts in neighbouring arcs can be this far apart
            let far = 0;
            for (const t of arc) far = Math.max(far, hexDistance(arc[0][0], arc[0][1], t[0], t[1]));
            span = Math.min(span, far);
        }
        if (worst < 25) fail(tag + ": an arc of the band has only " + worst + " open hexes for " + players + " players");

        // rivers
        for (const r of g.riverList) {
            for (let k = 0; k < r.tiles.length; k++) {
                const [x, y] = r.tiles[k];
                if (water(x, y)) fail(tag + ": river " + r.name + " runs over water at " + x + "," + y);
                if (g.terrain[g.idx(x, y)] === T.MOUNTAIN) fail(tag + ": river " + r.name + " crosses a mountain at " + x + "," + y);
                const t = g.riverTiles.get(x + "," + y);
                if (t && hexDistance(x, y, t.to[0], t.to[1]) !== 1) fail(tag + ": river " + r.name + " jumps at " + x + "," + y);
            }
            const [mx, my] = r.mouth;
            if (!water(mx, my) && !g.riverTiles.has(mx + "," + my)) fail(tag + ": river " + r.name + " ends on dry land");
        }
        for (const v of g.volcanoes) if (g.riverTiles.has(v.x + "," + v.y)) fail(tag + ": volcano " + v.name + " sits on a river");
        // inner seas: landlocked, on Antarctica, and their shore is not part of the band
        for (const [name, tiles] of g.seaTiles) {
            if (!tiles.length) fail(tag + ": sea " + name + " has no water");
            for (const [x, y] of tiles) for (const [a, b] of hexNeighbors(x, y)) {
                if (!g.inBounds(a, b)) continue;
                const j = g.idx(a, b);
                if (g.isLand(a, b) ? g.owner[j] !== 0 : !g.inlandSea[j]) { fail(tag + ": sea " + name + " is not enclosed by Antarctica"); break; }
                if (g.isLand(a, b) && g.band[j] && g.coastDist[j] === 1 && !hexNeighbors(a, b).some(([p, q]) => g.inBounds(p, q) && !g.isLand(p, q) && !g.inlandSea[g.idx(p, q)])) fail(tag + ": sea " + name + " made its shore part of the band");
            }
        }
        // atolls: a lagoon with exactly two openings to the open sea (one at each end of the cut)
        for (const isl of GEO.islands.filter((z) => z.shape === "atoll")) {
            const n = atollOpenings(g);
            if (n !== 2) fail(tag + ": atoll " + isl.name + " has " + n + " opening(s) instead of 2");
        }
        // lakes
        for (const [lk, tiles] of g.lakeTiles) for (const [x, y] of tiles) {
            if (hexNeighbors(x, y).some(([a, b]) => g.inBounds(a, b) && (g.terrain[g.idx(a, b)] === T.OCEAN || g.terrain[g.idx(a, b)] === T.COAST))) fail(tag + ": lake " + lk + " touches the sea");
        }

        if (seed === 1 || failures > before) {
            const count = (f) => { let c = 0; for (let i = 0; i < W * H; i++) if (f(i)) c++; return c; };
            console.log(tag + ": " + W + "x" + H + ", band " + g.bandTiles.length + " (" + open.length + " open), " + players +
                " players -> smallest arc " + worst + " hexes, " + g.riverList.length + " rivers, land " +
                count((i) => g.terrain[i] >= T.FLAT && g.terrain[i] <= T.MOUNTAIN) + ", " + logs[logs.length - 1]);
        }
    }
}
// The atoll's openings at every cut angle, so an edit in the editor cannot close the lagoon.
for (const isl of GEO.islands.filter((z) => z.shape === "atoll")) {
    const keep = isl.gap;
    for (let gap = 0; gap < 360; gap += 15) for (const [name, W, H] of shipped) {
        isl.gap = gap;
        let s = 11;
        const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        const n = atollOpenings(buildAntarcticaGrid(W, H, GEO, rnd));
        if (n !== 2) fail(name + ": atoll " + isl.name + " cut at " + gap + " degrees has " + n + " opening(s) instead of 2");
    }
    isl.gap = keep;
}

console.log(failures ? failures + " problem(s)" : "all checks passed");
process.exit(failures ? 1 : 0);
