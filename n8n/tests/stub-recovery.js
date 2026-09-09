// v56: N printed barcodes -> N rows out, even when the AI drops some.
//
// Run from the repo root:  node n8n/tests/stub-recovery.js n8n/manual-import.v56.json
//
// When LlamaParse mangles part of a document past the model's reach, the AI returns fewer
// items than the source printed (I-DI Invoice: 5056083208579 + the MUSIC PROTECTION lines,
// Mare 2026-09-09). The completeness gate has always NAMED the dropped barcodes; v56 turns
// each into a STUB row so the release cannot be silently lost. This test runs the real
// Chunk Source + Build Catalog Rows, has the simulated AI drop two barcodes (one in a table,
// one stranded in prose), and asserts both come back as stub rows carrying the exact EAN.
const fs = require('fs'), vm = require('vm');
const file = process.argv[2] || 'n8n/manual-import.v56.json';
const wf = JSON.parse(fs.readFileSync(file, 'utf8'));
const node = name => wf.nodes.find(n => n.name === name).parameters.jsCode;
const G = { console, String, Number, Array, Object, Set, Map, RegExp, JSON, Math, Date, parseInt, parseFloat, isNaN };
const run = (code, extra) => vm.runInNewContext('(function(){' + code + '})()', Object.assign({}, G, extra)).map(x => x.json);
const key = v => String(v).replace(/\D/g, '').replace(/^0+/, '');

// a clean 2-row table, then a barcode stranded in prose, then a mangled table row
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

const chunks = run(node('Chunk Source'), { $input: { all: () => [{ json: { message_id: 'M', thread_id: 'M', subject: 'Invoice.pdf', from: null, date: '2026-09-09T10:00:00Z', body: '', attachments_text, source_kind: 'manual' } }] } });

// the AI reads the clean table but drops the two barcodes in the mangled tail
const cleanItems = [
  { artist_raw: 'ARTIST A', artist: 'ARTIST A', title: 'TITLE A', format: 'CD', unit: 1, ean: '0198029909012', ppd: '9,99', rock_bottom: 9.99, label: 'I-DI MUSIC', calculation_group: '1', excluded: false },
  { artist_raw: 'ARTIST B', artist: 'ARTIST B', title: 'TITLE B', format: 'LP', unit: 1, ean: '0602557703887', ppd: '12,99', rock_bottom: 12.99, label: 'I-DI MUSIC', calculation_group: '1', excluded: false },
];
const ai = chunks.map((c, i) => ({ output: JSON.stringify({ document_type: 'invoice', is_catalog_relevant: true, label: 'I-DI MUSIC', sender_recognized: true, items: i === 0 ? cleanItems : [] }) }));

const nodeData = {
  Senders: [{ sender: '...@i-di.com', label: 'I-DI MUSIC', supplier_code: '41', active: true, label_raw: null }],
  MandatoryFields: ['ean', 'artist', 'title', 'format', 'release_date', 'label', 'rock_bottom'].map(f => ({ field_name: f })),
  'Catalog Lines (matching)': [], 'Blocked Emails': [],
};
const $ = name => name === 'Chunk Source'
  ? { all: () => chunks.map(j => ({ json: j })), itemMatching: i => ({ json: chunks[i] }), first: () => ({ json: chunks[0] }) }
  : { all: () => (nodeData[name] || []).map(j => ({ json: j })) };

const out = run(node('Build Catalog Rows'), { $, $input: { all: () => ai.map(j => ({ json: j })) } });

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n); } };
const stubs = out.filter(r => r.extra && r.extra.stub);
const eansOut = new Set(out.filter(r => r.ean).map(r => key(r.ean)));
const stubByEan = {}; for (const s of stubs) stubByEan[key(s.ean)] = s;

console.log('\n' + file.replace(/.*\//, '') + '  (4 printed, AI returned 2)');
ok('every printed barcode has a row (4 distinct EANs out)', eansOut.size === 4);
ok('two stub rows were created', stubs.length === 2);
ok('the prose-stranded barcode 5056083208579 is recovered', !!stubByEan['5056083208579']);
ok('the mangled-table barcode 8032484011830 is recovered', !!stubByEan['8032484011830']);
ok('a table stub reads its artist from the source line', stubByEan['8032484011830'] && stubByEan['8032484011830'].artist === 'VARIOUS ARTISTS');
ok('a stub is flagged for review, never sent blindly', stubs.every(s => s.extra.needs_review === true && s.status === 'in_progress'));
ok('a stub never invents a barcode (EAN copied from source, 13 digits)', stubs.every(s => /^\d{13}$/.test(String(s.ean))));
ok('a completed run creates NO stubs', (function () {
  const ai2 = chunks.map((c, i) => ({ output: JSON.stringify({ document_type: 'invoice', is_catalog_relevant: true, label: 'I-DI MUSIC', items: i === 0 ? cleanItems.concat([
    { artist_raw: 'V', artist: 'VARIOUS ARTISTS', title: 'SUBURBIA COMPILATION', format: 'CD', unit: 1, ean: '8032484011830', rock_bottom: 2.99, label: 'I-DI MUSIC', calculation_group: '1' },
    { artist_raw: 'GNR', artist: 'GUNS N ROSES', title: 'LIVE IN STUTTGART', format: 'CD', unit: 1, ean: '5056083208579', rock_bottom: 9.99, label: 'I-DI MUSIC', calculation_group: '1' },
  ]) : [] }) }));
  return run(node('Build Catalog Rows'), { $, $input: { all: () => ai2.map(j => ({ json: j })) } }).filter(r => r.extra && r.extra.stub).length === 0;
})());

console.log('  ' + '-'.repeat(60));
console.log('  %d passed, %d failed', pass, fail);
if (fail) process.exit(1);
