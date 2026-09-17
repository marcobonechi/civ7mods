#!/usr/bin/env node
// Plan the rivers of every registered large Europe map, at every shipped size and several seeds,
// with maps/europe-rivers.js, and check what the engine needs from TerrainBuilder.setRiverInfo():
// every river hex drains into an adjacent hex, that hex is water or another river, following the
// flow always reaches water, and no river takes a true-start hex. Also checks that the river names
// the planner sets exist in the base game's text.
//
// Elevation and water come from the rasterized grid, not the engine, so this proves the network's
// shape, not what the engine renders.
//
//   node tools/check-rivers.mjs [--seeds N] [--dump WxH]
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOD = path.join(HERE, '..', 'EuropeMediterranean');
const MAPS = path.join(MOD, 'maps');
const GAME = process.env.CIV7_GAME_ROOT || path.join(os.homedir(),
    "Library/Application Support/Steam/steamapps/common/Sid Meier's Civilization VII/CivilizationVII.app/Contents/Resources");

const args = process.argv.slice(2);
const seeds = +(args[args.indexOf('--seeds') + 1] || 0) || 4;
const dumpSize = args.includes('--dump') ? args[args.indexOf('--dump') + 1] : null;

const raster = await import(pathToFileURL(path.join(MAPS, 'europe-raster.js')).href);
const { buildEuropeGrid, hexDistance, T } = raster;

// The planner imports the raster by its in-game path; point that at the file on disk.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-rivers-'));
const plannerSrc = fs.readFileSync(path.join(MAPS, 'europe-rivers.js'), 'utf8')
    .replace("'/europe-mediterranean-map/maps/europe-raster.js'", JSON.stringify(pathToFileURL(path.join(MAPS, 'europe-raster.js')).href));
fs.writeFileSync(path.join(tmp, 'europe-rivers.mjs'), plannerSrc);
const { planRivers, directionName, RIVER_NAME_TAGS, RIVER_NAVIGABLE } = await import(pathToFileURL(path.join(tmp, 'europe-rivers.mjs')).href);

let failures = 0;
const check = (cond, msg) => { if (!cond) { console.log('    FAIL ' + msg); failures++; } return cond; };

// Names must exist in the game's text, or players see a raw key.
const textDir = path.join(GAME, 'Base/modules/base-standard/text/en_us');
if (fs.existsSync(textDir)) {
    const text = fs.readdirSync(textDir).map(f => fs.readFileSync(path.join(textDir, f), 'utf8')).join('\n');
    for (const [name, tag] of Object.entries(RIVER_NAME_TAGS)) check(text.includes('"' + tag + '"'), `${name}: ${tag} not in base-standard text`);
} else {
    console.log('game text not found, skipping the name check (set CIV7_GAME_ROOT)');
}

const xml = fs.readFileSync(path.join(MOD, 'data', 'maps.xml'), 'utf8');
const shipped = [...xml.matchAll(/MapSizeType="(\w+)"[^>]*GridWidth="(\d+)" GridHeight="(\d+)"/g)].map(m => ({ name: m[1], w: +m[2], h: +m[3] }));
const cfg = fs.readFileSync(path.join(MOD, 'config', 'config.xml'), 'utf8');
const registered = [...cfg.matchAll(/<Row File="\{europe-mediterranean-map\}maps\/([\w-]+\.js)"/g)].map(m => m[1]);
const geoFiles = [...new Set(registered.flatMap(f => [...fs.readFileSync(path.join(MAPS, f), 'utf8').matchAll(/maps\/([\w-]+-geo\.js)/g)].map(m => m[1])))].sort();

