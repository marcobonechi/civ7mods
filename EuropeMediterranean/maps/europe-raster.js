// europe-raster.js
// Turns the lon/lat geography in europe-geo.js into a hex grid.
// Pure JavaScript: no engine calls, so the same code runs in the game and in a browser preview.

export const T = { OCEAN: 0, COAST: 1, FLAT: 2, HILL: 3, MOUNTAIN: 4, RIVER: 5 };
export const B = { MARINE: "M", GRASSLAND: "G", PLAINS: "P", DESERT: "D", TUNDRA: "T", TROPICAL: "R" };

const DEG = Math.PI / 180;
const ROW_SPACING = 0.866; // physical distance between hex rows, in column units

export function makeProjection(GEO, W, H) {
    // Latitude mapping: optional piecewise-linear control points [lat, rowFraction] (ascending).
    const ctrl = GEO.latControl || [[GEO.latBottom, 0], [GEO.latTop, 1]];
    const fracToLat = (f) => {
        if (f <= ctrl[0][1]) return ctrl[0][0];
        for (let i = 1; i < ctrl.length; i++) {
            if (f <= ctrl[i][1]) {
                const t = (f - ctrl[i - 1][1]) / (ctrl[i][1] - ctrl[i - 1][1]);
                return ctrl[i - 1][0] + t * (ctrl[i][0] - ctrl[i - 1][0]);
            }
        }
        return ctrl[ctrl.length - 1][0];
    };
    const latToFrac = (lat) => {
        if (lat <= ctrl[0][0]) return ctrl[0][1] + (lat - ctrl[0][0]) * (ctrl[1][1] - ctrl[0][1]) / (ctrl[1][0] - ctrl[0][0]);
        for (let i = 1; i < ctrl.length; i++) {
            if (lat <= ctrl[i][0]) {
                const t = (lat - ctrl[i - 1][0]) / (ctrl[i][0] - ctrl[i - 1][0]);
                return ctrl[i - 1][1] + t * (ctrl[i][1] - ctrl[i - 1][1]);
            }
        }
        const n = ctrl.length - 1;
        return ctrl[n][1] + (lat - ctrl[n][0]) * (ctrl[n][1] - ctrl[n - 1][1]) / (ctrl[n][0] - ctrl[n - 1][0]);
    };
    const dLat = (GEO.latTop - GEO.latBottom) / (H - 1);   // average, kept for reference
    const cosRef = Math.cos(GEO.latRef * DEG);
    const latOf = (y) => fracToLat(y / (H - 1));
    const dLatAt = (y) => {
        const y0 = Math.max(0, y - 1), y1 = Math.min(H - 1, y + 1);
        return (latOf(y1) - latOf(y0)) / Math.max(1, y1 - y0);
    };
    const dLonAt = (lat) => (GEO.spanRef / W) * Math.pow(cosRef / Math.max(0.15, Math.cos(lat * DEG)), GEO.scaleExp);
    // Optional horizontal squeeze east of a longitude ("lonSqueeze"): each screen degree east of
    // `from` covers k geographic degrees, so the east takes fewer columns.
    const lq = GEO.lonSqueeze;
    // Western squeeze ("lonSqueezeWest"): west of `from`, each screen degree covers k geographic
    // degrees, but only south of latNone (full strength at latFull and below), so West Africa fits.
    // lonSqueezeWest.segments: [[fromLon, k], ...] westwards (first entry is the easternmost edge);
    // legacy form {from, k} is one segment. Strength blends from 1 at latNone to full at latFull.
    const lw = GEO.lonSqueezeWest;
    const lwSegs = !lw ? [] : (lw.segments || [[lw.from, lw.k]]);
    const lwFrom = lwSegs.length ? lwSegs[0][0] : -1e9;
    const wBlend = (tLat) => {
        if (!lw) return 0;
        if (tLat >= lw.latNone) return 0;
        if (tLat <= lw.latFull) return 1;
        return (lw.latNone - tLat) / (lw.latNone - lw.latFull);
    };
    const kSeg = (i, tLat) => 1 + (lwSegs[i][1] - 1) * wBlend(tLat);
    // screen -> geo: walk the segments westwards
    const geoFromScreenWest = (s, tLat) => {
        let sEdge = lwFrom, gEdge = lwFrom;
        for (let i = 0; i < lwSegs.length; i++) {
            const k = kSeg(i, tLat);
            const gNext = i + 1 < lwSegs.length ? lwSegs[i + 1][0] : -1e9;   // geo where the next segment starts
            const sNext = sEdge - (gEdge - gNext) / k;                         // its screen position
            if (s >= sNext) return gEdge - (sEdge - s) * k;
            sEdge = sNext; gEdge = gNext;
        }
        return gEdge - (sEdge - s);
    };
    const screenFromGeoWest = (g, tLat) => {
        let sEdge = lwFrom, gEdge = lwFrom;
        for (let i = 0; i < lwSegs.length; i++) {
            const k = kSeg(i, tLat);
            const gNext = i + 1 < lwSegs.length ? lwSegs[i + 1][0] : -1e9;
            if (g >= gNext) return sEdge - (gEdge - g) / k;
            sEdge = sEdge - (gEdge - gNext) / k; gEdge = gNext;
        }
        return sEdge - (gEdge - g);
    };
    const kWestAt = (g, tLat) => { for (let i = lwSegs.length - 1; i >= 0; i--) if (g < lwSegs[i][0]) return kSeg(i, tLat); return 1; };
    const geoFromScreen = (s, tLat) => {
        if (lq && s > lq.from) return lq.from + (s - lq.from) * lq.k;
        if (lwSegs.length && s < lwFrom) return geoFromScreenWest(s, tLat);
        return s;
    };
    const screenFromGeo = (g, tLat) => {
        if (lq && g > lq.from) return lq.from + (g - lq.from) / lq.k;
        if (lwSegs.length && g < lwFrom) return screenFromGeoWest(g, tLat);
        return g;
    };
    const lonScaleAt = (lon, tLat) => (lq && lon > lq.from) ? lq.k : kWestAt(lon, tLat);   // geographic degrees per screen degree
    const lonOf = (x, y) => geoFromScreen(GEO.lonCenter + (x + 0.5 * (y & 1) - (W - 1) / 2) * dLonAt(latOf(y)), latOf(y));

    // Optional longitude-dependent vertical remap south of a pivot latitude ("southWarp").
    // westMap is a list of [geoLat, tileLat] control points used in the west (lon <= lonWestEnd);
    // it blends to the identity mapping at lon >= lonEastStart. Must end at [latPivot, latPivot].
    const sw = GEO.southWarp;
    // zones: each has a longitude window (ramp in from lonStart to lonFullStart, full weight until
    // lonFullEnd, ramp out to lonEnd) and its own [geoLat, tileLat] map. Legacy form: westMap only.
    const zones = !sw ? [] : (sw.zones || [{ lonStart: -1000, lonFullStart: -999, lonFullEnd: sw.lonWestEnd, lonEnd: sw.lonEastStart, map: sw.westMap }]);
    const zoneWeight = (z, lon) => {
        if (lon <= z.lonStart || lon >= z.lonEnd) return 0;
        if (lon < z.lonFullStart) return (lon - z.lonStart) / (z.lonFullStart - z.lonStart);
        if (lon <= z.lonFullEnd) return 1;
        return 1 - (lon - z.lonFullEnd) / (z.lonEnd - z.lonFullEnd);
    };
    const kAt = (lon) => {            // total remap weight at this longitude (0 = plain projection)
        let s = 0;
        for (const z of zones) s += zoneWeight(z, lon);
        return Math.min(1, s);
    };
    const piecewise = (pts, v, i0, i1) => {   // interpolate column i1 from column i0
        if (v <= pts[0][i0]) return pts[0][i1] + (v - pts[0][i0]) * (pts[1][i1] - pts[0][i1]) / (pts[1][i0] - pts[0][i0]);
        for (let i = 1; i < pts.length; i++) {
            if (v <= pts[i][i0]) {
                const t = (v - pts[i - 1][i0]) / (pts[i][i0] - pts[i - 1][i0]);
                return pts[i - 1][i1] + t * (pts[i][i1] - pts[i - 1][i1]);
            }
        }
        return pts[pts.length - 1][i1];
    };
    // geographic latitude -> tile latitude at this longitude
    const geoToTileLat = (lon, geoLat) => {
        if (!sw || geoLat >= sw.latPivot) return geoLat;
        let acc = 0, wsum = 0;
        for (const z of zones) {
            const w = zoneWeight(z, lon);
            if (w > 0) { acc += w * piecewise(z.map, geoLat, 0, 1); wsum += w; }
        }
        if (wsum <= 0) return geoLat;
        if (wsum > 1) { acc /= wsum; wsum = 1; }
        return geoLat * (1 - wsum) + acc;
    };
    // tile latitude (row) -> geographic latitude at this longitude (numeric inverse, monotonic)
    const tileToGeoLat = (lon, tileLat) => {
        if (!sw || tileLat >= sw.latPivot) return tileLat;
        if (kAt(lon) <= 0) return tileLat;
        let lo = -40, hi = sw.latPivot;
        for (let i = 0; i < 40; i++) {
            const mid = (lo + hi) / 2;
            if (geoToTileLat(lon, mid) < tileLat) lo = mid; else hi = mid;
        }
        return (lo + hi) / 2;
    };
    const geoLatAt = (x, y) => tileToGeoLat(lonOf(x, y), latOf(y));

    // Continuous tile coordinates (xf includes the odd-row half shift). Input is geographic lon/lat.
    const toTile = (lon, lat) => {
        const tLat = geoToTileLat(lon, lat);
        const yf = latToFrac(tLat) * (H - 1);
        const xf = (screenFromGeo(lon, tLat) - GEO.lonCenter) / dLonAt(tLat) + (W - 1) / 2;
        return [xf, yf];
    };
    const nearestTile = (lon, lat) => {
        const [xf, yf] = toTile(lon, lat);
        const y = Math.round(yf);
        const x = Math.round(xf - 0.5 * (y & 1));
        return [x, y];
    };
    return { W, H, dLat, dLatAt, latOf, lonOf, dLonAt, toTile, nearestTile, kAt, geoLatAt, tileToGeoLat, lonScaleAt };
}

