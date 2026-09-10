// THE CORPUS: every real document we have, against every way the AI can fail, checked against
// invariants that must hold for ALL of them.
//
// Run from the repo root:  node n8n/tests/corpus.js n8n/manual-import.v61.json
//
// WHY THIS FILE EXISTS. From v54 to v61 every fix was found by the client, in production, one
// document at a time: an IBAN counted as a barcode, a barcode stranded in prose, a table whose
// columns the parser lost, a release returned as a page header, a no-op that read as a loss, an
// item pairing broken by new nodes. Every one of those was a correct fix and every one of them
// arrived after a real order had already been mis-read. The fault was never really the document.
// It was that the tests answered "does this document work now" instead of "what must be true of
// EVERY document, however the AI behaves".
//
// So: three real documents — the two that broke things and the one that exposed the pairing —
// crossed with seven AI behaviours, from perfect to returning nothing at all. Every combination
// must satisfy every invariant below. A change that fixes the document in front of you and
// breaks one of these has not fixed anything.
//
// The invariants are deliberately about SAFETY, not quality. Nobody can promise a language model
// reads every mangled table correctly. What can be promised, and is checked here, is that a
// release is never lost without being named, never invented, never duplicated, and never filed
// under the wrong document.
const fs = require('fs'), vm = require('vm');
const P = 'C:/Users/User/Desktop/nika-platform/';
const file = process.argv[2] || 'n8n/manual-import.v61.json';
const wf = JSON.parse(fs.readFileSync(P + file, 'utf8'));
const node = n => (((wf.nodes.find(x => x.name === n) || {}).parameters) || {}).jsCode;
const G = { console, String, Number, Array, Object, Set, Map, RegExp, JSON, Math, Date, parseInt, parseFloat, isNaN };
const run = (code, extra) => vm.runInNewContext('(function(){' + code + '})()', Object.assign({}, G, extra)).map(x => x.json);
const BARCODE_G = /(?<![0-9A-Za-z])\d{12,14}(?![0-9])/g;
const key = v => String(v == null ? '' : v).replace(/\D/g, '').replace(/^0+/, '');
const read = f => fs.readFileSync(P + 'n8n/tests/corpus/' + f, 'utf8');

// ---------------------------------------------------------------- the documents
const DOCS = [
  { name: 'I-DI invoice (clean page + a page the parser mangled)', att: read('idi-invoice.txt'), body: '',
    label: 'I-DI MUSIC', supplier: '41' },
  { name: 'Croatia 648 (one clean table, splits in two)', att: read('croatia-648.txt'), body: '',
    label: 'CROATIA RECORDS', supplier: '6' },
  { name: 'Croatia 648+649 (TWO attachments, IBAN footers)', att: read('croatia-648-649.email.txt'),
    body: read('croatia-648-649.body.txt'), label: 'CROATIA RECORDS', supplier: '6' },
];

// ---------------------------------------------------------------- the ways an AI can fail
// Each takes the barcodes a part prints and returns the ones it chooses to report.
const BEHAVIOURS = [
  { name: 'returns everything', pick: b => b },
  { name: 'returns nothing for the LAST part', pick: (b, i, n) => (i === n - 1 ? [] : b) },
  { name: 'returns nothing at all', pick: () => [] },
  { name: 'drops every third release', pick: b => b.filter((x, j) => j % 3 !== 2) },
  { name: 'returns the first release of each part TWICE', pick: b => (b.length ? [b[0]].concat(b) : b) },
  { name: 'returns one release with no barcode', pick: b => b, blank: true },
  { name: 'returns unreadable output for the last part', pick: b => b, garbage: true },
  // The one that would be worst of all: a barcode the document does not contain. An invented
  // release looks exactly like a real one, gets approved, and sends cleanly to Hermes.
  { name: 'INVENTS a release that is not in the document', pick: b => b, invent: true },
];

let pass = 0, fail = 0;
const failures = [];
const ok = (doc, beh, name, cond, detail) => {
  if (cond) { pass++; return; }
  fail++;
  failures.push('  ' + doc + '\n    behaviour: ' + beh + '\n    BROKEN: ' + name + (detail !== undefined ? '\n    ' + String(detail).replace(/\n/g, '\n    ').slice(0, 400) : ''));
};

