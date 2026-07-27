import { createClient } from "@/utils/supabase/server";
import { CatalogTable, type CatalogColumnSpec } from "@/components/catalog-table";
import { type FieldDef } from "@/components/row-form";
import { Tabs } from "@/components/tabs";

export const metadata = { title: "Catalog · Nika" };

// Display set (full set of columns). `status` drives the coloured badge;
// source_status is a plain data field. id/ruleset_version/missing_fields/
// confidence are present but hidden by default — toggle them via "Columns".
// Column order requested by the client (2026-07). Everything after `our_price`
// is "the rest, left as it was".
const CATALOG_COLUMNS: CatalogColumnSpec[] = [
  { key: "artist", label: "Artist", size: 140 },
  { key: "title", label: "Title", size: 190 },
  { key: "status", label: "Status", variant: "status", size: 120 },
  { key: "hermes_sent", label: "Hermes", variant: "status", size: 115 },
  { key: "unit", label: "Unit", variant: "number", size: 65 },
  { key: "format", label: "Format", size: 95 },
  { key: "ean", label: "EAN", variant: "code", size: 125 },
  { key: "label", label: "Label", size: 120 },
  { key: "code", label: "Code", variant: "code", size: 115 },
  { key: "catalogue_no", label: "Cat. no", size: 105 },
  { key: "release_date", label: "Release", variant: "date", size: 105 },
  // Readable reason (pulled from the `extra` jsonb) — mainly for excluded lines.
  { key: "exclusion_reason", label: "Exclusion reason", size: 200 },
  // Also out of `extra`, hidden until wanted: why the workflow wants a human to
  // look (e.g. an indefinite territory), and follow-ups that arrived after the
  // line had already gone to Hermes and so were deliberately not applied.
  { key: "review_note", label: "Review note", size: 240, hidden: true },
  { key: "late_update", label: "Late update", size: 240, hidden: true },
  { key: "calculation_group", label: "Calculation group", size: 130 },
  { key: "supplier_code", label: "Supplier code", size: 110 },
  // Price block: Rock Bottom -> COP -> PPD -> Our price.
  { key: "rock_bottom", label: "Rock Bottom €", variant: "number", size: 115 },
  { key: "cop", label: "COP €", variant: "number", size: 80 },
  // ppd holds a merged "PPD_EUR/RockBottom" string (e.g. "30,5/24,25") — text.
  { key: "ppd", label: "PPD €", size: 105 },
  { key: "our_price", label: "Our price €", variant: "number", size: 100 },
  // The rest, unchanged.
  { key: "genre", label: "Genre", size: 110 },
  { key: "source_status", label: "Source status", size: 120 },
  { key: "currency", label: "Orig. cur.", size: 70 },
  { key: "price_original", label: "Orig. price", size: 95 },
  { key: "price_secondary", label: "Price 2nd", variant: "number", size: 95, hidden: true },
  { key: "catalog", label: "Catalog", size: 90, hidden: true },
  { key: "approved_by", label: "Approved by", size: 150, hidden: true },
  { key: "notes", label: "Notes", size: 200, hidden: true },
  { key: "extra", label: "Extra", size: 220, hidden: true },
  // Hidden, but declared so the xlsx export gets a clean "Hermes ID" header.
  { key: "hermes_id", label: "Hermes ID", size: 130, hidden: true },
  { key: "id", label: "ID", size: 80, hidden: true },
  { key: "ruleset_version", label: "Ruleset version", size: 120, hidden: true },
  { key: "missing_fields", label: "Missing fields", size: 150, hidden: true },
  { key: "confidence", label: "Confidence", variant: "number", size: 100, hidden: true },
];

const CATALOG_FIELDS: FieldDef[] = [
  { key: "artist", label: "Artist", type: "text", required: true },
  { key: "title", label: "Title", type: "text", required: true },
  { key: "format", label: "Format", type: "text" },
  { key: "unit", label: "Unit", type: "number" },
  { key: "genre", label: "Genre", type: "text" },
  { key: "label", label: "Label", type: "text" },
  { key: "ean", label: "EAN", type: "text" },
  { key: "code", label: "Code", type: "text" },
  { key: "catalogue_no", label: "Catalogue no", type: "text" },
  { key: "release_date", label: "Release date", type: "date" },
  { key: "rock_bottom", label: "Rock Bottom (€)", type: "number" },
  { key: "currency", label: "Original currency", type: "text" },
  { key: "price_original", label: "Original price", type: "text" },
  { key: "price_secondary", label: "Price secondary", type: "number" },
  { key: "cop", label: "COP (€)", type: "number" },
  { key: "ppd", label: "PPD (€) — merged, e.g. 30,5/24,25", type: "text" },
  { key: "our_price", label: "Our price (€)", type: "number" },
  { key: "source_status", label: "Source status", type: "text" },
  { key: "calculation_group", label: "Calculation group", type: "text" },
  // Defaults to 149 (Warner) on new/empty rows, per the client.
  { key: "supplier_code", label: "Supplier code", type: "text", default: "149" },
  {
    key: "status",
    label: "Status",
    type: "select",
    // No "sent" here — whether a line reached Hermes is shown by the derived
    // "Hermes" column (driven by sent_at), not by the workflow status.
    options: ["in_progress", "approved", "excluded"],
  },
];