// ---- geometry helpers ------------------------------------------------------

function bbox(pts) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
    }
    return [minX, minY, maxX, maxY];
}

function pointInPolygon(lon, lat, poly) {
    const bb = poly.bb;
    if (lon < bb[0] || lon > bb[2] || lat < bb[1] || lat > bb[3]) return false;
    const pts = poly.pts;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if ((yi > lat) !== (yj > lat)) {
            const xInt = xi + (lat - yi) * (xj - xi) / (yj - yi);
            if (lon < xInt) inside = !inside;
        }
    }
    return inside;
}

function prepPolys(list) {
    return (list || []).map((p) => ({ name: p.name, pts: p.pts, bb: bbox(p.pts), biome: p.biome, rain: p.rain, prob: p.prob, coastDist: p.coastDist }));
}

function inAny(lon, lat, polys) {
    for (const p of polys) if (pointInPolygon(lon, lat, p)) return true;
    return false;
}

// distance from point to segment, in tile units (rows scaled by ROW_SPACING)
function segDist(px, py, ax, ay, bx, by) {
    const sy = ROW_SPACING;
    const vx = bx - ax, vy = (by - ay) * sy;
    const wx = px - ax, wy = (py - ay) * sy;
    const len2 = vx * vx + vy * vy;
    let t = len2 > 0 ? (wx * vx + wy * vy) / len2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const dx = wx - t * vx, dy = wy - t * vy;
    return Math.sqrt(dx * dx + dy * dy);
}

