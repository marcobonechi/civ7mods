// app.js - the Antarctica map editor.
//
// Draws the map with the mod's own rasterizer (/maps/antarctica-raster.js, served read-only from
// Antarctica/maps), so what you see is the grid the game builds for that size and seed. The
// geography (/maps/antarctica-geo.js) is plain data: the editor changes a copy of it and saves it
// back through geo-format.js, which always writes the same layout.
//
// Every shape is stored in its own land's [lon, lat] and drawn through that land's frame, so a
// dragged point is converted back with the frame of the land it belongs to.

import { buildAntarcticaGrid, makeFrame, SIZES, T, B, hexNeighbors, hexDistance } from '/maps/antarctica-raster.js';
import { formatGeo } from './geo-format.js';

const SQ3 = Math.sqrt(3) / 2;
const HEX_R = 1 / Math.sqrt(3);          // centre to corner, in hex-width units
const OFF = 10;                           // offscreen pixels per hex unit
const MAX_PLAYERS = { MAPSIZE_ANTARCTICA_STD: 10, MAPSIZE_ANTARCTICA_LRG: 12, MAPSIZE_ANTARCTICA_HUGE: 14 };
const EDGE = { "south-america": "top", africa: "top", australia: "bottom", "new-zealand": "bottom" };
const BIOME_COL = { [B.GRASSLAND]: "#6fae4a", [B.PLAINS]: "#b5b35a", [B.DESERT]: "#e3cf8e", [B.TUNDRA]: "#8e9f86", [B.TROPICAL]: "#2f7d3a" };
const T_NAME = ["ocean", "coast", "flat", "hills", "mountain", "lake"];
const B_NAME = ["marine", "grassland", "plains", "desert", "tundra", "tropical"];
const LAND_COL = ["#ffffff", "#ffb070", "#ffe070", "#ff8080", "#90e0ff", "#c0a0ff"];

const $ = (id) => document.getElementById(id);
const cv = $("map"), ctx = cv.getContext("2d");
const off = document.createElement("canvas"), octx = off.getContext("2d");

const state = {
    geo: null, savedText: "", size: "MAPSIZE_ANTARCTICA_STD", seed: 7,
    grid: null, frames: [], logs: [],
    sel: null, hoverVertex: null,
    zoom: 8, panX: 0, panY: 0,
    history: [], hi: -1,
    show: { shapes: true, rivers: true, band: true, hexes: true },
};

// ---- geometry ----------------------------------------------------------------------------

const hyMax = () => (state.grid.H - 1) * SQ3;
const cx0 = () => (state.grid.W - 0.5) / 2;
// canvas (X, Y) <-> hex units (hx right, hy up)
const canvasToHex = (X, Y) => [X * state.grid.halfH + cx0(), Y * state.grid.halfH + state.grid.halfH];
const hexToCanvas = (hx, hy) => [(hx - cx0()) / state.grid.halfH, (hy - state.grid.halfH) / state.grid.halfH];
const hexToScreen = (hx, hy) => [state.panX + hx * state.zoom, state.panY + (hyMax() - hy) * state.zoom];
const screenToHex = (sx, sy) => [(sx - state.panX) / state.zoom, hyMax() - (sy - state.panY) / state.zoom];
const canvasToScreen = (X, Y) => hexToScreen(...canvasToHex(X, Y));
const screenToCanvas = (sx, sy) => hexToCanvas(...screenToHex(sx, sy));
const tileCentre = (x, y) => [x + 0.5 * (y & 1), y * SQ3];

function tileAt(sx, sy) {
    const [hx, hy] = screenToHex(sx, sy);
    const [X, Y] = hexToCanvas(hx, hy);
    return state.grid.nearestHex(X, Y);
}

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

// ---- selection references ------------------------------------------------------------------
// { t: "land" | "poly" | "range" | "river" | "lake" | "volcano", l, i } | { t: "island" | "wonder", i } | { t: "settings" }

const LIST = { poly: "polys", range: "ranges", river: "rivers", lake: "lakes", volcano: "volcanoes" };
const landIndexOf = (ref) => ref.t === "island" ? 0 : ref.t === "wonder" ? state.geo.lands.findIndex((L) => L.id === state.geo.wonders[ref.i].land) : ref.l;
const frameOf = (ref) => state.frames[landIndexOf(ref)];
function itemOf(ref) {
    if (ref.t === "island") return state.geo.islands[ref.i];
    if (ref.t === "wonder") return state.geo.wonders[ref.i];
    if (ref.t === "land") return state.geo.lands[ref.l];
    if (LIST[ref.t]) return state.geo.lands[ref.l][LIST[ref.t]][ref.i];
    return null;
}
const isLine = (ref) => ref && (ref.t === "poly" || ref.t === "range" || ref.t === "river");
const isPoint = (ref) => ref && (ref.t === "lake" || ref.t === "volcano" || ref.t === "island" || ref.t === "wonder");
const sameRef = (a, b) => a && b && a.t === b.t && a.l === b.l && a.i === b.i;

function allRefs() {
    const out = [];
    state.geo.lands.forEach((L, l) => {
        for (const t of ["poly", "range", "river", "lake", "volcano"]) (L[LIST[t]] || []).forEach((_, i) => out.push({ t, l, i }));
    });
    (state.geo.islands || []).forEach((_, i) => out.push({ t: "island", i }));
    (state.geo.wonders || []).forEach((_, i) => out.push({ t: "wonder", i }));
    return out;
}

// ---- history ---------------------------------------------------------------------------------

