// geo-format.js
// Writes the Antarctica geography (a plain-data GEO object) as the JavaScript text of
// Antarctica/maps/antarctica-geo.js. One layout for every save, so saving an unchanged map gives
// back the same file byte for byte and a diff shows only what was edited.
//
// Comments inside GEO would not survive a save, so explanations live in `note` fields instead;
// the file's header comment (everything before `export const GEO`) is kept by the server.
//
// Used by the editor page (browser) and by node, so both write the same text.

const IND = "    ";
const WIDTH = 100;

const isNum = (v) => typeof v === "number";
const isPoint = (v) => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);
const isPrim = (v) => v === null || typeof v !== "object";
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function num(n) {
    if (!isFinite(n)) return "0";
    return String(Math.round(n * 10000) / 10000);
}

function prim(v) {
    if (isNum(v)) return num(v);
    if (typeof v === "string") return JSON.stringify(v);
    return String(v);
}

function key(k) {
    return IDENT.test(k) ? k : JSON.stringify(k);
}

// A value on one line, or null if it cannot be written on one line.
function inline(v) {
    if (isPrim(v)) return prim(v);
    if (isPoint(v)) return "[" + num(v[0]) + ", " + num(v[1]) + "]";
    if (Array.isArray(v)) {
        const parts = v.map(inline);
        return parts.includes(null) ? null : "[" + parts.join(", ") + "]";
    }
    const parts = Object.keys(v).map((k) => { const s = inline(v[k]); return s === null ? null : key(k) + ": " + s; });
    return parts.includes(null) ? null : "{ " + parts.join(", ") + " }";
}

// A list of short items, wrapped to WIDTH.
function wrapped(parts, ind) {
    const inner = ind + IND, lines = [];
    let cur = "";
    for (let i = 0; i < parts.length; i++) {
        const piece = parts[i] + ",";
        if (cur && inner.length + cur.length + 1 + piece.length > WIDTH) { lines.push(inner + cur); cur = piece; }
        else cur = cur ? cur + " " + piece : piece;
    }
    if (cur) lines.push(inner + cur);
    return "[\n" + lines.join("\n") + "\n" + ind + "]";
}

function value(v, ind) {
    const one = inline(v);
    if (one !== null && ind.length + one.length <= WIDTH) return one;
    if (Array.isArray(v)) {
        // lists of points or numbers wrap as a block; anything else goes one item per line
        if (v.every((x) => isPoint(x) || isPrim(x))) return wrapped(v.map(inline), ind);
        return "[\n" + v.map((x) => ind + IND + value(x, ind + IND) + ",").join("\n") + "\n" + ind + "]";
    }
    // short fields share a line (name, w, m, h ...); long ones (point lists) get their own
    const inner = ind + IND, lines = [];
    let cur = "";
    for (const k of Object.keys(v)) {
        const one = isPrim(v[k]) || isPoint(v[k]) ? inline(v[k]) : null;
        if (one !== null) {
            const piece = key(k) + ": " + one + ",";
            if (cur && inner.length + cur.length + 1 + piece.length > WIDTH) { lines.push(inner + cur); cur = piece; }
            else cur = cur ? cur + " " + piece : piece;
            continue;
        }
        if (cur) { lines.push(inner + cur); cur = ""; }
        lines.push(inner + key(k) + ": " + value(v[k], inner) + ",");
    }
    if (cur) lines.push(inner + cur);
    return "{\n" + lines.join("\n") + "\n" + ind + "}";
}

export function formatGeo(geo) {
    return "export const GEO = " + value(geo, "") + ";\n";
}

// Splits an existing file into the header comment (kept) and the GEO text (replaced).
// The declaration is matched at the start of a line, since the header may mention it too.
export function splitHeader(text) {
    const at = text.indexOf("\nexport const GEO = {");
    return at < 0 ? "" : text.slice(0, at + 1);
}