export function hexNeighbors(x, y) {
    if (y & 1) {
        return [[x + 1, y], [x - 1, y], [x + 1, y + 1], [x, y + 1], [x + 1, y - 1], [x, y - 1]];
    }
    return [[x + 1, y], [x - 1, y], [x, y + 1], [x - 1, y + 1], [x, y - 1], [x - 1, y - 1]];
}

export function hexDistance(x1, y1, x2, y2) {
    const q1 = x1 - (y1 - (y1 & 1)) / 2, r1 = y1;
    const q2 = x2 - (y2 - (y2 & 1)) / 2, r2 = y2;
    const dq = q1 - q2, dr = r1 - r2, ds = (-q1 - r1) - (-q2 - r2);
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

// ---- main ------------------------------------------------------------------

export function buildEuropeGrid(W, H, GEO, rnd) {
    const P = makeProjection(GEO, W, H);
    const N = W * H;
    const rangeScale = GEO.rangeScale || 1;
    const blobScale = GEO.blobScale || 1;
    const idx = (x, y) => y * W + x;
    const inBounds = (x, y) => x >= 0 && x < W && y >= 0 && y < H;

    const landPolys = prepPolys(GEO.land);
    const waterPolys = prepPolys(GEO.water);
    const shallowPolys = prepPolys(GEO.shallow);
    const biomePolys = prepPolys(GEO.biomeAreas);
    const rainPolys = prepPolys(GEO.rainAreas);

    const isLand = new Uint8Array(N);
    const isLake = new Uint8Array(N);   // water painted as a lake: always shallow
    const terrain = new Uint8Array(N);
    const biome = new Array(N);
    const rain = new Uint16Array(N);
    const region = new Array(N);   // "W" or "E"
    const lonC = new Float32Array(N);
    const latC = new Float32Array(N);

    // sample offsets around a hex center, in tile units
    const SAMPLE_R = 0.42;
    const samples = [];
    for (let k = 0; k < 6; k++) {
        const a = (k * 60 + 30) * DEG;
        samples.push([SAMPLE_R * Math.cos(a), SAMPLE_R * Math.sin(a) / ROW_SPACING]);
    }

    // 1. land vs water from polygons
    for (let y = 0; y < H; y++) {
        const tileLat = P.latOf(y);
        const dLonTile = P.dLonAt(tileLat);
        const dLatTile = P.dLatAt(y);
        for (let x = 0; x < W; x++) {
            const lon = P.lonOf(x, y);
            const i = idx(x, y);
            const lat = P.tileToGeoLat(lon, tileLat);       // geographic latitude of this hex
            // geographic degrees per row / per column at this hex (local slopes of the remaps)
            const dLatRow = P.tileToGeoLat(lon, tileLat + dLatTile * 0.5) - P.tileToGeoLat(lon, tileLat - dLatTile * 0.5);
            const dLon = dLonTile * P.lonScaleAt(lon, tileLat);
            lonC[i] = lon;
            latC[i] = lat;
            let land = inAny(lon, lat, landPolys);
            if (!land) {
                let count = 0;
                for (const s of samples) {
                    if (inAny(lon + s[0] * dLon, lat + s[1] * dLatRow, landPolys)) count++;
                }
                if (count >= 2) land = true;
            }
            if (land) {
                let water = inAny(lon, lat, waterPolys);
                if (!water) {
                    let count = 0;
                    for (const s of samples) {
                        if (inAny(lon + s[0] * dLon, lat + s[1] * dLatRow, waterPolys)) count++;
                    }
                    if (count >= 4) water = true;
                }
                if (water) land = false;
            }
            isLand[i] = land ? 1 : 0;
        }
    }

    // 2. small islands
    const paintBlob = (lon, lat, r, value) => {
        const [xf, yf] = P.toTile(lon, lat);
        let painted = 0;
        const [nx, ny] = P.nearestTile(lon, lat);
        const R = Math.ceil(r) + 1;
        for (let y = ny - R; y <= ny + R; y++) {
            for (let x = nx - R; x <= nx + R; x++) {
                if (!inBounds(x, y)) continue;
                const dx = (x + 0.5 * (y & 1)) - xf;
                const dy = (y - yf) * ROW_SPACING;
                if (Math.sqrt(dx * dx + dy * dy) < r) {
                    isLand[idx(x, y)] = value;
                    if (value === 0) isLake[idx(x, y)] = 1;
                    painted++;
                }
            }
        }
        if (painted === 0 && inBounds(nx, ny)) {
            isLand[idx(nx, ny)] = value;
            if (value === 0) isLake[idx(nx, ny)] = 1;
        }
    };
    for (const b of GEO.landBlobs || []) paintBlob(b[0], b[1], b[2] * blobScale, 1);

    // 3. straits: one-tile-wide water lines, kept hex-connected
    const markWater = (x, y) => { if (inBounds(x, y)) isLand[idx(x, y)] = 0; };
    for (const line of GEO.waterLines || []) {
        let prev = null;
        for (let s = 0; s < line.pts.length - 1; s++) {
            const a = line.pts[s], b = line.pts[s + 1];
            const [ax, ay] = P.toTile(a[0], a[1]);
            const [bx, by] = P.toTile(b[0], b[1]);
            const steps = Math.max(1, Math.ceil(Math.sqrt((bx - ax) ** 2 + ((by - ay) * ROW_SPACING) ** 2) * 4));
            for (let k = 0; k <= steps; k++) {
                const t = k / steps;
                const lon = a[0] + (b[0] - a[0]) * t;
                const lat = a[1] + (b[1] - a[1]) * t;
                const [x, y] = P.nearestTile(lon, lat);
                if (prev && (prev[0] !== x || prev[1] !== y) && hexDistance(prev[0], prev[1], x, y) > 1) {
                    // bridge the gap with a shared neighbour
                    for (const n of hexNeighbors(prev[0], prev[1])) {
                        if (hexDistance(n[0], n[1], x, y) <= 1) { markWater(n[0], n[1]); break; }
                    }
                }
                markWater(x, y);
                prev = [x, y];
            }
        }
    }

    // 4. lakes
    for (const l of GEO.lakes || []) paintBlob(l[0], l[1], l[2] * blobScale, 0);

    // 4b. islands that sit between straits (painted after the lines)
    for (const b of GEO.landBlobsLate || []) paintBlob(b[0], b[1], b[2] * blobScale, 1);

    // 5. map edge: keep the left/right columns water
    for (let y = 0; y < H; y++) { isLand[idx(0, y)] = 0; isLand[idx(W - 1, y)] = 0; }

    // 5b. optional sea lane along the bottom edge (from the left border up to a longitude)
    if (GEO.bottomWater) {
        for (let y = 0; y < GEO.bottomWater.rows; y++) {
            for (let x = 0; x < W; x++) {
                if (P.lonOf(x, y) <= GEO.bottomWater.untilLon) { isLand[idx(x, y)] = 0; isLake[idx(x, y)] = 1; }
            }
        }
    }
    // 5c. optional sea lane along the left edge, for rows below a tile latitude
    if (GEO.leftWater) {
        for (let y = 0; y < H; y++) {
            if (P.latOf(y) >= GEO.leftWater.belowLat) continue;
            for (let x = 0; x < GEO.leftWater.cols; x++) { isLand[idx(x, y)] = 0; isLake[idx(x, y)] = 1; }
        }
    }

    // 6. distance to land (hex steps) for coast/ocean
    const distLand = new Int16Array(N).fill(-1);
    let frontier = [];
    for (let i = 0; i < N; i++) if (isLand[i]) { distLand[i] = 0; frontier.push(i); }
    let d = 0;
    while (frontier.length && d < 4) {
        d++;
        const next = [];
        for (const i of frontier) {
            const x = i % W, y = (i - x) / W;
            for (const n of hexNeighbors(x, y)) {
                if (!inBounds(n[0], n[1])) continue;
                const j = idx(n[0], n[1]);
                if (distLand[j] < 0) { distLand[j] = d; next.push(j); }
            }
        }
        frontier = next;
    }

    for (let i = 0; i < N; i++) {
        if (isLand[i]) { terrain[i] = T.FLAT; continue; }
        const x = i % W;
        // shallow polygons: all water is coast, unless the polygon sets coastDist (hexes from land)
        let coastDist = 1;
        if (isLake[i] === 1) coastDist = 999;
        else for (const p of shallowPolys) if (pointInPolygon(lonC[i], latC[i], p)) { coastDist = Math.max(coastDist, p.coastDist === undefined ? 999 : p.coastDist); }
        let isCoast;
        const d = distLand[i];
        if (coastDist >= 999) isCoast = true;
        else if (coastDist <= 1) isCoast = d > 0 && d <= 1;                 // open sea: coast hugs the land
        else if (d <= coastDist - 1) isCoast = true;                        // inland-ish seas: ragged edge
        else if (d === coastDist) isCoast = rnd() < 0.7;
        else if (d === coastDist + 1) isCoast = rnd() < 0.3;
        else isCoast = false;
        terrain[i] = (x === 0 || x === W - 1) ? T.OCEAN : (isCoast ? T.COAST : T.OCEAN);
    }

    // 6b. shallow lines: ocean within `radius` tiles of these corridors becomes coast (island hops)
    for (const line of GEO.shallowLines || []) {
        const r = line.radius || 1.0;
        for (let s = 0; s < line.pts.length - 1; s++) {
            const a = line.pts[s], b = line.pts[s + 1];
            const [ax, ay] = P.toTile(a[0], a[1]);
            const [bx, by] = P.toTile(b[0], b[1]);
            const steps = Math.max(1, Math.ceil(Math.sqrt((bx - ax) ** 2 + ((by - ay) * ROW_SPACING) ** 2) * 2));
            for (let k = 0; k <= steps; k++) {
                const t = k / steps;
                const [xf, yf] = P.toTile(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
                const R = Math.ceil(r) + 1;
                for (let y = Math.round(yf) - R; y <= Math.round(yf) + R; y++) {
                    for (let x = Math.round(xf) - R; x <= Math.round(xf) + R; x++) {
                        if (!inBounds(x, y) || x === 0 || x === W - 1) continue;
                        const dx = (x + 0.5 * (y & 1)) - xf, dy = (y - yf) * ROW_SPACING;
                        if (Math.sqrt(dx * dx + dy * dy) < r && terrain[idx(x, y)] === T.OCEAN) terrain[idx(x, y)] = T.COAST;
                    }
                }
            }
        }
    }

    // 7. mountains and hills
    const ranges = (GEO.ranges || []).map((r) => ({
        core: r.core * rangeScale, fringe: r.fringe * rangeScale,
        pts: r.pts.map((p) => P.toTile(p[0], p[1]))
    }));
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = idx(x, y);
            if (!isLand[i]) continue;
            const px = x + 0.5 * (y & 1), py = y;
            let best = null;
            for (const r of ranges) {
                let dmin = Infinity;
                const pts = r.pts;
                if (pts.length === 1) {
                    dmin = segDist(px, py, pts[0][0], pts[0][1], pts[0][0], pts[0][1]);
                } else {
                    for (let s = 0; s < pts.length - 1; s++) {
                        const dd = segDist(px, py, pts[s][0], pts[s][1], pts[s + 1][0], pts[s + 1][1]);
                        if (dd < dmin) dmin = dd;
                    }
                }
                if (dmin < r.fringe) {
                    const score = dmin < r.core ? -1 : (dmin - r.core) / Math.max(0.01, r.fringe - r.core);
                    if (!best || score < best.score) best = { score, d: dmin, core: r.core, fringe: r.fringe };
                }
            }
            let t = T.FLAT;
            if (best) {
                if (best.d < best.core) {
                    t = rnd() < 0.85 ? T.MOUNTAIN : T.HILL;
                } else {
                    const p = 0.15 + 0.65 * (1 - best.score);
                    t = rnd() < p ? T.HILL : T.FLAT;
                }
            } else if (rnd() < (GEO.baseHillProb !== undefined ? GEO.baseHillProb : 0.07)) {
                t = T.HILL;   // random sprinkle of hills away from the ranges
            }
            terrain[i] = t;
        }
    }

    // 7b. flatten areas: turn hills into flat land with a probability (mountains untouched)
    const flatPolys = prepPolys((GEO.flatAreas || []).map((a) => ({ name: a.name, pts: a.pts, prob: a.prob })));
    if (flatPolys.length) {
        for (let i = 0; i < N; i++) {
            if (terrain[i] !== T.HILL) continue;
            for (const p of flatPolys) {
                if (pointInPolygon(lonC[i], latC[i], p) && rnd() < (p.prob === undefined ? 1 : p.prob)) { terrain[i] = T.FLAT; break; }
            }
        }
    }

    // 7b2. rough areas: flat land -> hills with a probability; an optional `biome` is applied to those hexes
    const roughPolys = prepPolys((GEO.roughAreas || []).map((a) => ({ name: a.name, pts: a.pts, prob: a.prob, biome: a.biome })));
    const forcedBiome = new Array(N);
    if (roughPolys.length) {
        for (let i = 0; i < N; i++) {
            if (terrain[i] !== T.FLAT) continue;
            for (const p of roughPolys) {
                if (pointInPolygon(lonC[i], latC[i], p) && rnd() < (p.prob === undefined ? 1 : p.prob)) {
                    terrain[i] = T.HILL;
                    if (p.biome) forcedBiome[i] = p.biome;
                    break;
                }
            }
        }
    }

    // 7c. mountains -> hills inside areas (with a probability) and along passes (polyline + radius)
    const hillPolys = prepPolys((GEO.hillAreas || []).map((a) => ({ name: a.name, pts: a.pts, prob: a.prob })));
    if (hillPolys.length) {
        for (let i = 0; i < N; i++) {
            if (terrain[i] !== T.MOUNTAIN) continue;
            for (const p of hillPolys) {
                if (pointInPolygon(lonC[i], latC[i], p) && rnd() < (p.prob === undefined ? 1 : p.prob)) { terrain[i] = T.HILL; break; }
            }
        }
    }
    for (const pass of GEO.passes || []) {
        const pts = pass.pts.map((p) => P.toTile(p[0], p[1]));
        const r = (pass.radius || 0.6) * rangeScale;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = idx(x, y);
                if (terrain[i] !== T.MOUNTAIN) continue;
                const px = x + 0.5 * (y & 1), py = y;
                let dmin = Infinity;
                for (let s = 0; s < Math.max(1, pts.length - 1); s++) {
                    const a = pts[s], b = pts[Math.min(s + 1, pts.length - 1)];
                    const dd = segDist(px, py, a[0], a[1], b[0], b[1]);
                    if (dd < dmin) dmin = dd;
                }
                if (dmin < r) terrain[i] = T.HILL;
            }
        }
    }

    // 7b. landmass regions (Distant Lands).
    // The engine reads a region change as a distant-lands boundary: land units cannot cross it
    // and civilizations across it cannot be contacted until the Exploration Age. A boundary that
    // runs through connected land is therefore an invisible wall, so regions are assigned to whole
    // water-separated landmasses rather than by longitude. Landmasses containing one of
    // GEO.distantLandsAnchors become "E" (distant lands); everything else is "W" (home lands).
    // With no anchors the whole map is one region and every civilization is reachable overland.
    assignLandmassRegions(W, H, idx, isLand, region, P, GEO.distantLandsAnchors);

    // 8. biomes and rainfall
    for (let i = 0; i < N; i++) {
        const lat = latC[i], lon = lonC[i];
        if (!isLand[i]) { biome[i] = B.MARINE; rain[i] = 100; continue; }
        let b;
        if (lat >= 63) b = B.TUNDRA;
        else if (lat >= 59) b = rnd() < ((lat - 59) / 4) * 0.8 ? B.TUNDRA : B.GRASSLAND;
        else if (lat >= 46) b = B.GRASSLAND;
        else if (lat >= 44) b = rnd() < (46 - lat) / 2 ? B.PLAINS : B.GRASSLAND;
        else if (lat >= 33) b = B.PLAINS;
        else b = B.DESERT;
        for (const p of biomePolys) {
            if (!pointInPolygon(lon, lat, p)) continue;
            if (p.prob === undefined || rnd() < p.prob) b = p.biome;
        }
        if (forcedBiome[i]) b = forcedBiome[i];
        biome[i] = b;

        let r;
        if (lat < 33) r = 15;
        else if (lat < 38) r = 60;
        else if (lat < 44) r = 80;
        else if (lat < 50) r = 110;
        else if (lat < 60) r = 120;
        else r = 100;
        for (const p of rainPolys) if (pointInPolygon(lon, lat, p)) r = p.rain;
        if (b === B.DESERT && r > 30) r = 20;
        rain[i] = r;
    }

    // 8a. circular biome patches (oases, valleys): [lon, lat, radius in tiles, biome, rainfall]
    for (const b of GEO.biomeBlobs || []) {
        const [xf, yf] = P.toTile(b[0], b[1]);
        const r = b[2] * blobScale;
        const [nx, ny] = P.nearestTile(b[0], b[1]);
        const R = Math.ceil(r) + 1;
        for (let y = ny - R; y <= ny + R; y++) {
            for (let x = nx - R; x <= nx + R; x++) {
                if (!inBounds(x, y)) continue;
                const dx = (x + 0.5 * (y & 1)) - xf, dy = (y - yf) * ROW_SPACING;
                const inside = Math.sqrt(dx * dx + dy * dy) < r || (x === nx && y === ny);
                if (!inside || !isLand[idx(x, y)]) continue;
                biome[idx(x, y)] = b[3];
                if (b[4] !== undefined) rain[idx(x, y)] = b[4];
            }
        }
    }

    // 8b. hand-placed navigable rivers: a hex-connected chain of river terrain over land
    const riverTiles = [];
    const riverChains = [];   // per river: { name, tiles } in course order (the game steers the engine's rivers along them)
    for (const river of GEO.rivers || []) {
        let prev = null;
        // `strength` (0..1, default 1) scales the rainfall the map script pours along this
        // course. Lower it to make a river less likely to win the engine's navigable-river pass.
        const chain = { name: river.name, strength: river.strength, tiles: [] };
        riverChains.push(chain);
        const markRiver = (x, y) => {
            if (!inBounds(x, y) || x < 1 || x >= W - 1) return;
            const i = idx(x, y);
            if (isLand[i] && terrain[i] !== T.RIVER) { terrain[i] = T.RIVER; riverTiles.push([x, y]); chain.tiles.push([x, y]); }
        };
        for (let s = 0; s < river.pts.length - 1; s++) {
            const a = river.pts[s], b = river.pts[s + 1];
            const [ax, ay] = P.toTile(a[0], a[1]);
            const [bx, by] = P.toTile(b[0], b[1]);
            const steps = Math.max(1, Math.ceil(Math.sqrt((bx - ax) ** 2 + ((by - ay) * ROW_SPACING) ** 2) * 4));
            for (let k = 0; k <= steps; k++) {
                const t = k / steps;
                const [x, y] = P.nearestTile(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
                if (prev && (prev[0] !== x || prev[1] !== y) && hexDistance(prev[0], prev[1], x, y) > 1) {
                    for (const n of hexNeighbors(prev[0], prev[1])) {
                        if (hexDistance(n[0], n[1], x, y) <= 1) { markRiver(n[0], n[1]); break; }
                    }
                }
                markRiver(x, y);
                prev = [x, y];
            }
        }
    }

    // 9. volcanoes and start sites
    const findLandTile = (lon, lat, maxR, allowMountain) => {
        const [nx, ny] = P.nearestTile(lon, lat);
        let best = null, bestD = Infinity;
        for (let y = ny - maxR; y <= ny + maxR; y++) {
            for (let x = nx - maxR; x <= nx + maxR; x++) {
                if (!inBounds(x, y) || x < 2 || x > W - 3 || y < 1 || y > H - 2) continue;
                const i = idx(x, y);
                if (!isLand[i]) continue;
                if (terrain[i] === T.RIVER) continue;
                if (!allowMountain && terrain[i] === T.MOUNTAIN) continue;
                const dd = hexDistance(nx, ny, x, y);
                if (dd <= maxR && dd < bestD) { bestD = dd; best = [x, y]; }
            }
        }
        return best;
    };

    const volcanoes = [];
    for (const v of GEO.volcanoes || []) {
        const t = findLandTile(v[0], v[1], 2, true);
        if (t) { terrain[idx(t[0], t[1])] = T.MOUNTAIN; volcanoes.push({ x: t[0], y: t[1], name: v[2] }); }
    }

    const grid = {
        W, H, P, terrain, biome, rain, region, isLand, lonC, latC, volcanoes, riverTiles, riverChains,
        idx, inBounds, findLandTile,
        // prepare a start tile: flat, with no mountain wall around it
        prepareStartTile(x, y) {
            terrain[idx(x, y)] = T.FLAT;
            for (const n of hexNeighbors(x, y)) {
                if (!inBounds(n[0], n[1])) continue;
                const j = idx(n[0], n[1]);
                if (terrain[j] === T.MOUNTAIN) terrain[j] = T.HILL;
            }
        }
    };
    return grid;
}

