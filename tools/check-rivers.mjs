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
const { planRivers, carveRiverValleys, directionName, RIVER_NAME_TAGS, RIVER_NAVIGABLE } = await import(pathToFileURL(path.join(tmp, 'europe-rivers.mjs')).href);

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
// Each registered map script as the game builds it: One Landmass passes the shared geo through
// oneLandmassGeo, which drops channels, so its rivers are planned on different coasts.
const maps = registered.map(script => {
    const src = fs.readFileSync(path.join(MAPS, script), 'utf8');
    // The first geography a script imports is its own; any other is drawn for particular grids
    // (GEO.gridSizes) and europe-large-core.js swaps it in on those, so the check does the same.
    const geoFiles = [...src.matchAll(/maps\/([\w-]+-geo\.js)/g)].map(m => m[1]);
    // A map is only built at the sizes config.xml offers it.
    const sizes = new Set([...cfg.matchAll(new RegExp('Map="\\{europe-mediterranean-map\\}maps/' + script.replace(/[.]/g, '\\.') + '" Domain="\\w+" Value="(\\w+)"', 'g'))].map(m => m[1]));
    return { script, geoFile: geoFiles[0], sizedGeoFiles: geoFiles.slice(1), sizes, united: /oneLandmassGeo\(/.test(src) };
}).filter(m => m.geoFile);

for (const { script, geoFile, sizedGeoFiles, sizes, united } of maps) {
    const load = async (f) => { const { GEO: RAW } = await import(pathToFileURL(path.join(MAPS, f)).href); return united ? raster.oneLandmassGeo(RAW) : RAW; };
    const OWN = await load(geoFile);
    const SIZED = [];
    for (const f of sizedGeoFiles) SIZED.push(await load(f));
    console.log('\n=== ' + script + ' (' + geoFile + (united ? ', one landmass' : '') + ')');
    for (const { name, w: W, h: H } of shipped.filter(z => !sizes.size || sizes.has(z.name))) {
        const GEO = SIZED.find(z => (z.gridSizes || []).some(d => d[0] === W && d[1] === H)) || OWN;
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
                W, H, rnd, reserved, noRiver: g.passHexes, isWater, elevation,
                isMountain: (x, y) => terrainAt(x, y) === T.MOUNTAIN,
                rain: (x, y) => g.rain[g.idx(x, y)],
                lonLat: (x, y) => [g.lonC[g.idx(x, y)], g.latC[g.idx(x, y)]],
                riverAreas: GEO.riverAreas,
            });

            const label = `${W}x${H} seed ${seed}`;
            // Carve the valleys the way the map script does, then every river hex must sit strictly
            // above the land hex it drains into (finalizeRivers() drops rivers that run uphill).
            const elev = new Int32Array(W * H);
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) elev[y * W + x] = isWater(x, y) ? 0 : elevation(x, y);
            const before = elev.slice();
            const carved = carveRiverValleys(plan, elev, W, isWater);
            let deepest = 0;
            for (let i = 0; i < elev.length; i++) deepest = Math.max(deepest, before[i] - elev[i]);
            for (const t of plan.tiles.values()) {
                const [tx, ty] = t.to;
                const rise = elev[t.y * W + t.x] - elev[ty * W + tx];
                check(rise > 0, `${label}: ${t.river || 'minor'} (${t.x},${t.y}) runs uphill after carving`);
            }
            let bad = 0;
            for (const t of plan.tiles.values()) {
                const [tx, ty] = t.to;
                const where = `${label}: ${t.river || 'minor'} (${t.x},${t.y})`;
                if (!check(inB(tx, ty) && hexDistance(t.x, t.y, tx, ty) === 1, `${where} drains to non-neighbour (${tx},${ty})`)) { bad++; continue; }
                check(isWater(tx, ty) || plan.tiles.has(tx + ',' + ty), `${where} drains onto dry land (${tx},${ty})`) || bad++;
                check(!isWater(t.x, t.y), `${where} is on water`) || bad++;
                check(!reserved.has(t.x + ',' + t.y), `${where} takes a true start`) || bad++;
                check(!g.passHexes.has(t.x + ',' + t.y), `${where} runs through a mountain pass`) || bad++;
                directionName(t.x, t.y, t.to);
                // follow the flow to the sea
                let cur = t, steps = 0;
                while (cur && steps < W * H) { const k = cur.to[0] + ',' + cur.to[1]; if (isWater(cur.to[0], cur.to[1])) break; cur = plan.tiles.get(k); steps++; }
                check(cur && steps < W * H, `${where} never reaches water`) || bad++;
                if (bad > 10) break;
            }
            // A named river must not drain into a small lake while its other end meets another river:
            // that is a course running backwards from its source lake (the Blue Nile into Lake Tana).
            const waterComp = new Int32Array(W * H).fill(-1), compSize = [];
            for (let y0 = 0; y0 < H; y0++) for (let x0 = 0; x0 < W; x0++) {
                if (!isWater(x0, y0) || waterComp[g.idx(x0, y0)] >= 0) continue;
                const id = compSize.length; let size = 0; const stack = [[x0, y0]]; waterComp[g.idx(x0, y0)] = id;
                while (stack.length) { const [x, y] = stack.pop(); size++;
                    for (const [a, b] of raster.hexNeighbors(x, y)) if (inB(a, b) && isWater(a, b) && waterComp[g.idx(a, b)] < 0) { waterComp[g.idx(a, b)] = id; stack.push([a, b]); } }
                compSize.push(size);
            }
            const LAKE_MAX = 60;
            const riverHex = new Map([...plan.tiles.values()].map((t) => [t.x + ',' + t.y, t]));
            for (const t of plan.tiles.values()) {
                if (!t.river || !isWater(t.to[0], t.to[1])) continue;
                if (compSize[waterComp[g.idx(t.to[0], t.to[1])]] > LAKE_MAX) continue;
                const meetsAnother = [...plan.tiles.values()].some((u) => u.river === t.river &&
                    raster.hexNeighbors(u.x, u.y).some(([a, b]) => { const v = riverHex.get(a + ',' + b); return v && v.river && v.river !== t.river; }));
                check(!meetsAnother, `${label}: ${t.river} drains into a lake at (${t.to}) but meets another river - backwards? set mouth in GEO.rivers`);
            }
            check(!plan.report.unresolved.length, `${label}: unresolved course hexes ${plan.report.unresolved.join(', ')}`);
            let nav = 0, minor = 0;
            for (const t of plan.tiles.values()) t.type === RIVER_NAVIGABLE ? nav++ : minor++;
            if (seed === 1) {
                const r = plan.report;
                console.log(`  ${W}x${H} ${name}: navigable ${nav}, minor ${minor} (${r.minorRivers} generated rivers, ${r.minorHexes}/${r.minorTarget} hexes), ${r.bends} bends, ${r.bridged} bridged, ${r.headwaters} headwater hexes, ${plan.names.length} names, ${carved} hexes lowered (deepest ${deepest})`);
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
