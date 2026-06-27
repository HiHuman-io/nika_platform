import { createClient } from "@/utils/supabase/server";
import { EditableTable, type FieldDef } from "./editable-table";
import { type ColumnDef } from "./table-cells";

/**
 * Server component: fetches a table (read-only here; writes happen via server
 * actions) and hands the rows to the interactive {@link EditableTable}. Query
 * errors are surfaced inline rather than thrown.
 */
export async function SupabaseEditableTable({
  table,
  limit = 500,
  columns,
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
  columns?: ColumnDef[];
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
  const { data, error } = await supabase.from(table).select("*").limit(limit);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <p className="font-medium">Could not load “{table}”.</p>
        <p className="mt-0.5 text-red-700/80">{error.message}</p>
      </div>
    );
  }

  return (
    <EditableTable
      table={table}
      rows={data ?? []}
      columns={columns}
      fields={fields}
      idKey={idKey}
      canAdd={canAdd}
      canEdit={canEdit}
      canDelete={canDelete}
      searchPlaceholder={searchPlaceholder}
      entityLabel={entityLabel}
      addLabel={addLabel}
      selectionAction={selectionAction}
      markIgnored={markIgnored}
    />
  );
}
