import { createClient } from "@/utils/supabase/server";
import { CatalogTable } from "@/components/catalog-table";

export const metadata = { title: "Raw Entries · Nika" };

export default async function RawEntriesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("raw_entries")
    .select("*")
    // `id` tiebreaker keeps the order stable across updates (see catalog page).
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(500);

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
          columns={[]}
          fields={[]}
          entityLabel="raw entry"
          storageKey="raw-entries-table"
          canAdd={false}
          canEdit={false}
          canDelete={false}
          markIgnored
          searchPlaceholder="Search raw entries…"
          pinColumns={["extraction_audit"]}
        />
      )}
    </div>
  );
}
