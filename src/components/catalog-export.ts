import { type Row } from "./table-cells";

/**
 * One column in a generated export file.
 *
 * Richer than the on-screen column spec because the client's catalogue workbook
 * has columns the app has no field for (a blank "Stran"), columns that repeat a
 * field ("Our price" appears twice) and columns Excel computes itself (the 95%
 * price is a live formula, not a frozen number).
 */
export type ExportColumnSpec = {
  /** Unique id for the column. Doubles as the row key when `value` is omitted. */
  key: string;
  /** Header text. Falls back to the on-screen column label, then to `key`. */
  label?: string;
  /** Derived value. Defaults to `row[key]`. Used by CSV, and by xlsx unless `formula` is set. */
  value?: (row: Row) => unknown;
  /** "number" writes a real numeric cell, so Excel can compute on it. Default "text". */
  type?: "text" | "number";
  /** Excel number format for numeric cells, e.g. "0.00". */
  format?: string;
  /**
   * Excel formula for this cell, WITHOUT the leading "=". `sheetRow` is the
   * 1-based row (the header is row 1, so the first data row is 2) and
   * `col(key)` resolves another export column to its letter — so reordering the
   * layout can never silently break the reference. xlsx only; CSV falls back to
   * `value`.
   */
  formula?: (sheetRow: number, col: (key: string) => string) => string;
};

/** Price tiers are stored as 1/2/3 but the client's catalogue spells them F/M/B. */
const CALC_GROUP_LETTER: Record<string, string> = { "1": "F", "2": "M", "3": "B" };

/** Postgres numerics arrive as numbers, but tolerate "17,00"/"17.00" strings too. */
function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** ISO date -> DD.MM.YYYY, the format used throughout the client's catalogue. */
export function formatDmy(value: unknown): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
}

/**
 * Catalog export layout, column-for-column with the client's existing
 * catalogue workbook (agreed 2026-07-27):
 *
 *   artist, title, unit, format, EAN, label, code, cat. no, release date,
 *   our price, our price x 95%, calculation group, COP, PPD, our price,
 *   status, stran, Hermes ID
 *
 * Notes on the odd ones:
 *  - "Our price" deliberately appears TWICE (positions 10 and 15) — the old
 *    workbook has it in both places, so the same field is written twice.
 *  - "Stran" has no counterpart in the app and is not going to get one; the
 *    column exists for layout parity and is always empty.
 *  - Prices are written as real numeric cells so Excel can compute on them and
 *    renders them in the user's locale. Identifiers (EAN, code, cat. no,
 *    Hermes ID) stay text so leading zeros survive.
 */
export const CATALOG_EXPORT_COLUMNS: ExportColumnSpec[] = [
  { key: "artist" },
  { key: "title" },
  { key: "unit", type: "number" },
  { key: "format" },
  { key: "ean" },
  { key: "label" },
  { key: "code" },
  { key: "catalogue_no" },
  { key: "release_date", value: (r) => formatDmy(r.release_date) },
  { key: "our_price", type: "number", format: "0.00", value: (r) => num(r.our_price) },
  {
    key: "our_price_95",
    label: "Our price 95%",
    type: "number",
    format: "0.00",
    // Live formula: editing "Our price" in Excel updates this cell, and it stays
    // blank for as long as "Our price" is empty (the client fills those by hand).
    formula: (sheetRow, col) => {
      const ref = `${col("our_price")}${sheetRow}`;
      return `IF(${ref}="","",${ref}*0.95)`;
    },
    // CSV has no formulas, so compute the same thing for that path.
    value: (r) => {
      const p = num(r.our_price);
      return p === null ? null : Math.round(p * 95) / 100;
    },
  },
  {
    key: "calculation_group",
    value: (r) => CALC_GROUP_LETTER[String(r.calculation_group ?? "")] ?? null,
  },
  { key: "cop", type: "number", format: "0.00", value: (r) => num(r.cop) },
  // `ppd` holds a merged "PPD/Rock bottom" string (e.g. "30,5/24,25") — text.
  { key: "ppd" },
  {
    key: "our_price_repeat",
    label: "Our price €",
    type: "number",
    format: "0.00",
    value: (r) => num(r.our_price),
  },
  // Same wording as the on-screen badge ("in_progress" -> "in progress").
  { key: "status", value: (r) => String(r.status ?? "").replace(/_/g, " ") || null },
  { key: "stran", label: "Stran", value: () => null },
  { key: "hermes_id", label: "Hermes ID" },
];

/** Named export layouts a table can opt into via CatalogTable's `exportPreset`. */
export const EXPORT_PRESETS = {
  catalog: CATALOG_EXPORT_COLUMNS,
} satisfies Record<string, ExportColumnSpec[]>;

export type ExportPreset = keyof typeof EXPORT_PRESETS;
