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

const { buildEuropeGrid, hexNeighbors, hexDistance, oneLandmassGeo, T } = await import(pathToFileURL(path.join(MAPS, 'europe-raster.js')).href);

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

// What ground each natural wonder needs, read off the game's own tables: Feature_ValidTerrains,
// Feature_ValidBiomes and Feature_NaturalWonders.Tiles (base-standard/data/terrain.xml and
// racetowonders-terrain.xml, plus the mountain-natural-wonders, water-wonders and
// japan-korea-wonders DLC - 22 wonders in all). `river` is NoRiver="false":
// only the three waterfalls may stand on a river course, every other wonder may not.
// This is the engine's canHaveFeatureParam test approximated - it does not model the Direction
// column, so a wonder that wants a particular triangle of mountains can still be refused in game,
// which is why europe-large-core.js falls back to the random pass instead of insisting.
// Four wonders the engine refuses everywhere on these maps, observed straight from its own scan
// ("No valid location for ..." in Scripting.log, 2026-09-20): both WATERFALL features, which want
// running water this map never puts on the ground they need, Valley of Flowers, and Mount Everest,
// which wants mountains in a tropical biome. Listing one as a site candidate is dead weight, so
// the checker refuses to count them.
const WONDER_UNPLACEABLE = new Set(['FEATURE_GULLFOSS', 'FEATURE_IGUAZU_FALLS',
                                    'FEATURE_VALLEY_OF_FLOWERS', 'FEATURE_MOUNT_EVEREST']);
const WONDER_GROUND = {
    FEATURE_VALLEY_OF_FLOWERS:     { terrain: 'FLAT',     biomes: 'P',  tiles: 2 },
    FEATURE_REDWOOD_FOREST:        { terrain: 'FLAT',     biomes: 'G',  tiles: 3 },
    FEATURE_GRAND_CANYON:          { terrain: 'FLAT',     biomes: 'D',  tiles: 4 },
    FEATURE_GULLFOSS:              { terrain: 'HILL',     biomes: 'TG', tiles: 1, river: true },
    FEATURE_IGUAZU_FALLS:          { terrain: 'HILL',     biomes: 'R',  tiles: 1, river: true },
    FEATURE_ULURU:                 { terrain: 'HILL',     biomes: 'D',  tiles: 1 },
    FEATURE_HOERIKWAGGO:           { terrain: 'MOUNTAIN', biomes: 'G',  tiles: 4 },
    FEATURE_KILIMANJARO:           { terrain: 'MOUNTAIN', biomes: 'P',  tiles: 3 },
    FEATURE_ZHANGJIAJIE:           { terrain: 'MOUNTAIN', biomes: 'R',  tiles: 2 },
    FEATURE_TORRES_DEL_PAINE:      { terrain: 'MOUNTAIN', biomes: 'T',  tiles: 3 },
    FEATURE_MOUNT_EVEREST:         { terrain: 'MOUNTAIN', biomes: 'R',  tiles: 4 },
    FEATURE_MOUNT_FUJI:            { terrain: 'MOUNTAIN', biomes: 'G',  tiles: 3 },
    FEATURE_MACHAPUCHARE:          { terrain: 'MOUNTAIN', biomes: 'R',  tiles: 3 },
    FEATURE_VIHREN:                { terrain: 'MOUNTAIN', biomes: 'P',  tiles: 3 },
    FEATURE_VINICUNCA:             { terrain: 'MOUNTAIN', biomes: 'D',  tiles: 4 },
    FEATURE_NACHI_FALLS:           { terrain: 'MOUNTAIN', biomes: 'R',  tiles: 4, river: true },
    FEATURE_THERA:                 { terrain: 'COAST',    biomes: 'M',  tiles: 4 },
    FEATURE_BARRIER_REEF:          { terrain: 'COAST',    biomes: 'M',  tiles: 4 },
    FEATURE_GREAT_BLUE_HOLE:       { terrain: 'COAST',    biomes: 'M',  tiles: 1 },
    FEATURE_MAPU_A_VAEA_BLOWHOLES: { terrain: 'COAST',    biomes: 'M',  tiles: 2 },
    FEATURE_SEONGSAN_ILCHULBONG:   { terrain: 'COAST',    biomes: 'M',  tiles: 2 },
    // The only wonder that wants deep water rather than coast.
    FEATURE_BERMUDA_TRIANGLE:      { terrain: 'OCEAN',    biomes: 'M',  tiles: 3 },
};
// Civilizations whose ability needs a natural wonder inside their own borders, and borders reach
// three tiles from a city centre (Civilopedia, Growth). A site further than this from the start it
// was put there for is serving a second city at best, so it is worth knowing about.
const WONDER_BORDER_REACH = 3;
// Land within this many hexes of a true start is not dependable ground for a wonder: before the
// wonders go in, europe-large-core.js flattens the start hex (prepareStartTile) and then
// boostStartFood turns tiles around it into flat grassland until the start has five rich ones.
// Water is untouched by that pass, so coastal sites are unaffected. Not modelling this is what let
// the checker pass Gullfoss on the compact grid when the engine went on to refuse it.
const START_FOOD_REACH = 2;
const WONDER_SITE_FOR = { 'the Central System, Spain': 'CIVILIZATION_SPAIN', 'the Irish Sea': 'CIVILIZATION_MAJAPAHIT' };