function pushHistory() {
    const snap = JSON.stringify(state.geo);
    if (state.hi >= 0 && state.history[state.hi] === snap) return;
    state.history = state.history.slice(0, state.hi + 1);
    state.history.push(snap);
    if (state.history.length > 200) state.history.shift();
    state.hi = state.history.length - 1;
    updateDirty();
}
function restore(k) {
    if (k < 0 || k >= state.history.length) return;
    state.hi = k;
    state.geo = JSON.parse(state.history[k]);
    if (state.sel && state.sel.t !== "settings" && !itemOf(state.sel)) state.sel = null;
    buildNow(); renderTree(); renderProps(); updateDirty();
}
function updateDirty() {
    const dirty = formatGeo(state.geo) !== state.savedText;
    $("dirty").textContent = dirty ? "unsaved changes" : "";
    return dirty;
}

// ---- building and drawing --------------------------------------------------------------------

function seededRnd(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Build the grid now (the rasterizer takes about 20 ms), or once per frame while dragging.
function buildNow() {
    const [W, H] = SIZES[state.size];
    state.logs = [];
    try {
        state.frames = state.geo.lands.map((L) => makeFrame(L.frame));
        state.grid = buildAntarcticaGrid(W, H, state.geo, seededRnd(state.seed), (m) => state.logs.push(m));
    } catch (e) {
        logLine("rasterizer error: " + e.message, "bad");
        return;
    }
    drawOffscreen();
    render();
    renderStats();
}
let rebuildQueued = false;
function rebuild() {
    if (rebuildQueued) return;
    rebuildQueued = true;
    requestAnimationFrame(() => { rebuildQueued = false; buildNow(); });
}

function drawOffscreen() {
    const g = state.grid;
    off.width = Math.ceil((g.W + 1) * OFF);
    off.height = Math.ceil((hyMax() + 2 * HEX_R) * OFF);
    octx.fillStyle = "#123";
    octx.fillRect(0, 0, off.width, off.height);
    const ox = (hx) => (hx + 0.5) * OFF, oy = (hy) => (hyMax() - hy + HEX_R) * OFF;
    const corners = [...Array(6)].map((_, k) => [HEX_R * Math.cos(Math.PI / 180 * (60 * k - 30)), HEX_R * Math.sin(Math.PI / 180 * (60 * k - 30))]);
    for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) {
        const i = g.idx(x, y), t = g.terrain[i];
        let fill;
        if (t === T.OCEAN) fill = "#1d3f6e";
        else if (t === T.COAST) fill = "#3c6fa6";
        else if (t === T.LAKE) fill = "#58a6d6";
        else {
            const icy = g.owner[i] === 0 && !g.band[i];
            fill = icy ? "#e9eef3" : BIOME_COL[g.biome[i]];
            if (t === T.HILL) fill = shade(fill, icy ? 0.86 : 0.75);
            if (t === T.MOUNTAIN) fill = icy ? "#8a8f99" : "#6b5440";
        }
        const [hx, hy] = tileCentre(x, y);
        octx.beginPath();
        corners.forEach(([a, b], k) => { const px = ox(hx) + a * OFF, py = oy(hy) + b * OFF; k ? octx.lineTo(px, py) : octx.moveTo(px, py); });
        octx.closePath();
        octx.fillStyle = fill;
        octx.fill();
        if (state.show.hexes) { octx.strokeStyle = "rgba(0,0,0,0.18)"; octx.lineWidth = 0.6; octx.stroke(); }
    }
    if (state.show.band) {
        // the band's inner edge: sides between band and ice
        octx.strokeStyle = "#d4a017"; octx.lineWidth = 2;
        octx.beginPath();
        for (const [x, y] of g.bandTiles) for (const [a, b] of hexNeighbors(x, y)) {
            if (!g.inBounds(a, b) || g.band[g.idx(a, b)] || !g.isLand(a, b)) continue;
            const [ax, ay] = tileCentre(x, y), [bx, by] = tileCentre(a, b);
            const mx = (ax + bx) / 2, my = (ay + by) / 2, L = Math.hypot(bx - ax, by - ay);
            const px = -(by - ay) / L * HEX_R / 2 * 1.0, py = (bx - ax) / L * HEX_R / 2;
            octx.moveTo(ox(mx + px), oy(my + py)); octx.lineTo(ox(mx - px), oy(my - py));
        }
        octx.stroke();
    }
}

function shade(hex, f) {
    return "#" + [1, 3, 5].map((k) => Math.round(parseInt(hex.slice(k, k + 2), 16) * f).toString(16).padStart(2, "0")).join("");
}

function resize() {
    const r = cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
}

function fit() {
    if (!state.grid) return;
    const r = cv.parentElement.getBoundingClientRect();
    state.zoom = Math.min((r.width - 20) / (state.grid.W + 1), (r.height - 20) / (hyMax() + 2));
    state.panX = (r.width - (state.grid.W + 0.5) * state.zoom) / 2;
    state.panY = (r.height - hyMax() * state.zoom) / 2;
    render();
}

function render() {
    if (!state.grid) return;
    const r = cv.parentElement.getBoundingClientRect();
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, r.width, r.height);
    // offscreen pixel (ox, oy) = ((hx + 0.5) * OFF, (hyMax - hy + HEX_R) * OFF)
    const s = state.zoom / OFF;
    ctx.imageSmoothingEnabled = state.zoom < OFF;
    ctx.drawImage(off, state.panX - 0.5 * state.zoom, state.panY - HEX_R * state.zoom, off.width * s, off.height * s);
    if (state.show.rivers) drawRivers();
    if (state.show.shapes) drawShapes();
    drawSelection();
}

