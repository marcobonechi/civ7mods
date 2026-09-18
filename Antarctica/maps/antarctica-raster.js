// antarctica-raster.js
// Turns the Antarctica geography (antarctica-geo.js, plain data) into a hex grid. Pure JavaScript
// with no engine calls, so the map script, tools/antarctica-check.mjs, tools/antarctica-preview.mjs
// and the editor (editor-antarctica/) all build exactly the same grid.
//
// Coordinates: a "canvas" frame with the map centre at 0,0, y up (north on screen), and half the
// map height equal to 1. One hex is 1 / halfH canvas units wide. Each land has its own projection
// (its `frame` in the geography), from [lon, lat] to canvas.

export const T = { OCEAN: 0, COAST: 1, FLAT: 2, HILL: 3, MOUNTAIN: 4, LAKE: 5 };
export const B = { MARINE: 0, GRASSLAND: 1, PLAINS: 2, DESERT: 3, TUNDRA: 4, TROPICAL: 5 };
export const REGION = { NONE: 0, HOME: 1, DISTANT: 2 };

// Grid per map size, all with the same aspect (width / height in hex units about 1.56).
export const SIZES = {
    MAPSIZE_ANTARCTICA_STD: [108, 80],
    MAPSIZE_ANTARCTICA_LRG: [124, 92],
    MAPSIZE_ANTARCTICA_HUGE: [138, 102],
};

const D2R = Math.PI / 180;
const SQ3 = Math.sqrt(3) / 2;

// ---- hex helpers (rows count upwards, odd rows sit half a hex to the east) -------------------

export function hexNeighbors(x, y) {
    if (y & 1) return [[x + 1, y], [x - 1, y], [x + 1, y + 1], [x, y + 1], [x + 1, y - 1], [x, y - 1]];
    return [[x + 1, y], [x - 1, y], [x, y + 1], [x - 1, y + 1], [x, y - 1], [x - 1, y - 1]];
}

