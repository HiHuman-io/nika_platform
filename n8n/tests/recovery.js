// v60: THE RECOVERY PASS — a second AI call over ONLY the lines the first pass could not read.
//
// Run from the repo root:  node n8n/tests/recovery.js n8n/manual-import.v60.json
//
// v56 guarantees a printed barcode is never LOST: every one the AI drops becomes a stub row
// carrying the exact EAN. A stub is capture, not completion — a human still keys artist, title,
// format and price. The recovery pass asks the model about those lines alone and folds what it
// reads back into the FIRST pass's output, so a recovered release goes through the identical
// pipeline and the gate counts it as produced, so no stub is made for it.
//
// The interesting assertions here are not "does it work" but what it is NOT allowed to do. A
// second pass over the hardest part of a document is exactly where an invention would come
// from, and an invented row looks right and gets approved. So: it may only ANSWER, never ADD;
// the barcode is the document's, never the model's; an empty answer is discarded in favour of
// the stub that at least says why it is empty; and if anything goes wrong the run comes out
// exactly as it did before the recovery node existed.
const fs = require('fs'), vm = require('vm');
const file = process.argv[2] || 'n8n/manual-import.v60.json';
const wf = JSON.parse(fs.readFileSync(file, 'utf8'));
const node = name => {
  const n = wf.nodes.find(x => x.name === name);
  if (!n) throw new Error('no such node: ' + name);
  return n.parameters.jsCode;
};
const G = { console, String, Number, Array, Object, Set, Map, RegExp, JSON, Math, Date, parseInt, parseFloat, isNaN };
const run = (code, extra) => vm.runInNewContext('(function(){' + code + '})()', Object.assign({}, G, extra)).map(x => x.json);
const key = v => String(v == null ? '' : v).replace(/\D/g, '').replace(/^0+/, '');

// a clean table, then the I-DI page-2 shape: a release the parser left as loose text above a
// table whose columns it could not find, and rows split across two lines
const attachments_text = [
  '# Barcode', '',
  '| Barcode | Artist | Title | Units | Format | Price |',
  '| --- | --- | --- | --- | --- | --- |',
  '| 0198029909012 | ARTIST A | TITLE A | 1 | CD | 9,99 |',
  '| 0602557703887 | ARTIST B | TITLE B | 1 | LP | 12,99 |',
  '',
  '5056083208579  Yes  Hanns-Martin-Schleyer-Halle. Stuttgart. 3  Germany.',
  '| CD            | 31St May                           | 1    | 1991   | 9,99  |',
  '| ------------- | ---------------------------------- | ---- | ------ | ----- |',
  '| 8032484011830 | VARIOUS ARTISTS                    | SUBURBIA COMPILATION - ESSENTIAL | 1 | HOUSE |',
  '| 5060572510005 | MUSIC PROTECTION                   | KXRM25K - WITH PPS - WOODEN RECORD | 2 | AV-ACC |',
  '| 34,99         | 100 LPS - RETRO MUSIQUE            |      |        |       |',
].join('\n');

const src = { message_id: 'M', thread_id: 'M', subject: 'Invoice.pdf', from: null,
  date: '2026-09-10T12:00:00Z', body: '', attachments_text, source_kind: 'manual' };
const chunks = run(node('Chunk Source'), { $input: { all: () => [{ json: src }] } });

// the first pass reads the clean table and returns nothing for the mangled page
const cleanItems = [
  { artist_raw: 'ARTIST A', artist: 'ARTIST A', title: 'TITLE A', format: 'CD', unit: 1, ean: '0198029909012', rock_bottom: 9.99, label: 'I-DI MUSIC', calculation_group: '1', excluded: false },
  { artist_raw: 'ARTIST B', artist: 'ARTIST B', title: 'TITLE B', format: 'LP', unit: 1, ean: '0602557703887', rock_bottom: 12.99, label: 'I-DI MUSIC', calculation_group: '1', excluded: false },
];
const firstPass = chunks.map((c, i) => ({ output: JSON.stringify({ document_type: 'invoice', is_catalog_relevant: true,
  label: 'I-DI MUSIC', sender_recognized: true, items: i === 0 ? cleanItems : [] }) }));

const $chunks = name => name === 'Chunk Source'
  ? { all: () => chunks.map(j => ({ json: j })), itemMatching: i => ({ json: chunks[i] }), first: () => ({ json: chunks[0] }) }
  : { all: () => [] };