function drawRivers() {
    ctx.lineCap = "round";
    for (const t of state.grid.riverTiles.values()) {
        const [ax, ay] = hexToScreen(...tileCentre(t.x, t.y)), [bx, by] = hexToScreen(...tileCentre(t.to[0], t.to[1]));
        ctx.strokeStyle = t.nav ? "#2a7fff" : "#4aa0ff";
        ctx.lineWidth = Math.max(1.5, state.zoom * (t.nav ? 0.35 : 0.18));
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
}

function screenPts(ref) {
    const f = frameOf(ref);
    return itemOf(ref).pts.map(([lo, la]) => canvasToScreen(...f.toCanvas(lo, la)));
}
function screenPoint(ref) {
    const it = itemOf(ref);
    return canvasToScreen(...frameOf(ref).toCanvas(it.lon, it.lat));
}

function drawShapes() {
    for (const ref of allRefs()) {
        if (sameRef(ref, state.sel)) continue;
        const col = LAND_COL[landIndexOf(ref)] || "#fff";
        if (isLine(ref)) {
            const p = screenPts(ref);
            ctx.setLineDash(ref.t === "poly" ? [] : ref.t === "range" ? [6, 4] : [2, 3]);
            ctx.strokeStyle = ref.t === "river" ? "rgba(120,200,255,0.8)" : ref.t === "range" ? "rgba(90,60,30,0.9)" : col + "99";
            ctx.lineWidth = ref.t === "range" ? 2.5 : 1.2;
            ctx.beginPath();
            p.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
            if (ref.t === "poly") ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            drawMarker(ref, screenPoint(ref), false);
        }
    }
}

function drawMarker(ref, [x, y], selected) {
    ctx.lineWidth = selected ? 3 : 1.5;
    const it = itemOf(ref);
    ctx.beginPath();
    if (ref.t === "volcano") { ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y + 5); ctx.lineTo(x - 6, y + 5); ctx.closePath(); ctx.fillStyle = "#e03020"; ctx.fill(); }
    else if (ref.t === "lake") { ctx.arc(x, y, 5, 0, 7); ctx.fillStyle = "#58c6ff"; ctx.fill(); }
    else if (ref.t === "island") {
        const scale = state.zoom * state.grid.halfH / (79 * SQ3 / 2);   // hexes of 108x80 -> pixels
        const rr = Math.max(4, (it.r || 0.6) * scale);
        ctx.arc(x, y, rr, 0, 7); ctx.strokeStyle = "#c0ffc0"; ctx.stroke();
        if ((it.n || 1) > 1 && it.spread) {
            ctx.beginPath(); ctx.setLineDash([3, 3]); ctx.arc(x, y, it.spread * scale, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        }
    } else if (ref.t === "wonder") {
        for (let k = 0; k < 10; k++) { const a = Math.PI / 5 * k - Math.PI / 2, rr = k % 2 ? 3 : 7; k ? ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)) : ctx.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); }
        ctx.closePath(); ctx.fillStyle = "#ffe040"; ctx.fill();
    }
    if (selected) { ctx.strokeStyle = "#ffd84a"; ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.stroke(); }
}

// Frame handles of the selected land: the square moves it (Distant Lands only), the circle turns
// and scales it. The circle sits `rot` degrees round from east, at k * REF canvas units.
const REF_LOCAL = 10, REF_POLAR = 25;
function frameHandles(l) {
    const fr = state.geo.lands[l].frame;
    const centre = fr.type === "polar" ? [0, 0] : fr.at;
    const d = fr.k * (fr.type === "polar" ? REF_POLAR : REF_LOCAL), a = (fr.rot || 0) * Math.PI / 180;
    return { centre, ring: [centre[0] + d * Math.cos(a), centre[1] + d * Math.sin(a)], movable: fr.type !== "polar" };
}

function drawSelection() {
    const sel = state.sel;
    if (!sel || sel.t === "settings") return;
    if (sel.t === "land") {
        // the land's own shapes, highlighted
        const L = state.geo.lands[sel.l];
        (L.polys || []).forEach((_, i) => strokeLine({ t: "poly", l: sel.l, i }, "#ffd84a", 2.5, false));
        const h = frameHandles(sel.l);
        const [cx, cy] = canvasToScreen(...h.centre), [rx, ry] = canvasToScreen(...h.ring);
        ctx.strokeStyle = "#ffd84a"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(rx, ry); ctx.stroke(); ctx.setLineDash([]);
        if (h.movable) { ctx.fillStyle = "#ffd84a"; ctx.fillRect(cx - 7, cy - 7, 14, 14); }
        ctx.beginPath(); ctx.arc(rx, ry, 8, 0, 7); ctx.fillStyle = "#ffd84a"; ctx.fill();
        return;
    }
    if (isLine(sel)) {
        strokeLine(sel, "#ffd84a", 2.5, true);
        return;
    }
    if (isPoint(sel)) drawMarker(sel, screenPoint(sel), true);
}

function strokeLine(ref, col, w, handles) {
    const p = screenPts(ref), closed = ref.t === "poly";
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath();
    p.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (closed) ctx.closePath();
    ctx.stroke();
    if (!handles) return;
    // insert handles between points
    ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const m of midpoints(p, closed)) {
        ctx.fillStyle = "rgba(20,20,20,0.75)"; ctx.beginPath(); ctx.arc(m[0], m[1], 5, 0, 7); ctx.fill();
        ctx.fillStyle = "#ffd84a"; ctx.fillText("+", m[0], m[1] + 0.5);
    }
    p.forEach(([x, y], k) => {
        const hot = state.hoverVertex === k;
        ctx.fillStyle = k === 0 && !closed ? "#80ff80" : "#ffd84a";
        ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, hot ? 6 : 4.5, 0, 7); ctx.fill(); ctx.stroke();
    });
}