function chunkOf(doc) {
  const src = { message_id: 'M', thread_id: 'T', subject: 'doc.pdf', from: null,
    date: '2026-09-10T12:00:00Z', body: doc.body, attachments_text: doc.att, source_kind: 'manual' };
  return run(node('Chunk Source'), { $input: { all: () => [{ json: src }] } });
}

function aiFor(doc, chunks, beh) {
  // what each part prints, minus anything an earlier part already claimed (the repeated header)
  const claimed = {};
  return chunks.map((c, i) => {
    const own = [];
    for (const raw of (String(c.attachments_text || '') + '\n' + String(c.body || '')).match(BARCODE_G) || []) {
      const k = key(raw);
      if (k && !claimed[k]) { claimed[k] = true; own.push(raw); }
    }
    if (beh.garbage && i === chunks.length - 1) return { output: 'I was not able to read this part.' };
    let picked = beh.pick(own, i, chunks.length);
    if (beh.invent && i === 0) picked = picked.concat(['9911223344556']);
    const items = picked.map((raw, j) => ({
      artist_raw: 'ARTIST ' + key(raw).slice(-4), artist: 'ARTIST ' + key(raw).slice(-4),
      title: 'TITLE ' + key(raw).slice(-4), format: 'LP', unit: 1,
      ean: (beh.blank && i === 0 && j === 0) ? null : raw,
      cop: 18, label: doc.label, calculation_group: '1', excluded: false,
    }));
    return { output: JSON.stringify({ document_type: 'invoice', is_catalog_relevant: true, label: doc.label, sender_recognized: true, items }) };
  });
}

function build(doc, chunks, ai, pairingWorks) {
  const nd = {
    Senders: [{ sender: 'doc.pdf', label: doc.label, supplier_code: doc.supplier, active: true, label_raw: null }],
    MandatoryFields: ['ean', 'artist', 'title', 'format', 'release_date', 'label', 'rock_bottom'].map(f => ({ field_name: f })),
    'Catalog Lines (matching)': [], 'Blocked Emails': [],
  };
  const $ = name => name === 'Chunk Source'
    ? { all: () => chunks.map(j => ({ json: j })), first: () => ({ json: chunks[0] }),
        itemMatching: i => { if (!pairingWorks) throw new Error('cannot determine which item to use'); return { json: chunks[i] }; } }
    : { all: () => (nd[name] || []).map(j => ({ json: j })) };
  let feed = ai;
  if (node('Find Dropped Barcodes')) {
    const req = run(node('Find Dropped Barcodes'), { $, $input: { all: () => ai.map(j => ({ json: j })) } })[0];
    feed = run(node('Merge Recovered Items'), {
      $: n => (n === 'Find Dropped Barcodes' ? { first: () => ({ json: req }) } : $(n)),
      $input: { all: () => [{ json: req }] } });
  }
  return run(node('Build Catalog Rows'), { $, $input: { all: () => feed.map(j => ({ json: j })) } });
}

