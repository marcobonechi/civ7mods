// geo-io.js
// Reads and writes the mod's `export const GEO = {...}` geography files without
// losing anything the editor does not understand.
//
// The old serializer rebuilt the whole file from an allow-list of keys, so every
// key it had not been taught about (distantLandsAnchors, narrowStraits, flatAreas,
// resourceAreas, wonders, ...) silently vanished on save, along with every comment
// and every optional per-item field (river `strength`, shallow `coastDist`).
//
// This module keeps the file's own text and rewrites only the smallest spans whose
// value actually changed: it descends into arrays and objects, so dragging one lake
// rewrites one `[lon, lat, r, name]` line and leaves the other 28 - and every comment
// around them - byte for byte as they were.

(function(global) {
    const IND = '    ';
    const WRAP = 108;

    // ---- primitive formatting -------------------------------------------

    function fmtNum(n) {
        if (typeof n !== 'number' || !isFinite(n)) return '0';
        return String(Math.round(n * 1e6) / 1e6);
    }

    function prim(v) {
        if (v === null) return 'null';
        if (v === undefined) return 'undefined';
        if (typeof v === 'number') return fmtNum(v);
        if (typeof v === 'boolean') return String(v);
        return JSON.stringify(String(v));
    }

    const isPrim = v => v === null || typeof v !== 'object';
    const isPoint = v => Array.isArray(v) && v.length === 2 &&
                         typeof v[0] === 'number' && typeof v[1] === 'number';
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const isPlainObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

    // ---- value emitter ---------------------------------------------------
    // Generic on purpose: any shape round-trips, including keys added later.

    function wrapList(parts, ind) {
        const oneLine = '[' + parts.join(', ') + ']';
        if (ind.length + oneLine.length <= WRAP) return oneLine;
        const inner = ind + IND;
        const lines = [];
        let cur = '';
        for (let i = 0; i < parts.length; i++) {
            const piece = parts[i] + (i < parts.length - 1 ? ',' : '');
            if (cur && inner.length + cur.length + 1 + piece.length > WRAP) {
                lines.push(inner + cur);
                cur = piece;
            } else {
                cur = cur ? cur + ' ' + piece : piece;
            }
        }
        if (cur) lines.push(inner + cur);
        return '[\n' + lines.join('\n') + '\n' + ind + ']';
    }

    function emitValue(v, ind) {
        if (isPrim(v)) return prim(v);
        if (Array.isArray(v)) {
            if (!v.length) return '[]';
            if (isPoint(v)) return '[' + fmtNum(v[0]) + ', ' + fmtNum(v[1]) + ']';
            if (v.every(isPrim)) return wrapList(v.map(prim), ind);
            if (v.every(isPoint)) return wrapList(v.map(p => '[' + fmtNum(p[0]) + ', ' + fmtNum(p[1]) + ']'), ind);
            if (v.every(e => Array.isArray(e) && e.every(isPrim))) {
                return wrapList(v.map(e => '[' + e.map(prim).join(', ') + ']'), ind);
            }
            const inner = ind + IND;
            return '[\n' + v.map(e => inner + emitValue(e, inner)).join(',\n') + '\n' + ind + ']';
        }
        const keys = Object.keys(v);
        if (!keys.length) return '{}';
        const inline = '{ ' + keys.map(k => k + ': ' + emitValue(v[k], ind)).join(', ') + ' }';
        if (ind.length + inline.length <= WRAP && !inline.includes('\n')) return inline;
        const inner = ind + IND;
        return '{\n' + keys.map(k => inner + k + ': ' + emitValue(v[k], inner)).join(',\n') + '\n' + ind + '}';
    }

    const emitEntry = (key, value) => key + ': ' + emitValue(value, IND);

    // ---- source scanning -------------------------------------------------

    const isIdentCh = c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
                           (c >= '0' && c <= '9') || c === '_' || c === '$';

    function endOfString(text, i) {
        const q = text[i];
        i++;
        while (i < text.length) {
            if (text[i] === '\\') { i += 2; continue; }
            if (text[i] === q) return i + 1;
            i++;
        }
        return i;
    }

    /** Index of the next character that is not whitespace or a comment. */
    function skipTrivia(text, i, end) {
        while (i < end) {
            const c = text[i];
            if (/\s/.test(c)) { i++; continue; }
            if (c === '/' && text[i + 1] === '/') {
                const nl = text.indexOf('\n', i);
                i = nl < 0 || nl >= end ? end : nl;
                continue;
            }
            if (c === '/' && text[i + 1] === '*') {
                const e = text.indexOf('*/', i + 2);
                i = e < 0 || e >= end ? end : e + 2;
                continue;
            }
            return i;
        }
        return end;
    }

    /** Leading whitespace of the line that `pos` sits on. */
    function indentOf(text, pos) {
        const ls = text.lastIndexOf('\n', pos - 1) + 1;
        const m = /^[ \t]*/.exec(text.slice(ls, pos));
        return m ? m[0] : '';
    }

    /**
     * Split the `[...]` or `{...}` that starts the span into member spans.
     * Array members carry `key: null`; object members carry their key name and
     * `valueStart`, the offset just past the colon. Returns null if the span is
     * not a container.
     */
    function containerMembers(text, start, end) {
        const open = skipTrivia(text, start, end);
        if (open >= end || (text[open] !== '[' && text[open] !== '{')) return null;
        const kind = text[open] === '[' ? 'array' : 'object';

        const members = [];
        let depth = 1, i = open + 1;
        let memStart = -1, memKey = null, memValue = -1, memEnd = -1, closeIdx = -1;

        // A member ends at its last significant character, so a trailing line
        // comment ("CIVILIZATION_SUMER: [46.1, 30.9]  // Ur, ...") stays outside
        // the span and survives an edit to the member before it.
        const mark = to => { if (memStart >= 0) memEnd = to; };
        const flush = () => {
            if (memStart >= 0 && memEnd > memStart) {
                members.push({
                    key: memKey,
                    start: memStart,
                    valueStart: memValue < 0 ? memStart : memValue,
                    end: memEnd
                });
            }
            memStart = -1; memKey = null; memValue = -1; memEnd = -1;
        };

        while (i < end) {
            const c = text[i];
            if (c === '/' && text[i + 1] === '/') {
                const nl = text.indexOf('\n', i);
                i = nl < 0 ? end : nl;
                continue;
            }
            if (c === '/' && text[i + 1] === '*') {
                const e = text.indexOf('*/', i + 2);
                i = e < 0 ? end : e + 2;
                continue;
            }
            if (/\s/.test(c)) { i++; continue; }

            if (c === '"' || c === "'" || c === '`') {
                if (memStart < 0) memStart = i;
                i = endOfString(text, i);
                mark(i);
                continue;
            }
            if (c === '{' || c === '[' || c === '(') {
                if (memStart < 0) memStart = i;
                depth++; i++; mark(i);
                continue;
            }
            if (c === '}' || c === ']' || c === ')') {
                depth--;
                if (depth === 0) { flush(); closeIdx = i; break; }
                i++; mark(i);
                continue;
            }
            if (depth === 1 && c === ',') { flush(); i++; continue; }

            if (memStart < 0) {
                memStart = i;
                if (depth === 1 && kind === 'object' && isIdentCh(c)) {
                    let j = i;
                    while (j < end && isIdentCh(text[j])) j++;
                    const k = skipTrivia(text, j, end);
                    if (text[k] === ':') {
                        memKey = text.slice(i, j);
                        // start the value span at the value itself, not at the colon,
                        // so replacing it keeps the "key: value" spacing
                        memValue = skipTrivia(text, k + 1, end);
                        i = k + 1;
                        mark(i);
                        continue;
                    }
                }
            }
            i++; mark(i);
        }
        if (closeIdx < 0) return null;
        return { kind, openIdx: open, closeIdx, members };
    }

    /** Top-level `key: value` spans of the GEO object literal. */
    function parseTopLevel(text) {
        const m = /export\s+const\s+GEO\s*=\s*\{/.exec(text);
        if (!m) throw new Error('no `export const GEO = {` in this file');
        const braceIdx = m.index + m[0].length - 1;
        const c = containerMembers(text, braceIdx, text.length);
        if (!c || c.kind !== 'object') throw new Error('unterminated GEO object literal');
        return {
            bodyStart: braceIdx + 1,
            bodyEnd: c.closeIdx,
            entries: c.members.filter(e => e.key)
        };
    }

    // ---- patching --------------------------------------------------------

    /**
     * Collect the narrowest edits that turn the value in text[start,end) from
     * `ov` into `nv`. Recurses into matching containers so unchanged siblings -
     * and the comments between them - are never touched.
     */
    function diffSpan(text, start, end, nv, ov, edits) {
        if (same(nv, ov)) return;

        const c = containerMembers(text, start, end);

        // An array emptied completely is re-emitted whole: splicing the members out
        // would leave the brackets holding the old line break, i.e. "[\n    ]".
        if (c && c.kind === 'array' && Array.isArray(nv) && Array.isArray(ov) &&
            c.members.length === ov.length && nv.length > 0) {
            const n = Math.min(nv.length, ov.length);
            for (let k = 0; k < n; k++) {
                diffSpan(text, c.members[k].start, c.members[k].end, nv[k], ov[k], edits);
            }
            if (nv.length > ov.length) {
                const last = c.members[c.members.length - 1];
                const ind = last ? indentOf(text, last.start) : indentOf(text, start) + IND;
                pushAppend(text, last ? last.end : c.openIdx + 1,
                           nv.slice(ov.length).map(v => emitValue(v, ind)), ind, edits);
            } else if (nv.length < ov.length) {
                let s = c.members[nv.length].start;
                const e = c.members[ov.length - 1].end;
                while (s > 0 && /\s/.test(text[s - 1])) s--;
                if (nv.length > 0 && text[s - 1] === ',') s--;
                edits.push({ start: s, end: e, text: '' });
            }
            return;
        }

        if (c && c.kind === 'object' && isPlainObj(nv) && isPlainObj(ov)) {
            const byKey = new Map();
            for (const m of c.members) if (m.key) byKey.set(m.key, m);
            const gone = Object.keys(ov).filter(k => !(k in nv));
            const fresh = Object.keys(nv).filter(k => !(k in ov));
            const shared = Object.keys(nv).filter(k => k in ov);
            if (!gone.length && shared.every(k => byKey.has(k))) {
                for (const k of shared) {
                    const m = byKey.get(k);
                    diffSpan(text, m.valueStart, m.end, nv[k], ov[k], edits);
                }
                if (fresh.length) {
                    const last = c.members[c.members.length - 1];
                    const ind = last ? indentOf(text, last.start) : indentOf(text, start) + IND;
                    pushAppend(text, last ? last.end : c.openIdx + 1,
                               fresh.map(k => k + ': ' + emitValue(nv[k], ind)), ind, edits);
                }
                return;
            }
        }

        edits.push({ start, end, text: emitValue(nv, indentOf(text, start)) });
    }

    /**
     * Queue an append of `bodies` after the member ending at `at`. The comma goes
     * straight after the member, but the new lines go after any trailing line
     * comment, so "CIVILIZATION_SUMER: [...]  // Ur, ..." keeps its own note.
     */
    function pushAppend(text, at, bodies, ind, edits) {
        if (!bodies.length) return;
        const nl = text.indexOf('\n', at);
        const tail = nl > at ? text.slice(at, nl) : null;
        const block = bodies.map(b => '\n' + ind + b).join(',');
        if (tail !== null && /^[ \t]*(\/\/.*)?$/.test(tail) && /\S/.test(tail)) {
            edits.push({ start: at, end: at, text: ',' });
            edits.push({ start: nl, end: nl, text: block });
        } else {
            edits.push({ start: at, end: at, text: ',' + block });
        }
    }

    function applyEdits(text, edits) {
        let out = text;
        for (const e of edits.slice().sort((a, b) => b.start - a.start || b.end - a.end)) {
            out = out.slice(0, e.start) + e.text + out.slice(e.end);
        }
        return out;
    }

    /**
     * Rewrite `text` so every top-level key whose value differs between `orig`
     * and `geo` carries the new value. Comments, formatting and keys the editor
     * never models are copied verbatim.
     * Returns { text, changed, added, dropped, edits }.
     */
    function patchSource(text, geo, orig, opts) {
        const parsed = parseTopLevel(text);
        const byKey = new Map(parsed.entries.map(e => [e.key, e]));
        const emptiable = new Set((opts && opts.emptiable) || []);

        const changed = [], added = [], edits = [];
        for (const k of Object.keys(geo)) {
            if (same(geo[k], orig[k])) continue;
            if (byKey.has(k)) {
                const e = byKey.get(k);
                changed.push(k);
                diffSpan(text, e.valueStart, e.end, geo[k], orig[k], edits);
            } else {
                added.push(k);
            }
        }

        // A key on disk but absent from the live object is never deleted: that can
        // only be an editor bug, and silent deletion is exactly what we are fixing.
        // The exception is a collection the editor itself owns and the user has
        // emptied - undoing past the first hex pin, say. Those are written back as
        // `key: []`, which means the same thing and keeps the file's key set stable.
        const dropped = [];
        for (const k of Object.keys(orig)) {
            if (k in geo) continue;
            if (emptiable.has(k) && byKey.has(k) && Array.isArray(orig[k])) {
                const e = byKey.get(k);
                edits.push({ start: e.valueStart, end: e.end, text: '[]' });
                changed.push(k);
            } else {
                dropped.push(k);
            }
        }

        let out = applyEdits(text, edits);

        if (added.length) {
            const p2 = parseTopLevel(out);           // offsets moved
            const last = p2.entries[p2.entries.length - 1];
            const tail = [];
            pushAppend(out, last ? last.end : p2.bodyStart,
                       added.map(k => '\n' + IND + emitEntry(k, geo[k])), '', tail);
            out = applyEdits(out, tail);
        }

        return { text: out, changed, added, dropped, edits };
    }

    /** Whole-file emit, for standalone use when the original text is unavailable. */
    function serializeGeo(geo, header) {
        const head = (header ? '// ' + header + '\n' : '') +
                     '// Geography configuration for Civilization VII map mod\n\n';
        return head + 'export const GEO = {\n' +
               Object.keys(geo).map(k => IND + emitEntry(k, geo[k])).join(',\n\n') +
               '\n};\n';
    }

    const CivGeoIO = {
        parseTopLevel, containerMembers, patchSource, serializeGeo,
        emitValue, emitEntry, fmtNum
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = CivGeoIO;
    else global.CivGeoIO = CivGeoIO;
})(typeof window !== 'undefined' ? window : globalThis);