function midpoints(p, closed) {
    const out = [];
    for (let k = 0; k + 1 < p.length || (closed && k < p.length); k++) {
        const a = p[k], b = p[(k + 1) % p.length];
        out.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, k + 1]);
    }
    return out;
}

// ---- hit testing -----------------------------------------------------------------------------

function segDist(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    let t = L ? ((px - a[0]) * dx + (py - a[1]) * dy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
}

function hit(sx, sy) {
    const sel = state.sel;
    if (sel && sel.t === "land") {
        const h = frameHandles(sel.l);
        const [rx, ry] = canvasToScreen(...h.ring);
        if (Math.hypot(sx - rx, sy - ry) < 10) return { kind: "ring" };
        const [cx, cy] = canvasToScreen(...h.centre);
        if (h.movable && Math.abs(sx - cx) < 9 && Math.abs(sy - cy) < 9) return { kind: "move" };
    }
    if (isLine(sel)) {
        const p = screenPts(sel);
        for (let k = 0; k < p.length; k++) if (Math.hypot(sx - p[k][0], sy - p[k][1]) < 8) return { kind: "vertex", ref: sel, k };
        for (const m of midpoints(p, sel.t === "poly")) if (Math.hypot(sx - m[0], sy - m[1]) < 7) return { kind: "insert", ref: sel, at: m[2] };
    }
    if (isPoint(sel)) {
        const [x, y] = screenPoint(sel);
        if (Math.hypot(sx - x, sy - y) < 10) return { kind: "point", ref: sel };
    }
    if (!state.show.shapes) return null;
    const refs = allRefs();
    for (const ref of refs) if (isPoint(ref)) {
        const [x, y] = screenPoint(ref);
        if (Math.hypot(sx - x, sy - y) < 9) return { kind: "point", ref };
    }
    let best = null, bd = 6;
    for (const ref of refs) if (isLine(ref)) {
        const p = screenPts(ref), closed = ref.t === "poly";
        for (let k = 0; k + 1 < p.length || (closed && k < p.length); k++) {
            const d = segDist(sx, sy, p[k], p[(k + 1) % p.length]);
            if (d < bd) { bd = d; best = { kind: "shape", ref }; }
        }
    }
    return best;
}

// ---- mouse -----------------------------------------------------------------------------------

let drag = null;

function mousePos(e) {
    const r = cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
}

cv.addEventListener("mousedown", (e) => {
    if (!state.grid) return;
    const [sx, sy] = mousePos(e);
    const h = hit(sx, sy);
    if (h && h.kind === "vertex" && e.altKey) { deleteVertex(h.ref, h.k); return; }
    if (h && h.kind === "insert") {
        const f = frameOf(h.ref), pts = itemOf(h.ref).pts;
        const [lo, la] = f.fromCanvas(...screenToCanvas(sx, sy));
        pts.splice(h.at, 0, [r1(lo), r1(la)]);
        drag = { kind: "vertex", ref: h.ref, k: h.at, moved: true };
        rebuild(); render();
        return;
    }
    if (h && (h.kind === "vertex" || h.kind === "ring" || h.kind === "move")) { drag = { ...h, moved: false, start: [sx, sy] }; return; }
    if (h && h.kind === "point") {
        select(h.ref);
        drag = { kind: "point", ref: h.ref, moved: false };
        return;
    }
    if (h && h.kind === "shape") { select(h.ref); return; }
    // nothing hit: pan, and a click without a drag selects the land under the cursor
    drag = { kind: "pan", start: [sx, sy], pan: [state.panX, state.panY], moved: false };
    cv.classList.add("dragging");
});

window.addEventListener("mousemove", (e) => {
    if (!state.grid) return;
    const [sx, sy] = mousePos(e);
    if (!drag) {
        updateHover(sx, sy);
        return;
    }
    if (drag.kind === "pan") {
        state.panX = drag.pan[0] + sx - drag.start[0];
        state.panY = drag.pan[1] + sy - drag.start[1];
        drag.moved = drag.moved || Math.hypot(sx - drag.start[0], sy - drag.start[1]) > 3;
        render();
        return;
    }
    const [X, Y] = screenToCanvas(sx, sy);
    if (drag.kind === "vertex") {
        const [lo, la] = frameOf(drag.ref).fromCanvas(X, Y);
        itemOf(drag.ref).pts[drag.k] = [r1(lo), r1(la)];
    } else if (drag.kind === "point") {
        const it = itemOf(drag.ref);
        const [lo, la] = frameOf(drag.ref).fromCanvas(X, Y);
        it.lon = r1(lo); it.lat = r1(la);
    } else if (drag.kind === "move") {
        state.geo.lands[state.sel.l].frame.at = [r2(X), r2(Y)];
    } else if (drag.kind === "ring") {
        const fr = state.geo.lands[state.sel.l].frame;
        const c = fr.type === "polar" ? [0, 0] : fr.at;
        const dx = X - c[0], dy = Y - c[1];
        let rot = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);
        if (e.shiftKey) rot = fr.rot || 0;                       // Shift: scale only
        fr.rot = rot;
        if (!e.altKey) fr.k = Math.max(0.005, r3(Math.hypot(dx, dy) / (fr.type === "polar" ? REF_POLAR : REF_LOCAL)));  // Alt: turn only
    }
    drag.moved = true;
    rebuild();
    render();
    if (state.sel) renderProps();
});

window.addEventListener("mouseup", (e) => {
    if (!drag) return;
    cv.classList.remove("dragging");
    if (drag.kind === "pan" && !drag.moved) {
        const [sx, sy] = mousePos(e);
        const t = tileAt(sx, sy);
        const o = t ? state.grid.owner[state.grid.idx(t[0], t[1])] : -1;
        select(o >= 0 ? { t: "land", l: o } : null);
    } else if (drag.moved) {
        pushHistory();
        buildNow();
        renderProps();
    }
    drag = null;
});

cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const [sx, sy] = mousePos(e);
    const [hx, hy] = screenToHex(sx, sy);
    state.zoom = Math.max(2, Math.min(80, state.zoom * (e.deltaY < 0 ? 1.15 : 0.87)));
    state.panX = sx - hx * state.zoom;
    state.panY = sy - (hyMax() - hy) * state.zoom;
    render();
}, { passive: false });

function updateHover(sx, sy) {
    const g = state.grid;
    // hovered vertex of the selected line (for Delete)
    let hv = null;
    if (isLine(state.sel)) {
        const p = screenPts(state.sel);
        for (let k = 0; k < p.length; k++) if (Math.hypot(sx - p[k][0], sy - p[k][1]) < 8) hv = k;
    }
    if (hv !== state.hoverVertex) { state.hoverVertex = hv; render(); }
    const t = tileAt(sx, sy);
    if (!t) { $("hover").textContent = ""; return; }
    const i = g.idx(t[0], t[1]);
    const o = g.owner[i];
    const land = o >= 0 ? state.geo.lands[o].name : o === -2 ? "sub-Antarctic island" : "sea";
    const fl = o >= 0 ? o : 0;
    const [lo, la] = state.frames[fl].fromCanvas(...screenToCanvas(sx, sy));
    let s = `hex ${t[0]},${t[1]}  ${T_NAME[g.terrain[i]]}${g.isLand(t[0], t[1]) ? " " + B_NAME[g.biome[i]] : ""}  ${land}`;
    if (o === 0) s += g.band[i] ? `  band ${g.band[i]}` : "  ice";
    s += `\n${state.geo.lands[fl].name} frame: lon ${lo.toFixed(1)}, lat ${la.toFixed(1)}`;
    const rv = g.riverTiles.get(t[0] + "," + t[1]);
    if (rv) s += `\nriver ${rv.river}${rv.nav ? " (navigable)" : ""}`;
    $("hover").textContent = s;
}

// ---- editing ---------------------------------------------------------------------------------

function select(ref) {
    state.sel = ref;
    state.hoverVertex = null;
    renderTree(); renderProps(); render();
}

function deleteVertex(ref, k) {
    const pts = itemOf(ref).pts, min = ref.t === "poly" ? 3 : 2;
    if (pts.length <= min) { logLine(`a ${ref.t === "poly" ? "outline" : "line"} needs at least ${min} points; delete the whole item instead`, "bad"); return; }
    pts.splice(k, 1);
    state.hoverVertex = null;
    pushHistory(); rebuild(); render();
}

function deleteItem(ref) {
    if (ref.t === "island") state.geo.islands.splice(ref.i, 1);
    else if (ref.t === "wonder") state.geo.wonders.splice(ref.i, 1);
    else if (LIST[ref.t]) {
        const L = state.geo.lands[ref.l];
        if (ref.t === "poly" && L.polys.length === 1) { logLine("a land needs at least one outline", "bad"); return; }
        L[LIST[ref.t]].splice(ref.i, 1);
    }
    state.sel = null;
    pushHistory(); rebuild(); renderTree(); renderProps();
}

// the middle of the view, in a land's [lon, lat]
function viewCentreIn(l) {
    const r = cv.getBoundingClientRect();
    return state.frames[l].fromCanvas(...screenToCanvas(r.width / 2, r.height / 2));
}

function addItem(t, l) {
    const f = state.frames[l];
    const [X, Y] = screenToCanvas(cv.getBoundingClientRect().width / 2, cv.getBoundingClientRect().height / 2);
    const d = 2 / state.grid.halfH;   // two hexes, in canvas units
    const at = (dx, dy) => { const [lo, la] = f.fromCanvas(X + dx * d, Y + dy * d); return [r1(lo), r1(la)]; };
    const [lon, lat] = viewCentreIn(l);
    const L = state.geo.lands[l];
    let item;
    if (t === "poly") item = { name: "new outline", pts: [at(-1, -1), at(1, -1), at(1.4, 0.6), at(0, 1.4), at(-1.4, 0.6)] };
    if (t === "range") item = { name: "new range", w: 1, m: 0.4, h: 0.9, pts: [at(-1.5, 0), at(1.5, 0)] };
    if (t === "river") item = { name: "new river", nav: 0, pts: [at(-1.5, 0), at(0, 0.3), at(1.5, 0)] };
    if (t === "lake") item = { name: "new lake", lon: r1(lon), lat: r1(lat), size: 1 };
    if (t === "volcano") item = { name: "new volcano", lon: r1(lon), lat: r1(lat) };
    const key = LIST[t];
    L[key] = L[key] || [];
    L[key].push(item);
    pushHistory(); rebuild(); select({ t, l, i: L[key].length - 1 });
    logLine(`added ${item.name} to ${L.name} in the middle of the view; drag it into place`);
}

function addIsland() {
    const [lon, lat] = viewCentreIn(0);
    state.geo.islands = state.geo.islands || [];
    state.geo.islands.push({ name: "new island", lon: r1(lon), lat: r1(lat), r: 0.8, climate: "polar" });
    pushHistory(); rebuild(); select({ t: "island", i: state.geo.islands.length - 1 });
}

function addWonder(l) {
    const [lon, lat] = viewCentreIn(l);
    state.geo.wonders = state.geo.wonders || [];
    state.geo.wonders.push({ feature: "FEATURE_", land: state.geo.lands[l].id, lon: r1(lon), lat: r1(lat) });
    pushHistory(); rebuild(); select({ t: "wonder", i: state.geo.wonders.length - 1 });
}

