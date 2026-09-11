// v63: the six rules the 11.09 PIAS run produced, each one held down by a test.
//
// Run from the repo root:  node n8n/tests/v63-rules.js n8n/manual-import.v63.json
//
// That run lost nothing — 33 printed barcodes, 33 rows — so not one of these would have been caught
// by a barcode-level invariant, and three of them could not be. They are the defects BELOW the
// "nothing is lost" line: a double LP stored as a single, the same release written three times, a
// wrong release date written over a right one, two sellable CDs marked excluded, a note that grows
// a copy of itself on every re-circulation, and a whole part of a document that vanished in
// silence. Every assertion below fails on v62 or is new behaviour v62 has no answer for.
const fs = require('fs'), vm = require('vm');
const P = 'C:/Users/User/Desktop/nika-platform/';
const file = process.argv[2] || 'n8n/manual-import.v63.json';
const wf = JSON.parse(fs.readFileSync(P + file, 'utf8'));
const node = n => (((wf.nodes.find(x => x.name === n) || {}).parameters) || {}).jsCode;
const G = { console, String, Number, Array, Object, Set, Map, RegExp, JSON, Math, Date, parseInt, parseFloat, isNaN };
const run = (c, e) => vm.runInNewContext('(function(){' + c + '})()', Object.assign({}, G, e)).map(x => x.json);

