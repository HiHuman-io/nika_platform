// Run every workflow test against both workflows, and print one verdict.
//
//   node n8n/tests/all.js            # newest vNN found in n8n/
//   node n8n/tests/all.js v62        # a specific version
//
// Run this before shipping any workflow version. From v54 to v61 every defect was found by the
// client, in production, one document at a time; the point of this file is that the answer to
// "is it safe to ship" is one command and not a judgement.
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

const want = (process.argv[2] || '').replace(/^v/, '');
const versions = fs.readdirSync(path.join(ROOT, 'n8n'))
  .map(f => (f.match(/^manual-import\.v(\d+)\.json$/) || [])[1]).filter(Boolean).map(Number);
const V = want ? Number(want) : Math.max.apply(null, versions);
if (!versions.includes(V)) { console.error('no such version: v' + V); process.exit(2); }

const SUITES = ['corpus', 'v63-rules', 'count-shapes', 'item-pairing', 'recovery', 'stub-recovery', 'review-notes', 'unaligned-tables', 'gate-note'];
const WFS = ['manual-import', 'extraction-stage1'];

console.log('\n  workflow tests — v' + V + '\n');
let bad = 0;
const width = Math.max.apply(null, SUITES.map(s => s.length));
for (const s of SUITES) {
  const marks = [];
  for (const w of WFS) {
    const wf = 'n8n/' + w + '.v' + V + '.json';
    try {
      execFileSync(process.execPath, [path.join('n8n', 'tests', s + '.js'), wf], { cwd: ROOT, stdio: 'pipe' });
      marks.push('ok');
    } catch (e) {
      marks.push('FAILED');
      bad++;
      const out = String((e.stdout || '') + (e.stderr || ''));
      const lines = out.split('\n').filter(l => /FAIL|BROKEN|Error|failed/.test(l)).slice(0, 6);
      marks.push('\n      ' + wf + '\n      ' + lines.join('\n      '));
    }
  }
  console.log('  ' + s.padEnd(width + 2) + marks.join('   '));
}
console.log('');
if (bad) { console.log('  ' + bad + ' suite/workflow combination(s) FAILED — do not ship v' + V + '\n'); process.exit(1); }
console.log('  all ' + SUITES.length + ' suites pass on both workflows.\n');