// ---- panels ----------------------------------------------------------------------------------

function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const k in attrs) {
        if (k === "class") n.className = attrs[k];
        else if (k.startsWith("on")) n.addEventListener(k.slice(2), attrs[k]);
        else n.setAttribute(k, attrs[k]);
    }
    for (const c of kids) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
    return n;
}

function renderTree() {
    const tree = $("tree");
    tree.innerHTML = "";
    const item = (ref, label, kind) => el("div", { class: "item" + (sameRef(ref, state.sel) || (ref.t === "settings" && state.sel && state.sel.t === "settings") ? " sel" : ""), onclick: () => select(ref) },
        kind ? el("span", { class: "kind" }, kind) : null, label);
    tree.append(el("div", { class: "group" }, item({ t: "settings" }, "Map settings and checks")));
    state.geo.lands.forEach((L, l) => {
        const g = el("div", { class: "group" });
        g.append(el("div", { class: "head", style: `color:${LAND_COL[l] || "#fff"}`, onclick: () => select({ t: "land", l }) }, L.name));
        const sub = el("div", { class: "sub" });
        for (const [t, kind] of [["poly", "outline"], ["range", "range"], ["river", "river"], ["lake", "lake"], ["volcano", "volcano"]]) {
            (L[LIST[t]] || []).forEach((it, i) => sub.append(item({ t, l, i }, it.name || "(unnamed)", kind)));
        }
        g.append(sub);
        tree.append(g);
    });
    const isl = el("div", { class: "group" }, el("div", { class: "head" }, "Sub-Antarctic islands"));
    (state.geo.islands || []).forEach((it, i) => isl.append(item({ t: "island", i }, it.name)));
    tree.append(isl);
    const w = el("div", { class: "group" }, el("div", { class: "head" }, "Natural wonders"));
    (state.geo.wonders || []).forEach((it, i) => w.append(item({ t: "wonder", i }, it.feature.replace("FEATURE_", ""), it.land)));
    tree.append(w);
}

// a form field bound to obj[key]
function field(label, obj, key, type = "text", opts = {}) {
    let input;
    const commit = () => {
        let v = input.value;
        if (type === "number") { v = parseFloat(v); if (!isFinite(v)) return; }
        if (opts.optional && v === "") delete obj[key]; else obj[key] = v;
        pushHistory(); buildNow(); renderTree(); renderProps();
    };
    if (type === "select") {
        input = el("select", { onchange: commit });
        for (const [v, t] of opts.choices) { const o = el("option", { value: v }, t); if (String(obj[key] ?? "") === String(v)) o.selected = true; input.append(o); }
    } else if (type === "textarea") {
        input = el("textarea", { rows: 3, onchange: commit });
        input.value = obj[key] ?? "";
    } else {
        input = el("input", { type, onchange: commit });
        if (opts.step) input.step = opts.step;
        input.value = obj[key] ?? "";
    }
    return el("div", { class: "field" }, el("label", {}, label), input);
}

