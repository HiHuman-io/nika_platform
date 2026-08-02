import { createClient } from "@/utils/supabase/server";
import {
  CatalogTable,
  type CatalogColumnSpec,
} from "@/components/catalog-table";

export const metadata = { title: "Raw Entries · Nika" };

// Column order requested by the client (2026-07-31). This is the WHOLE visible set —
// `hideUnspecified` starts every other column of the table hidden, so anything the
// workflow or a migration adds later shows up in the "Columns" chooser rather than
// widening the table on its own.
// NOTE: `extraction_audit` is deliberately among the hidden ones now, at the client's
// request. It was the alarm column for "the AI returned fewer items than the source
// printed", so that signal is one click away in "Columns" instead of on screen.
const RAW_ENTRY_COLUMNS: CatalogColumnSpec[] = [
  { key: "received_at", label: "Received at", variant: "date", size: 120 },
  { key: "status", label: "Status", variant: "status", size: 100 },
  { key: "sender", label: "Sender", size: 200 },
  { key: "label", label: "Label", size: 130 },
  { key: "subject", label: "Subject", size: 300 },
  { key: "source_email_id", label: "Source email ID", variant: "code", size: 150 },
  { key: "extracted", label: "Extracted", size: 320 },
  { key: "confidence", label: "Confidence", variant: "number", size: 100 },
];

export default async function RawEntriesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("raw_entries")
    .select("*")
    // `id` tiebreaker keeps the order stable across updates (see catalog page).
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(3000);

  // The extraction completeness check lives inside the `extracted` jsonb (so a
  // missing DB column can never fail the n8n insert — see Build Raw Entry1). Hoist
  // it to a top-level field here so it shows as its own alarm column: non-null means
  // the AI returned fewer items than the source printed.
  const rows = (data ?? []).map((r) => {
    const extracted = r.extracted as { extraction_audit?: string | null } | null;
    return { ...r, extraction_audit: extracted?.extraction_audit ?? null };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Raw Entries
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Per-email AI extractions as they arrive, with confidence and notes.
          Filter the list or mark an entry as ignored.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">Could not load “raw_entries”.</p>
          <p className="mt-0.5 text-red-700/80">{error.message}</p>
        </div>
      ) : (
        <CatalogTable
          table="raw_entries"
          rows={rows}
          columns={RAW_ENTRY_COLUMNS}
          hideUnspecified
          fields={[]}
          entityLabel="raw entry"
          // Bumped with the new layout: widths, visibility and order are remembered
          // per storageKey in localStorage and are merged OVER the defaults, so a
          // browser that had already opened this page would otherwise keep showing
          // the old columns for ever.
          storageKey="raw-entries-table-v2"
          canAdd={false}
          canEdit={false}
          canDelete={false}
          markIgnored
          searchPlaceholder="Search raw entries…"
          pinColumns={["received_at"]}
        />
      )}
    </div>
  );
}