export function hexDistance(x1, y1, x2, y2) {
    const q1 = x1 - (y1 - (y1 & 1)) / 2, q2 = x2 - (y2 - (y2 & 1)) / 2;
    const dq = q1 - q2, dr = y1 - y2, ds = (-q1 - y1) - (-q2 - y2);
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

// The engine's DirectionTypes name for the neighbour `to` of (x, y).
export function directionName(x, y, to) {
    const [tx, ty] = to;
    const eastShift = (y & 1) ? 1 : 0;
    if (ty === y) return tx > x ? "DIRECTION_EAST" : "DIRECTION_WEST";
    const east = tx - x === eastShift;
    if (ty === y + 1) return east ? "DIRECTION_NORTHEAST" : "DIRECTION_NORTHWEST";
    return east ? "DIRECTION_SOUTHEAST" : "DIRECTION_SOUTHWEST";
}

// ---- projections ----------------------------------------------------------------------------

// Antarctica: azimuthal equidistant around the South Pole. k = canvas units per degree of arc.
function polarFrame(k, rot) {
    return {
        toCanvas(lon, lat) {
            const r = 90 + lat, b = (lon + rot) * D2R;
            return [k * r * Math.sin(b), k * r * Math.cos(b)];
        },
        fromCanvas(X, Y) {
            let lon = Math.atan2(X, Y) / D2R - rot;
            if (lon > 180) lon -= 360;
            if (lon < -180) lon += 360;
            return [lon, Math.hypot(X, Y) / k - 90];
        },
    };
}

// A Distant Land: a local equirectangular projection around (lon0, lat0), scaled by k, turned
// by rot degrees (counter-clockwise) and centred at canvas point `at`.
function localFrame(lon0, lat0, at, k, rotDeg) {
    const cl = Math.cos(lat0 * D2R), c = Math.cos(rotDeg * D2R), s = Math.sin(rotDeg * D2R);
    return {
        toCanvas(lon, lat) {
            const x = (lon - lon0) * cl, y = lat - lat0;
            return [at[0] + k * (x * c - y * s), at[1] + k * (x * s + y * c)];
        },
        fromCanvas(X, Y) {
            const u = (X - at[0]) / k, v = (Y - at[1]) / k;
            const x = u * c + v * s, y = -u * s + v * c;
            return [lon0 + x / cl, lat0 + y];
        },
    };
}

// The projection a land's `frame` describes.
export function makeFrame(f) {
    return f.type === "polar" ? polarFrame(f.k, f.rot || 0) : localFrame(f.lon0, f.lat0, f.at, f.k, f.rot || 0);
}

// ---- biome rules per Distant Land (Antarctica's own are in buildAntarcticaGrid) --------------
// n is a smooth noise value in [0, 1] for patchiness.

const BIOME_RULES = {
    "south-america"(lon, lat, n) {
        const andes = lat > -33 ? -69.6 : lat > -40 ? -70.2 - (lat + 33) * -0.13 : lat > -48 ? -71.5 - (-40 - lat) * 0.18 : -72.8;
        if (lat < -53) return n < 0.55 ? B.TUNDRA : B.PLAINS;
        if (lon < andes - 0.6) {                          // Pacific side of the Andes
            if (lat < -39) return B.GRASSLAND;            // temperate rainforest
            if (lat < -31) return n < 0.6 ? B.PLAINS : B.GRASSLAND;
            return B.DESERT;                              // Atacama
        }
        if (lat < -46) return n < 0.5 ? B.DESERT : (n < 0.8 ? B.PLAINS : B.TUNDRA);   // Patagonian steppe
        if (lat < -38) return n < 0.45 ? B.DESERT : B.PLAINS;
        if (lon < -66 && lat < -26) return n < 0.6 ? B.DESERT : B.PLAINS;           // Monte
        if (lat < -30) return n < 0.65 ? B.GRASSLAND : B.PLAINS;                      // Pampas
        if (lon < -58) return n < 0.6 ? B.PLAINS : B.TROPICAL;                        // Chaco
        if (lat > -24) return n < 0.7 ? B.TROPICAL : B.GRASSLAND;
        return n < 0.55 ? B.GRASSLAND : B.TROPICAL;                                    // Parana forest
    },
    africa(lon, lat, n) {
        if (lon > 42) return lon > 46.5 || lat > -14 ? (n < 0.75 ? B.TROPICAL : B.GRASSLAND) : (n < 0.6 ? B.PLAINS : B.DESERT);
        if (lat < -32.5) return lon < 22 ? (n < 0.5 ? B.PLAINS : B.GRASSLAND) : (n < 0.6 ? B.GRASSLAND : B.PLAINS);
        if (lon < 16.5) return B.DESERT;                                      // Namib
        if (lon < 25 && lat > -30) return n < 0.65 ? B.DESERT : B.PLAINS;     // Kalahari
        if (lat < -29 && lon < 26.5) return n < 0.55 ? B.PLAINS : B.DESERT;   // Karoo
        if (lon > 30.5 && lat < -24) return n < 0.7 ? B.GRASSLAND : B.TROPICAL;
        if (lat < -23) return n < 0.7 ? B.GRASSLAND : B.PLAINS;               // Highveld
        if (lon > 33) return n < 0.65 ? B.TROPICAL : B.PLAINS;
        return n < 0.6 ? B.PLAINS : (n < 0.85 ? B.TROPICAL : B.GRASSLAND);   // miombo savanna
    },
    australia(lon, lat, n) {
        if (lat < -40) return B.GRASSLAND;                                    // Tasmania
        if (lat > -19) return lon > 141 || lat > -15 ? (n < 0.7 ? B.TROPICAL : B.PLAINS) : (n < 0.6 ? B.PLAINS : B.TROPICAL);
        if (lon > 150 || (lon > 147 && lat < -33)) return lat > -24 ? (n < 0.55 ? B.TROPICAL : B.GRASSLAND) : B.GRASSLAND;
        if (lon < 119.5 && lat < -30) return n < 0.55 ? B.PLAINS : B.GRASSLAND;
        if (lon > 140 && lat < -34) return n < 0.6 ? B.GRASSLAND : B.PLAINS;
        if (lon > 141.5 && lat < -27) return n < 0.7 ? B.PLAINS : B.GRASSLAND; // Murray-Darling
        if (lon > 145) return n < 0.6 ? B.PLAINS : B.GRASSLAND;
        if (lat < -31 && lon < 136) return n < 0.6 ? B.PLAINS : B.DESERT;     // Nullarbor
        return n < 0.8 ? B.DESERT : B.PLAINS;                                   // the Outback
    },
    "new-zealand"(lon, lat, n) {
        if (lat < -43 && lon > 170.5) return n < 0.6 ? B.PLAINS : B.GRASSLAND;   // Canterbury, Otago
        if (lat > -36) return n < 0.5 ? B.TROPICAL : B.GRASSLAND;                  // Northland
        return n < 0.8 ? B.GRASSLAND : B.PLAINS;
    },
};
// a land the rules do not know (added in the editor) gets a temperate mix
const DEFAULT_BIOME = (lon, lat, n) => n < 0.5 ? B.GRASSLAND : n < 0.8 ? B.PLAINS : B.TUNDRA;

// ---- noise ----------------------------------------------------------------------------------

function makeNoise(rnd) {
    const perm = [];
    for (let i = 0; i < 256; i++) perm.push(i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    const vals = [];
    for (let i = 0; i < 256; i++) vals.push(rnd());
    const h = (i, j) => vals[perm[(perm[i & 255] + j) & 255]];
    const sm = (t) => t * t * (3 - 2 * t);
    const one = (x, y) => {
        const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi);
        const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    return (x, y, oct = 3) => {
        let s = 0, amp = 1, f = 1, tot = 0;
        for (let k = 0; k < oct; k++) { s += amp * one(x * f + k * 17.31, y * f + k * 31.77); tot += amp; amp *= 0.5; f *= 2; }
        return s / tot;
    };
}

function pointInPoly(X, Y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if ((yi > Y) !== (yj > Y) && X < xi + (Y - yi) * (xj - xi) / (yj - yi)) inside = !inside;
    }
    return inside;
}

function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

// ---- the rasterizer -------------------------------------------------------------------------

// GEO: the geography from antarctica-geo.js. Its first land must be Antarctica (the homeland).
export function buildAntarcticaGrid(W, H, GEO, rnd, log = () => {}) {
    const BAND_DEPTH = GEO.bandDepth;
    const LANDS = GEO.lands.map((L) => ({
        ...L, frame: makeFrame(L.frame), region: L.region === "home" ? REGION.HOME : REGION.DISTANT,
        polys: L.polys.map((p) => p.pts), biome: BIOME_RULES[L.id] || DEFAULT_BIOME,
    }));
    const ANTARCTICA = LANDS[0];
    const ISLANDS = GEO.islands || [];
    const WONDERS = GEO.wonders || [];
    const N = W * H;
    const idx = (x, y) => y * W + x;
    const inBounds = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const halfH = (H - 1) * SQ3 / 2;
    const cx0 = (W - 0.5) / 2;
    const toCanvas = (x, y) => [(x + 0.5 * (y & 1) - cx0) / halfH, (y * SQ3 - halfH) / halfH];
    const nearestHex = (X, Y) => {
        const py = Y * halfH + halfH, y0 = Math.round(py / SQ3);
        let best = null, bd = Infinity;
        for (let y = y0 - 1; y <= y0 + 1; y++) {
            const x0 = Math.round(X * halfH + cx0 - 0.5 * (y & 1));
            for (let x = x0 - 1; x <= x0 + 1; x++) {
                if (!inBounds(x, y)) continue;
                const [a, b] = toCanvas(x, y);
                const d = Math.hypot(a - X, b - Y);
                if (d < bd) { bd = d; best = [x, y]; }
            }
        }
        return best;
    };
    const noise = makeNoise(rnd);
    const warpA = makeNoise(rnd), warpB = makeNoise(rnd);

    const terrain = new Array(N).fill(T.OCEAN);
    const biome = new Array(N).fill(B.MARINE);
    const owner = new Array(N).fill(-1);          // index into LANDS, or -2 for a sub-Antarctic island
    const region = new Array(N).fill(REGION.NONE);
    const lon = new Array(N).fill(0), lat = new Array(N).fill(0);
    const plat = new Array(N).fill(0);            // latitude on the polar projection, for every hex
    const rain = new Array(N).fill(0);
    const canvasX = new Array(N), canvasY = new Array(N);

    // --- land ---
    const landPolys = LANDS.map((L) => L.polys.map((p) => p.map(([lo, la]) => L.frame.toCanvas(lo, la))));
    const WARP = 1.3 / halfH;   // coastline jitter, in canvas units (about a hex)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        const [X, Y] = toCanvas(x, y);
        canvasX[i] = X; canvasY[i] = Y;
        plat[i] = ANTARCTICA.frame.fromCanvas(X, Y)[1];
        const px = X * halfH, py = Y * halfH;
        const Xw = X + WARP * (warpA(px / 5, py / 5) - 0.5) * 2;
        const Yw = Y + WARP * (warpB(px / 5, py / 5) - 0.5) * 2;
        for (let l = 0; l < LANDS.length && owner[i] < 0; l++) {
            for (const poly of landPolys[l]) {
                if (pointInPoly(Xw, Yw, poly)) { owner[i] = l; break; }
            }
        }
    }
    // every small polygon (Falklands, Stewart Island) gets at least its central hex
    LANDS.forEach((L, l) => landPolys[l].forEach((poly) => {
        let sx = 0, sy = 0;
        for (const [a, b] of poly) { sx += a; sy += b; }
        const t = nearestHex(sx / poly.length, sy / poly.length);
        if (t && owner[idx(t[0], t[1])] < 0) owner[idx(t[0], t[1])] = l;
    }));
    const polar = ANTARCTICA.frame;
    for (const isl of ISLANDS) {
        const [X, Y] = polar.toCanvas(isl.lon, isl.lat);
        const c = nearestHex(X, Y);
        if (!c) continue;
        for (let y = c[1] - 3; y <= c[1] + 3; y++) for (let x = c[0] - 3; x <= c[0] + 3; x++) {
            if (!inBounds(x, y) || owner[idx(x, y)] >= 0) continue;
            const d = hexDistance(c[0], c[1], x, y);
            if (d === 0 || d < isl.r + (rnd() - 0.5) * 0.8) owner[idx(x, y)] = -2;
        }
    }
    // keep a clear sea on the map edges' first column so nothing touches the left and right sides
    for (let y = 0; y < H; y++) { owner[idx(0, y)] = -1; owner[idx(W - 1, y)] = -1; }

    for (let i = 0; i < N; i++) {
        if (owner[i] === -1) continue;
        terrain[i] = T.FLAT;
        const L = owner[i] >= 0 ? LANDS[owner[i]] : ANTARCTICA;
        const [lo, la] = L.frame.fromCanvas(canvasX[i], canvasY[i]);
        lon[i] = lo; lat[i] = la;
        region[i] = owner[i] >= 0 ? L.region : REGION.DISTANT;
    }

    // --- lakes (inland, so never on a coast) ---
    const lakeTiles = new Map();   // lake name -> [[x,y]...]
    LANDS.forEach((L, l) => (L.lakes || []).forEach((lk) => {
        const [X, Y] = L.frame.toCanvas(lk.lon, lk.lat);
        const c = nearestHex(X, Y);
        if (!c || owner[idx(c[0], c[1])] !== l) { log("lake " + lk.name + " is not on land"); return; }
        const tiles = [c];
        const seen = new Set([c.join(",")]);
        while (tiles.length < lk.size) {
            const cands = [];
            for (const t of tiles) for (const [a, b] of hexNeighbors(t[0], t[1])) {
                if (!inBounds(a, b) || seen.has(a + "," + b) || owner[idx(a, b)] !== l) continue;
                cands.push([a, b]);
            }
            if (!cands.length) break;
            const pick = cands[Math.floor(rnd() * cands.length)];
            seen.add(pick.join(",")); tiles.push(pick);
        }
        for (const [a, b] of tiles) terrain[idx(a, b)] = T.LAKE;
        lakeTiles.set(lk.name, tiles);
    }));

    // --- water depth: coast next to land, ocean further out ---
    // Distances to the homeland (Antarctica) and to the Distant Lands are kept apart: shallow water
    // two or three hexes out only grows where the other side is far away, so no chain of coast
    // tiles ever links Antarctica to a Distant Land and they stay out of reach until the ships of
    // the Exploration Age.
    const isLand = (i) => terrain[i] !== T.OCEAN && terrain[i] !== T.COAST && terrain[i] !== T.LAKE;
    const distFrom = (isSource) => {
        const d = new Array(N).fill(Infinity), q = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isSource(idx(x, y))) { d[idx(x, y)] = 0; q.push([x, y]); }
        for (let k = 0; k < q.length; k++) {
            const [x, y] = q[k], dd = d[idx(x, y)];
            for (const [a, b] of hexNeighbors(x, y)) {
                if (!inBounds(a, b) || d[idx(a, b)] <= dd + 1) continue;
                d[idx(a, b)] = dd + 1; q.push([a, b]);
            }
        }
        return d;
    };
    const dHome = distFrom((i) => isLand(i) && region[i] === REGION.HOME);
    const dFar = distFrom((i) => isLand(i) && region[i] !== REGION.HOME);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        if (terrain[i] !== T.OCEAN) continue;
        const d = Math.min(dHome[i], dFar[i]);
        const other = Math.max(dHome[i], dFar[i]);
        const n = noise(x / 4 + 40, y / 4 + 40);
        if (d === 1 || (other > 4 && ((d === 2 && n > 0.45) || (d === 3 && n > 0.72)))) terrain[i] = T.COAST;
    }

    // --- Antarctica's ice-free band: land within BAND_DEPTH hexes of the sea (lakes do not count) ---
    const band = new Array(N).fill(0);     // 1..BAND_DEPTH in the band, 0 elsewhere
    const coastDist = new Array(N).fill(Infinity);
    {
        const q = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = idx(x, y);
            if (!isLand(i)) continue;
            if (hexNeighbors(x, y).some(([a, b]) => inBounds(a, b) && (terrain[idx(a, b)] === T.OCEAN || terrain[idx(a, b)] === T.COAST))) {
                coastDist[i] = 1; q.push([x, y]);
            }
        }
        for (let k = 0; k < q.length; k++) {
            const [x, y] = q[k], d = coastDist[idx(x, y)];
            for (const [a, b] of hexNeighbors(x, y)) {
                if (!inBounds(a, b)) continue;
                const j = idx(a, b);
                if (!isLand(j) || coastDist[j] <= d + 1) continue;
                coastDist[j] = d + 1; q.push([a, b]);
            }
        }
    }
    for (let i = 0; i < N; i++) if (owner[i] === 0 && coastDist[i] <= BAND_DEPTH) band[i] = coastDist[i];

    // --- relief: ranges, then rolling hills ---
    const rangeCanvas = new Map();
    const hexDistToRange = (i, L, rg) => {
        let best = Infinity;
        let pts = rangeCanvas.get(rg);
        if (!pts) { pts = rg.pts.map(([lo, la]) => L.frame.toCanvas(lo, la)); rangeCanvas.set(rg, pts); }
        for (let k = 0; k + 1 < pts.length; k++) {
            best = Math.min(best, segDist(canvasX[i], canvasY[i], pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]));
        }
        return best * halfH;
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        if (!isLand(i)) continue;
        const L = owner[i] >= 0 ? LANDS[owner[i]] : null;
        let t = T.FLAT;
        if (L) {
            for (const rg of L.ranges) {
                const d = hexDistToRange(i, L, rg);
                if (d <= rg.w) {
                    const r = rnd();
                    if (r < rg.m) t = T.MOUNTAIN; else if (r < rg.h && t !== T.MOUNTAIN) t = T.HILL;
                } else if (d <= rg.w + 1 && t === T.FLAT && rnd() < rg.h * 0.45) t = T.HILL;
                if (t === T.MOUNTAIN) break;
            }
        }
        if (t === T.FLAT) {
            const n = noise(x / 3.5 + 7, y / 3.5 + 11);
            const hillCut = owner[i] === 0 ? (band[i] ? 0.66 : 0.63) : 0.68;
            if (n > hillCut && rnd() < 0.8) t = T.HILL;
        }
        // the band stays open: fewer peaks, and never a wall of them on the shore
        if (t === T.MOUNTAIN && band[i] && (band[i] === 1 || rnd() < 0.4)) t = T.HILL;
        terrain[i] = t;
    }
    // no mountain on a one-hex island or a sliver of coast with nothing else
    for (let i = 0; i < N; i++) if (terrain[i] === T.MOUNTAIN && owner[i] < 0) terrain[i] = T.HILL;

    // --- rivers ---
    const riverTiles = new Map();   // "x,y" -> { x, y, to: [x, y], nav, river }
    const riverList = [];
    const key = (x, y) => x + "," + y;
    const isWaterT = (x, y) => !isLand(idx(x, y));
    LANDS.forEach((L, l) => (L.rivers || []).forEach((rv) => {
        // sample the course densely and collect the hexes it passes through
        const pts = rv.pts.map(([lo, la]) => L.frame.toCanvas(lo, la));
        const seq = [];
        const step = 0.2 / halfH;
        for (let k = 0; k + 1 < pts.length; k++) {
            const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
            const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
            for (let s = 0; s <= n; s++) {
                const h = nearestHex(ax + (bx - ax) * s / n, ay + (by - ay) * s / n);
                if (!h) continue;
                const last = seq[seq.length - 1];
                if (last && last[0] === h[0] && last[1] === h[1]) continue;
                if (last && hexDistance(last[0], last[1], h[0], h[1]) > 1) {
                    // bridge a jump with the neighbour closest to the target
                    let cur = last;
                    while (hexDistance(cur[0], cur[1], h[0], h[1]) > 1) {
                        cur = hexNeighbors(cur[0], cur[1]).filter(([a, b]) => inBounds(a, b))
                            .sort((p, q) => hexDistance(p[0], p[1], h[0], h[1]) - hexDistance(q[0], q[1], h[0], h[1]))[0];
                        seq.push(cur);
                    }
                }
                seq.push(h);
            }
        }
        // cut loops
        const path = [];
        const onPath = new Set();
        for (const h of seq) {
            const k = key(h[0], h[1]);
            if (onPath.has(k)) {
                while (key(...path[path.length - 1]) !== k) onPath.delete(key(...path.pop()));
                continue;
            }
            onPath.add(k); path.push(h);
        }
        // start on land of this landmass
        let s = 0;
        while (s < path.length && (isWaterT(path[s][0], path[s][1]) || owner[idx(path[s][0], path[s][1])] !== l)) s++;
        const course = [];
        let mouth = null;
        for (let k = s; k < path.length; k++) {
            const [x, y] = path[k];
            if (isWaterT(x, y) || riverTiles.has(key(x, y))) { mouth = [x, y]; break; }
            course.push([x, y]);
        }
        if (!course.length) { log("river " + rv.name + " has no land course"); return; }
        if (!mouth) {
            // the drawn course stops short of the water: walk on to the nearest water or river
            const [ex, ey] = course[course.length - 1];
            const prev = new Map([[key(ex, ey), null]]);
            const q = [[ex, ey]];
            const wantLake = rv.toLake ? new Set((lakeTiles.get(rv.toLake) || []).map((t) => key(t[0], t[1]))) : null;
            for (let k = 0; k < q.length && !mouth; k++) {
                for (const [a, b] of hexNeighbors(q[k][0], q[k][1])) {
                    if (!inBounds(a, b) || prev.has(key(a, b))) continue;
                    prev.set(key(a, b), q[k]);
                    const done = wantLake ? wantLake.has(key(a, b)) : (isWaterT(a, b) || riverTiles.has(key(a, b)));
                    if (done) { mouth = [a, b]; break; }
                    if (isWaterT(a, b) || course.some((c) => c[0] === a && c[1] === b)) continue;
                    if (hexDistance(ex, ey, a, b) <= 8) q.push([a, b]);
                }
            }
            if (!mouth) { log("river " + rv.name + " found no mouth"); return; }
            const ext = [];
            for (let c = prev.get(key(mouth[0], mouth[1])); c && !(c[0] === ex && c[1] === ey); c = prev.get(key(c[0], c[1]))) ext.unshift(c);
            course.push(...ext);
        }
        const toOcean = terrain[idx(mouth[0], mouth[1])] === T.OCEAN || terrain[idx(mouth[0], mouth[1])] === T.COAST;
        const tiles = [];
        for (let k = 0; k < course.length; k++) {
            const [x, y] = course[k];
            const to = k + 1 < course.length ? course[k + 1] : mouth;
            const nav = toOcean && rv.nav > 0 && course.length - k <= rv.nav;
            const i = idx(x, y);
            if (terrain[i] === T.MOUNTAIN) terrain[i] = T.HILL;
            riverTiles.set(key(x, y), { x, y, to, nav, river: rv.name });
            tiles.push([x, y]);
        }
        riverList.push({ name: rv.name, land: L.id, tiles, mouth, toOcean });
    }));
    // --- volcanoes (after the rivers, on a hex no river runs through) ---
    const volcanoes = [];
    LANDS.forEach((L, l) => (L.volcanoes || []).forEach((v) => {
        // the nearest hex of this land to the peak (a coastal volcano can fall just offshore)
        const p = nearestHex(...L.frame.toCanvas(v.lon, v.lat));
        let c = null;
        for (let r = 0; r <= 2 && !c && p; r++) {
            for (let y = p[1] - r; y <= p[1] + r && !c; y++) for (let x = p[0] - r; x <= p[0] + r && !c; x++) {
                if (inBounds(x, y) && hexDistance(p[0], p[1], x, y) === r && owner[idx(x, y)] === l && isLand(idx(x, y)) && !riverTiles.has(key(x, y))) c = [x, y];
            }
        }
        if (!c) { log("volcano " + v.name + " is not on land"); return; }
        terrain[idx(c[0], c[1])] = T.MOUNTAIN;
        volcanoes.push({ name: v.name, x: c[0], y: c[1] });
    }));


    // --- biomes and rainfall ---
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        if (!isLand(i)) continue;
        const n = noise(x / 5 + 101, y / 5 + 57);
        let b;
        if (owner[i] === 0) {
            if (!band[i]) b = B.TUNDRA;
            else {
                // the Peninsula and the shore are the mildest; the inner band is mostly tundra
                const mild = (lon[i] < -55 && lon[i] > -75 && lat[i] > -71) ? 0.2 : 0;
                const shore = band[i] <= 2 ? 0.15 : 0;
                const g = n + mild + shore;
                b = g > 0.78 ? B.GRASSLAND : g > 0.5 ? B.PLAINS : B.TUNDRA;
            }
        } else if (owner[i] === -2) {
            b = n < 0.6 ? B.TUNDRA : B.GRASSLAND;
        } else {
            b = LANDS[owner[i]].biome(lon[i], lat[i], n);
        }
        biome[i] = b;
        rain[i] = { [B.DESERT]: 20, [B.PLAINS]: 70, [B.GRASSLAND]: 110, [B.TROPICAL]: 160, [B.TUNDRA]: 60 }[b] || 80;
        if (owner[i] === 0 && !band[i]) rain[i] = 10;
    }

    // --- wonders ---
    const wonders = WONDERS.map((w) => {
        const L = LANDS.find((z) => z.id === w.land);
        if (!L) { log("wonder " + w.feature + ": no land " + w.land); return null; }
        const c = nearestHex(...L.frame.toCanvas(w.lon, w.lat));
        return c ? { feature: w.feature, x: c[0], y: c[1] } : null;
    }).filter(Boolean);

    // --- the Antarctic centre and the band's hexes, for start regions ---
    const centre = nearestHex(...ANTARCTICA.frame.toCanvas(0, -90));   // the South Pole
    const bandTiles = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (band[idx(x, y)]) bandTiles.push([x, y]);

    const count = (f) => { let c = 0; for (let i = 0; i < N; i++) if (f(i)) c++; return c; };
    log("land: antarctica " + count((i) => owner[i] === 0 && isLand(i)) + " (band " + bandTiles.length + "), " +
        LANDS.slice(1).map((L, k) => L.id + " " + count((i) => owner[i] === k + 1 && isLand(i))).join(", ") +
        ", islands " + count((i) => owner[i] === -2));

    return {
        W, H, idx, inBounds, toCanvas, nearestHex, halfH,
        terrain, biome, owner, region, lon, lat, plat, rain, band, coastDist, canvasX, canvasY,
        riverTiles, riverList, volcanoes, wonders, lakeTiles, centre, bandTiles, lands: LANDS, bandDepth: BAND_DEPTH,
        isLand: (x, y) => isLand(idx(x, y)),
    };
}
