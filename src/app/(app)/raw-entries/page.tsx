import { createClient } from "@/utils/supabase/server";
import { CatalogTable } from "@/components/catalog-table";

export const metadata = { title: "Raw Entries · Nika" };

export default async function RawEntriesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("raw_entries")
    .select("*")
    .limit(500);

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
          rows={data ?? []}
          columns={[]}
          fields={[]}
          entityLabel="raw entry"
          storageKey="raw-entries-table"
          canAdd={false}
          canEdit={false}
          canDelete={false}
          markIgnored
          searchPlaceholder="Search raw entries…"
          pinColumns={[]}
        />
      )}
    </div>
  );
}