// Flood-fills water-separated land components and gives each one a single region letter, so a
// region boundary can never fall between two adjacent land tiles. Water takes the region of the
// nearest land, matching how the base game marks coast as part of its continent.
function assignLandmassRegions(W, H, idx, isLand, region, P, anchors) {
    const N = W * H;
    const comp = new Int32Array(N).fill(-1);
    const members = [];
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = idx(x, y);
            if (!isLand[i] || comp[i] >= 0) continue;
            const id = members.length;
            const tiles = [];
            const stack = [[x, y]];
            comp[i] = id;
            while (stack.length) {
                const [cx, cy] = stack.pop();
                tiles.push(idx(cx, cy));
                for (const [nx, ny] of hexNeighbors(cx, cy)) {
                    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                    const j = idx(nx, ny);
                    if (isLand[j] && comp[j] < 0) { comp[j] = id; stack.push([nx, ny]); }
                }
            }
            members.push(tiles);
        }
    }

    const distant = new Set();
    for (const [lon, lat] of anchors || []) {
        const [ax, ay] = P.nearestTile(lon, lat);
        // The anchor may land a hex or two off the coast; search outwards for the landmass.
        let found = -1;
        for (let r = 0; r <= 4 && found < 0; r++) {
            for (let dy = -r; dy <= r && found < 0; dy++) {
                for (let dx = -r; dx <= r && found < 0; dx++) {
                    const x = ax + dx, y = ay + dy;
                    if (x < 0 || y < 0 || x >= W || y >= H) continue;
                    const i = idx(x, y);
                    if (isLand[i]) found = comp[i];
                }
            }
        }
        if (found >= 0) distant.add(found);
        else console.log("Europe map: distant-lands anchor [" + lon + ", " + lat + "] found no land");
    }

    for (let i = 0; i < N; i++) region[i] = "W";
    for (const id of distant) for (const i of members[id]) region[i] = "E";

    // Water inherits the region of the nearest land, by breadth-first expansion from the coast.
    const queue = [];
    const seen = new Uint8Array(N);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = idx(x, y);
            if (isLand[i]) { seen[i] = 1; queue.push([x, y]); }
        }
    }
    for (let head = 0; head < queue.length; head++) {
        const [cx, cy] = queue[head];
        const ci = idx(cx, cy);
        for (const [nx, ny] of hexNeighbors(cx, cy)) {
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const j = idx(nx, ny);
            if (seen[j]) continue;
            seen[j] = 1;
            region[j] = region[ci];
            queue.push([nx, ny]);
        }
    }
}
