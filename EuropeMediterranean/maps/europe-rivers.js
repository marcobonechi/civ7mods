// europe-rivers.js
// Plans every river on the large Europe maps, tile by tile, the way the base game's Earth map
// (Civilization VII 1.5) paints its own: each river tile names the neighbour it flows into, and the
// map script hands the result to TerrainBuilder.setRiverInfo() and then finalizeRivers(), instead of
// letting TerrainBuilder.modelRivers() pick courses from rainfall.
//
// No engine calls in here, so tools can run it under Node: the caller passes the lookups.
//
// What comes out:
//  - the hand-drawn courses in GEO.rivers (rasterized into grid.riverChains) as they are drawn,
//    navigable, or minor when a river's `strength` is below MINOR_STRENGTH;
//  - slight per-game variance: a course bends through a neighbouring hex here and there, the
//    navigable stretch ends a hex or two short of the drawn head (the rest stays a minor river),
//    and a short minor headwater can climb beyond it;
//  - minor rivers everywhere else, walked downhill from wet high ground to the sea or a river.

import { hexNeighbors, hexDistance } from '/europe-mediterranean-map/maps/europe-raster.js';

export const RIVER_NAVIGABLE = "navigable";
export const RIVER_MINOR = "minor";

const MINOR_STRENGTH = 0.5;        // `strength` below this: the whole course is a minor river
const MEANDER_CHANCE = 0.2;        // per interior hex of a course: bend through a neighbour instead
const HEAD_MINOR_MAX = 2;          // navigable stretch ends up to this many hexes short of the head
const HEAD_MINOR_MIN_LENGTH = 6;   // ... on courses at least this long
const HEADWATER_MAX = 3;           // minor hexes that may continue uphill past the head
const HEADWATER_CHANCE = 0.6;
const MINOR_SHARE = 0.07;          // minor-river hexes to aim for, as a share of land hexes
const MINOR_MIN_LENGTH = 2;
const MINOR_MAX_LENGTH = 7;
const MINOR_MIN_RAIN = 55;         // no minor rivers out of dry land
const MAX_BRIDGE = 3;              // free hexes a course may add to reach the sea or a river

// Rivers whose base-game text key is LOC_RIVER_<NAME>_NAME; the rest stay unnamed rather than
// showing a raw key. Checked against the game's text by tools/check-rivers.mjs.
export const RIVER_NAME_TAGS = {
    "Niger": "LOC_RIVER_NIGER_NAME", "Senegal": "LOC_RIVER_SENEGAL_NAME", "Nile": "LOC_RIVER_NILE_NAME",
    "Nile (Rosetta branch)": "LOC_RIVER_ROSETTA_NAME", "Daugava": "LOC_RIVER_DAUGAVA_NAME",
    "Dnieper": "LOC_RIVER_DNIEPER_NAME", "Tiber": "LOC_RIVER_TIBER_NAME", "Po": "LOC_RIVER_PO_NAME",
    "Seine": "LOC_RIVER_SEINE_NAME", "Thames": "LOC_RIVER_THAMES_NAME", "Rhine": "LOC_RIVER_RHINE_NAME",
    "Danube": "LOC_RIVER_DANUBE_NAME", "Rhone": "LOC_RIVER_RHONE_NAME", "Vistula": "LOC_RIVER_VISTULA_NAME",
    "Oder": "LOC_RIVER_ODER_NAME", "Ebro": "LOC_RIVER_EBRO_NAME", "Tagus": "LOC_RIVER_TAGUS_NAME",
    "Guadalquivir": "LOC_RIVER_GUADALQUIVIR_NAME", "Euphrates": "LOC_RIVER_EUPHRATES_NAME",
    "Tigris": "LOC_RIVER_TIGRIS_NAME", "Volga": "LOC_RIVER_VOLGA_NAME", "Don": "LOC_RIVER_DON_NAME",
    "Dniester": "LOC_RIVER_DNIESTER_NAME",
    // White Nile and Blue Nile have keys too, but they end in the Nile rather than the sea, and a
    // name set on a confluence could rename the whole river, so only rivers with a mouth are named.
};

