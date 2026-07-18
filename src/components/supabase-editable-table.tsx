import { createClient } from "@/utils/supabase/server";
import { CatalogTable } from "./catalog-table";
import { type FieldDef } from "./row-form";

/**
 * Server component: fetches a table (read-only here; writes happen via server
 * actions) and hands the rows to the interactive {@link CatalogTable}, which
 * provides resizable columns, per-column filters and CSV export. Query errors
 * are surfaced inline rather than thrown.
 */
export async function SupabaseEditableTable({
  table,
  limit = 500,
  fields,
  idKey,
  canAdd,
  canEdit,
  canDelete,
  searchPlaceholder,
  entityLabel,
  addLabel,
  selectionAction,
  markIgnored,
}: {
  table: string;
  limit?: number;
  fields?: FieldDef[];
  idKey?: string;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  searchPlaceholder?: string;
  entityLabel?: string;
  addLabel?: string;
  selectionAction?: { label: string; pendingMessage: string };
  markIgnored?: boolean;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .select("*")
    // `id` tiebreaker keeps the order stable across updates (see catalog page).
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <p className="font-medium">Could not load “{table}”.</p>
        <p className="mt-0.5 text-red-700/80">{error.message}</p>
      </div>
    );
  }

  return (
    <CatalogTable
      table={table}
      rows={data ?? []}
      columns={[]}
      fields={fields}
      idKey={idKey}
      canAdd={canAdd}
      canEdit={canEdit}
      canDelete={canDelete}
      markIgnored={markIgnored}
      searchPlaceholder={searchPlaceholder}
      entityLabel={entityLabel}
      addLabel={addLabel}
      selectionAction={selectionAction}
      storageKey={`${table}-table`}
      pinColumns={[]}
    />
  );
}
