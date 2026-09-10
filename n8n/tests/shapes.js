// A battery of document SHAPES, each with the number of releases a human would count.
// The question is not "does SYEOR work" but "for how many shapes does the number we give
// the model equal the number of releases actually in front of it".
const B = ['0887828025824', '5054429211894', '3850126115200', '0602465795776', '0602458915044',
  '0081227800543', '0081227800499', '0081227800505', '0081227800512', '0081227800536'];

const shapes = [];
// `opts.floor: true` marks a shape whose true release count CANNOT be asserted as an exact
// row count (a barcode lives in prose, outside any table). It is excluded from the
// told===real scoreboard and judged only by the safety properties (see count-shapes.js):
// the count may sit below the truth, but it must never be announced as "EXACTLY".
const add = (name, releases, text, why, opts) => shapes.push(Object.assign({ name, releases, text, why }, opts || {}));

// ---- 1. a markdown price-list table, every row with a barcode (the ordinary case)
add('table: every row has a barcode', 4, [
  '| EAN | Artist | Title | Format | PPD |',
  '| --- | --- | --- | --- | --- |',
  '| ' + B[0] + ' | ARTIST A | TITLE A | LP | 12,50 |',
  '| ' + B[1] + ' | ARTIST B | TITLE B | CD | 8,90 |',
  '| ' + B[2] + ' | ARTIST C | TITLE C | LP | 14,00 |',
  '| ' + B[3] + ' | ARTIST D | TITLE D | LP | 21,00 |',
].join('\n'));

// ---- 2. THE EXCEL SHAPE: same table, two rows whose EAN cell is simply empty
add('table: an EAN column with two EMPTY cells', 4, [
  '| EAN | Artist | Title | Format | PPD |',
  '| --- | --- | --- | --- | --- |',
  '| ' + B[0] + ' | ARTIST A | TITLE A | LP | 12,50 |',
  '|  | ARTIST B | TITLE B | CD | 8,90 |',
  '| ' + B[2] + ' | ARTIST C | TITLE C | LP | 14,00 |',
  '|  | ARTIST D | TITLE D | LP | 21,00 |',
].join('\n'), 'an Excel where the barcode is not known yet');

// ---- 3. the same, with a placeholder rather than an empty cell
add('table: EAN cells reading TBC / N/A / -', 5, [
  '| Barcode | Artist | Title | Format |',
  '| --- | --- | --- | --- |',
  '| ' + B[0] + ' | ARTIST A | TITLE A | LP |',
  '| TBC | ARTIST B | TITLE B | CD |',
  '| N/A | ARTIST C | TITLE C | LP |',
  '| - | ARTIST D | TITLE D | LP |',
  '| ' + B[4] + ' | ARTIST E | TITLE E | 7" |',
].join('\n'), 'the label has not assigned barcodes yet');

// ---- 4. a table with a barcode column AND fee rows that must NOT count
add('table: product rows plus invoice fee rows', 2, [
  '| EAN | Description | Qty | Value |',
  '| --- | --- | --- | --- |',
  '| ' + B[0] + ' | ARTIST A - TITLE A | 2 | 25,00 |',
  '| ' + B[1] + ' | ARTIST B - TITLE B | 1 | 8,90 |',
  '|  | CHARGE PER SHIPPED UNIT | 3 | 1,50 |',
  '|  | FREIGHT | 1 | 12,00 |',
  '|  | GRAND TOTAL |  | 47,40 |',
].join('\n'), 'a blank barcode cell on a fee row is not a lost release');

// ---- 5. the SYEOR shape: heading blocks, labelled fields, some blank
add('headings: labelled fields, two printed empty', 4, [
  '# Campaign 2027', '',
  '# ARTIST A - TITLE A', '', 'Format: 1LP', '', 'UPC: ' + B[0], '', 'Rights: WW', '',
  '# ARTIST B - TITLE B', '', '| Format: | 1LP |', '| ------- | --- |', '| UPC:    |     |', '| Rights: | WW  |', '',
  '# ARTIST C - TITLE C', '', 'Format: 1LP', '', 'UPC: ' + B[2], '', 'Rights: WW', '',
  '# ARTIST D - TITLE D', '', '| Format: | 1LP |', '| ------- | --- |', '| UPC:    |     |', '| Rights: | WW  |', '',
].join('\n'));

