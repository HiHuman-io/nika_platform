// v64: the two rules the Menart invoice produced, each held down by a test.
//
// Run from the repo root:  node n8n/tests/v64-rules.js n8n/manual-import.v64.json
//
// "Racun-otpremnica br. 180/PJ1/12" (client, 2026-09-11) lists THREE titles, six pieces,
// 71,10 EUR. v63 produced FOUR catalog rows and told the reviewer, on every one of them, that
// the document held "at least 9 releases". The model was not at fault: the first pass returned
// exactly the invoice's three lines. Two independent defects did it.
//
//   THE COUNT. Every invoice line occupies two table rows — the product, then a continuation
//   carrying only the supplier's article code and the medium. v49's guard against phantom rows
//   needs a row to fill two columns; this one fills exactly two.
//
//   THE FOURTH ROW. The mail is a forward, and a forward is deliberately never stripped. But a
//   forward carries ONE message, and inside this one sat Nika's OWN order of 8 September,
//   quoted back. Menart supplied three of the four titles it asked for; the recovery pass read
//   the fourth barcode as "printed but returned by nobody" and manufactured a row for stock
//   that was never sent.
const fs = require('fs'), vm = require('vm');
const P = 'C:/Users/User/Desktop/nika-platform/';
const file = process.argv[2] || 'n8n/manual-import.v64.json';
const wf = JSON.parse(fs.readFileSync(P + file, 'utf8'));
const node = n => (((wf.nodes.find(x => x.name === n) || {}).parameters) || {}).jsCode;
const G = { console, String, Number, Array, Object, Set, Map, RegExp, JSON, Math, Date, parseInt, parseFloat, isNaN };
const run = (c, e) => vm.runInNewContext('(function(){' + c + '})()', Object.assign({}, G, e)).map(x => x.json);
const read = f => fs.readFileSync(P + 'n8n/tests/corpus/' + f, 'utf8').replace(/\r\n/g, '\n');