let failures = 0;
const check = (cond, msg) => { console.log((cond ? '    ok   ' : '    FAIL ') + msg); if (!cond) failures++; };

// The Eurasia maps' geography is built from the Europe file (tools/eurasia-compressed/build.mjs);
// checking it here catches a shared edit that never reached them.
{
    const { spawnSync } = await import('child_process');
    const r = spawnSync('node', [path.join(HERE, 'eurasia-compressed', 'build.mjs'), '--check'], { encoding: 'utf8' });
    console.log('\n=== europe-alt-geo.js against europe-large-geo.js');
    check(r.status === 0, (r.stdout || r.stderr).trim().split('\n')[0]);
    // ...and so is the compact 90x76 geography (tools/europe-compact/build.mjs).
    const c = spawnSync('node', [path.join(HERE, 'europe-compact', 'build.mjs'), '--check'], { encoding: 'utf8' });
    console.log('\n=== europe-compact-geo.js against europe-large-geo.js');
    check(c.status === 0, (c.stdout || c.stderr).trim().split('\n')[0]);
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
    // The first geography a script imports is its own; any other is drawn for particular grids
    // (GEO.gridSizes) and europe-large-core.js swaps it in on those, so the check does the same.
    const geoFiles = [...src.matchAll(/maps\/([\w-]+-geo\.js)/g)].map(m => m[1]);
    // A map is only built at the sizes config.xml offers it.
    const sizes = new Set([...cfg.matchAll(new RegExp('Map="\\{europe-mediterranean-map\\}maps/' + script.replace(/[.]/g, '\\.') + '" Domain="\\w+" Value="(\\w+)"', 'g'))].map(m => m[1]));
    return { script, geoFile: geoFiles[0], sizedGeoFiles: geoFiles.slice(1), sizes, united: /oneLandmassGeo\(/.test(src) };
}).filter(m => m.geoFile);
if (!maps.length) { console.error('no registered map scripts found'); process.exit(1); }

// Land that Distant Lands keeps apart by sea and One Landmass joins: [name, from, to].
const JOINS = [['Finland and Russia', [23.8, 61.5], [37.6, 55.75]],
               ['Egypt and the Levant', [31.2, 30.0], [36.3, 33.5]]];

