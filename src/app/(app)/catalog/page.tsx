import { createClient } from "@/utils/supabase/server";
import { CatalogTable, type CatalogColumnSpec } from "@/components/catalog-table";
import { type FieldDef } from "@/components/row-form";

export const metadata = { title: "Catalog · Nika" };

// Display set (full set of columns). `status` drives the coloured badge;
// source_status is a plain data field. id/ruleset_version/missing_fields/
// confidence are present but hidden by default — toggle them via "Columns".
const CATALOG_COLUMNS: CatalogColumnSpec[] = [
  { key: "artist", label: "Artist", size: 140 },
  { key: "title", label: "Title", size: 190 },
  { key: "format", label: "Format", size: 95 },
  { key: "label", label: "Label", size: 120 },
  { key: "ean", label: "EAN", variant: "code", size: 125 },
  { key: "release_date", label: "Release", variant: "date", size: 105 },
  { key: "price_eur", label: "Price €", variant: "number", size: 85 },
  { key: "price_secondary", label: "Price 2nd", variant: "number", size: 95 },
  { key: "cop", label: "COP", variant: "number", size: 75 },
  { key: "ppd", label: "PPD", variant: "number", size: 75 },
  { key: "our_price", label: "Our price", variant: "number", size: 95 },
  { key: "source_status", label: "Source status", size: 120 },
  { key: "stran", label: "Stran", size: 80 },
  { key: "ne", label: "Ne", size: 70 },
  { key: "calculation_group", label: "Calc group", size: 130 },
  { key: "status", label: "Status", variant: "status", size: 120 },
  { key: "id", label: "ID", size: 80, hidden: true },
  { key: "ruleset_version", label: "Ruleset version", size: 120, hidden: true },
  { key: "missing_fields", label: "Missing fields", size: 150, hidden: true },
  { key: "confidence", label: "Confidence", variant: "number", size: 100, hidden: true },
];

const CATALOG_FIELDS: FieldDef[] = [
  { key: "artist", label: "Artist", type: "text", required: true },
  { key: "title", label: "Title", type: "text", required: true },
  { key: "format", label: "Format", type: "text" },
  { key: "label", label: "Label", type: "text" },
  { key: "ean", label: "EAN", type: "text" },
  { key: "release_date", label: "Release date", type: "date" },
  { key: "price_eur", label: "Price (€)", type: "number" },
  { key: "price_secondary", label: "Price secondary", type: "number" },
  { key: "cop", label: "COP", type: "number" },
  { key: "ppd", label: "PPD", type: "number" },
  { key: "our_price", label: "Our price", type: "number" },
  { key: "source_status", label: "Source status", type: "text" },
  { key: "stran", label: "Stran", type: "text" },
  { key: "ne", label: "Ne", type: "text" },
  { key: "calculation_group", label: "Calculation group", type: "text" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["in_progress", "ready", "approved", "sent", "excluded"],
  },
];

export default async function CatalogPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_lines")
    .select("*")
    .limit(500);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Catalog
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Merged catalog lines — add, edit, filter and select rows to send.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">Could not load “catalog_lines”.</p>
          <p className="mt-0.5 text-red-700/80">{error.message}</p>
        </div>
      ) : (
        <CatalogTable
          table="catalog_lines"
          rows={data ?? []}
          columns={CATALOG_COLUMNS}
          fields={CATALOG_FIELDS}
          entityLabel="catalog line"
          selectionAction={{
            label: "Send to Hermes",
            pendingMessage: "Hermes integration coming soon",
          }}
        />
      )}
    </div>
  );
}
