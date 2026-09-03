// A battery of document SHAPES, each with the number of releases a human would count.
// The question is not "does SYEOR work" but "for how many shapes does the number we give
// the model equal the number of releases actually in front of it".
const B = ['0887828025824', '5054429211894', '3850126115200', '0602465795776', '0602458915044',
  '0081227800543', '0081227800499', '0081227800505', '0081227800512', '0081227800536'];

const shapes = [];
const add = (name, releases, text, why) => shapes.push({ name, releases, text, why });

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

module.exports = shapes;