for (const geoFile of geoFiles) {
    const { GEO } = await import(pathToFileURL(path.join(MAPS, geoFile)).href);
    console.log('\n=== ' + geoFile);
    for (const { name, w: W, h: H } of shipped) {
        for (let seed = 1; seed <= seeds; seed++) {
            let s = seed * 7919;
            const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
            const g = buildEuropeGrid(W, H, structuredClone(GEO), rnd);
            const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
            const terrainAt = (x, y) => g.terrain[g.idx(x, y)];
            const isWater = (x, y) => !g.isLand[g.idx(x, y)];
            // Stand-in elevation: mountains over hills over flats, rising with distance from the sea.
            const coastDist = new Int16Array(W * H).fill(-1);
            const queue = [];
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isWater(x, y)) { coastDist[g.idx(x, y)] = 0; queue.push([x, y]); }
            for (let q = 0; q < queue.length; q++) {
                const [x, y] = queue[q];
                for (const [a, b] of raster.hexNeighbors(x, y)) {
                    if (!inB(a, b) || coastDist[g.idx(a, b)] >= 0) continue;
                    coastDist[g.idx(a, b)] = coastDist[g.idx(x, y)] + 1; queue.push([a, b]);
                }
            }
            const base = { [T.MOUNTAIN]: 900, [T.HILL]: 450 };
            const elevation = (x, y) => (base[terrainAt(x, y)] || 150) + 25 * coastDist[g.idx(x, y)];
            const reserved = new Set();
            for (const civ in GEO.tsl) {
                const t = g.findLandTile(GEO.tsl[civ][0], GEO.tsl[civ][1], 2, false);
                if (t) reserved.add(t[0] + ',' + t[1]);
            }
            const plan = planRivers(g.riverChains, {
                W, H, rnd, reserved, isWater, elevation,
                isMountain: (x, y) => terrainAt(x, y) === T.MOUNTAIN,
                rain: (x, y) => g.rain[g.idx(x, y)],
            });

            const label = `${W}x${H} seed ${seed}`;
            let bad = 0;
            for (const t of plan.tiles.values()) {
                const [tx, ty] = t.to;
                const where = `${label}: ${t.river || 'minor'} (${t.x},${t.y})`;
                if (!check(inB(tx, ty) && hexDistance(t.x, t.y, tx, ty) === 1, `${where} drains to non-neighbour (${tx},${ty})`)) { bad++; continue; }
                check(isWater(tx, ty) || plan.tiles.has(tx + ',' + ty), `${where} drains onto dry land (${tx},${ty})`) || bad++;
                check(!isWater(t.x, t.y), `${where} is on water`) || bad++;
                check(!reserved.has(t.x + ',' + t.y), `${where} takes a true start`) || bad++;
                directionName(t.x, t.y, t.to);
                // follow the flow to the sea
                let cur = t, steps = 0;
                while (cur && steps < W * H) { const k = cur.to[0] + ',' + cur.to[1]; if (isWater(cur.to[0], cur.to[1])) break; cur = plan.tiles.get(k); steps++; }
                check(cur && steps < W * H, `${where} never reaches water`) || bad++;
                if (bad > 10) break;
            }
            check(!plan.report.unresolved.length, `${label}: unresolved course hexes ${plan.report.unresolved.join(', ')}`);
            let nav = 0, minor = 0;
            for (const t of plan.tiles.values()) t.type === RIVER_NAVIGABLE ? nav++ : minor++;
            if (seed === 1) {
                const r = plan.report;
                console.log(`  ${W}x${H} ${name}: navigable ${nav}, minor ${minor} (${r.minorRivers} generated rivers, ${r.minorHexes}/${r.minorTarget} hexes), ${r.bends} bends, ${r.bridged} bridged, ${r.headwaters} headwater hexes, ${plan.names.length} names`);
            }
            if (dumpSize === `${W}x${H}` && seed === 1) {
                for (let y = H - 1; y >= 0; y--) {
                    let line = (y & 1) ? ' ' : '';
                    for (let x = 0; x < W; x++) {
                        const t = plan.tiles.get(x + ',' + y);
                        line += (isWater(x, y) ? ' ' : t ? (t.type === RIVER_NAVIGABLE ? 'N' : 'm') : reserved.has(x + ',' + y) ? '*' : '.') + ' ';
                    }
                    console.log(line);
                }
            }
        }
    }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures ? `\n${failures} failure(s)` : '\nall river networks valid');
process.exit(failures ? 1 : 0);
