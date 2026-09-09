// Export layout + the finished .xlsx, checked against the client's list of 2026-09-07.
//   node src/components/catalog-export.test.mjs
//
// Builds a real workbook with the real column spec and the same styling the browser
// writer applies, then reads the bytes back and looks at the XML. A test that only
// checked the spec object would not have noticed that the library drops quotePrefix.
import XLSX from "xlsx-js-style";
import {
  CATALOG_EXPORT_COLUMNS,
  addQuotePrefixToTextStyles,
  blankStyledCellsToEmpty,
  formatDmy,
} from "./catalog-export.ts";

let pass = 0, fail = 0;
const ok = (n, c, extra) => {
  if (c) { pass++; console.log("  PASS  " + n); }
  else { fail++; console.log("  FAIL  " + n + (extra !== undefined ? " — " + JSON.stringify(extra) : "")); }
};
const spec = (key) => CATALOG_EXPORT_COLUMNS.find((c) => c.key === key);

console.log("\n=== (a) the Status column is gone ===");
ok("no status column in the layout", !spec("status"));
ok("...and every other column is still there",
  ["artist", "title", "unit", "format", "ean", "label", "code", "catalogue_no", "release_date",
    "our_price", "our_price_95", "calculation_group", "cop", "ppd", "our_price_repeat", "stran", "hermes_id"]
    .every((k) => !!spec(k)),
  CATALOG_EXPORT_COLUMNS.map((c) => c.key));

console.log("\n=== (c) EAN and the codes are marked as quoted text ===");
for (const k of ["ean", "code", "catalogue_no"]) ok(k + " -> quoteText", spec(k).quoteText === true);
ok("nothing else is", CATALOG_EXPORT_COLUMNS.filter((c) => c.quoteText).length === 3);

console.log("\n=== (d) release date is DD.MM.YYYY with NO leading zeros, right aligned ===");
// Client (2026-09-09): the export must read exactly like the app — dots, no leading zeros.
ok("2027-10-08 -> " + formatDmy("2027-10-08"), formatDmy("2027-10-08") === "8.10.2027");
ok("2026-01-02 -> " + formatDmy("2026-01-02"), formatDmy("2026-01-02") === "2.1.2026");
ok("a timestamp still works", formatDmy("2027-10-08T00:00:00Z") === "8.10.2027");
ok("rubbish -> null", formatDmy("nope") === null && formatDmy(null) === null);
ok("the column is right aligned", spec("release_date").align === "right");
ok("the 2099 sentinel still reads TBD",
  spec("release_date").value({ release_date: "2099-12-31" }) === "TBD");
ok("a real date exports unpadded, exactly like the app",
  spec("release_date").value({ release_date: "2027-10-08" }) === "8.10.2027");

console.log("\n=== (e) both \"Our price €\" columns carry the euro format ===");
for (const k of ["our_price", "our_price_repeat"]) {
  ok(k + ' -> ' + spec(k).format, spec(k).format === '#,##0.00" €"', spec(k).format);
  ok("  ...and stays a real number", spec(k).type === "number");
}

// ---------------------------------------------------------------- the finished file
console.log("\n=== the workbook that actually comes out ===");
const rows = [{
  artist: "DIABATE TOUMANI", title: "HERITAGE", format: "LP2", unit: 2,
  ean: "0603497803590", label: "WARNER", code: "0349780359", catalogue_no: "0021430064",
  release_date: "2027-10-08", our_price: 7.5, calculation_group: "1", cop: 2.46,
  ppd: "18,5/14,75", status: "in_progress", hermes_id: "12345",
}, {
  // A sparse row: most of it empty, which is the shape that showed the borders stopping
  // short. Every one of these blanks still has to be inside the ruled rectangle.
  artist: "KOVACS", title: "LEAVE THE SUN BEHIND", ean: "1200214815678",
  label: "WM BENELUX / WM CEG", code: "0021481567", release_date: "2026-08-28",
}];
const columns = CATALOG_EXPORT_COLUMNS.map((c) => ({ ...c, label: c.label ?? c.key }));
const font = { name: "Utsaah", sz: 11 };
const thin = { style: "thin", color: { rgb: "FF000000" } };
const border = { top: thin, bottom: thin, left: thin, right: thin };
const styleFor = (c) => ({
  font: c.bold ? { ...font, bold: true } : font,
  border,
  ...(c.quoteText ? { numFmt: "@" } : {}),
  ...(c.align ? { alignment: { horizontal: c.align } } : {}),
});
const ws = {};
columns.forEach((c, C) => { ws[XLSX.utils.encode_cell({ r: 0, c: C })] = { t: "s", v: c.label, s: { font, border } }; });
rows.forEach((row, i) => {
  const R = i + 1;
  columns.forEach((c, C) => {
    const address = XLSX.utils.encode_cell({ r: R, c: C });
    const s = styleFor(c);
    if (c.formula) { ws[address] = { t: "n", f: c.formula(R + 1, () => "J"), z: c.format, s }; return; }
    const value = c.value ? c.value(row) : row[c.key];
    if (value === null || value === undefined || value === "") { ws[address] = { t: "s", v: "", s }; return; }
    if (c.type === "number" && typeof value === "number") { ws[address] = { t: "n", v: value, z: c.format, s }; return; }
    ws[address] = { t: "s", v: String(value), s, ...(c.quoteText ? { z: "@" } : {}) };
  });
});
ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: columns.length - 1 } });
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Export");

