// `import type` (not `import { type … }`) so the statement is fully erased at compile time.
// table-cells is a .tsx module and catalog-export must stay importable on its own — the
// export helpers are unit-tested by running this file directly under node.
import type { Row } from "./table-cells";

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
  /**
   * Horizontal alignment of the DATA cells in the xlsx (the header row is always
   * left). Excel's own default is right for numbers and left for text, so this is
   * only needed where the client wants otherwise — e.g. the identifiers, which are
   * text cells so leading zeros survive but should read right-aligned like numbers.
   * xlsx only; CSV has no formatting.
   */
  align?: "left" | "right" | "center";
  /** Bold data cells in the xlsx. xlsx only. */
  bold?: boolean;
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
  // Day/month without leading zeros, per the client: 2026-10-02 -> 2.10.2026 (not
  // 02.10.2026). Used by both the on-screen catalog and the xlsx/csv export. Storage
  // stays ISO and Hermes still receives ISO, so this is display-only.
  return m ? `${+m[3]}.${+m[2]}.${m[1]}` : null;
}

/**
 * The clock the client reads. Slovenia, so CET in winter and CEST in summer — using the
 * IANA zone rather than a fixed +01:00 keeps the app agreeing with their wall clock all
 * year, and it is the same zone the workflow already stamps `source_email` with.
 */
export const CATALOG_TIME_ZONE = "Europe/Ljubljana";

/** Anything Postgres returns from a `timestamptz`: "2026-08-19T11:18:15.711266+00:00". */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

/**
 * A stored UTC timestamp -> "DD.MM.YYYY HH:mm" in Slovenian local time.
 *
 * `created_at`, `sent_at` and friends reach the table as inferred columns and used to be
 * printed as the raw UTC ISO string, so a row created at 11:18 UTC read "11:18" while the
 * `source_email` beside it read "13:15" — the same moment, two clocks, and it looked like a
 * data bug (client, 2026-08-19). Storage stays `timestamptz` in UTC; this is display only.
 * Returns null for anything that is not a timestamp (a plain date, a name, a number), so
 * callers can fall back to their normal rendering.
 */
export function formatDateTimeCet(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_DATETIME.test(value)) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: CATALOG_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

/** One carrier of a stored format: letters, then an optional 1-2 digit disc count. */
const FORMAT_PART = /^([A-Za-z]+)(\d{1,2})?$/;

/**
 * Split a stored format into the two columns the client's workbook uses.
 *
 * Storage, the on-screen catalog and Hermes all keep the Hermes convention, where the disc
 * count is glued onto the letters ("LP2"). The exported workbook wants the carrier in
 * "Format" and the count in "Unit" (client, 2026-08-19), so "LP2" exports as LP / 2 and a
 * plain "CD" as CD / 1.
 *
 * A single product made of MIXED carriers — a deluxe box holding 2 LPs and 3 CDs — is one
 * catalog line whose format joins them with "&": "LP2&CD3" exports as "LP&CD" / "2&3".
 *
 * Anything that does not parse (an unexpected format string) is passed through untouched
 * with the stored unit, so an unknown value can never be silently mangled.
 */
export function splitFormatUnit(
  format: unknown,
  storedUnit: unknown,
): { format: string | null; unit: number | string | null } {
  const raw = String(format ?? "").trim();
  const fallbackUnit = (storedUnit ?? null) as number | string | null;
  if (!raw) return { format: null, unit: fallbackUnit };

  const parsed = raw.split("&").map((part) => FORMAT_PART.exec(part.trim()));
  if (parsed.some((m) => m === null)) return { format: raw, unit: fallbackUnit };

  const letters = parsed.map((m) => m![1].toUpperCase());
  const counts = parsed.map((m) => (m![2] ? Number(m![2]) : 1));
  return {
    format: letters.join("&"),
    // One carrier keeps a real number so Excel writes a numeric cell; a mixed box has no
    // single count, so it reads "2&3" alongside "LP&CD".
    unit: counts.length === 1 ? counts[0] : counts.join("&"),
  };
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
  // Client (2026-08-03): unit reads right, like a count.
  // Client (2026-08-19): the disc count belongs in THIS column, not glued onto the format —
  // "LP2" exports as format LP + unit 2. Storage, the screen and Hermes keep "LP2".
  { key: "unit", type: "number", align: "right", value: (r) => splitFormatUnit(r.format, r.unit).unit },
  { key: "format", value: (r) => splitFormatUnit(r.format, r.unit).format },
  // Identifiers stay TEXT so leading zeros survive, but read right-aligned like the
  // numbers they look like (client, 2026-08-03).
  { key: "ean", align: "right" },
  { key: "label" },
  { key: "code", align: "right" },
  { key: "catalogue_no", align: "right" },
  // The 2099 sentinel (Warner group, unannounced date) exports as "TBD"; non-Warner
  // missing dates are blank. Hermes still gets the ISO 2099-12-31 from the workflow.
  {
    key: "release_date",
    value: (r) =>
      String(r.release_date ?? "").slice(0, 10) === "2099-12-31"
        ? "TBD"
        : formatDmy(r.release_date),
  },
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
    // Bold: the client scans this column first (2026-08-03).
    bold: true,
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
  { key: "hermes_id", label: "Hermes ID", align: "left" },
];

/** Named export layouts a table can opt into via CatalogTable's `exportPreset`. */
export const EXPORT_PRESETS = {
  catalog: CATALOG_EXPORT_COLUMNS,
} satisfies Record<string, ExportColumnSpec[]>;

export type ExportPreset = keyof typeof EXPORT_PRESETS;
