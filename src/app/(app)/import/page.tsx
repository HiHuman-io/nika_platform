import { createClient } from "@/utils/supabase/server";
import { CatalogTable } from "@/components/catalog-table";
import { ImportDialog } from "@/components/import-dialog";
import { ProcessedImportDialog } from "@/components/processed-import-dialog";

export const metadata = { title: "Import · Nika" };

/**
 * Two sections, split by `manual_imports.kind` (client, 2026-08-19):
 *
 *  - New Releases — the section that already existed. A file a label shared directly, handed
 *    to n8n for LlamaParse + AI extraction into the Main/Other catalog.
 *  - Processed Catalog — Mare's own catalogue workbook, parsed in the browser and written
 *    straight into the Processed catalog, so that tab (and the dedup shield it gives the
 *    extraction workflow) stays current.
 */
async function loadImports(kind: "releases" | "processed") {
  const supabase = await createClient();
  return supabase
    .from("manual_imports")
    .select("*")
    // Rows created before `kind` existed are New Releases uploads; the column defaults to
    // 'releases' so they land in the right section without a backfill.
    .eq("kind", kind)
    // `id` tiebreaker keeps the order stable across updates (see catalog page).
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(500);
}

function LoadError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <p className="font-medium">Could not load “manual_imports”.</p>
      <p className="mt-0.5 text-red-700/80">{message}</p>
    </div>
  );
}

export default async function ImportPage() {
  const [releases, processed] = await Promise.all([
    loadImports("releases"),
    loadImports("processed"),
  ]);

  return (
    <div className="space-y-10">
      <section className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              Import - New Releases
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              Upload Excel/PDF files labels share directly (e.g. private links). Each upload
              is stored and sent for extraction into the catalog.
            </p>
          </div>
          <ImportDialog />
        </div>

        {releases.error ? (
          <LoadError message={releases.error.message} />
        ) : (
          <CatalogTable
            table="manual_imports"
            rows={releases.data ?? []}
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
      </section>

      <section className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              Import - Processed Catalog
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              Upload the catalogue workbook to keep the Processed catalog up to date. Rows go
              in as approved and sent to Hermes; a barcode already in the catalog is skipped,
              never overwritten.
            </p>
          </div>
          <ProcessedImportDialog />
        </div>

        {processed.error ? (
          <LoadError message={processed.error.message} />
        ) : (
          <CatalogTable
            table="manual_imports"
            rows={processed.data ?? []}
            columns={[]}
            fields={[]}
            entityLabel="import"
            storageKey="imports-processed-table"
            canAdd={false}
            canEdit={false}
            canDelete
            searchPlaceholder="Search catalogue imports…"
            pinColumns={[]}
          />
        )}
      </section>
    </div>
  );
}