function renderProps() {
    const p = $("props");
    p.innerHTML = "";
    const sel = state.sel;
    if (!sel || sel.t === "settings") {
        p.append(el("h2", {}, "Map settings"));
        p.append(field("Band depth", state.geo, "bandDepth", "number", { step: 1 }));
        p.append(el("p", {}, "Hexes of ice-free coast round Antarctica; every start is in this band."));
        p.append(el("div", { class: "buttons" }, el("button", { onclick: addIsland }, "+ Island or archipelago")));
        p.append(el("div", { id: "stats", class: "stats" }));
        renderStats();
        return;
    }
    const it = itemOf(sel);
    const del = el("button", { class: "danger", onclick: () => deleteItem(sel) }, "Delete");
    if (sel.t === "land") {
        const L = it, fr = L.frame, l = sel.l;
        p.append(el("h2", {}, L.name));
        p.append(field("Name", L, "name"));
        p.append(el("p", {}, L.region === "home" ? "The homeland: every civilization starts on its band." : "A Distant Land."));
        if (fr.type === "polar") {
            p.append(el("p", {}, "Polar projection round the South Pole, at the map centre."));
            p.append(field("Scale k", fr, "k", "number", { step: 0.001 }));
            p.append(field("Turn (deg)", fr, "rot", "number", { step: 1 }));
        } else {
            p.append(el("p", {}, "Drawn around lon0/lat0, scaled by k, turned by rot (counter-clockwise, 0 = north up) and placed at x, y (map centre 0,0; half the map height is 1)."));
            p.append(field("lon0", fr, "lon0", "number", { step: 0.5 }));
            p.append(field("lat0", fr, "lat0", "number", { step: 0.5 }));
            const at = { x: fr.at[0], y: fr.at[1] };
            const fx = field("x", at, "x", "number", { step: 0.01 }), fy = field("y", at, "y", "number", { step: 0.01 });
            for (const f of [fx, fy]) f.querySelector("input").addEventListener("change", () => { fr.at = [at.x, at.y]; pushHistory(); rebuild(); });
            p.append(fx, fy);
            p.append(field("Scale k", fr, "k", "number", { step: 0.001 }));
            p.append(field("Turn (deg)", fr, "rot", "number", { step: 1 }));
        }
        p.append(el("p", {}, "On the map: drag the square to move, the circle to turn and scale (Shift: scale only, Alt: turn only)."));
        p.append(el("div", { class: "buttons" },
            ...[["poly", "+ Outline"], ["range", "+ Range"], ["river", "+ River"], ["lake", "+ Lake"], ["volcano", "+ Volcano"]].map(([t, lab]) => el("button", { onclick: () => addItem(t, l) }, lab)),
            el("button", { onclick: () => addWonder(l) }, "+ Wonder")));
        if (!["antarctica", "south-america", "africa", "madagascar", "australia", "new-zealand"].includes(L.id)) p.append(el("p", {}, "No biome rules for this land id: it gets a temperate mix."));
        return;
    }
    const title = { poly: "Outline", range: "Mountain range", river: "River", lake: "Lake", volcano: "Volcano", island: "Island", wonder: "Natural wonder" }[sel.t];
    p.append(el("h2", {}, title + (LIST[sel.t] ? " - " + state.geo.lands[sel.l].name : "")));
    if (sel.t !== "wonder") p.append(field("Name", it, "name"));
    if (sel.t === "range") {
        p.append(field("Half width", it, "w", "number", { step: 0.1 }));
        p.append(field("Mountain %", it, "m", "number", { step: 0.05 }));
        p.append(field("Hill %", it, "h", "number", { step: 0.05 }));
        p.append(el("p", {}, "Half width in hexes; inside it a hex is a mountain with chance m, else a hill with chance h."));
    }
    if (sel.t === "river") {
        p.append(field("Navigable", it, "nav", "number", { step: 1 }));
        const lakes = state.geo.lands[sel.l].lakes || [];
        p.append(field("Ends in lake", it, "toLake", "select", { optional: true, choices: [["", "(the sea)"], ...lakes.map((k) => [k.name, k.name])] }));
        p.append(field("Note", it, "note", "textarea", { optional: true }));
        p.append(el("p", {}, "Drawn from source (green point) to mouth. Navigable = hexes above the mouth that ships can use; 0 = a minor river."));
        const r = state.grid.riverList.find((x) => x.name === it.name && x.land === state.geo.lands[sel.l].id);
        p.append(el("p", {}, r ? `On this grid: ${r.tiles.length} hexes, ${r.toOcean ? "reaches the sea" : "ends in a lake or another river"}.` : "On this grid: no river (see the log below)."));
    }
    if (sel.t === "lake") p.append(field("Size (hexes)", it, "size", "number", { step: 1 }));
    if (sel.t === "island") {
        p.append(field("Radius (hexes)", it, "r", "number", { step: 0.1 }));
        p.append(field("Islets", it, "n", "number", { step: 1 }));
        p.append(field("Spread (hexes)", it, "spread", "number", { step: 0.5 }));
        p.append(field("Climate", it, "climate", "select", { choices: [["polar", "polar (tundra)"], ["cool", "cool (grass, plains)"], ["warm", "warm (tropical)"]] }));
        p.append(el("p", {}, "Islets 1 = a single island. More makes an archipelago: the islets scatter within the spread (the dashed circle), differently every game. Sizes are for 108x80 and grow with the map."));
    }
    if (sel.t === "wonder") {
        p.append(field("Feature", it, "feature"));
        p.append(field("Land", it, "land", "select", { choices: state.geo.lands.map((L) => [L.id, L.name]) }));
        p.append(el("p", {}, "The game places it at the nearest hex whose terrain fits, within 3 hexes; otherwise the random pass does."));
    }
    if (isPoint(sel)) {
        p.append(field("Longitude", it, "lon", "number", { step: 0.1 }));
        p.append(field("Latitude", it, "lat", "number", { step: 0.1 }));
    }
    if (isLine(sel)) p.append(el("p", {}, `${it.pts.length} points. Drag a point to move it, click + to add one, Alt/Option-click or hover and press Delete to remove one.`));
    p.append(el("div", { class: "buttons" }, del));
}

// ---- live checks (the same promises tools/antarctica-check.mjs makes) --------------------------

function renderStats() {
    const box = $("stats");
    if (!box || !state.grid) return;
    const g = state.grid, W = g.W, H = g.H;
    const lines = [];
    const bad = (s) => `<span class="bad">${s}</span>`, ok = (s) => `<span class="ok">${s}</span>`;
    const count = (f) => { let c = 0; for (let i = 0; i < W * H; i++) if (f(i)) c++; return c; };
    const land = (i) => g.terrain[i] >= T.FLAT && g.terrain[i] <= T.MOUNTAIN;
    const open = g.bandTiles.filter(([x, y]) => { const t = g.terrain[g.idx(x, y)]; return (t === T.FLAT || t === T.HILL) && !g.riverTiles.get(x + "," + y)?.nav; }).length;
    const players = MAX_PLAYERS[state.size];
    const per = Math.floor(open / players);
    lines.push(`${W}x${H}, seed ${state.seed}`);
    lines.push(`band: ${g.bandTiles.length} hexes, ${open} open`);
    lines.push(`up to ${players} players: ${per} open hexes each ` + (per >= 25 ? ok("ok") : bad("too few")));
    state.geo.lands.forEach((L, l) => lines.push(`${L.name}: ${count((i) => g.owner[i] === l && land(i))} land hexes`));
    lines.push(`islands: ${count((i) => g.owner[i] === -2)} hexes`);
    // edges
    state.geo.lands.forEach((L, l) => {
        const want = EDGE[L.id];
        if (!want) return;
        const row = want === "top" ? H - 1 : 0;
        let n = 0;
        for (let x = 0; x < W; x++) if (g.owner[g.idx(x, row)] === l && g.isLand(x, row)) n++;
        lines.push(`${L.name} on the ${want} edge: ${n} ` + (n >= 2 ? ok("ok") : bad("does not reach it")));
    });
    // gaps: shortest hex distance from Antarctica's shore to each other land's shore
    const shore = (f) => { const out = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = g.idx(x, y); if (f(i) && land(i) && hexNeighbors(x, y).some(([a, b]) => g.inBounds(a, b) && !g.isLand(a, b))) out.push([x, y]); } return out; };
    const home = shore((i) => g.owner[i] === 0);
    const gapTo = (tiles) => { let m = Infinity; for (const a of home) for (const b of tiles) m = Math.min(m, hexDistance(a[0], a[1], b[0], b[1])); return m; };
    state.geo.lands.forEach((L, l) => { if (l === 0) return; const d = gapTo(shore((i) => g.owner[i] === l)); lines.push(`sea from Antarctica to ${L.name}: ${d} ` + (d >= 6 ? ok("ok") : bad("too close"))); });
    // coast-only route
    const seen = new Set(), q = [];
    for (const [x, y] of home) for (const [a, b] of hexNeighbors(x, y)) if (g.inBounds(a, b) && g.terrain[g.idx(a, b)] === T.COAST && !seen.has(a + "," + b)) { seen.add(a + "," + b); q.push([a, b]); }
    const touched = new Set();
    for (let k = 0; k < q.length; k++) for (const [a, b] of hexNeighbors(q[k][0], q[k][1])) {
        if (!g.inBounds(a, b)) continue;
        const j = g.idx(a, b);
        if (g.isLand(a, b)) { if (g.owner[j] !== 0) touched.add(g.owner[j] >= 0 ? state.geo.lands[g.owner[j]].name : "an island"); continue; }
        if (g.terrain[j] === T.COAST && !seen.has(a + "," + b)) { seen.add(a + "," + b); q.push([a, b]); }
    }
    lines.push("coast-only route off Antarctica: " + (touched.size ? bad("to " + [...touched].join(", ")) : ok("none")));
    const warn = state.logs.filter((m) => /not on land|no land course|no mouth|no land /.test(m));
    lines.push(warn.length ? bad(warn.join("\n")) : `${g.riverList.length} rivers, all placed`);
    box.innerHTML = lines.join("\n");
}

