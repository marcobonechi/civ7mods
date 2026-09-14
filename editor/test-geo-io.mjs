#!/usr/bin/env node
// Regression test for editor/js/geo-io.js.
//
// The editor's old serializer rebuilt each geography file from an allow-list of
// keys, so every key it had not been taught about vanished on save. These checks
// pin down that the patcher cannot do that again:
//   - it sees exactly the keys the module actually exports
//   - saving with nothing changed leaves the file byte-identical
//   - saving after an edit touches only the edited keys, and keeps every comment
//
// Run:  node editor/test-geo-io.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAPS = path.join(HERE, '..', 'EuropeMediterranean', 'maps');
const IO = createRequire(import.meta.url)(path.join(HERE, 'js', 'geo-io.js'));

// Keys the old serializer destroyed on every save. Named explicitly so that
// losing one again fails here rather than in a game three weeks later.
const CRITICAL = [
    'distantLandsAnchors', 'narrowStraits', 'flatAreas', 'hillAreas', 'lowAreas',
    'roughAreas', 'passes', 'shallowLines', 'resourceAreas', 'wonders',
    'requestedWonders', 'baseHillProb', 'lonSqueezeWest'
];

let failed = 0;
const ok = (cond, msg) => {
    console.log((cond ? '  ok   ' : '  FAIL ') + msg);
    if (!cond) failed++;
};
const load = f => import(pathToFileURL(path.join(MAPS, f)).href);

const files = fs.readdirSync(MAPS).filter(f => f.endsWith('-geo.js')).sort();
if (!files.length) { console.error('no *-geo.js in ' + MAPS); process.exit(1); }

for (const f of files) {
    console.log('\n== ' + f);
    const text = fs.readFileSync(path.join(MAPS, f), 'utf8');
    const { GEO } = await load(f);
    const orig = structuredClone(GEO);

    const parsed = IO.parseTopLevel(text);
    const seen = parsed.entries.map(e => e.key);
    const real = Object.keys(GEO);
    ok(seen.length === new Set(seen).size, `no duplicate key spans (${seen.length})`);
    ok(real.every(k => seen.includes(k)), `all ${real.length} exported keys found in the source`);
    ok(seen.every(k => real.includes(k)), 'no phantom keys');

    const badSpan = parsed.entries.filter(e => {
        const v = eval('({' + text.slice(e.start, e.end) + '})')[e.key];
        return JSON.stringify(v) !== JSON.stringify(GEO[e.key]);
    }).map(e => e.key);
    ok(!badSpan.length, 'every key span evaluates to its runtime value' + (badSpan.length ? ': ' + badSpan : ''));

    const noop = IO.patchSource(text, structuredClone(orig), orig);
    ok(noop.text === text, 'saving with no edits is byte-identical');
    ok(!noop.changed.length && !noop.added.length, 'no edits reported');

    // An edit to every collection the editor can actually move. Values are rounded
    // to 2 decimals because that is what the editor's own handlers store, and what
    // keeps `0.3 + 0.15` from arriving as 0.44999999999999996.
    const geo = structuredClone(orig);
    const touched = [];
    const r2 = n => Math.round(n * 100) / 100;
    const bump = (k, fn) => { if (geo[k]) { fn(geo[k]); touched.push(k); } };
    bump('lakes', v => { v[0] = [r2(v[0][0] + 0.25), r2(v[0][1] - 0.1), v[0][2], v[0][3]]; });
    bump('landBlobs', v => { v[0][0] = r2(v[0][0] + 0.2); });
    bump('biomeBlobs', v => { v[0][1] = r2(v[0][1] + 0.15); });
    bump('rivers', v => { v[0].pts[0] = [r2(v[0].pts[0][0] + 0.1), v[0].pts[0][1]]; });
    bump('ranges', v => { v[0].core = r2(v[0].core + 0.1); });
    bump('tsl', v => { v.CIVILIZATION_TEST_ONLY = [12, 45]; });
    bump('fallbackSites', v => { v.push([1.5, 43.6, 'Test Only']); });

    const r = IO.patchSource(text, geo, orig);
    ok(!r.dropped.length, 'no top-level key dropped');
    ok(r.changed.slice().sort().join() === touched.slice().sort().join(),
       `only the ${touched.length} edited keys rewritten (${r.changed.join(', ')})`);

    const tmp = path.join(HERE, '.geo-io-test.' + f);
    fs.writeFileSync(tmp, r.text);
    try {
        const after = (await import(pathToFileURL(tmp).href + '?t=' + Date.now())).GEO;
        const lost = CRITICAL.filter(k => k in orig && JSON.stringify(after[k]) !== JSON.stringify(orig[k]));
        ok(!lost.length, 'every previously-destroyed key survives' + (lost.length ? ': ' + lost : ''));
        const untouched = Object.keys(orig).filter(k => !r.changed.includes(k));
        const drift = untouched.filter(k => JSON.stringify(after[k]) !== JSON.stringify(orig[k]));
        ok(!drift.length, `${untouched.length} untouched keys unchanged` + (drift.length ? ': ' + drift : ''));
        const applied = touched.filter(k => JSON.stringify(after[k]) !== JSON.stringify(geo[k]));
        ok(!applied.length, 'every edit landed' + (applied.length ? '; missing: ' + applied : ''));
    } finally {
        fs.unlinkSync(tmp);
    }

    // Emptying a collection must produce `[]`, not brackets around a stray line break.
    const emptied = structuredClone(orig);
    const listKey = ['lakes', 'landBlobs', 'volcanoes'].find(k => Array.isArray(emptied[k]) && emptied[k].length);
    if (listKey) {
        emptied[listKey] = [];
        const e = IO.patchSource(text, emptied, orig);
        const span = /(\w+): (\[[^\]]*\])/.exec(e.text.slice(e.text.indexOf(listKey + ':')));
        ok(/^\s*\[\s*\]\s*$/.test(span ? span[2] : 'x') || e.text.includes(listKey + ': []'),
           `emptying ${listKey} emits []`);
    }

    // A key the editor owns, removed entirely, is written back as [] - never deleted,
    // and never silently reported as "no changes".
    {
        const gone = structuredClone(orig);
        gone.__ownedTest = undefined; delete gone.__ownedTest;
        const withKey = structuredClone(orig);
        withKey.lakes = withKey.lakes || [];
        const removed = structuredClone(withKey);
        delete removed.lakes;
        const guarded = IO.patchSource(text, removed, withKey);
        ok(guarded.dropped.includes('lakes') && !guarded.changed.includes('lakes'),
           'a missing key is refused by default');
        const allowed = IO.patchSource(text, removed, withKey, { emptiable: ['lakes'] });
        ok(!allowed.dropped.length && allowed.changed.includes('lakes'),
           'an editor-owned key emptied instead of dropped');
        ok(/lakes: \[\]/.test(allowed.text), 'it is written as lakes: []');
    }

    const before = (text.match(/\/\//g) || []).length;
    const now = (r.text.match(/\/\//g) || []).length;
    ok(now === before, `all ${before} comments kept`);
}

console.log(failed ? `\n${failed} FAILURE(S)` : '\nall pass');
process.exit(failed ? 1 : 0);
