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
  // Where the line came from: sender address + when they sent it, e.g.
  // "promo@elektra.com — 31.07.2026 10:43". Written by the workflow from v30 on;
  // blank on everything older (deliberately not backfilled — client, 2026-07-31).
  { key: "source_email", label: "Source email", size: 210 },
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
  // Hermes ID shown by default, immediately to the right of Orig. price (client, 2026-07).
  { key: "hermes_id", label: "Hermes ID", size: 130 },
  { key: "price_secondary", label: "Price 2nd", variant: "number", size: 95, hidden: true },
  { key: "catalog", label: "Catalog", size: 90, hidden: true },
  { key: "approved_by", label: "Approved by", size: 150, hidden: true },
  { key: "notes", label: "Notes", size: 200, hidden: true },
  { key: "extra", label: "Extra", size: 220, hidden: true },
  // Thread ID is available in the "Columns" chooser but hidden by default (client, 2026-07).
  { key: "thread_id", label: "Thread ID", variant: "code", size: 150, hidden: true },
  { key: "id", label: "ID", size: 80, hidden: true },
  { key: "ruleset_version", label: "Ruleset version", size: 120, hidden: true },
  { key: "missing_fields", label: "Missing fields", size: 150, hidden: true },
  { key: "confidence", label: "Confidence", variant: "number", size: 100, hidden: true },
];

// Edit-dialog order, requested by the client (2026-07-31): the fields they actually
// touch when fixing a line come first — artist, title, format, unit, genre, label,
// calculation group, supplier code, EAN, release date — and everything else keeps the
// order it already had underneath. `source_email` is deliberately absent: it is
// provenance written by the workflow, not something to type over.
const CATALOG_FIELDS: FieldDef[] = [
  { key: "artist", label: "Artist", type: "text", required: true },
  { key: "title", label: "Title", type: "text", required: true },
  { key: "format", label: "Format", type: "text" },
  { key: "unit", label: "Unit", type: "number" },
  { key: "genre", label: "Genre", type: "text" },
  { key: "label", label: "Label", type: "text" },
  { key: "calculation_group", label: "Calculation group", type: "text" },
  // Defaults to 149 (Warner) on new/empty rows, per the client.
  { key: "supplier_code", label: "Supplier code", type: "text", default: "149" },
  { key: "ean", label: "EAN", type: "text" },
  { key: "release_date", label: "Release date", type: "date" },
  // The rest, in the order they already had.
  { key: "code", label: "Code", type: "text" },
  { key: "catalogue_no", label: "Catalogue no", type: "text" },
  { key: "rock_bottom", label: "Rock Bottom (€)", type: "number" },
  { key: "currency", label: "Original currency", type: "text" },
  { key: "price_original", label: "Original price", type: "text" },
  { key: "price_secondary", label: "Price secondary", type: "number" },
  { key: "cop", label: "COP (€)", type: "number" },
  { key: "ppd", label: "PPD (€) — merged, e.g. 30,5/24,25", type: "text" },
  { key: "our_price", label: "Our price (€)", type: "number" },
  { key: "source_status", label: "Source status", type: "text" },
  {
    key: "status",
    label: "Status",
    type: "select",
    // No "sent" here — whether a line reached Hermes is shown by the derived
    // "Hermes" column (driven by sent_at), not by the workflow status.
    options: ["in_progress", "approved", "excluded"],
  },
];

// Fields that must be non-blank before a line can be sent to Hermes — a blank one
// makes the send fail (e.g. an empty Format), so "Send to Hermes" warns first and
// lists exactly what's missing per line. Edit this list in one place.
// NOTE: release_date is deliberately NOT required — it may legitimately be a real
// date, blank, or the TBD/2099 sentinel, all of which Hermes accepts.
const HERMES_REQUIRED_FIELDS = [
  { key: "artist", label: "Artist" },
  { key: "title", label: "Title" },
  { key: "ean", label: "EAN" },
  { key: "format", label: "Format" },
  { key: "calculation_group", label: "Calculation group" },
  { key: "supplier_code", label: "Supplier code" },
];

// How many rows we ship to the browser per tab. Filtering/search runs client-side
// over everything loaded, so this is also the ceiling for "filter across all pages".
// The migrated Processed catalog can hold tens of thousands of rows — we deliberately
// do NOT load them all; the true total is shown in the tab label via an exact count.
const MAX_ROWS = 3000;

// Derive display-only fields server-side so the client table stays dumb:
//  - hermes_sent: the "Hermes" badge (driven by sent_at)
//  - exclusion_reason / review_note / late_update: pulled out of the `extra` jsonb so
//    they read as plain columns (the raw `extra` blob stays too).
function mapRows(data: Record<string, unknown>[] | null) {
  return (data ?? []).map((r) => {
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
}

export default async function CatalogPage() {
  const supabase = await createClient();

  // One query PER TAB. A single fetch ordered by created_at would let the migrated
  // Processed catalog (imported all at once, so all "newest") push Main/Other out of
  // the window entirely. `count: "exact"` returns the true total ignoring the 3000
  // display cap, so the tab labels stay correct even when a tab has more rows than we
  // show. NB: the select stays ONE inline literal (Supabase infers the row shape from
  // it) — keep the three identical.
  const tab = (apply: (q: any) => any) =>
    apply(
      supabase
        .from("catalog_lines")
        // prettier-ignore
        .select("id, artist, title, status, format, unit, label, genre, ean, code, catalogue_no, release_date, rock_bottom, cop, ppd, our_price, currency, price_original, price_secondary, source_status, calculation_group, supplier_code, ruleset_version, missing_fields, confidence, notes, thread_id, hermes_id, approved_at, approved_by, sent_at, created_at, updated_at, catalog, extra", { count: "exact" }),
    )
      // created_at never changes and `id` breaks ties deterministically, so rows keep
      // a stable order across approve / edit / send updates.
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(MAX_ROWS);

  const [mainRes, otherRes, processedRes] = await Promise.all([
    // Legacy rows may have a null catalog; treat those as Main.
    tab((q) => q.or("catalog.is.null,catalog.eq.main")),
    tab((q) => q.eq("catalog", "other")),
    tab((q) => q.eq("catalog", "processed")),
  ]);

  const error = mainRes.error || otherRes.error || processedRes.error;
  const mainRows = mapRows(mainRes.data);
  const otherRows = mapRows(otherRes.data);
  const processedRows = mapRows(processedRes.data);
  const mainCount = mainRes.count ?? mainRows.length;
  const otherCount = otherRes.count ?? otherRows.length;
  const processedCount = processedRes.count ?? processedRows.length;

  // Same table for every tab; only the rows and the new-row `catalog` default differ.
  // `catalog` is an editable select, so a line can be moved between the three.
  const renderTable = (
    catalogRows: typeof mainRows,
    catalog: "main" | "other" | "processed",
  ) => (
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
          options: ["main", "other", "processed"],
          default: catalog,
        },
      ]}
      entityLabel="catalog line"
      storageKey={`catalog-${catalog}-v2`}
      bulkApprove={{ label: "Approve", status: "approved" }}
      selectionAction={{
        label: "Send to Hermes",
        requiredFields: HERMES_REQUIRED_FIELDS,
      }}
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
            { value: "main", label: `Main Catalog (${mainCount})` },
            { value: "other", label: `Other Catalog (${otherCount})` },
            { value: "processed", label: `Processed Catalog (${processedCount})` },
          ]}
        >
          {renderTable(mainRows, "main")}
          {renderTable(otherRows, "other")}
          {renderTable(processedRows, "processed")}
        </Tabs>
      )}
    </div>
  );
}