// ---- server actions ---------------------------------------------------------------------------

function logLine(s, cls) {
    const f = $("log");
    const d = el("div", cls ? { class: cls } : {}, new Date().toLocaleTimeString() + "  " + s);
    f.append(d);
    f.scrollTop = f.scrollHeight;
}

async function post(path, body) {
    const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    return r.json();
}

async function save() {
    const text = formatGeo(state.geo);
    logLine("saving...");
    try {
        const res = await post("/api/save", { geoText: text });
        if (!res.success) { logLine("not saved: " + res.error, "bad"); return; }
        state.savedText = text;
        updateDirty();
        logLine(res.message, res.checkOk === false ? "bad" : "ok");
        if (res.checkOk === false) logLine(res.output.split("\n").filter((l) => /FAIL/.test(l)).slice(0, 12).join("\n"), "bad");
    } catch (e) { logLine("save failed: " + e.message, "bad"); }
}

async function runCheck() {
    if (updateDirty()) logLine("the check runs on the saved file; save first to check your changes");
    logLine("checking...");
    const res = await post("/api/check");
    const out = (res.output || "").trim().split("\n");
    logLine(out.filter((l) => /FAIL/.test(l)).slice(0, 12).concat(out.slice(-1)).join("\n"), res.success ? "ok" : "bad");
}

async function install() {
    if (updateDirty()) logLine("installing the saved file; your unsaved changes are not in it", "bad");
    const res = await post("/api/install");
    logLine(res.success ? "installed: " + res.output.trim().split("\n").pop() + " (restart the game)" : "install failed: " + (res.error || res.output), res.success ? "ok" : "bad");
}

// ---- start -----------------------------------------------------------------------------------

async function load() {
    const mod = await import("/maps/antarctica-geo.js?t=" + Date.now());
    state.geo = structuredClone(mod.GEO);
    state.savedText = formatGeo(state.geo);
    pushHistory();
    renderTree(); renderProps();
    buildNow(); resize(); fit();
    const fresh = await fetch("/maps/antarctica-geo.js").then((r) => r.text());
    if (!fresh.includes(state.savedText)) logLine("note: antarctica-geo.js is laid out differently from how the editor writes it; the first save will reformat it");
    logLine("loaded antarctica-geo.js", "ok");
}

$("size").addEventListener("change", (e) => { state.size = e.target.value; buildNow(); fit(); });
$("seed").addEventListener("change", (e) => { state.seed = Math.max(1, parseInt(e.target.value) || 1); rebuild(); });
$("reseed").addEventListener("click", () => { state.seed = 1 + Math.floor(Math.random() * 99999); $("seed").value = state.seed; rebuild(); });
for (const [id, k] of [["showShapes", "shapes"], ["showRivers", "rivers"], ["showBand", "band"], ["showHexes", "hexes"]]) {
    $(id).addEventListener("change", (e) => { state.show[k] = e.target.checked; drawOffscreen(); render(); });
}
$("undo").addEventListener("click", () => restore(state.hi - 1));
$("redo").addEventListener("click", () => restore(state.hi + 1));
$("fit").addEventListener("click", fit);
$("save").addEventListener("click", save);
$("check").addEventListener("click", runCheck);
$("install").addEventListener("click", install);
window.addEventListener("resize", resize);
window.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select")) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); restore(e.shiftKey ? state.hi + 1 : state.hi - 1); }
    else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
    else if ((e.key === "Delete" || e.key === "Backspace") && isLine(state.sel) && state.hoverVertex != null) { e.preventDefault(); deleteVertex(state.sel, state.hoverVertex); }
    else if (e.key === "Escape") select(null);
});
window.addEventListener("beforeunload", (e) => { if (state.geo && updateDirty()) { e.preventDefault(); e.returnValue = ""; } });

load().catch((e) => logLine("could not load the map: " + e.message, "bad"));
