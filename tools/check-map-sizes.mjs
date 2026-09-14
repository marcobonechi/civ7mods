#!/usr/bin/env node
// Generate every grid size the mod ships and check the invariants that have actually
// broken here before. Geography is pinned by longitude/latitude, so a feature that is
// fine at 128x112 can merge into the mainland or vanish on a coarser grid - 96x84 was
// rejected this way: its Mediterranean was too narrow to separate the landmasses, so
// 97% of land flood-filled into Distant Lands and Sicily joined Africa.
//
//   node tools/check-map-sizes.mjs [extra WxH ...]
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOD = path.join(HERE, '..', 'EuropeMediterranean');
const MAPS = path.join(MOD, 'maps');

const { buildEuropeGrid, hexNeighbors } = await import(pathToFileURL(path.join(MAPS, 'europe-raster.js')).href);

// Sizes come from the mod's own gameplay data, so this cannot drift from what ships.
const xml = fs.readFileSync(path.join(MOD, 'data', 'maps.xml'), 'utf8');
const shipped = [...xml.matchAll(/MapSizeType="(\w+)"[^>]*GridWidth="(\d+)" GridHeight="(\d+)"/g)]
    .map(m => ({ name: m[1], w: +m[2], h: +m[3] }));
for (const a of process.argv.slice(2)) {
    const m = /^(\d+)x(\d+)$/.exec(a);
    if (m) shipped.push({ name: '(extra)', w: +m[1], h: +m[2] });
}

const SEAS = { Med: [18.5, 34.8], Black: [34.0, 43.5], Baltic: [19.5, 57.5], Red: [38.5, 19.0], NorthSea: [3.0, 56.0] };
const ISLANDS = { Britain: [-1.5, 52.5], Ireland: [-8.0, 53.3], Sicily: [14.2, 37.6], Crete: [24.9, 35.2],
                  Cyprus: [33.2, 35.0], Iceland: [-19.0, 64.8], Sardinia: [9.1, 40.1] };
// An island merged into the mainland shows up as a component far larger than this.
const ISLAND_MAX = 400;

let failures = 0;
const check = (cond, msg) => { console.log((cond ? '    ok   ' : '    FAIL ') + msg); if (!cond) failures++; };

// Only the geography behind a map the game actually offers at these grids is checked.
// maps/europe-geo.js is still in the repo but is not registered in config/config.xml,
// and it is built for the base game's sizes, so it is not in scope here.
const cfg = fs.readFileSync(path.join(MOD, 'config', 'config.xml'), 'utf8');
const registered = [...cfg.matchAll(/<Row File="\{europe-mediterranean-map\}maps\/([\w-]+\.js)"/g)].map(m => m[1]);
const geoFiles = [...new Set(registered.flatMap(f => {
    const src = fs.readFileSync(path.join(MAPS, f), 'utf8');
    return [...src.matchAll(/maps\/([\w-]+-geo\.js)/g)].map(m => m[1]);
}))].sort();
if (!geoFiles.length) { console.error('no registered map scripts found'); process.exit(1); }

for (const geoFile of geoFiles) {
    const { GEO } = await import(pathToFileURL(path.join(MAPS, geoFile)).href);
    console.log('\n=== ' + geoFile + '  (' + shipped.length + ' shipped sizes)');

    for (const { name, w: W, h: H } of shipped) {
        let s = 1;
        const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
        const g = buildEuropeGrid(W, H, structuredClone(GEO), rnd);
        const N = W * H, inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
        console.log(`\n  ${W}x${H}  ${name}`);

        let land = 0, east = 0, seam = 0;
        for (let i = 0; i < N; i++) { land += g.isLand[i]; if (g.isLand[i] && g.region[i] === 'E') east++; }
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = g.idx(x, y);
            if (!g.isLand[i]) continue;
            for (const [a, b] of hexNeighbors(x, y)) {
                if (!inB(a, b)) continue;
                const j = g.idx(a, b);
                if (g.isLand[j] && g.region[j] !== g.region[i]) seam++;
            }
        }
        const landPct = 100 * land / N, eastPct = 100 * east / land;
        check(landPct > 55 && landPct < 78, `land ${landPct.toFixed(1)}% is in range`);
        // A region change across connected land is an impassable wall - this is the bug
        // that once stopped a Roman scout entering Greece.
        check(seam === 0, `no land seam between regions (${seam})`);
        check(eastPct > 25 && eastPct < 50, `Distant Lands hold ${eastPct.toFixed(1)}% of land`);

        const seen = new Set();
        for (const civ of Object.keys(GEO.tsl)) {
            const t = g.findLandTile(...GEO.tsl[civ], 3, false);
            if (t) seen.add(t[0] + ',' + t[1]);
        }
        check(seen.size === Object.keys(GEO.tsl).length,
              `${seen.size}/${Object.keys(GEO.tsl).length} true starts land on distinct hexes`);

        const st = g.P.nearestTile(...SEAS.Med), si = g.idx(st[0], st[1]);
        const q = [st], wet = new Uint8Array(N);
        if (!g.isLand[si]) wet[si] = 1;
        for (let h = 0; h < q.length; h++) for (const [a, b] of hexNeighbors(...q[h])) {
            if (!inB(a, b)) continue;
            const j = g.idx(a, b);
            if (wet[j] || g.isLand[j]) continue;
            wet[j] = 1; q.push([a, b]);
        }
        const cut = Object.entries(SEAS).filter(([, ll]) => { const t = g.P.nearestTile(...ll); return !wet[g.idx(t[0], t[1])]; }).map(([n]) => n);
        check(!cut.length, `every sea reachable from the Mediterranean${cut.length ? ' (cut off: ' + cut.join(', ') + ')' : ''}`);

        const size = (lon, lat) => {
            const t = g.findLandTile(lon, lat, 3, true);
            if (!t) return 0;
            const qq = [t], sn = new Set([t.join(',')]);
            for (let h = 0; h < qq.length && qq.length < N; h++) for (const [a, b] of hexNeighbors(...qq[h])) {
                if (!inB(a, b) || sn.has(a + ',' + b) || !g.isLand[g.idx(a, b)]) continue;
                sn.add(a + ',' + b); qq.push([a, b]);
            }
            return qq.length;
        };
        const merged = Object.entries(ISLANDS).filter(([, ll]) => { const n = size(...ll); return n === 0 || n > ISLAND_MAX; })
                                              .map(([n, ll]) => n + '=' + size(...ll));
        check(!merged.length, `islands stay separate${merged.length ? ' (merged or missing: ' + merged.join(', ') + ')' : ''}`);
    }
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall sizes sound');
process.exit(failures ? 1 : 0);