// env: { W, H, rnd() in [0,1), isWater(x,y), isMountain(x,y), elevation(x,y), rain(x,y),
//        reserved: Set of "x,y" hexes no river may take (start sites) }
// Returns { tiles: Map "x,y" -> { x, y, to: [x, y], type, river }, names: [{ x, y, tag }], report }
export function planRivers(chains, env) {
    const { W, H, rnd } = env;
    const key = (x, y) => x + "," + y;
    const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const land = (x, y) => inside(x, y) && !env.isWater(x, y);
    const neighbors = (x, y) => hexNeighbors(x, y).filter(([a, b]) => inside(a, b));
    const touchesWater = (x, y) => neighbors(x, y).some(([a, b]) => env.isWater(a, b));
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

    const owner = new Map();   // "x,y" -> course index, for every hex on a hand-drawn course
    const courses = [];
    chains.forEach((chain, ci) => {
        const hexes = chain.tiles.filter(([x, y]) => land(x, y) && !env.isMountain(x, y));
        for (const [x, y] of hexes) owner.set(key(x, y), ci);
        courses.push({ name: chain.name, strength: chain.strength === undefined ? 1 : chain.strength, hexes });
    });

    // Orientation: the end on the sea (or a lake) is the mouth; failing that, the end that meets
    // another course is a confluence. Courses come out mouth first.
    const endScore = (ci, [x, y]) => {
        if (touchesWater(x, y)) return 2;
        return neighbors(x, y).some(([a, b]) => owner.has(key(a, b)) && owner.get(key(a, b)) !== ci) ? 1 : 0;
    };
    courses.forEach((c, ci) => {
        const n = c.hexes.length;
        if (n > 1 && endScore(ci, c.hexes[n - 1]) > endScore(ci, c.hexes[0])) c.hexes.reverse();
    });

    // Hexes a tributary meets, and the ends themselves, keep their place so confluences survive.
    const pinned = new Set();
    courses.forEach((c, ci) => {
        if (!c.hexes.length) return;
        for (const end of [c.hexes[0], c.hexes[c.hexes.length - 1]]) {
            pinned.add(key(end[0], end[1]));
            for (const [a, b] of neighbors(end[0], end[1])) {
                if (owner.has(key(a, b)) && owner.get(key(a, b)) !== ci) pinned.add(key(a, b));
            }
        }
    });

    const taken = new Set(owner.keys());
    const freeHex = (x, y) => land(x, y) && !env.isMountain(x, y) && !taken.has(key(x, y)) && !env.reserved.has(key(x, y));

    // Variance 1: bends. Swap an interior hex for a free neighbour of both its course neighbours.
    let bends = 0;
    for (const c of courses) {
        const h = c.hexes;
        for (let k = 1; k < h.length - 1; k++) {
            if (pinned.has(key(h[k][0], h[k][1])) || rnd() >= MEANDER_CHANCE) continue;
            const [px, py] = h[k - 1], [nx, ny] = h[k + 1];
            if (hexDistance(px, py, h[k][0], h[k][1]) !== 1 || hexDistance(nx, ny, h[k][0], h[k][1]) !== 1) continue;
            const alt = neighbors(px, py).filter(([a, b]) =>
                (a !== h[k][0] || b !== h[k][1]) && hexDistance(a, b, nx, ny) === 1 && freeHex(a, b) &&
                !neighbors(a, b).some(([p, q]) => owner.has(key(p, q)) && owner.get(key(p, q)) !== owner.get(key(px, py))));
            if (!alt.length) continue;
            const [ax, ay] = pick(alt);
            taken.delete(key(h[k][0], h[k][1])); owner.delete(key(h[k][0], h[k][1]));
            h[k] = [ax, ay];
            taken.add(key(ax, ay)); owner.set(key(ax, ay), courses.indexOf(c));
            bends++; k++;   // never bend two hexes in a row
        }
    }

    const tiles = new Map();
    const set = (x, y, to, type, river) => tiles.set(key(x, y), { x, y, to, type, river });

    // Flow targets. A course hex drains to the previous hex of its course; a hex with no adjacent
    // predecessor (the mouth, or the far side of a lake or a shared stretch) drains to water, then to
    // an already-draining river hex, then to an earlier hex of its own course. When none is next to
    // it - a course drawn a hex short of a coast that came out further away, or a head cut off by a
    // mountain - a bridge of up to MAX_BRIDGE free hexes carries it to the nearest one.
    const drains = new Set();   // hexes whose water provably reaches the sea
    const outlet = (x, y, own) => {
        const water = neighbors(x, y).filter(([a, b]) => env.isWater(a, b));
        if (water.length) return water[0];
        const river = neighbors(x, y).filter(([a, b]) => drains.has(key(a, b)) && !own.has(key(a, b)));
        if (river.length) return river[0];
        return null;
    };
    const bridge = (x, y) => {
        const from = new Map([[key(x, y), null]]);
        let frontier = [[x, y]];
        for (let depth = 0; depth <= MAX_BRIDGE && frontier.length; depth++) {
            const nextFrontier = [];
            for (const [cx, cy] of frontier) {
                for (const [a, b] of neighbors(cx, cy)) {
                    const k = key(a, b);
                    if (from.has(k)) continue;
                    if (env.isWater(a, b) || drains.has(k)) {
                        const path = [];
                        for (let p = [cx, cy]; p && (p[0] !== x || p[1] !== y); p = from.get(key(p[0], p[1]))) path.unshift(p);
                        return { path, to: [a, b] };
                    }
                    if (depth < MAX_BRIDGE && freeHex(a, b)) { from.set(k, [cx, cy]); nextFrontier.push([a, b]); }
                }
            }
            frontier = nextFrontier;
        }
        return null;
    };
    const unresolved = [];
    const resolve = (c, allowBridge) => {
        const own = new Set(c.hexes.map(([x, y]) => key(x, y)));
        const [mx, my] = c.hexes[0];
        if (!outlet(mx, my, own) && !(allowBridge && bridge(mx, my))) return false;
        const navigable = c.strength >= MINOR_STRENGTH && c.hexes.length >= 2;
        const n = c.hexes.length;
        const headMinor = navigable && n >= HEAD_MINOR_MIN_LENGTH ? Math.floor(rnd() * (HEAD_MINOR_MAX + 1)) : 0;
        for (let k = 0; k < n; k++) {
            const [x, y] = c.hexes[k];
            const type = navigable && k < n - headMinor ? RIVER_NAVIGABLE : RIVER_MINOR;
            const prev = k > 0 ? c.hexes[k - 1] : null;
            let to = null;
            if (prev && hexDistance(x, y, prev[0], prev[1]) === 1 && tiles.has(key(prev[0], prev[1]))) to = prev;
            if (!to) to = outlet(x, y, own);
            if (!to) to = neighbors(x, y).find(([a, b]) => own.has(key(a, b)) && drains.has(key(a, b))) || null;
            if (!to) {
                const b = bridge(x, y);
                if (!b) { unresolved.push(c.name + " (" + x + "," + y + ")"); continue; }
                const hops = [...b.path, b.to];
                for (let h = b.path.length - 1; h >= 0; h--) {
                    const [hx, hy] = b.path[h];
                    set(hx, hy, hops[h + 1], type, c.name);
                    taken.add(key(hx, hy)); drains.add(key(hx, hy));
                }
                bridged += b.path.length;
                to = hops[0];
            }
            set(x, y, to, type, c.name);
            drains.add(key(x, y));
        }
        c.mouth = c.hexes[0];
        return true;
    };
    let bridged = 0;
    // Courses reaching the sea first, then the tributaries that meet them, then whatever is left.
    let pending = courses.filter((c) => c.hexes.length);
    for (let progress = true; progress && pending.length;) {
        const before = pending.length;
        pending = pending.filter((c) => !resolve(c, false));
        progress = pending.length < before;
    }
    for (const c of pending) if (!resolve(c, true)) unresolved.push(c.name + " (no outlet)");

    // Variance 2: headwaters. A few minor hexes climbing on from the head of a course.
    let headwaters = 0;
    for (const c of courses) {
        if (!c.hexes.length || rnd() >= HEADWATER_CHANCE) continue;
        let [x, y] = c.hexes[c.hexes.length - 1];
        if (!tiles.has(key(x, y))) continue;
        const steps = 1 + Math.floor(rnd() * HEADWATER_MAX);
        for (let s = 0; s < steps; s++) {
            const here = env.elevation(x, y);
            const up = neighbors(x, y).filter(([a, b]) => freeHex(a, b) && env.elevation(a, b) >= here &&
                neighbors(a, b).every(([p, q]) => (p === x && q === y) || !taken.has(key(p, q))));
            if (!up.length) break;
            const [ax, ay] = pick(up);
            set(ax, ay, [x, y], RIVER_MINOR, c.name);
            taken.add(key(ax, ay)); drains.add(key(ax, ay));
            x = ax; y = ay; headwaters++;
        }
    }

    // Minor rivers: from wet high ground, downhill to the sea or a river.
    let landCount = 0;
    const sources = [];
    for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
            if (!land(x, y)) continue;
            landCount++;
            if (env.isMountain(x, y) || env.rain(x, y) < MINOR_MIN_RAIN) continue;
            if (!freeHex(x, y) || touchesWater(x, y)) continue;
            sources.push([x, y]);
        }
    }
    for (let i = sources.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [sources[i], sources[j]] = [sources[j], sources[i]];
    }
    // Higher ground first, so streams run down from the hills rather than across plains.
    const rank = new Map(sources.map(([x, y]) => [key(x, y), env.elevation(x, y) + rnd() * 200]));
    sources.sort((a, b) => rank.get(key(b[0], b[1])) - rank.get(key(a[0], a[1])));
    const minorTarget = Math.round(landCount * MINOR_SHARE);
    let minorHexes = 0, minorRivers = 0;
    for (const [sx, sy] of sources) {
        if (minorHexes >= minorTarget) break;
        if (!freeHex(sx, sy) || neighbors(sx, sy).some(([a, b]) => taken.has(key(a, b)))) continue;
        const path = [[sx, sy]];
        const onPath = new Set([key(sx, sy)]);
        let end = null;
        while (path.length <= MINOR_MAX_LENGTH) {
            const [x, y] = path[path.length - 1];
            const here = env.elevation(x, y);
            const exits = neighbors(x, y).filter(([a, b]) => env.isWater(a, b) || drains.has(key(a, b)));
            if (exits.length && path.length >= MINOR_MIN_LENGTH) { end = pick(exits); break; }
            const down = neighbors(x, y).filter(([a, b]) => freeHex(a, b) && !onPath.has(key(a, b)) &&
                env.elevation(a, b) <= here);
            if (!down.length) break;
            down.sort((p, q) => env.elevation(p[0], p[1]) - env.elevation(q[0], q[1]));
            const [nx, ny] = rnd() < 0.7 ? down[0] : pick(down);
            path.push([nx, ny]); onPath.add(key(nx, ny));
        }
        if (!end) continue;
        for (let k = 0; k < path.length; k++) {
            const [x, y] = path[k];
            set(x, y, k + 1 < path.length ? path[k + 1] : end, RIVER_MINOR, null);
            taken.add(key(x, y)); drains.add(key(x, y));
        }
        minorHexes += path.length; minorRivers++;
    }

    const names = [];
    for (const c of courses) {
        const tag = RIVER_NAME_TAGS[c.name];
        if (tag && c.mouth && tiles.has(key(c.mouth[0], c.mouth[1]))) names.push({ x: c.mouth[0], y: c.mouth[1], tag });
    }
    const report = { bends, bridged, headwaters, minorRivers, minorHexes, minorTarget, unresolved };
    return { tiles, names, report };
}