for (const { script, geoFile: ownGeoFile, sizedGeoFiles, sizes, united } of maps) {
    const load = async (f) => { const { GEO: RAW } = await import(pathToFileURL(path.join(MAPS, f)).href); return united ? oneLandmassGeo(RAW) : RAW; };
    const OWN = await load(ownGeoFile);
    const SIZED = [];
    for (const f of sizedGeoFiles) SIZED.push({ file: f, geo: await load(f) });
    const offered = shipped.filter(z => z.name === '(extra)' || !sizes.size || sizes.has(z.name));
    console.log('\n=== ' + script + ' (' + ownGeoFile + (united ? ', one landmass' : '') + ')  (' + offered.length + ' sizes offered)');

    for (const { name, w: W, h: H } of offered) {
        const sized = SIZED.find(z => (z.geo.gridSizes || []).some(d => d[0] === W && d[1] === H));
        const GEO = sized ? sized.geo : OWN, geoFile = sized ? sized.file : ownGeoFile;
        // Islands a sized geography has moved are looked for where it put them (GEO.checkIslands).
        const ISLANDS_HERE = { ...ISLANDS, ...(GEO.checkIslands || {}) };
        let s = 1;
        const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
        const g = buildEuropeGrid(W, H, structuredClone(GEO), rnd);
        const N = W * H, inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
        console.log(`\n  ${W}x${H}  ${name}` + (sized ? '  (' + geoFile + ')' : ''));

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
        if (geoFile === 'europe-large-geo.js' || geoFile === 'europe-compact-geo.js') for (const [name, a, b] of JOINS) {
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
        const merged = Object.entries(ISLANDS_HERE).filter(([, ll]) => { const n = size(...ll); return n === 0 || n > ISLAND_MAX; })
                                              .map(([n, ll]) => n + '=' + size(...ll));
        check(!merged.length, `islands stay separate${merged.length ? ' (merged or missing: ' + merged.join(', ') + ')' : ''}`);

        // Natural wonders the geography places by hand (GEO.wonders) or by site (GEO.wonderSites).
        const startFood = new Set();
        for (const civ in GEO.tsl || {}) {
            const t0 = g.findLandTile(...GEO.tsl[civ], 3, false);
            if (!t0) continue;
            for (let dy = -START_FOOD_REACH; dy <= START_FOOD_REACH; dy++)
                for (let dx = -START_FOOD_REACH; dx <= START_FOOD_REACH; dx++) {
                    const x = t0[0] + dx, y = t0[1] + dy;
                    if (hexDistance(t0[0], t0[1], x, y) <= START_FOOD_REACH) startFood.add(x + ',' + y);
                }
        }
        // europe-large-core.js exempts the ground a pin or a site is aiming at, so the checker must
        // too - otherwise it writes off hexes the pass will actually leave alone.
        for (const w of [...(GEO.wonders || []), ...(GEO.wonderSites || [])]) {
            const t0 = g.P.nearestTile(w.lon, w.lat);
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const x = t0[0] + dx, y = t0[1] + dy;
                if (hexDistance(t0[0], t0[1], x, y) <= 1) startFood.delete(x + ',' + y);
            }
        }
        // A pin or a site that finds no ground silently falls back to the random pass in game,
        // which puts the wonder somewhere else entirely - the failure this catches.
        const gRef = { g };
        const fitsHere = (feature, lon, lat, radius) => {
            const g = gRef.g;
            const g0 = WONDER_GROUND[feature];
            if (!g0) return null;                 // a wonder this table does not know: not judged
            if (WONDER_UNPLACEABLE.has(feature)) return -1;
            const ok = (x, y) => {
                if (!inB(x, y)) return false;
                const code = g.terrain[g.idx(x, y)];
                if (code !== T.OCEAN && code !== T.COAST && startFood.has(x + ',' + y)) return false;
                const terr = code === T.RIVER ? (g0.river ? 'FLAT' : null)
                           : code === T.OCEAN ? 'OCEAN' : Object.keys(T).find(k => T[k] === code);
                if (terr !== g0.terrain) return false;
                const biome = (code === T.OCEAN || code === T.COAST) ? 'M' : g.biome[g.idx(x, y)];
                return g0.biomes.includes(biome);
            };
            // The footprint may run outside the search radius, so only its first tile is bounded.
            const t = g.P.nearestTile(lon, lat);
            for (let r = 0; r <= radius; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
                const x = t[0] + dx, y = t[1] + dy;
                if (hexDistance(t[0], t[1], x, y) !== r || !ok(x, y)) continue;
                const seen = new Set([x + ',' + y]), qq = [[x, y]];
                for (let h = 0; h < qq.length && qq.length < g0.tiles; h++)
                    for (const [a, b] of hexNeighbors(...qq[h]))
                        if (!seen.has(a + ',' + b) && ok(a, b)) { seen.add(a + ',' + b); qq.push([a, b]); }
                if (qq.length >= g0.tiles) return r;
            }
            return -1;
        };
        for (const w of GEO.wonders || []) {
            // A pin for a wonder the engine refuses everywhere is a known limitation the geography
            // documents, not a failure to report every run - but a site that lists one is dead
            // weight, and that is still a failure below.
            if (WONDER_UNPLACEABLE.has(w.feature)) {
                console.log(`    note ${w.feature.replace('FEATURE_', '')} pinned but unplaceable on this map (see europe-large-geo.js)`);
                continue;
            }
            const r = fitsHere(w.feature, w.lon, w.lat, w.radius || 3);
            if (r === null) continue;
            check(r >= 0, `${w.feature.replace('FEATURE_', '')} fits at its site` + (r >= 0 ? ` (${r} hex away)` : ''));
        }
        // A site is not pass-or-fail on one seed: the ground under it is rolled per game, so what
        // matters is how often it can fill. Sample several and require most of them - judging this
        // on the checker's single seed reported a site that fills nineteen games in twenty as broken.
        const SITE_SEEDS = 8, SITE_MIN = 0.7;
        for (const s2 of GEO.wonderSites || []) {
            let filled = 0;
            const everFits = new Set();
            for (let sd = 1; sd <= SITE_SEEDS; sd++) {
                let ss = sd * 7919;
                const rnd2 = () => (ss = (ss * 1103515245 + 12345) % 2147483648) / 2147483648;
                const g2 = buildEuropeGrid(W, H, structuredClone(GEO), rnd2);
                const saved = g;
                const fit2 = (s2.candidates || []).filter(f => { gRef.g = g2; return fitsHere(f, s2.lon, s2.lat, s2.radius || 3) >= 0; });
                gRef.g = saved;
                if (fit2.length) { filled++; fit2.forEach(f => everFits.add(f)); }
            }
            const rate = filled / SITE_SEEDS;
            check(rate >= SITE_MIN, `wonder site "${s2.name}" fills ${filled}/${SITE_SEEDS} seeds` +
                  (everFits.size ? ' (' + [...everFits].map(f => f.replace('FEATURE_', '')).join(', ') + ')' : ''));
            // and it is no use to the civilization it was put there for if borders cannot reach it
            const civ = WONDER_SITE_FOR[s2.name];
            if (!civ || !GEO.tsl[civ]) continue;
            const a = g.findLandTile(...GEO.tsl[civ], 3, false), b = g.P.nearestTile(s2.lon, s2.lat);
            const d = a ? hexDistance(a[0], a[1], b[0], b[1]) : 99;
            check(d <= WONDER_BORDER_REACH, `"${s2.name}" is ${d} hexes from ${civ.replace('CIVILIZATION_', '')} ` +
                  `(borders reach ${WONDER_BORDER_REACH})`);
        }
    }
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall sizes sound');
process.exit(failures ? 1 : 0);