// ---- 6. a plain text list, one release per line
add('plain list: one release per line', 3, [
  'NEW RELEASES OCTOBER', '',
  'ARTIST A - TITLE A (LP) ' + B[0] + ' 12,50 EUR',
  'ARTIST B - TITLE B (CD) ' + B[1] + ' 8,90 EUR',
  'ARTIST C - TITLE C (LP) ' + B[2] + ' 14,00 EUR',
].join('\n'));

// ---- 7. a release that shows a catalogue number and no barcode field at all
add('a release with only a catalogue number', 3, [
  '| Cat no | Artist | Title | Format |',
  '| --- | --- | --- | --- |',
  '| ABC-1234 | ARTIST A | TITLE A | LP |',
  '| ABC-1235 | ARTIST B | TITLE B | LP |',
  '| ABC-1236 | ARTIST C | TITLE C | LP |',
].join('\n'), 'nothing in the document says "barcode" at all');

// ---- 8. the barcode column is second, not first
add('table: barcode column in the middle, one blank', 3, [
  '| Artist | Title | UPC | Price |',
  '| --- | --- | --- | --- |',
  '| ARTIST A | TITLE A | ' + B[0] + ' | 12,50 |',
  '| ARTIST B | TITLE B |  | 8,90 |',
  '| ARTIST C | TITLE C | ' + B[2] + ' | 14,00 |',
].join('\n'));

// ---- 9. a table with NO barcode column at all (a tracklisting, say) — no releases
add('a tracklisting table: no releases at all', 0, [
  '| Side | Track | Duration |',
  '| --- | --- | --- |',
  '| A1 | Opening | 3:21 |',
  '| A2 | Second | 4:05 |',
].join('\n'), 'must not invent anchors out of an unrelated table');

// ---- 10. duplicate barcode printed twice (a summary repeating the list)
add('the same barcode printed twice', 2, [
  '| EAN | Title |', '| --- | --- |',
  '| ' + B[0] + ' | TITLE A |',
  '| ' + B[1] + ' | TITLE B |', '',
  'Summary: ' + B[0] + ' and ' + B[1] + ' ship on Friday.',
].join('\n'), 'one release, however many times its barcode appears');

// ---- 11. a product table with a WRAPPED cell — the phantom-row risk of counting by structure
add('table: a wrapped title cell is not a row', 2, [
  '| EAN | Artist | Title | Format |',
  '| --- | --- | --- | --- |',
  '| ' + B[0] + ' | ARTIST A | TITLE A | LP |',
  '|  | (deluxe edition) |  |  |',
  '| ' + B[1] + ' | ARTIST B | TITLE B | CD |',
].join('\n'), 'counting one line as one row must not invent a release');

// ---- 12. both at once: a blank EAN row AND a wrapped cell
add('table: a blank EAN row and a wrapped cell together', 3, [
  '| EAN | Artist | Title | Format |',
  '| --- | --- | --- | --- |',
  '| ' + B[0] + ' | ARTIST A | TITLE A | LP |',
  '|  | (deluxe edition) |  |  |',
  '|  | ARTIST B | TITLE B | CD |',
  '| ' + B[2] + ' | ARTIST C | TITLE C | LP |',
].join('\n'), 'the blank-identifier row counts, the wrapped one does not');

