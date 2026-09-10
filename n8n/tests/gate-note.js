// v58: THE COMPLETENESS NOTE MUST SAY WHAT ACTUALLY HAPPENED, ONCE.
//
// Run from the repo root:  node n8n/tests/gate-note.js n8n/manual-import.v58.json
//
// The gate runs before the stub pass, so it used to promise "added as a STUB row" for every
// dropped barcode — including the ones that already have a catalog line and correctly get no
// stub. It then printed a second paragraph about the SAME releases under a different heading,
// and put the whole block on every row of the run: a 48-barcode document showed the reviewer
// the same five lines 43 times (client, 2026-09-10). A warning that overstates itself, repeats
// itself and fires on every row is one the reviewer learns to skim — and then they skim the
// run where it mattered.
//
// Same document, same dropped barcodes, twice: once with an empty catalog (stubs ARE created)
// and once with those barcodes already in it (no stub is possible, and nothing was lost).
const fs = require('fs'), vm = require('vm');
const file = process.argv[2] || 'n8n/manual-import.v58.json';
const wf = JSON.parse(fs.readFileSync(file, 'utf8'));
const node = name => wf.nodes.find(n => n.name === name).parameters.jsCode;
const G = { console, String, Number, Array, Object, Set, Map, RegExp, JSON, Math, Date, parseInt, parseFloat, isNaN };
const run = (code, extra) => vm.runInNewContext('(function(){' + code + '})()', Object.assign({}, G, extra)).map(x => x.json);

const attachments_text = [
  '# Barcode', '',
  '| Barcode | Artist | Title | Format | Price |',
  '| --- | --- | --- | --- | --- |',
  '| 0198029909012 | ARTIST A | TITLE A | CD | 9,99 |',
  '| 0602557703887 | ARTIST B | TITLE B | LP | 12,99 |',
  '',
  '5056083208579  Live In Stuttgart 1991  Germany.',
  '| 8032484011830 | VARIOUS ARTISTS | SUBURBIA COMPILATION | 1 | HOUSE | CD | MUSIC | 1 | 2,99 |',
].join('\n');

const chunks = run(node('Chunk Source'), { $input: { all: () => [{ json: { message_id: 'M', thread_id: 'M', subject: 'Invoice.pdf', from: null, date: '2026-09-10T10:00:00Z', body: '', attachments_text, source_kind: 'manual' } }] } });

// the AI returns the two clean rows and drops the two in the tail
const cleanItems = [
  { artist_raw: 'ARTIST A', artist: 'ARTIST A', title: 'TITLE A', format: 'CD', unit: 1, ean: '0198029909012', rock_bottom: 9.99, label: 'I-DI MUSIC', calculation_group: '1', excluded: false },
  { artist_raw: 'ARTIST B', artist: 'ARTIST B', title: 'TITLE B', format: 'LP', unit: 1, ean: '0602557703887', rock_bottom: 12.99, label: 'I-DI MUSIC', calculation_group: '1', excluded: false },
];
const ai = chunks.map((c, i) => ({ output: JSON.stringify({ document_type: 'invoice', is_catalog_relevant: true, label: 'I-DI MUSIC', sender_recognized: true, items: i === 0 ? cleanItems : [] }) }));

const MISSING = ['5056083208579', '8032484011830'];
const build = pool => {
  const nodeData = {
    Senders: [{ sender: '...@i-di.com', label: 'I-DI MUSIC', supplier_code: '41', active: true, label_raw: null }],
    MandatoryFields: ['ean', 'artist', 'title', 'format', 'release_date', 'label', 'rock_bottom'].map(f => ({ field_name: f })),
    'Catalog Lines (matching)': pool, 'Blocked Emails': [],
  };
  const $ = name => name === 'Chunk Source'
    ? { all: () => chunks.map(j => ({ json: j })), itemMatching: i => ({ json: chunks[i] }), first: () => ({ json: chunks[0] }) }
    : { all: () => (nodeData[name] || []).map(j => ({ json: j })) };
  return run(node('Build Catalog Rows'), { $, $input: { all: () => ai.map(j => ({ json: j })) } });
};
const noteOf = r => String(((r || {}).extra || {}).review_note || '');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (x !== undefined ? '\n          ' + String(x).replace(/\n/g, '\n          ') : '')); } };

