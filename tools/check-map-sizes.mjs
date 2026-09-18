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

const { buildEuropeGrid, hexNeighbors, hexDistance, oneLandmassGeo } = await import(pathToFileURL(path.join(MAPS, 'europe-raster.js')).href);

// Sizes come from the mod's own gameplay data, so this cannot drift from what ships.
const xml = fs.readFileSync(path.join(MOD, 'data', 'maps.xml'), 'utf8');
const shipped = [...xml.matchAll(/MapSizeType="(\w+)"[^>]*GridWidth="(\d+)" GridHeight="(\d+)"/g)]
    .map(m => ({ name: m[1], w: +m[2], h: +m[3] }));
for (const a of process.argv.slice(2)) {
    const m = /^(\d+)x(\d+)$/.exec(a);
    if (m) shipped.push({ name: '(extra)', w: +m[1], h: +m[2] });
}

// Which civilizations can be in the same game. Ages never overlap, so a start is
// only a clash if both civs belong to the same age.
const AGE_CIVS = {
    Antiquity: ['AKSUM','ASSYRIA','BABYLON','CARTHAGE','EGYPT','GAUL','GREECE','HAN','HEIAN','KHMER',
                'MAURYA','MAYA','MISSISSIPPIAN','PERSIA','ROME','SILLA','TONGA','ETRUSCANS','BYZANTIUM'],
    Exploration: ['ABBASID','BULGARIA','CHOLA','DAI_VIET','ENGLAND','GORYEO','HAWAII','ICELAND','INCA',
                  'MAJAPAHIT','MING','MONGOLIA','NORMAN','PIRATE_REPUBLIC','SENGOKU','SHAWNEE','SONGHAI',
                  'SPAIN','ETRUSCANS','BYZANTIUM','TUSCANY'],
    Modern: ['AMERICA','BUGANDA','FRENCH_EMPIRE','GREAT_BRITAIN','JOSEON','MEIJI','MEXICO','MUGHAL','NEPAL',
             'OTTOMANS','PRUSSIA','QAJAR','QING','RUSSIA','SIAM','ETRUSCANS','BYZANTIUM'],
};

// Pairs that are knowingly closer than TSL_SPACING. Etruria and Tuscany are the same
// corner of Italy and there is nowhere else for either; europe-large-geo.js explains the
// reasoning above CIVILIZATION_ETRUSCANS. When both are in a game one takes a fallback
// site, which is the intended behaviour rather than a placement bug.
const ALLOWED_CLOSE = new Set(['ETRUSCANS/TUSCANY']);

const SEAS = { Med: [18.5, 34.8], Black: [34.0, 43.5], Baltic: [19.5, 57.5], Red: [38.5, 19.0], NorthSea: [3.0, 56.0] };
const ISLANDS = { Britain: [-1.5, 52.5], Ireland: [-8.0, 53.3], Sicily: [14.2, 37.6], Crete: [24.9, 35.2],
                  Cyprus: [33.2, 35.0], Iceland: [-19.0, 64.8], Sardinia: [9.1, 40.1] };
// An island merged into the mainland shows up as a component far larger than this.
const ISLAND_MAX = 400;

let failures = 0;
const check = (cond, msg) => { console.log((cond ? '    ok   ' : '    FAIL ') + msg); if (!cond) failures++; };

// The Eurasia maps' geography is built from the Europe file (tools/eurasia-compressed/build.mjs);
// checking it here catches a shared edit that never reached them.
{
    const { spawnSync } = await import('child_process');
    const r = spawnSync('node', [path.join(HERE, 'eurasia-compressed', 'build.mjs'), '--check'], { encoding: 'utf8' });
    console.log('\n=== europe-alt-geo.js against europe-large-geo.js');
    check(r.status === 0, (r.stdout || r.stderr).trim().split('\n')[0]);
}