// finalizeRivers() re-traces every river against elevation. Verified in game: setRiverInfo() alone
// stores the plan exactly; after finalizeRivers() a hex that runs uphill loses its river, and a
// navigable hex whose climb from the hex below is more than a unit becomes a minor river. The base
// game's Earth map hand-sets its elevation to match: 158 of its 165 navigable hexes sit exactly one
// unit above the hex they drain into, its minor rivers 1 or 20 units. This does the same, from each
// mouth upstream: a navigable hex goes exactly one unit above the hex below it, a minor hex at most
// VALLEY_STEP above and never below that (so valleys are carved, never raised, where the land allows).
// `elevation` is a row-major W*H array (index y * W + x), modified in place; returns hexes changed.
const VALLEY_STEP = 8;
export function carveRiverValleys(plan, elevation, W, isWater) {
    const at = (x, y) => y * W + x;
    const upstream = new Map();
    const roots = [];
    for (const t of plan.tiles.values()) {
        const [tx, ty] = t.to;
        if (isWater(tx, ty)) { roots.push(t); continue; }
        const k = tx + "," + ty;
        if (!upstream.has(k)) upstream.set(k, []);
        upstream.get(k).push(t);
    }
    let changed = 0;
    const queue = roots.map((t) => [t, isWater(t.to[0], t.to[1]) ? elevation[at(t.to[0], t.to[1])] : null]);
    for (let q = 0; q < queue.length; q++) {
        const [t, below] = queue[q];
        const i = at(t.x, t.y);
        const floor = (below === null ? 0 : below) + 1;
        const want = t.type === RIVER_NAVIGABLE ? floor : Math.max(floor, Math.min(elevation[i], floor - 1 + VALLEY_STEP));
        if (want !== elevation[i]) { elevation[i] = want; changed++; }
        for (const u of upstream.get(t.x + "," + t.y) || []) queue.push([u, want]);
    }
    return changed;
}

// The engine's DirectionTypes name, for the neighbour `to` of (x, y). Rows count upwards (north),
// odd rows sit half a hex to the east, as in hexNeighbors().
export function directionName(x, y, to) {
    const [tx, ty] = to;
    const eastShift = (y & 1) ? 1 : 0;
    if (ty === y) return tx > x ? "DIRECTION_EAST" : "DIRECTION_WEST";
    const east = tx - x === eastShift;
    if (ty === y + 1) return east ? "DIRECTION_NORTHEAST" : "DIRECTION_NORTHWEST";
    return east ? "DIRECTION_SOUTHEAST" : "DIRECTION_SOUTHWEST";
}
