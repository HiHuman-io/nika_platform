import { createClient } from "@/utils/supabase/server";
import { CatalogTable, type CatalogColumnSpec } from "./catalog-table";
import { type FieldDef } from "./row-form";

// `id` is a uuid primary key — a backend join key that means nothing to the person
// maintaining these rules, so it starts hidden on every settings tab (client,
// 2026-07-31). Listed rather than dropped: it stays available in "Columns" for the
// rare moment someone needs to quote a row to support. Every other column is still
// inferred from the data and visible, which is what these generic tables rely on.
const HIDE_ID: CatalogColumnSpec[] = [
  { key: "id", label: "ID", size: 80, hidden: true },
];

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
      columns={HIDE_ID}
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
      // Bumped when `id` was hidden: column visibility is remembered per storageKey
      // in localStorage and merged OVER the defaults, so a browser that had already
      // opened Settings would otherwise keep showing the ID column for ever.
      storageKey={`${table}-table-v2`}
      pinColumns={[]}
    />
  );
}
