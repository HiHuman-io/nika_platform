// v57: which review notes belong to a LINE and which to a RUN — and the swapped-name flag.
//
// Run from the repo root:  node n8n/tests/review-notes.js n8n/manual-import.v57.json
//
// 1. A completeness-gate finding ("INCOMPLETE EXTRACTION", "POSSIBLE MISSING RELEASE")
//    describes the RUN that produced it. Merging an old line's extra forward onto every later
//    update echoed a stale count for ever — a 48-barcode document still showing "printed 115
//    barcodes but produced 9 catalog lines" (client, 2026-09-10). Those sentences are dropped
//    on merge; every other note in extra is line-level and must survive.
// 2. "SURNAME, GIVEN & SURNAME, GIVEN" with the SAME given name twice is a wrapped cell the
//    parser mixed up (I-DI: "Sinatra, Nancy & Hazlewood, Nancy" / "Lee & Lee" for Nancy
//    Sinatra & LEE Hazlewood, "Nancy & Lee"). It is FLAGGED, never corrected — recovering the
//    real name would mean inventing one. Two different given names must NOT be flagged.
const fs = require('fs'), vm = require('vm');
const file = process.argv[2] || 'n8n/manual-import.v57.json';
const wf = JSON.parse(fs.readFileSync(file, 'utf8'));
const node = n => wf.nodes.find(x => x.name === n).parameters.jsCode;
const G = { console, String, Number, Array, Object, Set, Map, RegExp, JSON, Math, Date, parseInt, parseFloat, isNaN };
const run = (code, extra) => vm.runInNewContext('(function(){' + code + '})()', Object.assign({}, G, extra)).map(x => x.json);

const attachments_text = [
  '# Barcode', '',
  '| Barcode | Artist | Title | Format | Price |',
  '| --- | --- | --- | --- | --- |',
  '| 0198029909012 | Pink Floyd | Live In LA | LP | 9,99 |',
  '| 0826853019828 | Sinatra, Nancy & Hazlewood, Nancy | Lee & Lee | CD | 23,49 |',
  '| 5018791120895 | Smith, John & Jones, Mary | Duets | CD | 6,99 |',
].join('\n');

const chunks = run(node('Chunk Source'), { $input: { all: () => [{ json: { message_id: 'M', thread_id: 'M', subject: 'Invoice.pdf', from: null, date: '2026-09-10T10:00:00Z', body: '', attachments_text, source_kind: 'manual' } }] } });

const items = [
  { artist_raw: 'Pink Floyd', artist: 'PINK FLOYD', title: 'LIVE IN LA', format: 'LP', unit: 1, ean: '0198029909012', rock_bottom: 9.99, label: 'I-DI MUSIC', calculation_group: '1', excluded: false },
  { artist_raw: 'Sinatra, Nancy & Hazlewood, Nancy', artist: 'SINATRA NANCY/HAZLEWOOD NANCY', title: 'LEE & LEE', format: 'CD', unit: 1, ean: '0826853019828', rock_bottom: 23.49, label: 'I-DI MUSIC', calculation_group: '1', excluded: false },
  { artist_raw: 'Smith, John & Jones, Mary', artist: 'SMITH JOHN/JONES MARY', title: 'DUETS', format: 'CD', unit: 1, ean: '5018791120895', rock_bottom: 6.99, label: 'I-DI MUSIC', calculation_group: '1', excluded: false },
];
const ai = chunks.map((c, i) => ({ output: JSON.stringify({ document_type: 'invoice', is_catalog_relevant: true, label: 'I-DI MUSIC', items: i === 0 ? items : [] }) }));

// an EXISTING line for the first barcode, carrying a stale gate note AND a real line-level note
const STALE = 'INCOMPLETE EXTRACTION: this document printed 115 barcodes but produced 9 catalog lines. 106 barcode(s) came back from the AI as nothing at all: 826853019828, ….';
const STALE2 = 'POSSIBLE MISSING RELEASE: this document was read as holding at least 50 releases and the AI returned 9 — 41 fewer.';
const KEEP = 'Label "FOO RECORDS" is not in the label map — confirm/add it in Settings.';
const nodeData = {
  Senders: [{ sender: '...@i-di.com', label: 'I-DI MUSIC', supplier_code: '41', active: true, label_raw: null }],
  MandatoryFields: ['ean', 'artist', 'title', 'format', 'release_date', 'label', 'rock_bottom'].map(f => ({ field_name: f })),
  'Catalog Lines (matching)': [{ id: 'L1', ean: '0198029909012', artist: 'PINK FLOYD', title: 'LIVE IN LA', format: 'LP', status: 'in_progress', sent_at: null, catalog: 'other', extra: { review_note: [STALE, KEEP, STALE2].join('\n'), needs_review: true } }],
  'Blocked Emails': [],
};
const $ = n => n === 'Chunk Source'
  ? { all: () => chunks.map(j => ({ json: j })), itemMatching: i => ({ json: chunks[i] }), first: () => ({ json: chunks[0] }) }
  : { all: () => (nodeData[n] || []).map(j => ({ json: j })) };

const out = run(node('Build Catalog Rows'), { $, $input: { all: () => ai.map(j => ({ json: j })) } });
const byEan = {}; for (const r of out) if (r.ean) byEan[String(r.ean).replace(/^0+/, '')] = r;
const upd = out.find(r => r.action === 'update') || {};
const updNote = String(((upd.extra || {}).review_note) || '');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (x !== undefined ? ' — ' + JSON.stringify(x) : '')); } };

console.log('\n' + file.replace(/.*\//, ''));
ok('the matched line came back as an update', upd.action === 'update');
ok("a previous run's INCOMPLETE EXTRACTION is not echoed forward", updNote.indexOf('INCOMPLETE EXTRACTION') === -1, updNote);
ok("a previous run's POSSIBLE MISSING RELEASE is not echoed forward", updNote.indexOf('POSSIBLE MISSING RELEASE') === -1, updNote);
ok('the line-level label note SURVIVES the merge', updNote.indexOf('not in the label map') !== -1, updNote);

const sw = byEan['826853019828'] || {};
const swNote = String(((sw.extra || {}).review_note) || '');
ok('the same given name twice is FLAGGED', swNote.indexOf('SUSPECT NAME') !== -1, swNote);
ok('...and names both surnames', swNote.indexOf('SINATRA') !== -1 && swNote.indexOf('HAZLEWOOD') !== -1, swNote);
ok('...and points at the title as the likely second name', swNote.indexOf('LEE') !== -1, swNote);
ok('...and is flagged for review', (sw.extra || {}).needs_review === true);
ok('...and the artist is NOT silently rewritten', String(sw.artist || '').indexOf('NANCY') !== -1);

const okName = byEan['5018791120895'] || {};
ok('two DIFFERENT given names are not flagged', String(((okName.extra || {}).review_note) || '').indexOf('SUSPECT NAME') === -1);

console.log('  ' + '-'.repeat(60));
console.log('  %d passed, %d failed', pass, fail);
if (fail) process.exit(1);
