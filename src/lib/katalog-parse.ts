/**
 * Mare's catalogue workbook -> catalog_lines rows for the Processed catalog.
 *
 * The client keeps the finished catalogue in one Excel file and hands it over periodically
 * so the app's Processed tab stays current. Processed is not just a display: it is the dedup
 * shield the extraction workflow relies on, so a barcode that is in that file must be in
 * that tab or the same release gets re-catalogued from the next release mail.
 *
 * Parsed DIRECTLY rather than through LlamaParse + the AI (client, 2026-08-19). The file is
 * a spreadsheet with a fixed, known layout — every value is already in a cell, so there is
 * nothing for a model to interpret, and 25k rows through an LLM would be slow, expensive and
 * would put every barcode at risk of being "helpfully" reformatted.
 *
 * The mapping is the one proven on the real file by scripts/import-katalog.mjs, which
 * produced the 25,725 rows already in the tab — kept deliberately identical so a re-import
 * of the same workbook lands on exactly the same values and dedups cleanly.
 */

export type KatalogRow = {
  ean: string | null;
  code: string | null;
  catalogue_no: string | null;
  artist: string | null;
  title: string | null;
  format: string | null;
  unit: number;
  label: string | null;
  release_date: string;
  cop: number | null;
  ppd: string | null;
  our_price: number | null;
  supplier_code: string;
  calculation_group: string;
  hermes_id: string | null;
  catalog: "processed";
  status: "approved";
};

export type ParseReport = {
  rows: KatalogRow[];
  /** Rows read from the sheet, header excluded. */
  read: number;
  /** Calculation group "D" — the client does not carry those over. */
  droppedD: number;
  /** No barcode and no catalogue number: nothing that could identify or dedup a product. */
  droppedNoId: number;
  /** A barcode repeated inside the file itself. */
  droppedDuplicate: number;
  /** Which sheet the rows came from. */
  sheet: string | null;
  /**
   * Only when NO sheet could be used: the required headers (Artist / Title / EAN) that the
   * best candidate was missing, so the error can say what it looked for.
   */
  missingColumns: string[];
  /**
   * Expected headers the chosen sheet does NOT have. Those fields import as blank for every
   * row, which is legitimate — a workbook need not carry a COP column — but is also exactly
   * what a RENAMED or misspelled header looks like ("Our Price" -> "Price" would import
   * 25,000 rows with no price and no complaint). Surfaced so a silent gap becomes a visible
   * one; it never blocks the import.
   */
  columnsNotFound: string[];
};

/** Labels whose supplier code is not the Warner default. From the proven importer. */
const SUPPLIER_CODES: Record<string, string> = {
  MATRIXMUSIC: "54",
  MATRIX: "54",
  PIASRECORDINGS: "1009",
  PIAS: "1009",
};

/** The workbook spells the price tier F/M/B; the app stores 1/2/3. */
const CALC: Record<string, string> = { F: "1", M: "2", B: "3" };

/**
 * The far-future sentinel already used everywhere for "not announced" — shown as TBD in the
 * app, sent to Hermes as 31.12.2099. A historical row with no readable date gets it rather
 * than a blank, exactly as the original import did.
 */
const TBD_DATE = "2099-12-31";

function up(s: unknown): string {
  return String(s ?? "").toUpperCase();
}

function labelKey(s: unknown): string {
  return up(s).replace(/[^A-Z0-9]/g, "");
}

/**
 * A leading "!!!" in the workbook is a sorting marker, not part of the name — the original
 * import stripped it and the rows already in the tab have it stripped. But "!!!" is also a
 * real band, so the strip only applies when something is left afterwards; otherwise the row
 * would arrive with no artist at all.
 */
function stripBangs(value: string): string {
  const stripped = value.replace(/^!!!\s*/, "").trim();
  return stripped === "" ? value.trim() : stripped;
}

