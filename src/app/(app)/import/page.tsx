import { createClient } from "@/utils/supabase/server";
import { CatalogTable } from "@/components/catalog-table";
import { ImportDialog } from "@/components/import-dialog";

export const metadata = { title: "Import · Nika" };

export default async function ImportPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("manual_imports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            Import
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Upload Excel/PDF files labels share directly (e.g. private links).
            Each upload is stored and sent to n8n for extraction into the
            catalog.
          </p>
        </div>
        <ImportDialog />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">Could not load “manual_imports”.</p>
          <p className="mt-0.5 text-red-700/80">{error.message}</p>
        </div>
      ) : (
        <CatalogTable
          table="manual_imports"
          rows={data ?? []}
          columns={[]}
          fields={[]}
          entityLabel="import"
          storageKey="imports-table"
          canAdd={false}
          canEdit={false}
          canDelete
          searchPlaceholder="Search imports…"
          pinColumns={[]}
        />
      )}
    </div>
  );
}
