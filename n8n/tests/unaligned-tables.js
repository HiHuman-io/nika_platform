// v58: WHAT THE MODEL IS SHOWN when the parser could not find a table's columns.
//
// Run from the repo root:  node n8n/tests/unaligned-tables.js n8n/manual-import.v58.json
//
// count-shapes.js already proves the release COUNT survives an unaligned table. This file is
// about the text: under v57 the count was right and the model still returned nothing for the
// page, because it was shown a header row that was really a product row plus eight fragments
// (I-DI Invoice_IDI.pdf page 2 — 5 releases, 0 returned, three versions running).
//
// splitTableSeg already decides that a line carrying no barcode and no date continues the line
// above it; that is the only reason such a table can be counted at all. v58 writes the same
// judgement into the text: one line, one release. The two things that must never happen are a
// clean table being touched, and a totals line being folded onto a release.
const fs = require('fs'), vm = require('vm');
const P = 'C:/Users/User/Desktop/nika-platform/';
const file = process.argv[2] || 'n8n/manual-import.v58.json';
const code = JSON.parse(fs.readFileSync(P + file, 'utf8')).nodes.find(n => n.name === 'Chunk Source').parameters.jsCode;
const G = { console, String, Number, Array, Object, Set, Map, RegExp, JSON, Math, Date, parseInt, parseFloat, isNaN };
const chunk = doc => vm.runInNewContext('(function(){' + code + '})()', Object.assign({}, G, {
  $input: { all: () => [{ json: { message_id: 'm', thread_id: 't', subject: 's', from: null, date: '2026-09-10T10:00:00Z', body: '', attachments_text: doc, source_kind: 'manual' } }] },
})).map(x => x.json);

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (x !== undefined ? '\n          ' + String(x).replace(/\n/g, '\n          ') : '')); } };

console.log('\n' + file.replace(/.*\//, ''));

// ---------------------------------------------------------------- 1. the I-DI page-2 shape
const UNALIGNED = [
  '5056083208579  Yes  Hanns-Martin-Schleyer-Halle. Stuttgart. 3  Germany.',
  '| CD            | 31St May         | 1                                   | 1991 | 9,99   | 9,99          |    |',
  '| ------------- | ---------------- | ----------------------------------- | ---- | ------ | ------------- | -- |',
  '| 8032484011830 | VARIOUS ARTISTS  | SUBURBIA COMPILATION - ESSENTIAL    | 1    | HOUSE  | CD            | 1  |',
  '| 5060420687392 | MUSIC PROTECTION | KXRM25W - WITH 40PP - WOODEN RECORD | 1    | AV-ACC | STORAGE CRATE | ON |',
  '| 35,99         | 100 LPS - WHITEWASH - RETRO MUSIQU |                   |      |        |               |    |',
  '| 7111606534882 | MUSIC PROTECTION | KXRM22 - 35 PPS - 7 INCH ALUMINIUM  | 1    | VINYL  | AV-ACC        | 1  |',
  '| 35 SINGLES    | 16,99            | - SILVER - RETRO MUSIQUE            |      |        |               |    |',
  '| 5060572510005 | MUSIC PROTECTION | KXRM25K - WITH PPS - WOODEN RECORD  | 1    | AV-ACC | STORAGE CRATE | ON |',
  '| 69,98         | 100 LPS - RETRO MUSIQUE |                              |      |        |               |    |',
  '| 27            | 369,73           |                                     |      |        |               |    |',
].join('\n');

const shown = chunk(UNALIGNED).map(p => p.attachments_text).join('\n');
const lineFor = ean => shown.split('\n').filter(l => l.indexOf(ean) !== -1)[0] || '';

ok('the reader is told the table was rewritten', /THE PARSER COULD NOT ALIGN THIS TABLE/.test(shown), shown.slice(0, 200));

// each wrapped release is ONE line carrying the cells that were on its second line
ok('5060420687392 is one line, and its wrapped title tail is on it',
  /100 LPS - WHITEWASH - RETRO MUSIQU/.test(lineFor('5060420687392')), lineFor('5060420687392'));
ok('7111606534882 is one line, and its wrapped title tail is on it',
  /- SILVER - RETRO MUSIQUE/.test(lineFor('7111606534882')), lineFor('7111606534882'));
ok('5060572510005 is one line, and its wrapped title tail is on it',
  /100 LPS - RETRO MUSIQUE/.test(lineFor('5060572510005')), lineFor('5060572510005'));

// no release line may swallow a second barcode: that would merge two releases into one
const barcodeLines = shown.split('\n').filter(l => /(?<![0-9A-Za-z])\d{12,14}(?![0-9])/.test(l));
ok('no rewritten line carries two barcodes',
  barcodeLines.every(l => (l.match(/(?<![0-9A-Za-z])\d{12,14}(?![0-9])/g) || []).length === 1),
  barcodeLines.filter(l => (l.match(/(?<![0-9A-Za-z])\d{12,14}(?![0-9])/g) || []).length > 1).join('\n'));

// the invoice total has no letters in it: it is not the tail of a title
ok('the "| 27 | 369,73 |" total is NOT folded onto the release above it',
  !/369,73/.test(lineFor('5060572510005')) && /369,73/.test(shown), lineFor('5060572510005'));

// nothing is dropped: every cell of the original still appears somewhere
const cells = UNALIGNED.split('\n').join('|').split('|').map(s => s.trim()).filter(s => s && !/^-{2,}$/.test(s));
const lost = cells.filter(c => shown.indexOf(c) === -1);
ok('no cell of the original is lost in the rewrite', lost.length === 0, lost.join(' / '));

// and every barcode is named in the note, so the model has a checklist
const notes = chunk(UNALIGNED).map(p => p.chunk_note).join(' ');
for (const b of ['5056083208579', '8032484011830', '5060420687392', '7111606534882', '5060572510005']) {
  ok('the note names ' + b, notes.indexOf(b) !== -1);
}

// ---------------------------------------------------------------- 2. a clean table is untouched
const CLEAN = [
  '| EAN | Artist | Title | Format |',
  '| --- | --- | --- | --- |',
  '| 0887828025824 | ARTIST A | TITLE A | LP |',
  '| 5054429211894 | ARTIST B | TITLE B | CD |',
  '|  | (deluxe edition) |  |  |',
  '| 3850126115200 | ARTIST C | TITLE C | LP |',
].join('\n');
const cleanShown = chunk(CLEAN).map(p => p.attachments_text).join('\n');
ok('a table that names an identifier column is NOT rewritten', !/COULD NOT ALIGN/.test(cleanShown));
ok('...and its wrapped continuation line is left exactly where it was',
  cleanShown.indexOf('|  | (deluxe edition) |  |  |') !== -1, cleanShown);
ok('...and it still counts 3 releases, not 4', chunk(CLEAN).reduce((n, p) => n + p.chunk_rows, 0) === 3);

// ---------------------------------------------------------------- 3. an unaligned table with no
// wrapped row has nothing to repair, so it is left alone too (the smallest blast radius)
const NOWRAP = [
  '| 31St May | 1991 | 9,99 |',
  '| --- | --- | --- |',
  '| 0887828025824 | ARTIST A | LP |',
  '| 5054429211894 | ARTIST B | CD |',
].join('\n');
ok('an unaligned table with no wrapped row is left alone', !/COULD NOT ALIGN/.test(chunk(NOWRAP).map(p => p.attachments_text).join('\n')));

console.log('  ' + '-'.repeat(60));
console.log('  %d passed, %d failed', pass, fail);
if (fail) process.exit(1);