/** The artist may not start or end with "THE". (The workbook's titles are left as printed.) */
function dropThe(value: string): string {
  const original = value;
  let t = value.trim();
  if (t.slice(0, 4).toUpperCase() === "THE ") t = t.slice(4).trim();
  t = t.replace(/[\s,]+THE\s*$/i, "").trim();
  return t === "" ? original : t;
}

/** The normalised barcode the unique index dedups on: check digit and leading zeros gone. */
export function toCode(ean: unknown): string | null {
  const digits = String(ean ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.slice(0, -1).replace(/^0+/, "") || null;
}

/** "2LP" -> "LP2" (the Hermes convention); "1CD" -> "CD"; anything else is passed through. */
function normFormat(value: unknown): string | null {
  const s = up(value).trim();
  const m = /^(\d+)\s*(LP|CD|MC)$/.exec(s);
  if (m) return m[2] + (m[1] === "1" ? "" : m[1]);
  return s.replace(/\s+/g, "") || null;
}

/** The workbook writes dates the US way ("9/5/26"). Returns ISO, or null if unreadable. */
function isoFromUsDate(value: unknown): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(String(value ?? "").trim());
  if (!m) return null;
  let year = Number(m[3]);
  // Two-digit years: the workbook holds releases decades back and a season or two ahead, so
  // the pivot sits just past the present rather than at an arbitrary 50.
  if (year < 100) year = year <= 26 ? 2000 + year : 1900 + year;
  return `${year}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
}

/**
 * A price or a count out of a spreadsheet cell, in either European or English notation.
 *
 * This is the ONE place that deliberately departs from scripts/import-katalog.mjs. That
 * script kept only digits and dots, so a cell reading "7,99" — which is how a Slovenian
 * Excel writes it, and how prices already appear elsewhere in this catalog — became 799: a
 * hundredfold error in a price column, silently. Here the LAST separator followed by one or
 * two digits is the decimal point and every earlier one is thousands grouping, so "7,99",
 * "7.99", "1.234,56" and "1,234.56" all read correctly and "1,234" stays 1234.
 */
function num(value: unknown): number | null {
  let s = String(value ?? "").replace(/[^\d.,-]/g, "").trim();
  if (!s) return null;
  const sep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  if (sep >= 0) {
    const tail = s.slice(sep + 1);
    s = /^\d{1,2}$/.test(tail)
      ? s.slice(0, sep).replace(/[.,]/g, "") + "." + tail
      : s.replace(/[.,]/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Header cell -> lookup key, so "CATALOGUE NO", "Catalogue No" and "catalogue  no" agree. */
function headerKey(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Which header each field is read from. First match wins, so the exact spellings in the
 * client's own file come first and the tolerant variants are only a fallback.
 */
const COLUMNS = {
  artist: ["artist"],
  title: ["title"],
  format: ["format"],
  unit: ["unit"],
  ean: ["ean", "barcode"],
  label: ["label"],
  catalogue_no: ["catalogue no", "catalogue number", "cat no", "cat. no"],
  release_date: ["release date"],
  cop: ["cop"],
  ppd: ["ppd"],
  our_price: ["our price"],
  calculation_group: ["calculation group"],
  hermes_id: ["hermes id"],
} as const;

/** Without these there is no usable row, so a sheet lacking them is the wrong sheet. */
const REQUIRED = ["artist", "title", "ean"] as const;

type SheetRow = Record<string, unknown>;

function pick(row: SheetRow, names: readonly string[]): unknown {
  for (const n of names) {
    if (n in row) return row[n];
  }
  return "";
}

/** Re-key a sheet row by normalised header so lookups are case- and spacing-insensitive. */
function normaliseKeys(row: SheetRow): SheetRow {
  const out: SheetRow = {};
  for (const k of Object.keys(row)) out[headerKey(k)] = row[k];
  return out;
}

/**
 * Map one workbook's rows. `sheets` is [sheetName, rowsAsObjects][] — the caller does the
 * XLSX reading so this module stays free of the spreadsheet library and testable on its own.
 */
export function parseKatalog(sheets: [string, SheetRow[]][]): ParseReport {
  const empty: ParseReport = {
    rows: [],
    read: 0,
    droppedD: 0,
    droppedNoId: 0,
    droppedDuplicate: 0,
    sheet: null,
    missingColumns: [],
    columnsNotFound: [],
  };

  // Pick the sheet that actually holds the catalogue. The client's file calls it "List1",
  // but choosing by CONTENT means a renamed tab, or a workbook with a cover sheet in front,
  // still imports instead of failing with an empty result.
  let chosen: [string, SheetRow[]] | null = null;
  let bestMissing: string[] = [...REQUIRED];
  for (const [name, rows] of sheets) {
    if (!rows.length) continue;
    const keys = new Set(Object.keys(normaliseKeys(rows[0])));
    const missing = REQUIRED.filter((f) => !COLUMNS[f].some((n) => keys.has(n)));
    if (missing.length === 0) {
      chosen = [name, rows];
      bestMissing = [];
      break;
    }
    if (missing.length < bestMissing.length) bestMissing = missing;
  }
  if (!chosen) return { ...empty, missingColumns: bestMissing };

  const [sheetName, sheetRows] = chosen;
  // Which of the expected headers this sheet simply does not have. Those fields will be
  // blank on every row — fine when the workbook genuinely has no such column, and the only
  // warning anyone gets when a header has been renamed since the last import.
  const headers = new Set(Object.keys(normaliseKeys(sheetRows[0])));
  const columnsNotFound = (Object.keys(COLUMNS) as (keyof typeof COLUMNS)[])
    .filter((f) => !COLUMNS[f].some((n) => headers.has(n)))
    .map((f) => COLUMNS[f][0]);

  const report: ParseReport = {
    ...empty,
    sheet: sheetName,
    read: sheetRows.length,
    columnsNotFound,
  };
  const seen = new Set<string>();

  for (const raw of sheetRows) {
    const row = normaliseKeys(raw);

    const calc = up(pick(row, COLUMNS.calculation_group)).trim();
    if (calc === "D") {
      report.droppedD++;
      continue;
    }

    const ean = String(pick(row, COLUMNS.ean) ?? "").trim() || null;
    const catalogueNo = String(pick(row, COLUMNS.catalogue_no) ?? "").trim() || null;
    if (!ean && !catalogueNo) {
      report.droppedNoId++;
      continue;
    }

    const code = toCode(ean);
    // Dedup key: the normalised barcode when there is one, else the catalogue number. Two
    // rows sharing it are the same product listed twice in the workbook.
    const key = code ? "E:" + code : "C:" + labelKey(catalogueNo);
    if (seen.has(key)) {
      report.droppedDuplicate++;
      continue;
    }
    seen.add(key);

    const label = String(pick(row, COLUMNS.label) ?? "").trim() || null;
    const ppd = num(pick(row, COLUMNS.ppd));

    report.rows.push({
      ean,
      code,
      catalogue_no: catalogueNo,
      artist: up(dropThe(stripBangs(String(pick(row, COLUMNS.artist) ?? "")))) || null,
      title: up(String(pick(row, COLUMNS.title) ?? "").trim()) || null,
      format: normFormat(pick(row, COLUMNS.format)),
      unit: num(pick(row, COLUMNS.unit)) || 1,
      label: label ? up(label) : null,
      release_date: isoFromUsDate(pick(row, COLUMNS.release_date)) ?? TBD_DATE,
      cop: num(pick(row, COLUMNS.cop)),
      ppd: ppd === null ? null : String(ppd),
      our_price: num(pick(row, COLUMNS.our_price)),
      supplier_code: SUPPLIER_CODES[labelKey(label)] ?? "149",
      calculation_group: CALC[calc] ?? "1",
      hermes_id: String(pick(row, COLUMNS.hermes_id) ?? "").trim() || null,
      catalog: "processed",
      status: "approved",
    });
  }

  return report;
}
