// v61: EVERY AI ITEM MUST FIND ITS OWN SOURCE, even when n8n cannot trace the pairing.
//
// Run from the repo root:  node n8n/tests/item-pairing.js n8n/manual-import.v61.json
//
// Build Catalog Rows needs to know which Chunk Source part each AI item came from — that part's
// message_id, subject, thread, supplier and announced row count. It used to ask n8n
// (`$('Chunk Source').itemMatching(i)`), which can only answer while it can trace the item back
// through every node in between. v60 inserted a node that collapses N items into ONE and another
// that expands one back into N, so n8n stopped answering and the old fallback handed EVERY item
// the FIRST part's source.
//
// On NIKA OTPR 648 — one clean table, 21 rows, split 12 + 9 — that announced 12 + 12 = 24 and
// warned on every row about three releases that were never missing (client, 2026-09-10). That is
// the visible damage. The dangerous damage is silent: in a mail carrying several attachments,
// every row would be filed under the FIRST attachment's supplier code and thread, which is
// exactly the mis-attribution v26 and v36 exist to prevent, and a wrong supplier code sends
// cleanly to Hermes where a missing one would have been caught.
//
// So this file runs the whole chain twice: once with a working itemMatching and once with one
// that throws. Both must give the same, correct answer.
const fs = require('fs'), vm = require('vm');
const P = 'C:/Users/User/Desktop/nika-platform/';
const file = process.argv[2] || 'n8n/manual-import.v61.json';
const wf = JSON.parse(fs.readFileSync(P + file, 'utf8'));
const node = n => (((wf.nodes.find(x => x.name === n) || {}).parameters) || {}).jsCode;
const G = { console, String, Number, Array, Object, Set, Map, RegExp, JSON, Math, Date, parseInt, parseFloat, isNaN };
const run = (c, e) => vm.runInNewContext('(function(){' + c + '})()', Object.assign({}, G, e)).map(x => x.json);

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (x !== undefined ? '\n          ' + String(x).replace(/\n/g, '\n          ') : '')); } };
console.log('\n' + file.replace(/.*\//, ''));

// ---------------------------------------------------------------- a 21-row consignment note
const ROWS = [];
for (let i = 1; i <= 21; i++) ROWS.push({ n: String(i), ean: '385012610' + String(1000 + i), name: 'ARTIST ' + i + ' - TITLE ' + i + ' (LP)' });
const attachments_text = [
  'Izdatnica na komisi u bro : 648', 'Datum: 7.09.2026', '', 'NIKA D.O.O.', '',
  '| R. | Bar kod | Naziv artikla | J.m. | Kolicina | PDV % | Ci ena | Iznos |',
  '| -- | ------- | ------------- | ---- | -------- | ----- | ------ | ----- |',
].concat(ROWS.map(r => '| ' + r.n + ' | ' + r.ean + ' | ' + r.name + ' | kom | 5,00 | 25 | 18,00 | 90,00 |'))
  .concat(['', 'Ukupno pri e poreza: 127,00', '', 'Zagrebacka banka d.d. Zagreb IBAN: HR8223600001101213510 *']).join('\n');

const src = { message_id: 'M', thread_id: 'M', subject: 'NIKA OTPR 648.pdf', from: null,
  date: '2026-09-10T16:24:13Z', body: '', attachments_text, source_kind: 'manual' };
const chunks = run(node('Chunk Source'), { $input: { all: () => [{ json: src }] } });
ok('the document splits into more than one part', chunks.length > 1, chunks.length);
ok('...and the parts add up to the 21 rows it holds',
  chunks.reduce((a, c) => a + c.chunk_rows, 0) === 21, chunks.map(c => c.chunk_rows).join(' + '));
ok('...with DIFFERENT row counts, so a mis-pairing cannot hide',
  new Set(chunks.map(c => c.chunk_rows)).size > 1, chunks.map(c => c.chunk_rows).join(' + '));

const mk = r => ({ artist_raw: r.name.split(' - ')[0], artist: r.name.split(' - ')[0],
  title: r.name.split(' - ')[1].replace(' (LP)', ''), format: 'LP', unit: 1, ean: r.ean,
  cop: 18, label: 'CROATIA RECORDS', calculation_group: '1', excluded: false });
let at = 0;
const ai = chunks.map(c => { const g = ROWS.slice(at, at + c.chunk_rows); at += c.chunk_rows;
  return { output: JSON.stringify({ document_type: 'invoice', is_catalog_relevant: true, label: 'CROATIA RECORDS', sender_recognized: true, items: g.map(mk) }) }; });

const nd = {
  Senders: [{ sender: 'NIKA OTPR 648.pdf', label: 'CROATIA RECORDS', supplier_code: '6', active: true, label_raw: null }],
  MandatoryFields: ['ean', 'artist', 'title', 'format', 'release_date', 'label', 'rock_bottom'].map(f => ({ field_name: f })),
  'Catalog Lines (matching)': [], 'Blocked Emails': [],
};
const mkDollar = works => name => name === 'Chunk Source'
  ? { all: () => chunks.map(j => ({ json: j })), first: () => ({ json: chunks[0] }),
      itemMatching: i => { if (!works) throw new Error('cannot determine which item to use'); return { json: chunks[i] }; } }
  : { all: () => (nd[name] || []).map(j => ({ json: j })) };

function endToEnd(works) {
  const req = run(node('Find Dropped Barcodes'), { $: mkDollar(works), $input: { all: () => ai.map(j => ({ json: j })) } })[0];
  const feed = run(node('Merge Recovered Items'), {
    $: n => (n === 'Find Dropped Barcodes' ? { first: () => ({ json: req }) } : mkDollar(works)(n)),
    $input: { all: () => [{ json: req }] } });
  const out = run(node('Build Catalog Rows'), { $: mkDollar(works), $input: { all: () => feed.map(j => ({ json: j })) } });
  return { req, feed, out };
}

// ---------------------------------------------------------------- the pairing is carried, not traced
const whole = endToEnd(true);
ok('the pairing is resolved and shipped with the request',
  Array.isArray(whole.req.srcKeys) && whole.req.srcKeys.length === ai.length, JSON.stringify(whole.req.srcKeys));
ok('...one key per part, all different',
  new Set(whole.req.srcKeys || []).size === chunks.length, JSON.stringify(whole.req.srcKeys));
ok('every item the merge emits carries its own key',
  whole.feed.length === ai.length && whole.feed.every((j, i) => !!j._chunk_key && j._chunk_key === (whole.req.srcKeys || [])[i]),
  JSON.stringify(whole.feed.map(j => j._chunk_key)));

// ---------------------------------------------------------------- and the answer does not change
const broken = endToEnd(false);
const shortfall = o => (o.map(r => String(((r.extra || {}).review_note) || '')).find(n => /POSSIBLE MISSING RELEASE/.test(n)) || '');
for (const [label, r] of [['n8n can trace the pairing', whole], ['n8n CANNOT trace the pairing', broken]]) {
  ok(label + ': every row is produced (21)', r.out.length === 21, r.out.length);
  ok(label + ': no release is reported missing', shortfall(r.out) === '', shortfall(r.out));
  ok(label + ': no row is flagged for review', r.out.every(x => ((x.extra || {}).needs_review) !== true),
    r.out.map(x => (x.extra || {}).review_note).find(Boolean));
}
ok('the two runs agree row for row',
  JSON.stringify(whole.out) === JSON.stringify(broken.out),
  'first difference at row ' + whole.out.findIndex((x, i) => JSON.stringify(x) !== JSON.stringify(broken.out[i])));

// ---------------------------------------------------------------- and each item keeps its OWN source
// The real danger is a mail carrying two attachments: every row filed under the first one's
// supplier and thread. Two sources, two different suppliers — each row must keep its own.
const srcA = Object.assign({}, src, { message_id: 'A', thread_id: 'A', subject: 'A.pdf' });
const srcB = Object.assign({}, src, { message_id: 'B', thread_id: 'B', subject: 'B.pdf',
  attachments_text: attachments_text.replace(/385012610/g, '509912610') });
const cA = run(node('Chunk Source'), { $input: { all: () => [{ json: srcA }] } });
const cB = run(node('Chunk Source'), { $input: { all: () => [{ json: srcB }] } });
const both = cA.concat(cB);
let bt = 0;
const aiBoth = both.map(c => {
  const src2 = c.message_id === 'A' ? ROWS : ROWS.map(r => ({ n: r.n, ean: r.ean.replace(/^385012610/, '509912610'), name: r.name }));
  if (c.chunk_index === 1) bt = 0;
  const g = src2.slice(bt, bt + c.chunk_rows); bt += c.chunk_rows;
  return { output: JSON.stringify({ document_type: 'invoice', is_catalog_relevant: true, label: 'CROATIA RECORDS', sender_recognized: true, items: g.map(mk) }) };
});
const nd2 = Object.assign({}, nd, { Senders: [
  { sender: 'A.pdf', label: 'LABEL A', supplier_code: '11', active: true, label_raw: null },
  { sender: 'B.pdf', label: 'LABEL B', supplier_code: '22', active: true, label_raw: null }] });
const dollar2 = works => name => name === 'Chunk Source'
  ? { all: () => both.map(j => ({ json: j })), first: () => ({ json: both[0] }),
      itemMatching: i => { if (!works) throw new Error('cannot determine which item to use'); return { json: both[i] }; } }
  : { all: () => (nd2[name] || []).map(j => ({ json: j })) };
const req2 = run(node('Find Dropped Barcodes'), { $: dollar2(false), $input: { all: () => aiBoth.map(j => ({ json: j })) } })[0];
const feed2 = run(node('Merge Recovered Items'), {
  $: n => (n === 'Find Dropped Barcodes' ? { first: () => ({ json: req2 }) } : dollar2(false)(n)),
  $input: { all: () => [{ json: req2 }] } });
const out2 = run(node('Build Catalog Rows'), { $: dollar2(false), $input: { all: () => feed2.map(j => ({ json: j })) } });
const threads = {};
for (const r of out2) if (r.ean) threads[String(r.ean).slice(0, 9)] = r.thread_id;
ok('two attachments, pairing broken: rows keep their OWN document',
  threads['385012610'] === 'A' && threads['509912610'] === 'B', JSON.stringify(threads));
// source_message_id is copied straight off the paired source, so it is the sharpest test of
// whether each row found its own document or borrowed the first one's.
const mids = {};
for (const r of out2) if (r.ean) mids[String(r.ean).slice(0, 9)] = ((r.extra || {}).source_message_id) || null;
ok('...and record the document they were actually read from',
  mids['385012610'] === 'A' && mids['509912610'] === 'B', JSON.stringify(mids));
// and the completeness gate counts each document separately: 21 printed, 21 produced, each side
ok('...so neither document is reported incomplete',
  !out2.some(r => /INCOMPLETE EXTRACTION|POSSIBLE MISSING RELEASE/.test(String(((r.extra || {}).review_note) || ''))),
  out2.map(r => (r.extra || {}).review_note).find(Boolean));
ok('...and both documents produce all their rows (42)', out2.length === 42, out2.length);

console.log('  ' + '-'.repeat(60));
console.log('  %d passed, %d failed', pass, fail);
if (fail) process.exit(1);