let pass = 0, fail = 0;
const ok = (n, c, x) => {
  if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (x !== undefined ? '\n          ' + String(x).replace(/\n/g, '\n          ').slice(0, 400) : '')); }
};
console.log('\n' + file.replace(/.*\//, ''));

const ATT = read('menart-invoice.txt');
const BODY = read('menart-invoice.body.txt').trim();
const SENDERS = [{ sender: 'marko.stopar@nika.si', label: 'MATRIX MUSIC', supplier_code: '54', active: true, label_raw: null }];
const MANDATORY = ['ean', 'artist', 'title', 'format', 'release_date', 'label', 'rock_bottom'].map(f => ({ field_name: f }));

function chunk(src) {
  return run(node('Chunk Source'), { $input: { all: () => [{ json: Object.assign({
    from: 'marko.stopar@nika.si', subject: 'Fwd: NIKA narudzba i pitanje',
    date: '2026-09-11T09:14:15.000Z', thread_id: 'T', message_id: 'T',
    source_kind: 'email', quote_strip: 'forward', body: '', attachments_text: '',
  }, src) }] } });
}
function pipeline(src, items, opts) {
  opts = opts || {};
  const chunks = chunk(src);
  const answer = { document_type: 'invoice', is_catalog_relevant: true, label: 'MATRIX MUSIC',
    sender_recognized: true, needs_review: false, review_reasons: [], items: items };
  const ai = [{ output: JSON.stringify(answer), _chunk_key: 'T#1' }];
  const tables = { Senders: SENDERS, MandatoryFields: MANDATORY, Glossary: [], Exclusions: [],
    LabelNotes: [], 'Catalog Lines (matching)': [], 'Blocked Emails': [] };
  const $ = name => name === 'Chunk Source'
    ? { all: () => chunks.map(j => ({ json: j })), first: () => ({ json: chunks[0] }), itemMatching: i => ({ json: chunks[i] }) }
    : { all: () => (tables[name] || []).map(j => ({ json: j })) };
  const req = run(node('Find Dropped Barcodes'), { $: $, $input: { all: () => ai.map(j => ({ json: j })) } })[0];
  const rows = run(node('Build Catalog Rows'), { $: $, $input: { all: () => ai.map(j => ({ json: j })) } });
  return { chunks, req, rows };
}
const item = o => Object.assign({
  artist_raw: 'Dubioza kolektiv', artist: 'DUBIOZA KOLEKTIV', artist_kind: 'group',
  features: [], label: 'MATRIX MUSIC', format: 'LP', genre: 'Pop', unit: 1,
  release_date: null, price: null, currency: null, cop: 11.85, ppd_eur: null, rock_bottom: null,
  calculation_group: '1', excluded: false, exclusion_reason: null, missing_mandatory: [], item_confidence: 0.95,
}, o);
const THREE = [
  item({ title: 'FIRMA ILEGAL', features: ['YELLOW VINYL'], ean: '3856010933619', catalogue_no: 'M1385601093361' }),
  item({ title: 'APSURDISTAN', features: ['RED CLEAR VINYL'], ean: '3856010933916', catalogue_no: 'M1385601093391' }),
  item({ title: 'PJESMICE ZA DJECU I ODRASLE', features: ['ORANGE VINYL'], ean: '3856010934111', catalogue_no: 'M1385601093411' }),
];
const noteOf = r => String((r.notes || '') + ' ' + (((r.extra || {}).review_note) || ''));

// ------------------------------------------------- 1. the real document, end to end
{
  const { chunks, req, rows } = pipeline({ body: BODY, attachments_text: ATT }, THREE);
  ok('the invoice is counted as the 3 lines it has', chunks[0].chunk_rows === 3, chunks[0].chunk_rows);
  ok('...and EXACTLY, because its table is clean', /exactly 3 product rows/.test(String(chunks[0].chunk_note)), String(chunks[0].chunk_note).slice(0, 120));
  ok('...naming only the 3 barcodes the invoice prints',
    !/3856010934319/.test(String(chunks[0].chunk_note)), String(chunks[0].chunk_note).match(/identifiers[^.]*\./));
  ok('nothing is left for the recovery pass to find', req.needs_recovery === false && req.count === 0, JSON.stringify(req.targets || []));
  ok('three rows, one per invoice line', rows.length === 3, rows.length + ': ' + rows.map(r => r.ean).join(', '));
  ok('the title Menart did NOT supply gets no row',
    !rows.some(r => String(r.ean) === '3856010934319'), rows.map(r => r.ean).join(', '));
  ok('and not one review note on a run that is correct',
    rows.every(r => noteOf(r).trim() === ''), rows.map(noteOf).find(x => x.trim()));
}

// ------------------------------------------------- 2. the model still reads the quoted order
{
  const c = chunk({ body: BODY, attachments_text: ATT })[0];
  ok('the quoted order still reaches the model', c.body.indexOf('3856010934319') !== -1);
  ok('...behind a marker that says what it is', /AN EARLIER MESSAGE, QUOTED INSIDE THIS FORWARD/.test(c.body));
  ok('body_own holds the document\'s own text only', String(c.body_own).indexOf('3856010934319') === -1);
  ok('body_full still records everything that arrived', String(c.body_full).indexOf('3856010934319') !== -1);
  ok('body_quoted carries the demoted text to the row builder', String(c.body_quoted).indexOf('3856010934319') !== -1);
}

// ------------------------------------------------- 3. if the model returns it anyway, say so
{
  const extra = THREE.concat([item({ title: 'AGRIKULTURA', features: ['GOLD VINYL'], ean: '3856010934319' })]);
  const { rows } = pipeline({ body: BODY, attachments_text: ATT }, extra);
  const r = rows.find(x => String(x.ean) === '3856010934319');
  ok('a release the model reads out of the quoted order is NOT dropped', !!r, rows.map(x => x.ean).join(', '));
  ok('...its barcode is not refused', r && String(r.ean) === '3856010934319', r && r.ean);
  ok('...and the row says it is not from this document',
    r && /FROM AN EARLIER MESSAGE, NOT FROM THIS DOCUMENT/.test(noteOf(r)), r && noteOf(r).slice(0, 200));
  ok('...and is flagged for review', r && ((r.extra || {}).needs_review) === true, r && JSON.stringify(r.extra));
  ok('the three real lines stay clean', rows.filter(x => String(x.ean) !== '3856010934319').every(x => noteOf(x).trim() === ''),
    rows.filter(x => String(x.ean) !== '3856010934319').map(noteOf).find(y => y.trim()));
}

// ------------------------------------------------- 4. the guard: a body-only mail is untouched
{
  // the same quoted order, but no attachment at all — the body may be the only place the
  // releases are, so nothing may be demoted and every barcode must still be policed.
  const { chunks, req } = pipeline({ body: BODY, attachments_text: '' }, []);
  ok('with no attachment, nothing is demoted', String(chunks[0].body_own).indexOf('3856010934319') !== -1,
    'body_own: ' + String(chunks[0].body_own).length + ' chars');
  ok('...and every barcode in it is still policed', (req.targets || []).some(t => t.ean === '3856010934319'),
    JSON.stringify((req.targets || []).map(t => t.ean)));
  ok('...all four of them', (req.targets || []).length === 4, (req.targets || []).length);
}
{
  // an attachment that prints no barcode cannot make the body stop being the source either
  const c = chunk({ body: BODY, attachments_text: '## Attachment: note.pdf\n\nThanks, see you next week.' })[0];
  ok('an attachment with no barcode demotes nothing', String(c.body_own).indexOf('3856010934319') !== -1);
}
{
  // not a forward at all: "Latest Message Only" already cut the history, so nothing here may
  const plain = BODY.replace(/---------- Forwarded message ---------/, 'Here is the order we placed:');
  const c = chunk({ body: plain, attachments_text: ATT })[0];
  ok('a message that is not a forward is left alone', String(c.body_own).indexOf('3856010934319') !== -1);
}

// ------------------------------------------------- 5. the continuation predicate
{
  const code = node('Chunk Source');
  const f = new Function(code.slice(0, code.indexOf('function splitTableSeg')) + '\nreturn { continuesRow, cellsOf };')();
  const cases = [
    [true, 'the Menart continuation: an article code and a medium',
      '|                                                                      | M1385601093361 | LP        |       |      |            |            |           |'],
    [false, 'a real release whose EAN cell is blank (the v49 shape)', '|  | ARTIST B | TITLE B | CD |'],
    [false, 'a real release whose EAN cell is blank, with a price', '| ARTIST B | TITLE B |  | 8,90 |'],
    [false, 'any row carrying a standalone barcode', '|  | 3856010933619 | LP |'],
    [false, 'a second format line that prints its own price', '|  | ZEN328 | LP | 123,56 |'],
    [false, 'a row that names a title', '|  | SOME TITLE HERE | LP |'],
    [true, 'an empty row', '|  |  |  |'],
  ];
  for (const [want, why, line] of cases) {
    ok((want ? 'continuation: ' : 'a row: ') + why, f.continuesRow(line) === want,
      'continuesRow=' + f.continuesRow(line) + ' cells=' + JSON.stringify(f.cellsOf(line).filter(c => c !== '')));
  }
}

// ------------------------------------------------- 6. the invoice table alone, counted right
{
  const c = chunk({ body: '', attachments_text: ATT })[0];
  ok('three invoice lines, not six', c.chunk_rows === 3, c.chunk_rows);
}

console.log('  ' + '-'.repeat(60));
console.log('  %d passed, %d failed', pass, fail);
if (fail) process.exit(1);