console.log('\n' + file.replace(/.*\//, ''));

// ---------------------------------------------------------- A. nothing in the catalog yet
console.log('  -- the dropped barcodes are NOT in the catalog: stubs are created');
const outA = build([]);
const stubsA = outA.filter(r => r.extra && r.extra.stub);
const ordinaryA = outA.filter(r => !(r.extra && r.extra.stub));
ok('two stub rows were created', stubsA.length === 2, stubsA.length);
ok('the STUB rows carry the full completeness text',
  stubsA.every(s => /INCOMPLETE EXTRACTION/.test(noteOf(s)) && noteOf(s).indexOf('5056083208579') !== -1), noteOf(stubsA[0]));
ok('...and still say why the row itself exists', stubsA.every(s => /^AUTO-ADDED/.test(noteOf(s))), noteOf(stubsA[0]));
ok('an ordinary row gets ONE sentence, not the whole block',
  ordinaryA.every(r => noteOf(r).split('\n').length === 1), ordinaryA.map(noteOf).join(' || '));
ok('...which points at the stub rows', ordinaryA.every(r => /STUB row/.test(noteOf(r))), noteOf(ordinaryA[0]));
ok('...and does not repeat the barcode list', ordinaryA.every(r => noteOf(r).indexOf('5056083208579') === -1), noteOf(ordinaryA[0]));
ok('an ordinary row IS flagged: there is a stub to complete', ordinaryA.every(r => r.extra.needs_review === true));
ok('the same shortfall is NOT also reported as POSSIBLE MISSING RELEASE',
  outA.every(r => !/POSSIBLE MISSING RELEASE/.test(noteOf(r))), outA.map(noteOf).find(n => /POSSIBLE/.test(n)));

// ---------------------------------------------------------- B. they already have a line
console.log('  -- the dropped barcodes ALREADY have catalog lines: no stub is possible');
const pool = MISSING.map((e, i) => ({ id: 'L' + i, ean: e, artist: 'X', title: 'Y', format: 'CD', status: 'in_progress', sent_at: null, catalog: 'other', extra: {} }));
const outB = build(pool);
const stubsB = outB.filter(r => r.extra && r.extra.stub);
const ordinaryB = outB.filter(r => !(r.extra && r.extra.stub));
ok('no stub is created for a barcode that already has a line', stubsB.length === 0, stubsB.length);
ok('the note does NOT claim a stub was added',
  ordinaryB.every(r => !/STUB row/.test(noteOf(r))), ordinaryB.map(noteOf).join(' || '));
ok('...it says the barcodes already have a catalog line',
  ordinaryB.every(r => /already has a catalog line/.test(noteOf(r))), noteOf(ordinaryB[0]));
ok('...and the row is NOT flagged for review: there is nothing to do',
  ordinaryB.every(r => r.extra.needs_review !== true), ordinaryB.map(r => r.extra.needs_review).join(','));
ok('...and it is headed run-scoped, so a later update never echoes it',
  ordinaryB.every(r => /^(?:INCOMPLETE EXTRACTION|POSSIBLE MISSING RELEASE|EXTRACTION NOTE)\b/.test(noteOf(r))), noteOf(ordinaryB[0]));

// ---------------------------------------------------------- C. a shortfall the barcodes miss
// POSSIBLE MISSING RELEASE is the only check that can see a release printing no barcode at
// all, so it must still fire when the shortfall is LARGER than the barcodes named.
console.log('  -- a shortfall bigger than the named barcodes: the soft check still fires');
const chunks2 = chunks.map(c => Object.assign({}, c, { chunk_rows: (c.chunk_rows || 0) + 3 }));
const $2 = name => name === 'Chunk Source'
  ? { all: () => chunks2.map(j => ({ json: j })), itemMatching: i => ({ json: chunks2[i] }), first: () => ({ json: chunks2[0] }) }
  : { all: () => ({ Senders: [{ sender: '...@i-di.com', label: 'I-DI MUSIC', supplier_code: '41', active: true, label_raw: null }], MandatoryFields: ['ean', 'artist', 'title', 'format', 'release_date', 'label', 'rock_bottom'].map(f => ({ field_name: f })), 'Catalog Lines (matching)': [], 'Blocked Emails': [] }[name] || []).map(j => ({ json: j })) };
const outC = run(node('Build Catalog Rows'), { $: $2, $input: { all: () => ai.map(j => ({ json: j })) } });
ok('POSSIBLE MISSING RELEASE fires when the shortfall exceeds the named barcodes',
  outC.some(r => /POSSIBLE MISSING RELEASE/.test(noteOf(r))), outC.map(noteOf).join(' || ').slice(0, 300));

console.log('  ' + '-'.repeat(60));
console.log('  %d passed, %d failed', pass, fail);
if (fail) process.exit(1);
