// Does the number we give the AI equal the number of releases actually in the document?
//
// Run from the repo root:   node n8n/tests/count-shapes.js n8n/extraction-stage1.v55.json
//
// Every version from v42 to v48 fixed the ONE document that had just gone wrong, and each
// time the next document broke somewhere else - v48 scored 6 of these. Before changing
// Chunk Source again, run this. A change that improves the document in front of you and
// lowers this score has not fixed anything.
//
// FOUR SAFETY PROPERTIES matter more than the score, and are asserted here as a hard gate
// (non-zero exit on violation):
//   1. the count must NEVER exceed the real one — that orders the model to INVENT a row
//      (v54: an IBAN's inner 14-digit run counted as a barcode and overcounted the order);
//   2. a source may be announced "EXACTLY n" ONLY when the count equals the truth. Announcing
//      "exactly" while undercounting orders the model to DROP a real row (v55: a barcode
//      stranded in prose left the row count one short, yet the tables still read as clean);
//   3. every barcode the document prints is NAMED in exactly one part's note — never left
//      unnamed, and never named twice. v58: part 4 of the I-DI invoice was told "AT LEAST 12"
//      and nothing more, held 7 rows that read cleanly plus a page the parser had mangled, and
//      returned the 7. A count is an order the model can satisfy by miscounting; a list is an
//      order per item. Named twice would be worse still — the same release back as two lines;
//   4. a part's asserted count is never BELOW the number of identifiers its own note names.
//      "At least 7" alongside a list of 12 is a self-contradicting instruction.
// A `floor:true` shape (its true count cannot be a row count) is exempt from the scoreboard
// but still bound by all four safety properties.
const fs = require('fs'), vm = require('vm');
const P = 'C:/Users/User/Desktop/nika-platform/';
const shapes = require('./shapes.js');
const file = process.argv[2];
const code = JSON.parse(fs.readFileSync(P + file, 'utf8')).nodes.find(n => n.name === 'Chunk Source').parameters.jsCode;
function chunk(doc) {
  const src = { message_id: 'm', thread_id: 't', subject: 's', from: null, date: '2026-09-03T10:00:00Z', body: '', attachments_text: doc, source_kind: 'manual' };
  return vm.runInNewContext('(function(){' + code + '})()', { console, String, Number, Array, Object, Set, Map, RegExp, JSON, Math, Date, parseInt, parseFloat, isNaN, $input: { all: () => [{ json: src }] } }).map(x => x.json);
}

console.log('\n' + file.replace(/.*\//, ''));
console.log('  ' + 'shape'.padEnd(52) + 'real  told   verdict');
let bad = 0, scored = 0;
const floors = [];
const violations = [];
for (const s of shapes) {
  const parts = chunk(s.text);
  const told = parts.reduce((n, p) => n + (p.chunk_rows || 0), 0);
  const hasExactly = parts.some(p => /exactly/i.test(p.chunk_note || ''));
  // safety properties (every shape, floor or not)
  if (told > s.releases) violations.push(s.name + ': OVERCOUNTS (told ' + told + ' > real ' + s.releases + ') — orders invention');
  if (hasExactly && told !== s.releases) violations.push(s.name + ': announced EXACTLY while told(' + told + ')!=real(' + s.releases + ') — orders a drop/invent');
  // v58 properties 3 and 4: the identifiers the notes name
  const named = {};
  for (const p of parts) {
    const m = String(p.chunk_note || '').match(/identifiers printed in this part are: ([^.]*)\./);
    const list = m ? m[1].split(',').map(x => x.trim()).filter(Boolean) : [];
    for (const c of list) { const k = c.replace(/^0+/, ''); named[k] = (named[k] || 0) + 1; }
    if (list.length > (p.chunk_rows || 0)) {
      violations.push(s.name + ': part ' + p.chunk_index + ' names ' + list.length + ' identifiers but asserts only ' + p.chunk_rows);
    }
  }
  const printed = {};
  for (const raw of (s.text.match(/(?<![0-9A-Za-z])\d{12,14}(?![0-9])/g) || [])) printed[raw.replace(/^0+/, '')] = raw;
  const distinctPrinted = Object.keys(printed);
  if (distinctPrinted.length && distinctPrinted.length <= 40) {
    for (const k of distinctPrinted) {
      const n = named[k] || 0;
      if (n === 0) violations.push(s.name + ': barcode ' + printed[k] + ' is printed but NAMED IN NO PART note');
      if (n > 1) violations.push(s.name + ': barcode ' + printed[k] + ' is named in ' + n + ' parts — orders it back twice');
    }
  }
  if (s.floor) { floors.push({ s, told, hasExactly }); continue; }
  scored++;
  const v = told === s.releases ? 'ok' : (told < s.releases ? 'UNDERCOUNTS by ' + (s.releases - told) : 'OVERCOUNTS by ' + (told - s.releases));
  if (told !== s.releases) bad++;
  console.log('  ' + s.name.padEnd(52) + String(s.releases).padEnd(6) + String(told).padEnd(6) + v);
}
console.log('  ' + '-'.repeat(74));
console.log('  %d of %d shapes counted correctly', scored - bad, scored);

if (floors.length) {
  console.log('\n  floor-only shapes (count not assertable — must never be announced EXACTLY):');
  for (const f of floors) {
    console.log('  ' + f.s.name.padEnd(52) + ('real ' + f.s.releases).padEnd(10) + ('told ' + f.told).padEnd(10) + (f.hasExactly ? 'SAYS EXACTLY (bad)' : 'floor/every (ok)'));
  }
}

console.log('\n  SAFETY PROPERTIES:');
if (!violations.length) {
  console.log('  ok  no shape overcounts, and no undercounted shape is announced EXACTLY');
  console.log('  ok  every printed barcode is named in exactly one part, and no part names more than it asserts');
} else {
  for (const v of violations) console.log('  FAIL  ' + v);
  console.log('\n  ' + violations.length + ' SAFETY VIOLATION(S).');
  process.exit(1);
}
