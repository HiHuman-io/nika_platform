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

/** Keys that are never something you'd look a rule up by. */
const NOT_A_SORT_KEY = new Set(["id", "created_at", "updated_at", "inserted_at"]);

/**
 * The first two columns the user actually sees, in the order they see them.
 * `select *` returns keys in table-definition order and the table renders them in
 * that same order (after the hidden `id`), so reading them off the row keeps the
 * sort and the layout in step by construction — rename or reorder a column and the
 * sort follows, with nothing here to update.
 */
function sortKeys(row: Record<string, unknown> | undefined) {
  return Object.keys(row ?? {})
    .filter((k) => !NOT_A_SORT_KEY.has(k))
    .slice(0, 2);
}

/** Blank/`null`/whitespace sorts last, everything else A–Z, case- and accent-aware. */
function compareCell(a: unknown, b: unknown) {
  const x = a == null ? "" : String(a).trim();
  const y = b == null ? "" : String(b).trim();
  if (!x && !y) return 0;
  if (!x) return 1;
  if (!y) return -1;
  return x.localeCompare(y, undefined, { sensitivity: "base", numeric: true });
}

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
    // Newest-first decides WHICH rows come back if a table ever exceeds `limit`;
    // what you see is then sorted alphabetically below. `id` tiebreaker keeps the
    // fetch stable across updates (see catalog page).
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

  // A settings table is a list of rules you look things up in, not a feed — creation
  // order tells the reader nothing and scatters the blank-first-column rules through
  // the list (client, 2026-07-31). Sort A–Z on the first column, then the second, with
  // blanks last at both levels: a "keyword only" block rule sits under the ones that
  // name a sender, itself ordered by keyword.
  const rows = [...(data ?? [])];
  const [first, second] = sortKeys(rows[0]);
  if (first) {
    rows.sort(
      (a, b) =>
        compareCell(a[first], b[first]) ||
        (second ? compareCell(a[second], b[second]) : 0) ||
        // last resort so the order can never wobble between renders
        compareCell(a.id, b.id),
    );
  }

  return (
    <CatalogTable
      table={table}
      rows={rows}
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