// ---- 13. TWO consignment tables, each with an IBAN in the footer (the Croatia Records shape)
// The footer prints IBANs — "HR8223600001101213510" — whose inner 14-digit run a bare
// /\d{12,14}/ counts as a barcode. With two attachment headings that pushes the barcode
// count past the table total and routes the whole thing to the heading splitter, which can
// only cut at a heading and so emits two mega-parts. A barcode is a STANDALONE token; an
// IBAN is not one. Real release count = 24, and the footer numbers must not add to it.
// (client, NIKA OTPR 648/649, 2026-09-09)
const bc = i => '3850126' + String(100000 + i);      // distinct standalone 13-digit barcodes
const crow = i => '| ' + i + ' | ' + bc(i) + ' | ARTIST ' + i + ' - TITLE ' + i + ' (LP) | kom | | 5,00 | 25 | 18,00 | 90,00 | 30,00 |';
const cfooter = [
  'Ukupno prije poreza: 127,00', '', '2.568,00', '',
  'Zagrebačka banka d.d. Zagreb IBAN: HR8223600001101213510 *',
  'Privredna banka d.d. Zagreb IBAN: HR7623400091110046200 *',
  'Društvo je upisano u Sudski registar pod MBS: 080034452 * temeljni kapital: 22.813.200 HRK * izdanih dionica: 114.066',
].join('\n');
const ctable = (from, to) => ['| R. | Bar kod | Naziv artikla | J.m. | Serijski | Količina | PDV % | Cijena | Iznos | MP cijena |',
  '| -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |']
  .concat(Array.from({ length: to - from + 1 }, (_, k) => crow(from + k))).join('\n');
add('two consignment tables, each with an IBAN footer', 24, [
  '## Attachment: NIKA OTPR 648.pdf', '', 'Izdatnica na komisiju broj: 648', '', ctable(1, 12), '', cfooter,
  '', '---', '',
  '## Attachment: NIKA OTPR 649.pdf', '', 'Izdatnica na komisiju broj: 649', '', ctable(13, 24), '', cfooter,
].join('\n'), 'an IBAN in the footer is not a barcode, and must not add to the release count');

// ---- 14. a single supplier table whose footer carries an IBAN and a company reg number
// The regression guard for shape 13: one table, footer numbers present. The count is the
// table's rows, never the footer numbers, whether or not the router is involved.
add('single table with an IBAN + reg number in the footer', 3, [
  '| EAN | Artist | Title | Format |',
  '| --- | --- | --- | --- |',
  '| ' + B[0] + ' | ARTIST A | TITLE A | LP |',
  '| ' + B[1] + ' | ARTIST B | TITLE B | CD |',
  '| ' + B[2] + ' | ARTIST C | TITLE C | LP |',
  '',
  'IBAN: HR8223600001101213510  reg. 080034452  kapital 22.813.200',
].join('\n'), 'footer numbers (IBAN, registration, capital) are never releases');

// ---- 16. a barcode STRANDED IN PROSE above a table (the I-DI "Invoice IDI" shape)
// I-DI printed a live album as a free-text line — "5056083208579  Yes  Hanns-Martin-Schleyer-
// Halle..." — above a table LlamaParse could not align. That barcode is a real release but
// sits in no table row, so the row count (3) is below the truth (4). The row count staying
// low is acceptable — what is NOT is announcing it as "EXACTLY 3", which orders the model to
// return three and drop the fourth (Mare: 5060572510005 lost, 2026-09-09). floor:true, so it
// is judged only by the safety rule: an undercounted source must never be called EXACTLY.
add('a barcode stranded in prose above a table', 4, [
  '# Invoice',
  '',
  '5056083208579  Yes  Live In Stuttgart 1991  Germany.',
  '| Barcode | Artist | Title | Format |',
  '| --- | --- | --- | --- |',
  '| ' + B[0] + ' | ARTIST A | TITLE A | CD |',
  '| ' + B[1] + ' | ARTIST B | TITLE B | CD |',
  '| ' + B[2] + ' | ARTIST C | TITLE C | CD |',
// v57 counts it: a barcode outside every table is STRANDED and joins the floor, so the count
// is the truth (4) again — but it stays a FLOOR, never "EXACTLY", because calling a loose
// barcode a release is an inference.
].join('\n'), 'a barcode outside the table joins the floor and forbids an EXACTLY count');

module.exports = shapes;