export default async function CatalogPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_lines")
    // Every column except `extra` (jsonb): the table renders a JSON.stringify of
    // it on every row, which is the one field that genuinely hurt. Everything
    // else stays available so no column silently disappears from the view.
    // NB: keep this as ONE string literal — Supabase infers the row type from it,
    // and a concatenated string degrades to `string` and breaks that inference.
    // prettier-ignore
    .select("id, artist, title, status, format, unit, label, genre, ean, code, catalogue_no, release_date, rock_bottom, cop, ppd, our_price, currency, price_original, price_secondary, source_status, calculation_group, supplier_code, ruleset_version, missing_fields, confidence, notes, thread_id, hermes_id, approved_at, approved_by, sent_at, created_at, updated_at, catalog, extra")
    // created_at never changes, and `id` breaks ties deterministically. Without
    // the tiebreaker Postgres may return rows sharing a created_at (a batch from
    // one extraction) in a different order after any UPDATE, so lines jumped
    // around when they were approved / edited / sent.
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(500);

  // Derive display-only fields server-side so the client table stays dumb:
  //  - hermes_sent: the "Hermes" badge (driven by sent_at)
  //  - exclusion_reason: pulled out of the `extra` jsonb so the reason a line was
  //    excluded is a plain, readable column (the raw `extra` blob stays too).
  const rows = (data ?? []).map((r) => {
    const extra = (r.extra ?? null) as {
      exclusion_reason?: string | null;
      review_note?: string | null;
      late_update?: { at?: string; changes?: string[] } | null;
    } | null;
    const late = extra?.late_update ?? null;
    return {
      ...r,
      hermes_sent: r.sent_at ? "sent" : "not_sent",
      exclusion_reason: extra?.exclusion_reason ?? null,
      review_note: extra?.review_note ?? null,
      late_update: late
        ? `${late.at ?? ""} ${(late.changes ?? []).join("; ")}`.trim()
        : null,
    };
  });

  // Two catalogs share one table via the `catalog` column: 'other' for Matrix
  // Music / I-DI music / Pias Recordings, 'main' for the rest.
  const mainRows = rows.filter((r) => r.catalog !== "other");
  const otherRows = rows.filter((r) => r.catalog === "other");

  // Same table for both tabs; only the rows and the new-row catalog default
  // differ. `catalog` is an editable select, so a line can be moved between them.
  const renderTable = (catalogRows: typeof rows, catalog: "main" | "other") => (
    <CatalogTable
      table="catalog_lines"
      rows={catalogRows}
      columns={CATALOG_COLUMNS}
      fields={[
        ...CATALOG_FIELDS,
        {
          key: "catalog",
          label: "Catalog",
          type: "select",
          options: ["main", "other"],
          default: catalog,
        },
      ]}
      entityLabel="catalog line"
      storageKey={`catalog-${catalog}-v2`}
      bulkApprove={{ label: "Approve", status: "approved" }}
      selectionAction={{ label: "Send to Hermes" }}
      exportFormat="xlsx"
      // Column-for-column with the client's own catalogue workbook — the
      // layout lives in `components/catalog-export.ts`.
      exportPreset="catalog"
    />
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Catalog
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Merged catalog lines - add, edit, filter and select rows to send.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">Could not load “catalog_lines”.</p>
          <p className="mt-0.5 text-red-700/80">{error.message}</p>
        </div>
      ) : (
        <Tabs
          tabs={[
            { value: "main", label: `Main Catalog (${mainRows.length})` },
            { value: "other", label: `Other Catalog (${otherRows.length})` },
          ]}
        >
          {renderTable(mainRows, "main")}
          {renderTable(otherRows, "other")}
        </Tabs>
      )}
    </div>
  );
}