// ---------------------------------------------------------------- 1. what does it ask about?
const req = run(node('Find Dropped Barcodes'), { $: $chunks, $input: { all: () => firstPass.map(j => ({ json: j })) } })[0];

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (x !== undefined ? '\n          ' + String(x).replace(/\n/g, '\n          ') : '')); } };
console.log('\n' + file.replace(/.*\//, ''));

const asked = (req.targets || []).map(t => key(t.ean)).sort();
ok('it asks about exactly the barcodes the first pass did not return',
  JSON.stringify(asked) === JSON.stringify(['5056083208579', '5060572510005', '8032484011830'].sort()), JSON.stringify(asked));
ok('...and never about one the first pass DID return',
  !asked.includes(key('0198029909012')) && !asked.includes(key('0602557703887')));
ok('each target carries the line it must be read from',
  (req.targets || []).every(t => t.line && t.line.indexOf(t.ean) !== -1), JSON.stringify((req.targets || []).map(t => t.line)));
ok('the stranded release is asked about with its WHOLE record, not the fragment',
  /31St May/.test((req.targets.find(t => key(t.ean) === '5056083208579') || {}).line || ''),
  (req.targets.find(t => key(t.ean) === '5056083208579') || {}).line);
ok('the wrapped row is asked about with its wrapped tail',
  /RETRO MUSIQUE/.test((req.targets.find(t => key(t.ean) === '5060572510005') || {}).line || ''),
  (req.targets.find(t => key(t.ean) === '5060572510005') || {}).line);
ok('it carries the first pass output forward, so the merge always finds it',
  Array.isArray(req.ai) && req.ai.length === firstPass.length);

// a complete first pass asks for nothing at all — no AI call, no cost
const allItems = cleanItems.concat([
  { artist: 'YES', title: 'X', format: 'CD', unit: 1, ean: '5056083208579', rock_bottom: 9.99, label: 'I-DI MUSIC' },
  { artist: 'VARIOUS ARTISTS', title: 'Y', format: 'CD', unit: 1, ean: '8032484011830', rock_bottom: 2.99, label: 'I-DI MUSIC' },
  { artist: 'MUSIC PROTECTION', title: 'Z', format: 'CD', unit: 2, ean: '5060572510005', rock_bottom: 34.99, label: 'I-DI MUSIC' },
]);
const complete = chunks.map((c, i) => ({ output: JSON.stringify({ document_type: 'invoice', is_catalog_relevant: true, label: 'I-DI MUSIC', items: i === 0 ? allItems : [] }) }));
const reqNone = run(node('Find Dropped Barcodes'), { $: $chunks, $input: { all: () => complete.map(j => ({ json: j })) } })[0];
ok('a complete first pass triggers no recovery call at all', reqNone.needs_recovery === false && reqNone.count === 0);

// ---------------------------------------------------------------- 2. merging an answer back
const answer = items => [{ output: JSON.stringify({ items }) }];
const merge = (reqJson, aiOut) => run(node('Merge Recovered Items'), {
  $: name => name === 'Find Dropped Barcodes' ? { first: () => ({ json: reqJson }) } : $chunks(name),
  $input: { all: () => aiOut.map(j => ({ json: j })) },
});
const itemsOf = merged => merged.flatMap(m => {
  const o = m.output; const a = o.indexOf('{'), b = o.lastIndexOf('}');
  return JSON.parse(o.slice(a, b + 1)).items || [];
});

const GOOD = [
  { ean: '5056083208579', artist: 'YES', artist_raw: 'Yes', title: 'HANNS-MARTIN-SCHLEYER-HALLE STUTTGART', format: 'CD', unit: 1, rock_bottom: 9.99 },
  { ean: '8032484011830', artist: 'VARIOUS ARTISTS', artist_raw: 'VARIOUS ARTISTS', title: 'SUBURBIA COMPILATION - ESSENTIAL', format: 'CD', unit: 1, rock_bottom: 2.99 },
  { ean: '5060572510005', artist: 'MUSIC PROTECTION', artist_raw: 'MUSIC PROTECTION', title: 'KXRM25K WOODEN RECORD STORAGE CRATE ON WHEELS FOR 100 LPS - RETRO MUSIQUE', format: 'AV-ACC', unit: 2, rock_bottom: 34.99 },
];
const mergedGood = merge(req, answer(GOOD));
ok('the merge returns the same number of items it was given, so chunk pairing is unchanged',
  mergedGood.length === firstPass.length, mergedGood.length + ' vs ' + firstPass.length);
const gotEans = itemsOf(mergedGood).map(i => key(i.ean)).sort();
ok('all three recovered releases are folded into the first pass output',
  ['5056083208579', '5060572510005', '8032484011830'].every(e => gotEans.includes(e)), JSON.stringify(gotEans));
ok('...and the releases the first pass already had are still there', gotEans.length === 5, JSON.stringify(gotEans));
ok('...each marked recovered, with the line it was read from',
  itemsOf(mergedGood).filter(i => i.recovered).every(i => !!i.recovered_from) &&
  itemsOf(mergedGood).filter(i => i.recovered).length === 3);

// ---- the four things it may never do
const SNEAKY = GOOD.concat([{ ean: '9999999999999', artist: 'INVENTED', title: 'NOT IN THE DOCUMENT', format: 'CD', unit: 1, rock_bottom: 1 }]);
ok('an answer for a barcode nobody asked about is DISCARDED',
  !itemsOf(merge(req, answer(SNEAKY))).some(i => key(i.ean) === '9999999999999'),
  JSON.stringify(itemsOf(merge(req, answer(SNEAKY))).map(i => i.ean)));

const TYPO = [{ ean: '5056083208578', artist: 'YES', title: 'X', format: 'CD', unit: 1, rock_bottom: 9.99 }];
ok('a mistyped barcode does not become a catalog line',
  !itemsOf(merge(req, answer(TYPO))).some(i => key(i.ean) === '5056083208578'));

const NAMED = [{ ean: '05056083208579', artist: 'YES', title: 'X', format: 'CD', unit: 1, rock_bottom: 9.99 }];
const nm = itemsOf(merge(req, answer(NAMED))).find(i => i.recovered);
ok('the barcode written on the row is the DOCUMENT\'s, not the model\'s rendering of it',
  nm && nm.ean === '5056083208579', nm && nm.ean);

const EMPTY = [{ ean: '5056083208579', artist: null, title: '   ', format: 'CD', unit: 1 }];
ok('an answer with neither artist nor title is discarded, so the stub survives to explain itself',
  !itemsOf(merge(req, answer(EMPTY))).some(i => i.recovered));

// ---- and it can never cost the run its rows
const untouched = JSON.stringify(firstPass);
ok('a failed recovery call leaves the first pass output byte-identical',
  JSON.stringify(merge(req, [{ error: 'the model timed out' }])) === untouched);
ok('an empty answer leaves it byte-identical', JSON.stringify(merge(req, answer([]))) === untouched);
ok('garbage in the answer leaves it byte-identical', JSON.stringify(merge(req, [{ output: 'I could not read these lines.' }])) === untouched);
ok('the no-recovery-needed branch leaves it byte-identical',
  JSON.stringify(merge(reqNone, [{ json: reqNone }])) === JSON.stringify(complete));

// ---------------------------------------------------------------- 3. end to end through Build Catalog Rows
const nodeData = {
  Senders: [{ sender: 'Invoice.pdf', label: 'I-DI MUSIC', supplier_code: '41', active: true, label_raw: null }],
  MandatoryFields: ['ean', 'artist', 'title', 'format', 'release_date', 'label', 'rock_bottom'].map(f => ({ field_name: f })),
  'Catalog Lines (matching)': [], 'Blocked Emails': [],
};
const build = aiItems => run(node('Build Catalog Rows'), {
  $: name => name === 'Chunk Source' ? $chunks(name) : { all: () => (nodeData[name] || []).map(j => ({ json: j })) },
  $input: { all: () => aiItems.map(j => ({ json: j })) },
});

const withRecovery = build(mergedGood);
const withoutRecovery = build(firstPass);
const stubsWith = withRecovery.filter(r => r.extra && r.extra.stub);
const stubsWithout = withoutRecovery.filter(r => r.extra && r.extra.stub);
ok('WITHOUT recovery the three dropped barcodes come back as blank stubs', stubsWithout.length === 3, stubsWithout.length);
ok('WITH recovery they come back as filled rows instead', stubsWith.length === 0, JSON.stringify(stubsWith.map(s => s.ean)));
ok('...and every printed barcode still has exactly one row',
  new Set(withRecovery.filter(r => r.ean).map(r => key(r.ean))).size === 5 && withRecovery.length === 5,
  withRecovery.length + ' rows / ' + new Set(withRecovery.map(r => key(r.ean))).size + ' eans');

const yes = withRecovery.find(r => key(r.ean) === '5056083208579') || {};
ok('a recovered row carries real data, not a placeholder',
  yes.artist === 'YES' && !!yes.title && yes.format === 'CD', JSON.stringify({ a: yes.artist, t: yes.title, f: yes.format }));
ok('...is flagged for review', ((yes.extra || {}).needs_review) === true);
ok('...says it was RECOVERED', /RECOVERED/.test(String((yes.extra || {}).review_note || '')), (yes.extra || {}).review_note);
ok('...and quotes the line it was read from, so no one reopens the PDF',
  /Source line: /.test(String((yes.extra || {}).review_note || '')), (yes.extra || {}).review_note);
ok('...and is never silently sent: status stays in_progress', yes.status === 'in_progress');
ok('the completeness gate no longer reports the recovered barcodes as missing',
  !withRecovery.some(r => /came back from the AI as nothing at all/.test(String(((r.extra || {}).review_note) || ''))),
  withRecovery.map(r => (r.extra || {}).review_note).find(n => /nothing at all/.test(String(n))));

console.log('  ' + '-'.repeat(60));
console.log('  %d passed, %d failed', pass, fail);
if (fail) process.exit(1);