// Only the geography behind a map the game actually offers at these grids is checked.
// maps/europe-geo.js is still in the repo but is not registered in config/config.xml,
// and it is built for the base game's sizes, so it is not in scope here.
const cfg = fs.readFileSync(path.join(MOD, 'config', 'config.xml'), 'utf8');
const registered = [...cfg.matchAll(/<Row File="\{europe-mediterranean-map\}maps\/([\w-]+\.js)"/g)].map(m => m[1]);
// Each registered map script is checked as the game builds it: its geo file, passed through
// oneLandmassGeo when the script does that (the One Landmass map), so both maps are verified
// from the one europe-large-geo.js they share.
const maps = registered.map(script => {
    const src = fs.readFileSync(path.join(MAPS, script), 'utf8');
    const geoFile = (src.match(/maps\/([\w-]+-geo\.js)/) || [])[1];
    return { script, geoFile, united: /oneLandmassGeo\(/.test(src) };
}).filter(m => m.geoFile);
if (!maps.length) { console.error('no registered map scripts found'); process.exit(1); }

// Land that Distant Lands keeps apart by sea and One Landmass joins: [name, from, to].
const JOINS = [['Finland and Russia', [23.8, 61.5], [37.6, 55.75]],
               ['Egypt and the Levant', [31.2, 30.0], [36.3, 33.5]]];

for (const { script, geoFile, united } of maps) {
    const { GEO: RAW } = await import(pathToFileURL(path.join(MAPS, geoFile)).href);
    const GEO = united ? oneLandmassGeo(RAW) : RAW;
    console.log('\n=== ' + script + ' (' + geoFile + (united ? ', one landmass' : '') + ')  (' + shipped.length + ' shipped sizes)');

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
        if (united) check(east === 0, `no Distant Lands (${eastPct.toFixed(1)}% of land)`);
        else {
            // A geo file may declare its own expected share (GEO.distantLandsShare: [min, max]):
            // Eurasia Compressed adds East Asia to the distant lands, so it runs higher.
            const [lo, hi] = GEO.distantLandsShare || [25, 50];
            check(eastPct > lo && eastPct < hi, `Distant Lands hold ${eastPct.toFixed(1)}% of land (expected ${lo}-${hi}%)`);
        }
        const landOf = (ll) => {
            const t = g.findLandTile(ll[0], ll[1], 3, true);
            const seen = new Set([t.join()]), q = [t];
            for (let h = 0; h < q.length; h++) for (const [a, b] of hexNeighbors(...q[h])) {
                if (!inB(a, b) || seen.has(a + ',' + b) || !g.isLand[g.idx(a, b)]) continue;
                seen.add(a + ',' + b); q.push([a, b]);
            }
            return seen;
        };
        const at = (p) => typeof p === 'string' ? GEO.tsl[p] : p;
        const joinedBy = (a, b) => { const tb = g.findLandTile(...at(b), 3, true); return landOf(at(a)).has(tb.join()); };
        // The Distant Lands / One Landmass pair share one geography, so these two joins tell them apart.
        if (geoFile === 'europe-large-geo.js') for (const [name, a, b] of JOINS) {
            const joined = joinedBy(a, b);
            check(joined === united, `${name} ${joined ? 'joined by land' : 'apart by sea'}`);
        }
        // Any geography can declare its own (GEO.expectLand: { joined: [...], apart: [...] }).
        for (const [name, a, b] of (GEO.expectLand || {}).joined || []) check(joinedBy(a, b), `${name} joined by land`);
        for (const [name, a, b] of (GEO.expectLand || {}).apart || []) check(!joinedBy(a, b), `${name} apart by sea`);

        // Only one age is ever live, so two ages may share a site on purpose - a
        // clash only matters between civs that can be in the same game. The engine
        // also needs starts at least TSL_SPACING apart (europe-large-core.js), or
        // the later civ silently falls back to a generic site.
        const TSL_SPACING = 5;
        for (const [age, roster] of Object.entries(AGE_CIVS)) {
            const live = roster.map(c => 'CIVILIZATION_' + c).filter(c => GEO.tsl[c]);
            const pos = [];
            const missing = [];
            for (const c of live) {
                const t = g.findLandTile(...GEO.tsl[c], 3, false);
                t ? pos.push({ c, t }) : missing.push(c.replace('CIVILIZATION_', ''));
            }
            const tooClose = [];
            for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
                const d = hexDistance(pos[i].t[0], pos[i].t[1], pos[j].t[0], pos[j].t[1]);
                if (d >= TSL_SPACING) continue;
                const pair = [pos[i].c, pos[j].c].map(c => c.replace('CIVILIZATION_', '')).sort().join('/');
                if (!ALLOWED_CLOSE.has(pair)) tooClose.push(`${pair}=${d}`);
            }
            check(!missing.length && !tooClose.length,
                  `${age}: ${pos.length}/${roster.length} civs pinned, all ${TSL_SPACING}+ hexes apart` +
                  (missing.length ? ` (no land: ${missing.join(', ')})` : '') +
                  (tooClose.length ? ` (too close: ${tooClose.join(', ')})` : ''));
        }

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
