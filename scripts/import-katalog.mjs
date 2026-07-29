import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const XLSX = require('C:/Users/User/Desktop/nika-platform/node_modules/xlsx');

const SRC = 'C:/Users/User/Downloads/Katalog 2026 07 03.xlsx';
const OUT = 'C:/Users/User/Downloads/catalog-import.csv';
const SENT_AT = '2026-07-29T00:00:00Z';

const SUPPLIER_CODES = { MATRIXMUSIC: '54', MATRIX: '54', PIASRECORDINGS: '1009', PIAS: '1009' };
const CALC = { F: '1', M: '2', B: '3' };

function up(s) { return typeof s === 'string' ? s.toUpperCase() : s; }
function labelKey(s) { return typeof s === 'string' ? s.toUpperCase().replace(/[^A-Z0-9]/g, '') : ''; }
function dropThe(s) {
  if (typeof s !== 'string') return s;
  const orig = s; let t = s.trim();
  if (t.slice(0, 4).toUpperCase() === 'THE ') t = t.slice(4).trim();
  t = t.replace(/[\s,]+THE\s*$/i, '').trim();
  return t === '' ? orig : t;
}
function artist(a) { return up(dropThe(String(a).replace(/^!!!\s*/, '').trim())); } // "!!!" is meaningless -> strip
function toCode(ean) { const s = String(ean == null ? '' : ean).replace(/\D/g, ''); if (!s) return null; return s.slice(0, -1).replace(/^0+/, '') || null; }
function normFormat(f) { let s = String(f || '').toUpperCase().trim(); const m = s.match(/^(\d+)\s*(LP|CD|MC)$/); if (m) return m[2] + (m[1] === '1' ? '' : m[1]); return s.replace(/\s+/g, '') || null; }
function isoUS(v) { const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if (!m) return null; let [, mo, d, y] = m; y = +y; if (y < 100) y = y <= 26 ? 2000 + y : 1900 + y; return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
function num(v) { const s = String(v == null ? '' : v).replace(/[^\d.]/g, ''); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; }

const OUT_COLS = ['ean', 'code', 'catalogue_no', 'artist', 'title', 'format', 'unit', 'label', 'release_date', 'cop', 'ppd', 'our_price', 'supplier_code', 'calculation_group', 'hermes_id', 'catalog', 'status', 'sent_at'];

const rows = XLSX.utils.sheet_to_json(XLSX.readFile(SRC).Sheets['List1'], { raw: false, defval: '' });
let droppedD = 0, noId = 0, dupCode = 0;
const seen = new Set();
const out = [];
for (const r of rows) {
  const c = String(r['Calculation Group']).trim().toUpperCase();
  if (c === 'D') { droppedD++; continue; }                 // client: drop the "D" rows
  const ean = String(r['EAN']).trim() || null;
  const catNo = String(r['CATALOGUE NO']).trim() || null;
  if (!ean && !catNo) { noId++; continue; }                // no identifier -> can't dedup/import
  const code = toCode(ean);
  const key = code || ('C:' + labelKey(catNo));
  if (seen.has(key)) { dupCode++; continue; }              // internal dedup on normalised barcode
  seen.add(key);
  const label = String(r['label']).trim() || null;
  const fmt = normFormat(r['Format']);
  out.push({
    ean, code, catalogue_no: catNo,
    artist: artist(r['Artist']), title: up(String(r['Title']).trim()) || null,
    format: fmt, unit: num(r['Unit']) || 1, label,
    release_date: isoUS(r['RELEASE DATE']) || '2099-12-31',
    cop: num(r['COP']), ppd: num(r['PPD']) != null ? String(num(r['PPD'])) : null,
    our_price: num(r['Our Price']),                        // client: column O, not J
    supplier_code: SUPPLIER_CODES[labelKey(label)] || '149',
    calculation_group: CALC[c] || '1',
    hermes_id: String(r['HERMES ID']).trim() || null,
    catalog: 'processed', status: 'approved', sent_at: SENT_AT,
  });
}

const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
fs.writeFileSync(OUT, [OUT_COLS.join(',')].concat(out.map((r) => OUT_COLS.map((c) => esc(r[c])).join(','))).join('\n') + '\n');

console.log('xlsx data rows :', rows.length);
console.log('dropped "D"    :', droppedD);
console.log('dropped no-id  :', noId);
console.log('deduped (code) :', dupCode);
console.log('WRITTEN        :', out.length, '->', OUT);
console.log('sample1:', JSON.stringify(out[0]));
console.log('sample2:', JSON.stringify(out.find((r) => r.our_price != null && r.hermes_id)));