console.log('\n' + file.replace(/.*\//, ''));
console.log('  ' + 'document'.padEnd(52) + 'behaviour'.padEnd(40) + 'printed  rows');

for (const doc of DOCS) {
  const chunks = chunkOf(doc);
  const printed = {};
  for (const raw of (doc.att + '\n' + doc.body).match(BARCODE_G) || []) { const k = key(raw); if (k) printed[k] = raw; }
  const N = Object.keys(printed).length;

  // ---- an invariant about the CHUNKER itself, independent of the AI
  const told = chunks.reduce((a, c) => a + (c.chunk_rows || 0), 0);
  const saysExactly = chunks.some(c => /exactly/i.test(c.chunk_note || ''));
  ok(doc.name, '(chunker)', 'the announced total exceeds what the document prints — that orders invention',
    told <= N, 'announced ' + told + ' > printed ' + N);
  ok(doc.name, '(chunker)', 'announced EXACTLY while the count is wrong — that orders a drop',
    !(saysExactly && told !== N), 'announced ' + told + ' EXACTLY, document prints ' + N);
  const named = {};
  for (const c of chunks) {
    const m = String(c.chunk_note || '').match(/identifiers printed in this part are: ([^.]*)\./);
    for (const x of (m ? m[1].split(',') : [])) { const k = key(x); if (k) named[k] = (named[k] || 0) + 1; }
  }
  for (const k in printed) {
    ok(doc.name, '(chunker)', 'barcode ' + printed[k] + ' is printed but named in no part', (named[k] || 0) >= 1);
    ok(doc.name, '(chunker)', 'barcode ' + printed[k] + ' is named in ' + named[k] + ' parts — orders it back twice', (named[k] || 0) <= 1);
  }

  for (const beh of BEHAVIOURS) {
    const ai = aiFor(doc, chunks, beh);
    const returned = {};
    for (const j of ai) { try { const o = JSON.parse(j.output); for (const it of o.items || []) { const k = key(it.ean); if (k) returned[k] = true; } } catch (e) {} }
    const out = build(doc, chunks, ai, true);
    console.log('  ' + doc.name.slice(0, 50).padEnd(52) + beh.name.padEnd(40) + String(N).padStart(5) + String(out.length).padStart(7));

    // 1. NOTHING INVENTED — every barcode on a row is printed in the document
    const strays = out.filter(r => r.ean && !printed[key(r.ean)]).map(r => r.ean);
    ok(doc.name, beh.name, 'a row carries a barcode the document never printed', strays.length === 0, JSON.stringify(strays));

    // 2. NOTHING DUPLICATED — no barcode gets two new lines
    const seen = {}, dupes = [];
    for (const r of out) { if (r.action !== 'create' || !r.ean) continue; const k = key(r.ean); if (seen[k]) dupes.push(r.ean); seen[k] = true; }
    ok(doc.name, beh.name, 'the same barcode was created twice', dupes.length === 0, JSON.stringify(dupes));

    // 3. NOTHING LOST WITHOUT BEING NAMED — a printed barcode either has a row, or a note says why
    const notes = out.map(r => String(((r.extra || {}).review_note) || '')).join('\n');
    const silent = [];
    for (const k in printed) {
      if (seen[k] || out.some(r => r.ean && key(r.ean) === k)) continue;
      if (notes.indexOf(printed[k]) !== -1 || notes.indexOf(k) !== -1) continue;
      silent.push(printed[k]);
    }
    ok(doc.name, beh.name, silent.length + ' printed barcode(s) have no row and are named nowhere',
      silent.length === 0, JSON.stringify(silent.slice(0, 8)));

    // 4. THE RIGHT DOCUMENT — every row records the source it was read from
    const wrongSrc = out.filter(r => r.extra && r.extra.source_message_id && r.extra.source_message_id !== 'M');
    ok(doc.name, beh.name, 'a row records a source that is not this document', wrongSrc.length === 0, wrongSrc.length);

    // 5. NO FALSE ALARM — when the AI returned every printed barcode, nothing may be reported missing
    const complete = Object.keys(printed).every(k => returned[k]);
    if (complete) {
      const alarm = out.map(r => String(((r.extra || {}).review_note) || '')).find(n => /INCOMPLETE EXTRACTION|POSSIBLE MISSING RELEASE/.test(n));
      ok(doc.name, beh.name, 'a complete run is reported as incomplete', !alarm, alarm);
    }

    // 6. NOTHING REACHES HERMES UNSEEN — every row a human must check is in_progress
    const sent = out.filter(r => r.action === 'create' && r.status && r.status !== 'in_progress');
    ok(doc.name, beh.name, 'a new row was created with a status other than in_progress', sent.length === 0, JSON.stringify(sent.map(r => r.status)));

    // 7. PAIRING-PROOF — the same run with a pairing n8n cannot trace must give the same answer
    const blind = build(doc, chunks, ai, false);
    ok(doc.name, beh.name, 'the output changes when n8n cannot trace the item pairing',
      JSON.stringify(blind) === JSON.stringify(out),
      'rows ' + out.length + ' vs ' + blind.length);
  }
}

console.log('  ' + '-'.repeat(100));
if (failures.length) {
  console.log('\n' + failures.join('\n\n'));
  console.log('\n  %d checks passed, %d FAILED', pass, fail);
  process.exit(1);
}
console.log('  %d checks passed across %d documents x %d AI behaviours — every invariant holds', pass, DOCS.length, BEHAVIOURS.length);