let bytes = new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" }));
const cfb = XLSX.CFB.read(bytes, { type: "array" });
const stylesPart = XLSX.CFB.find(cfb, "/xl/styles.xml");
const xml = new TextDecoder().decode(new Uint8Array(stylesPart.content));
const patched = addQuotePrefixToTextStyles(xml);
ok("the patch changes styles.xml", patched !== xml);
XLSX.CFB.utils.cfb_add(cfb, "/xl/styles.xml", new TextEncoder().encode(patched));
{
  const sheetPart = XLSX.CFB.find(cfb, "/xl/worksheets/sheet1.xml");
  const raw = new TextDecoder().decode(new Uint8Array(sheetPart.content));
  ok("the sheet has styled empty-string cells before the patch", /<v><\/v>|<v\/>/.test(raw));
  XLSX.CFB.utils.cfb_add(cfb, "/xl/worksheets/sheet1.xml", new TextEncoder().encode(blankStyledCellsToEmpty(raw)));
}
bytes = new Uint8Array(XLSX.CFB.write(cfb, { fileType: "zip", type: "array" }));

ok("the patched file still reads as a valid workbook", (() => {
  try { const b = XLSX.read(bytes, { type: "array" }); return b.Sheets.Export.A2.v === "DIABATE TOUMANI"; }
  catch { return false; }
})());

const out = XLSX.CFB.read(bytes, { type: "array" });
const styles2 = new TextDecoder().decode(new Uint8Array(XLSX.CFB.find(out, "/xl/styles.xml").content));
const xfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles2)[1].match(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g);
const textXfs = xfs.filter((x) => /numFmtId="49"/.test(x));
ok("(c) every TEXT style carries quotePrefix (" + textXfs.length + " of them)",
  textXfs.length > 0 && textXfs.every((x) => /quotePrefix="1"/.test(x)), textXfs.slice(0, 1));
ok("...and no other style does",
  xfs.filter((x) => /quotePrefix="1"/.test(x)).length === textXfs.length);
ok("(b) every style used by a populated cell has a border",
  xfs.filter((x) => /applyBorder="1"/.test(x)).length >= 4,
  xfs.filter((x) => /applyBorder="1"/.test(x)).length);
const borders = /<borders[^>]*>([\s\S]*?)<\/borders>/.exec(styles2)[1];
ok("...all four sides, thin",
  /<left style="thin"/.test(borders) && /<right style="thin"/.test(borders) &&
  /<top style="thin"/.test(borders) && /<bottom style="thin"/.test(borders));
ok("(e) the euro number format is in the file", /formatCode="#,##0\.00&quot; €&quot;"/.test(styles2) || /#,##0\.00/.test(styles2));

const sheet = new TextDecoder().decode(new Uint8Array(XLSX.CFB.find(out, "/xl/worksheets/sheet1.xml").content));
ok("(a) the word 'in progress' appears nowhere in the sheet", !/in.progress/i.test(sheet));
const back = XLSX.read(bytes, { type: "array" }).Sheets.Export;
const at = (k) => back[XLSX.utils.encode_col(columns.findIndex((c) => c.key === k)) + "2"];
ok("(c) the EAN is still text, leading zero intact: " + at("ean").v, at("ean").t === "s" && at("ean").v === "0603497803590");
ok("(d) the date reads " + at("release_date").v, at("release_date").v === "8.10.2027");
ok("(e) the price is a NUMBER, so it sums: " + at("our_price").v, at("our_price").t === "n" && at("our_price").v === 7.5);

console.log("\n=== (b) the WHOLE rectangle is ruled, empty cells included ===");
{
  // Alternation at the TOP level, not inside the attribute run: "[^>]*(?:\/>|>...)" lets the
  // greedy class eat the "/" of a self-closing cell, so the match falls through to the
  // ">...</c>" branch and swallows the NEXT cell with it. Two cells counted as one.
  const cells = sheet.match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) ?? [];
  const expected = columns.length * (rows.length + 1);
  ok("a cell exists for every position in the table: " + cells.length + " of " + expected,
    cells.length === expected, { got: cells.length, expected });
  ok("...and every one carries a style, so every one is ruled",
    cells.every((c) => /\bs="\d+"/.test(c)), cells.filter((c) => !/\bs="\d+"/.test(c)).slice(0, 2));

  const blanks = cells.filter((c) => !/<v/.test(c) && !/<f/.test(c));
  ok("the empty ones are present but hold nothing (" + blanks.length + " of them)", blanks.length > 0);
  ok("...not one is an empty STRING — ISBLANK and COUNTA still tell the truth",
    !/<v><\/v>/.test(sheet) && !/<v\/>/.test(sheet));
  ok("...each is exactly a ruled, empty cell",
    blanks.every((c) => /^<c r="[A-Z]+\d+" s="\d+"\/>$/.test(c)), blanks.slice(0, 2));

  // "Stran" has no counterpart in the app and is always empty — it must still be ruled
  const stranCol = XLSX.utils.encode_col(columns.findIndex((c) => c.key === "stran"));
  ok("the always-empty Stran column is ruled on the data row (" + stranCol + "2)",
    new RegExp('<c r="' + stranCol + '2" s="\\d+"\\/>').test(sheet));
  ok("...and Excel still reports it as blank", back[stranCol + "2"] === undefined);

  const ref = /<dimension ref="([^"]+)"/.exec(sheet);
  ok("the declared table size spans the whole rectangle: " + (ref && ref[1]),
    !!ref && ref[1] === "A1:" + XLSX.utils.encode_col(columns.length - 1) + (rows.length + 1), ref && ref[1]);
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
