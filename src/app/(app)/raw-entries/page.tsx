import { SupabaseEditableTable } from "@/components/supabase-editable-table";

export const metadata = { title: "Raw Entries · Nika" };

export default function RawEntriesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Raw Entries
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Per-email AI extractions as they arrive, with confidence and notes.
          Filter the list or mark an entry as ignored.
        </p>
      </div>

      <SupabaseEditableTable
        table="raw_entries"
        searchPlaceholder="Search raw entries…"
        entityLabel="raw entry"
        markIgnored
      />
    </div>
  );
}