let pass = 0, fail = 0;
const ok = (n, c, x) => {
  if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (x !== undefined ? '\n          ' + String(x).replace(/\n/g, '\n          ') : '')); }
};
console.log('\n' + file.replace(/.*\//, ''));

const SENDERS = [{ sender: 'bozena.haim@pias.com', label: 'PIAS/....', supplier_code: '1009', active: true, label_raw: null }];
const MANDATORY = ['ean', 'artist', 'title', 'format', 'release_date', 'label', 'rock_bottom'].map(f => ({ field_name: f }));

// One run of the pipeline. `answers` are the AI outputs, one per part; pass fewer than the document
// was split into to model a part the `If` node dropped.
function pipeline(attachments_text, answers, opts) {
  opts = opts || {};
  const src = {
    from: 'bozena.haim@pias.com', from_name: 'Bozena Haim', subject: opts.subject || 'releases of 11.09',
    date: '2026-09-10T21:40:53.000Z', thread_id: 'T', message_id: 'T',
    body: opts.body || 'Please see attached.', attachments_text: attachments_text, source_kind: 'email',
  };
  const chunks = run(node('Chunk Source'), { $input: { all: () => [{ json: src }] } });
  const ai = answers.map((a, i) => ({ output: typeof a === 'string' ? a : JSON.stringify(a), _chunk_key: 'T#' + (i + 1) }));
  const tables = {
    Senders: SENDERS, MandatoryFields: MANDATORY, Glossary: [], Exclusions: [], LabelNotes: [],
    'Catalog Lines (matching)': opts.lines || [], 'Blocked Emails': [],
  };
  const $ = name => name === 'Chunk Source'
    ? { all: () => chunks.map(j => ({ json: j })), first: () => ({ json: chunks[0] }), itemMatching: i => ({ json: chunks[i] }) }
    : { all: () => (tables[name] || []).map(j => ({ json: j })) };
  return { chunks, rows: run(node('Build Catalog Rows'), { $: $, $input: { all: () => ai.map(j => ({ json: j })) } }) };
}
const item = o => Object.assign({
  artist_raw: null, artist: null, artist_kind: 'group', title: null, features: [], label: null,
  format: null, genre: null, unit: 1, ean: null, catalogue_no: null, release_date: null,
  price: null, currency: null, cop: null, ppd_eur: null, rock_bottom: null,
  calculation_group: '1', excluded: false, exclusion_reason: null, missing_mandatory: [], item_confidence: 0.9,
}, o);
const answer = items => ({ document_type: 'release', is_catalog_relevant: true, label: 'PIAS RECORDINGS', sender_recognized: true, needs_review: false, review_reasons: [], items: items });
const noteOf = r => String((r.notes || '') + ' ' + (((r.extra || {}).review_note) || ''));
const allNotes = rows => rows.map(noteOf).join('\n');

// ------------------------------------------------- 1. "Black LPs" must not demote a 2LP
{
  const doc = [
    '## Attachment: list.xlsx', '',
    '|Release date|Artist|Title|Version|Cat Number|Barcode|Format|Type|Price|Label|Territory|GENRE|NOTES|',
    '|-|-|-|-|-|-|-|-|-|-|-|-|-|',
    '|9/11/26|JAY-Z|Reasonable Doubt|Black LPs|JAYZ30LP|0810061164906|2LP|Album|104.85 PLN|Diggers Factory|World|Hip-Hop/Rap||',
    '|9/11/26|JAY-Z|Reasonable Doubt|Cassette Tape|JAYZ30K7|0810061165866|Audio Cassette|Album|47.30 PLN|Diggers Factory|World|Hip-Hop/Rap||',
    '|9/11/26|Ezra Collective|Here Because of Hope|2xLP Translucent Blue Vinyl|PTSN3069-3|0720841306931|2LP|Album|115.36 PLN|Partisan Records|World|Jazz||',
  ].join('\n');
  const { rows } = pipeline(doc, [answer([
    item({ artist: 'JAY-Z', title: 'REASONABLE DOUBT', features: ['BLACK LPS'], format: 'LP2', unit: 2, ean: '0810061164906', release_date: '2026-09-11' }),
    item({ artist: 'JAY-Z', title: 'REASONABLE DOUBT', features: ['CASSETTE TAPE'], format: 'AUDIO CASSETTE', unit: 1, ean: '0810061165866', release_date: '2026-09-11' }),
    item({ artist: 'EZRA COLLECTIVE', title: 'HERE BECAUSE OF HOPE', features: ['2XLP TRANSLUCENT BLUE VINYL'], format: 'LP2', unit: 2, ean: '0720841306931', release_date: '2026-09-11' }),
  ])]);
  const by = {};
  for (const r of rows) if (r.ean) by[String(r.ean)] = r;
  ok('"Black LPs" keeps the column\'s 2LP', by['0810061164906'] && by['0810061164906'].format === 'LP2', by['0810061164906'] && by['0810061164906'].format);
  ok('...and its unit stays 2', by['0810061164906'] && by['0810061164906'].unit === 2, by['0810061164906'] && by['0810061164906'].unit);
  ok('a cassette is still normalised to MC', by['0810061165866'] && by['0810061165866'].format === 'MC', by['0810061165866'] && by['0810061165866'].format);
  ok('a version text that DOES state 2xLP still wins', by['0720841306931'] && by['0720841306931'].format === 'LP2' && by['0720841306931'].unit === 2,
    by['0720841306931'] && by['0720841306931'].format + '/' + by['0720841306931'].unit);
}

// ------------------------------------------------- 2. a release read twice is one release
{
  const doc = [
    '## Attachment: list.xlsx', '',
    '|Release date|Artist|Title|Version|Cat Number|Barcode|Format|Type|Price|Label|Territory|GENRE|NOTES|',
    '|-|-|-|-|-|-|-|-|-|-|-|-|-|',
    '|9/11/26|Bloc Party|Anatomy Of A Brief Romance||CON23LP|0823375111566|LP|Album|82.56 PLN|Contagious|World|Rock||',
    '', '---', '', '## Attachment: BP_AOABR_StandardLP.jpg', '', '# BLOC PARTY.', '', '# ANATOMY OF A BRIEF ROMANCE',
  ].join('\n');
  const withBarcode = item({ artist: 'BLOC PARTY', title: 'ANATOMY OF A BRIEF ROMANCE', format: 'LP', unit: 1, ean: '0823375111566', release_date: '2026-09-11', rock_bottom: 82.56 });
  const fromArtwork = item({ artist: 'BLOC PARTY', title: 'ANATOMY OF A BRIEF ROMANCE', format: 'LP', unit: 1 });
  const real = item({ artist: 'SOMEBODY ELSE', title: 'A RELEASE WITH NO BARCODE YET', format: 'LP', unit: 1, rock_bottom: 9.99 });
  const { rows } = pipeline(doc, [answer([fromArtwork, withBarcode, real])]);
  const blocs = rows.filter(r => r.artist === 'BLOC PARTY');
  ok('the artwork copy is merged into the barcoded line', blocs.length === 1, blocs.map(r => r.ean + '/' + r.action).join(', '));
  ok('...and the one that survives is the one with the barcode', blocs[0] && blocs[0].ean === '0823375111566', blocs[0] && blocs[0].ean);
  ok('...and the merge is named in the receipt, never silent',
    /read a second time off a page that prints no barcode/.test(allNotes(rows)), allNotes(rows).slice(0, 400));
  ok('a genuinely barcode-less release is still created (v47 holds)',
    rows.some(r => r.artist === 'SOMEBODY ELSE'), rows.map(r => r.artist).join(', '));
}

// ------------------------------------------------- 3. a bare year is not a release date
{
  const doc = [
    '## Attachment: one-sheet.pdf', '',
    'D’Anthoni Wooten & gogh.K', '‘Dave the Diver (Original Soundtrack)’', '',
    '# 2LP - LMLP367 - 5063176104212', '',
    'Released in 2023, ‘Dave the Diver’’s unique blend of deep sea exploration has captured the hearts',
    'of millions of players around the world.',
  ].join('\n');
  const lines = [{ id: 'L1', ean: '5063176104212', code: '506317610421', artist: 'WOOTEN D ANTHONI', title: 'DAVE THE DIVER',
    format: 'LP2', unit: 2, release_date: '2026-09-11', label: 'PIAS/LACED RECORDS', status: 'in_progress', sent_at: null, notes: null, extra: {} }];
  const { rows } = pipeline(doc, [answer([
    item({ artist: 'WOOTEN D ANTHONI', title: 'DAVE THE DIVER', format: 'LP2', unit: 2, ean: '5063176104212', release_date: '2023-01-01' }),
  ])], { lines: lines });
  const r = rows[0];
  ok('a 1 January date the document never prints is refused', r && r.release_date === undefined, r && r.release_date);
  ok('...so the correct date already stored is NOT overwritten', r && !('release_date' in r), r && JSON.stringify(Object.keys(r)));
  ok('...and the refusal says so on the row', /RELEASE DATE REFUSED/.test(noteOf(r)), noteOf(r).slice(0, 300));
}
{
  // ...and a real 1 January release, printed as such, is kept
  const doc = ['## Attachment: list.xlsx', '', '|Date|Artist|Title|Barcode|Format|', '|-|-|-|-|-|',
    '|01/01/2027|Somebody|New Year Record|5063176104212|LP|'].join('\n');
  const { rows } = pipeline(doc, [answer([
    item({ artist: 'SOMEBODY', title: 'NEW YEAR RECORD', format: 'LP', ean: '5063176104212', release_date: '2027-01-01', rock_bottom: 1 }),
  ])]);
  ok('a 1 January date the document DOES print is kept', rows[0] && rows[0].release_date === '2027-01-01', rows[0] && rows[0].release_date);
}

// ------------------------------------------------- 4. the territory the document prints wins
{
  const doc = [
    '## Attachment: list.xlsx', '',
    '|Release date|Artist|Title|Version|Cat Number|Barcode|Format|Type|Price|Label|Territory|GENRE|NOTES|',
    '|-|-|-|-|-|-|-|-|-|-|-|-|-|',
    "|9/11/26|NCT 127|The 7th Album 'BLINGY'|JET Poster Ver. - HAECHAN|SMCD513|8800371256806|CD|EP|51.52 PLN|SM Entertainment|World ex Korea, Republic of\\|Japan\\|China|K-Pop||",
    '|9/11/26|Someone|US Only Record||CAT9|5051083237925|CD|Album|1 PLN|A Label|US ONLY|Pop||',
  ].join('\n');
  const { rows } = pipeline(doc, [answer([
    item({ artist: 'NCT 127', title: 'BLINGY', features: ['US EXCLUSIVE'], format: 'CD', ean: '8800371256806', release_date: '2026-09-11', excluded: true, exclusion_reason: 'US/CANADA ONLY' }),
    item({ artist: 'SOMEONE', title: 'US ONLY RECORD', format: 'CD', ean: '5051083237925', release_date: '2026-09-11', excluded: true, exclusion_reason: 'US ONLY' }),
  ])]);
  const nct = rows.find(r => r.artist === 'NCT 127'), us = rows.find(r => r.artist === 'SOMEONE');
  ok('an exclusion the line\'s own territory contradicts is refused', nct && nct.status === 'in_progress', nct && nct.status);
  ok('...and the refusal is explained on the row', nct && /KEPT IN THE CATALOG/.test(noteOf(nct)), nct && noteOf(nct).slice(0, 300));
  ok('an exclusion the line\'s own territory supports still stands', us && us.status === 'excluded', us && us.status);
}

// ------------------------------------------------- 5. a part that produced nothing is named
{
  const rowsOf = n => {
    const many = [];
    for (let i = 1; i <= 30; i++) many.push('|9/11/26|ARTIST ' + i + '|TITLE ' + i + '||CAT' + i + '|' + (385012610000 + i) + '|CD|Album|9,99 PLN|A Label|World|Pop||');
    return many;
  };
  const doc = ['## Attachment: list.xlsx', '',
    '|Release date|Artist|Title|Version|Cat Number|Barcode|Format|Type|Price|Label|Territory|GENRE|NOTES|',
    '|-|-|-|-|-|-|-|-|-|-|-|-|-|'].concat(rowsOf()).join('\n');
  const src = { from: 'bozena.haim@pias.com', subject: 'x', date: '2026-09-10T21:40:53.000Z', thread_id: 'T', message_id: 'T', body: '', attachments_text: doc, source_kind: 'email' };
  const chunks = run(node('Chunk Source'), { $input: { all: () => [{ json: src }] } });
  ok('the document really is split into more than one part', chunks.length > 1, chunks.length);
  // every part answers except the first — exactly what the `If` node does with unreadable JSON
  const answers = chunks.slice(1).map((c, n) => ({
    output: JSON.stringify(answer(Array.from({ length: c.chunk_rows }, (_, k) => {
      const i = chunks.slice(0, n + 1).reduce((a, x) => a + x.chunk_rows, 0) + k + 1;
      return item({ artist: 'ARTIST ' + i, title: 'TITLE ' + i, format: 'CD', ean: String(385012610000 + i), release_date: '2026-09-11', rock_bottom: 9.99 });
    }))),
    _chunk_key: 'T#' + (n + 2),
  }));
  const tables = { Senders: SENDERS, MandatoryFields: MANDATORY, 'Catalog Lines (matching)': [], 'Blocked Emails': [] };
  const $ = name => name === 'Chunk Source'
    ? { all: () => chunks.map(j => ({ json: j })), first: () => ({ json: chunks[0] }), itemMatching: i => ({ json: chunks[i + 1] }) }
    : { all: () => (tables[name] || []).map(j => ({ json: j })) };
  const rows = run(node('Build Catalog Rows'), { $: $, $input: { all: () => answers.map(j => ({ json: j })) } });
  ok('a part that never reached this node is named on the rows', /PART NOT EXTRACTED/.test(allNotes(rows)), allNotes(rows).slice(0, 400));
  ok('...and the rows it lands on are flagged for review', rows.some(r => ((r.extra || {}).needs_review) === true), 'none flagged');
  ok('...and nothing printed in that part is lost — the stub net still covers it',
    new Set(rows.map(r => String(r.ean))).size === 30, rows.length + ' rows, ' + new Set(rows.map(r => String(r.ean))).size + ' distinct barcodes');
}

// ------------------------------------------------- 6. the same note is not appended twice
{
  const code = node('Build Catalog Rows');
  const appendNote = new Function('$', '$input', code.slice(0, code.indexOf('const WATCHED =')) + '\nreturn appendNote;')(
    () => ({ all: () => [] }), { all: () => [] });
  const stored = 'Moved from 2026-05-29\nLabel "F Communications" is not in the label map — confirm/add it in Settings.';
  const thisRun = ['Moved from 2026-05-29', 'Label "F Communications" is not in the label map — confirm/add it in Settings.'].join(' ');
  ok('a note already stored, wrapped differently, is not appended again', appendNote(stored, thisRun) === stored, JSON.stringify(appendNote(stored, thisRun)));
  ok('...and a genuinely new note still is', appendNote(stored, 'Something new entirely.') === stored + '\nSomething new entirely.',
    JSON.stringify(appendNote(stored, 'Something new entirely.')));
}

// ------------------------------------------------- 7. a recovered row says its imprint was not read
{
  const doc = ['## Attachment: list.xlsx', '',
    '|Release date|Artist|Title|Version|Cat Number|Barcode|Format|Type|Price|Label|Territory|GENRE|NOTES|',
    '|-|-|-|-|-|-|-|-|-|-|-|-|-|',
    '|9/11/26|Ezra Collective|Here Because of Hope||PTSN3069-2|0720841306924|CD|Album|47.30 PLN|Partisan Records/VMG|World|Jazz||'].join('\n');
  const { rows } = pipeline(doc, [answer([
    item({ artist: 'EZRA COLLECTIVE', title: 'HERE BECAUSE OF HOPE', format: 'CD', ean: '0720841306924', rock_bottom: 47.3, recovered: true, recovered_from: '|9/11/26|Ezra Collective|…' }),
  ])]);
  ok('a recovered row with no label says the imprint was not read', /IMPRINT NOT READ/.test(noteOf(rows[0])), noteOf(rows[0]).slice(0, 300));
  const { rows: r2 } = pipeline(doc, [answer([
    item({ artist: 'EZRA COLLECTIVE', title: 'HERE BECAUSE OF HOPE', format: 'CD', ean: '0720841306924', rock_bottom: 47.3, label: 'Partisan Records/VMG', recovered: true, recovered_from: '|…' }),
  ])]);
  ok('...and one that DID read its label does not', !/IMPRINT NOT READ/.test(noteOf(r2[0])), noteOf(r2[0]).slice(0, 300));
}

// ------------------------------------------------- 8. the two report nodes say what happened
{
  const runOne = (name, inputs, extra) => vm.runInNewContext('(function(){' + node(name) + '})()',
    Object.assign({}, G, { $input: { all: () => inputs.map(j => ({ json: j })) } },
      { $: n => ({ all: () => (extra && extra[n] ? extra[n] : []).map(j => ({ json: j })) }) }))[0].json;

  const dupe = { ean: '0810061164906', code: '1006116490', artist: 'JAY-Z', title: 'REASONABLE DOUBT',
    error: 'duplicate key value violates unique constraint "catalog_lines_code_uniq"' };
  const other = { ean: '5051083237925', artist: 'GLI ANGELI', error: 'column "nope" does not exist' };
  const fine = { id: 'x', ean: '5054429212372', artist: 'BONOBO' };
  const creates = [{ action: 'create' }, { action: 'create' }, { action: 'create' }, { action: 'update' }];
  const rep = runOne('Skipped Report', [fine, dupe, other], { 'Build Catalog Rows': creates });
  ok('Skipped Report counts the duplicate the database refused', rep.dropped_as_duplicates === 1, JSON.stringify(rep.dropped_as_duplicates));
  ok('...and keeps a non-duplicate failure apart from it', rep.failed_for_another_reason === 1, JSON.stringify(rep.failed_for_another_reason));
  ok('...and names the barcode that was dropped', /0810061164906/.test(JSON.stringify(rep.dropped)), JSON.stringify(rep.dropped).slice(0, 200));
  ok('...and counts only the creates that were attempted', rep.new_lines_attempted === 3, rep.new_lines_attempted);
  const quiet = runOne('Skipped Report', [fine], { 'Build Catalog Rows': creates });
  ok('...and says so plainly when nothing was dropped', /Every new line was inserted/.test(quiet.summary), quiet.summary);

  const unread = runOne('Unread AI Answer', [
    { output: '{"document_type":"release","is_catalog_relevant":true,"items":[{"ean":"1"}] // Additional items follow' },
    { output: JSON.stringify({ document_type: 'other', is_catalog_relevant: false, relevance_reason: 'a signature block', items: [] }) },
  ], { 'Chunk Source': [{ chunk_index: 1 }, { chunk_index: 2 }, { chunk_index: 3 }] });
  ok('Unread AI Answer separates a fault from a decision', unread.of_those_unreadable === 1, JSON.stringify(unread.of_those_unreadable));
  ok('...naming the unreadable one as a fault', /UNREADABLE ANSWER/.test(unread.parts[0].verdict), unread.parts[0].verdict);
  ok('...and the irrelevant one as a decision, with its reason',
    /NOT CATALOG RELEVANT/.test(unread.parts[1].verdict) && unread.parts[1].relevance_reason === 'a signature block',
    JSON.stringify(unread.parts[1]));
}

console.log('  ' + '-'.repeat(60));
console.log('  %d passed, %d failed', pass, fail);
if (fail) process.exit(1);
