"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  type ColumnDef as TSColumnDef,
  type ColumnSizingState,
  type PaginationState,
  type RowSelectionState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { CheckCircle2, ChevronLeft, ChevronRight, Copy, Download, EyeOff, Pencil, Plus, Search, Send, SlidersHorizontal, Trash2 } from "lucide-react";

import { bulkDelete, bulkUpdateStatus, duplicateRows, sendToHermes, updateRow } from "@/app/(app)/actions";
import { type Row, StatusBadge, inferVariant, toText } from "./table-cells";
import { ColumnFilter } from "./column-filter";
import { type FieldDef, inferFields, useRowDialogs } from "./row-form";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export type CatalogVariant = "text" | "code" | "number" | "date" | "status";

export type CatalogColumnSpec = {
  key: string;
  label: string;
  variant?: CatalogVariant;
  size?: number;
  hidden?: boolean;
};

type ColumnMeta = { variant?: CatalogVariant; label: string };

function loadPref<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function savePref(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage may be unavailable; preferences just won't persist */
  }
}

/**
 * Initial width (px) for a column with no explicit size: wide enough to show the
 * longest value (sampled) and the header, clamped so a long JSON blob can't blow
 * the layout out. The user can still drag-resize from here.
 */
function autoSizeWidth(key: string, label: string, rows: Row[]): number {
  let maxChars = label.length;
  for (const row of rows.slice(0, 80)) {
    const len = toText(row[key]).length;
    if (len > maxChars) maxChars = len;
  }
  return Math.min(440, Math.max(96, Math.round(maxChars * 7.2 + 30)));
}

/** Minimum width so the (uppercase) header label + filter icon always fit. */
function headerMinWidth(label: string): number {
  return Math.ceil(label.length * 8) + 52;
}

/** Build a UTF-8 CSV (Excel-friendly) from the given columns + rows and download it. */
function downloadCsv(
  filename: string,
  columns: { key: string; label: string }[],
  rows: Row[],
) {
  const esc = (val: unknown) => {
    const t = toText(val);
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const header = columns.map((c) => esc(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => esc(r[c.key])).join(","));
  const csv = String.fromCharCode(0xfeff) + [header, ...body].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function CatalogCell({
  value,
  variant,
}: {
  value: unknown;
  variant?: CatalogVariant;
}) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-border-strong">—</span>;
  }
  if (variant === "status" && typeof value === "string") {
    return <StatusBadge value={value} />;
  }
  if (typeof value === "boolean") return <>{value ? "true" : "false"}</>;
  if (typeof value === "object") {
    // Same font size as every other cell — only the family differs.
    return <span className="font-mono">{JSON.stringify(value)}</span>;
  }
  if (variant === "code") {
    return <span className="font-mono">{String(value)}</span>;
  }
  if (variant === "date" && typeof value === "string") {
    // Slovenian display format D.M.YYYY (e.g. 2026-07-04 -> 4.7.2026). Storage
    // stays ISO — Hermes and date sorting rely on it — so this is display-only.
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (m) return <>{`${Number(m[3])}.${Number(m[2])}.${m[1]}`}</>;
  }
  return <>{String(value)}</>;
}

export function CatalogTable({
  table: tableName,
  rows,
  columns: specs,
  fields: fieldsProp,
  idKey = "id",
  entityLabel = "catalog line",
  selectionAction,
  bulkApprove,
  storageKey = "catalog-table",
  canAdd = true,
  canEdit = true,
  canDelete = true,
  markIgnored = false,
  addLabel = "Add row",
  searchPlaceholder = "Search catalog…",
  pinColumns = ["artist", "title"],
  exportKeys,
}: {
  table: string;
  rows: Row[];
  columns: CatalogColumnSpec[];
  fields?: FieldDef[];
  idKey?: string;
  entityLabel?: string;
  selectionAction?: { label: string };
  /** Bulk action that sets the given status on all selected rows. */
  bulkApprove?: { label: string; status: string };
  storageKey?: string;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  markIgnored?: boolean;
  addLabel?: string;
  searchPlaceholder?: string;
  pinColumns?: string[];
  /**
   * Fixed allow-list of column keys (in order) to include in the CSV export,
   * regardless of what's visible on screen. When omitted, export mirrors the
   * visible columns.
   */
  exportKeys?: string[];
}) {
  const router = useRouter();
  // Explicit fields when provided; otherwise infer them from the data so any
  // table (e.g. Settings) gets working add/edit forms.
  const fields = React.useMemo(
    () => fieldsProp ?? inferFields(rows, idKey),
    [fieldsProp, rows, idKey],
  );
  const { openAdd, openEdit, openDelete, dialogs } = useRowDialogs({
    table: tableName,
    fields,
    entityLabel,
    idKey,
  });

  const onMarkIgnored = React.useCallback(
    async (row: Row) => {
      const payload: Record<string, unknown> =
        "ignored" in row
          ? { ignored: true }
          : "status" in row
            ? { status: "ignored" }
            : { ignored: true };
      const result = await updateRow(
        tableName,
        row[idKey] as string | number,
        payload,
      );
      if (!result.error) router.refresh();
    },
    [tableName, idKey, router],
  );

  // Guarantee the *full* set: any data key not in the spec is appended.
  const allSpecs = React.useMemo<CatalogColumnSpec[]>(() => {
    const known = new Set(specs.map((s) => s.key));
    const extras: CatalogColumnSpec[] = [];
    for (const row of rows) {
      for (const k of Object.keys(row)) {
        if (!known.has(k)) {
          known.add(k);
          extras.push({
            key: k,
            label: k.replace(/_/g, " "),
            variant: inferVariant(k, rows),
          });
          // NB: these must stay VISIBLE. Callers like SupabaseEditableTable pass
          // columns={[]} and rely entirely on this inference — hiding them here
          // blanks out the Settings / Import / Raw Entries tables. Trim what a
          // page fetches in its query instead.
        }
      }
    }
    return [...specs, ...extras];
  }, [specs, rows]);

  // Live search + per-column filters narrow rows before the table sees them.
  const [query, setQuery] = React.useState("");
  // Excel-style: per column, the set of values to keep (empty = no filter).
  const [colFilters, setColFilters] = React.useState<Record<string, string[]>>(
    {},
  );
  const setColumnFilter = React.useCallback((key: string, vals: string[]) => {
    setColFilters((prev) => {
      const next = { ...prev };
      if (vals.length) next[key] = vals;
      else delete next[key];
      return next;
    });
  }, []);

  // Distinct, sorted values per column for the filter dropdowns.
  const columnValues = React.useMemo(() => {
    const sets: Record<string, Set<string>> = {};
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        (sets[key] ??= new Set<string>()).add(toText(row[key]));
      }
    }
    const out: Record<string, string[]> = {};
    for (const k in sets) {
      out[k] = [...sets[k]].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      );
    }
    return out;
  }, [rows]);

  const data = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = Object.entries(colFilters).filter(([, v]) => v.length > 0);
    if (!q && active.length === 0) return rows;
    return rows.filter((row) => {
      if (
        q &&
        !Object.values(row).some((v) => toText(v).toLowerCase().includes(q))
      ) {
        return false;
      }
      for (const [key, vals] of active) {
        if (!vals.includes(toText(row[key]))) return false;
      }
      return true;
    });
  }, [rows, query, colFilters]);

  const defaultVisibility = React.useMemo<VisibilityState>(() => {
    const v: VisibilityState = {};
    for (const s of allSpecs) if (s.hidden) v[s.key] = false;
    return v;
  }, [allSpecs]);

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  // Render one page of rows at a time. With 500 rows x ~30 columns every
  // selection click re-rendered thousands of cells, which felt frozen.
  // Search + column filters still run over the FULL row set (see `data` below);
  // only what reaches the DOM is paged.
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });
  // Narrowing the result set should send you back to the first page.
  React.useEffect(() => {
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }));
  }, [query, colFilters]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(defaultVisibility);
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const [columnOrder, setColumnOrder] = React.useState<string[]>([]);

  // Restore session widths/visibility after mount (avoids hydration mismatch).
  const restored = React.useRef(false);
  React.useEffect(() => {
    setColumnSizing(loadPref(`${storageKey}:sizing`, {}));
    setColumnVisibility((v) => ({
      ...v,
      ...loadPref<VisibilityState>(`${storageKey}:visibility`, {}),
    }));
    setColumnOrder(loadPref<string[]>(`${storageKey}:order`, []));
    restored.current = true;
  }, [storageKey]);
  React.useEffect(() => {
    if (restored.current) savePref(`${storageKey}:sizing`, columnSizing);
  }, [columnSizing, storageKey]);
  React.useEffect(() => {
    if (restored.current) savePref(`${storageKey}:visibility`, columnVisibility);
  }, [columnVisibility, storageKey]);
  React.useEffect(() => {
    if (restored.current) savePref(`${storageKey}:order`, columnOrder);
  }, [columnOrder, storageKey]);

  const showSelect = !!selectionAction || !!bulkApprove;
  const hasActions = canEdit || canDelete || markIgnored;

  const columns = React.useMemo<TSColumnDef<Row>[]>(() => {
    const selectCol: TSColumnDef<Row> = {
      id: "select",
      size: 44,
      enableResizing: false,
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllRowsSelected()
              ? true
              : table.getIsSomeRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
        />
      ),
    };

    const dataCols: TSColumnDef<Row>[] = allSpecs.map((s) => ({
      id: s.key,
      accessorKey: s.key,
      header: s.label,
      // Explicit size when given; otherwise fit the content so text isn't
      // clipped. Never narrower than the header label + filter icon.
      size: Math.max(
        s.size ?? autoSizeWidth(s.key, s.label, rows),
        headerMinWidth(s.label),
      ),
      minSize: 64,
      meta: { variant: s.variant, label: s.label } satisfies ColumnMeta,
      cell: (info) => <CatalogCell value={info.getValue()} variant={s.variant} />,
    }));

    const actionsCol: TSColumnDef<Row> = {
      id: "actions",
      header: "Actions",
      size: 92,
      enableResizing: false,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted hover:text-foreground"
              aria-label="Edit"
              title="Edit"
              onClick={() => openEdit(row.original)}
            >
              <Pencil />
            </Button>
          ) : null}
          {markIgnored ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted hover:text-foreground"
              aria-label="Mark ignored"
              title="Mark ignored"
              onClick={() => onMarkIgnored(row.original)}
            >
              <EyeOff />
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
              aria-label="Delete"
              title="Delete"
              onClick={() => openDelete(row.original)}
            >
              <Trash2 />
            </Button>
          ) : null}
        </div>
      ),
    };

    return [
      ...(showSelect ? [selectCol] : []),
      ...dataCols,
      ...(hasActions ? [actionsCol] : []),
    ];
  }, [
    allSpecs,
    rows,
    showSelect,
    hasActions,
    canEdit,
    canDelete,
    markIgnored,
    openEdit,
    openDelete,
    onMarkIgnored,
  ]);

  const leftPinned = [
    ...(showSelect ? ["select"] : []),
    ...pinColumns.filter((k) => allSpecs.some((s) => s.key === k)),
  ];

  // React Compiler can't memoize TanStack's table instance; that's expected.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      columnVisibility,
      columnSizing,
      columnOrder,
      pagination,
    },
    getRowId: (row) => String(row[idKey]),
    enableRowSelection: true,
    columnResizeMode: "onChange",
    // Keep the current page across router.refresh() (approving on page 3
    // shouldn't bounce you back to page 1); the effect above handles filters.
    autoResetPageIndex: false,
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    initialState: {
      columnPinning: {
        left: leftPinned,
        right: hasActions ? ["actions"] : [],
      },
    },
  });

  // Reorder a data column before the drop-target column (drag-and-drop).
  const moveColumn = (from: string, to: string) => {
    setColumnOrder((prev) => {
      const base = prev.length
        ? prev
        : table.getAllLeafColumns().map((c) => c.id);
      const next = base.filter((id) => id !== from);
      const idx = next.indexOf(to);
      if (idx < 0) return prev;
      next.splice(idx, 0, from);
      return next;
    });
  };

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  // How many selected rows can still be approved (only open/in_progress ones,
  // never excluded).
  const approvableCount = bulkApprove
    ? selectedRows.filter((r) => {
        const s = r.original.status;
        return s !== bulkApprove.status && s !== "excluded";
      }).length
    : 0;
  // Sendable = approved and not yet pushed to Hermes. `sent_at` is the only
  // record of the push (status no longer carries a "sent" value).
  const sendableCount = selectionAction
    ? selectedRows.filter(
        (r) => r.original.status === "approved" && !r.original.sent_at,
      ).length
    : 0;
  const [hermesMessage, setHermesMessage] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const onHermes = async () => {
    if (!selectionAction) return;
    // Only approved lines that haven't been sent yet — same gate as the
    // button's enabled state.
    const ids = selectedRows
      .filter((r) => r.original.status === "approved" && !r.original.sent_at)
      .map((r) => r.id);
    if (ids.length === 0) return;
    setSending(true);
    setActionError(null);
    setHermesMessage(null);
    const result = await sendToHermes(ids);
    setSending(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setHermesMessage(`Sent ${ids.length} line(s) to Hermes.`);
    setRowSelection({});
    router.refresh();
  };

  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const onBulkDelete = async () => {
    const ids = table.getSelectedRowModel().rows.map((r) => r.id);
    if (ids.length === 0) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await bulkDelete(tableName, ids);
    setDeleting(false);
    if (result.error) {
      setDeleteError(result.error);
      return;
    }
    setRowSelection({});
    setConfirmDelete(false);
    router.refresh();
  };

  const [approving, setApproving] = React.useState(false);
  const onApprove = async () => {
    if (!bulkApprove) return;
    const ids = table.getSelectedRowModel().rows.map((r) => r.id);
    if (ids.length === 0) return;
    setApproving(true);
    setActionError(null);
    const result = await bulkUpdateStatus(tableName, ids, bulkApprove.status);
    setApproving(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    // Keep the rows selected: approving is usually followed by "Send to Hermes",
    // and re-picking the same lines is tedious. Selection is keyed by row id
    // (getRowId), so it survives the refresh below.
    router.refresh();
  };

  const [duplicating, setDuplicating] = React.useState(false);
  const onDuplicate = async () => {
    const ids = table.getSelectedRowModel().rows.map((r) => r.id);
    if (ids.length === 0) return;
    setDuplicating(true);
    setActionError(null);
    const result = await duplicateRows(tableName, ids);
    setDuplicating(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setRowSelection({});
    router.refresh();
  };

  const hideableColumns = table
    .getAllLeafColumns()
    .filter((c) => c.getCanHide());

  // Export: when the caller pins an explicit `exportKeys` allow-list, use it
  // verbatim (order + only those columns) no matter what's visible. Otherwise
  // mirror the visible columns + order (hidden columns stay out of the file).
  const exportColumns = () => {
    const labelFor = (key: string) =>
      (allSpecs.find((s) => s.key === key)?.label ?? key);
    if (exportKeys) {
      return exportKeys.map((key) => ({ key, label: labelFor(key) }));
    }
    return table
      .getVisibleLeafColumns()
      .filter((c) => c.id !== "select" && c.id !== "actions")
      .map((c) => ({
        key: c.id,
        label: (c.columnDef.meta as ColumnMeta | undefined)?.label ?? c.id,
      }));
  };
  const onExportAll = () => downloadCsv(`${tableName}.csv`, exportColumns(), data);
  const onExportSelected = () =>
    downloadCsv(
      `${tableName}-selected.csv`,
      exportColumns(),
      table.getSelectedRowModel().rows.map((r) => r.original),
    );

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline">
                <SlidersHorizontal />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {hideableColumns.map((column) => {
                const meta = column.columnDef.meta as ColumnMeta | undefined;
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(v) => column.toggleVisibility(!!v)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {meta?.label ?? column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline">
                <Download />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Download CSV</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onExportAll}>
                Export all (filtered) - {data.length}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={selectedCount === 0}
                onSelect={onExportSelected}
              >
                Export selected{selectedCount > 0 ? ` - ${selectedCount}` : ""}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {canDelete && showSelect ? (
            <Button
              type="button"
              variant="destructive"
              disabled={selectedCount === 0}
              onClick={() => {
                setDeleteError(null);
                setConfirmDelete(true);
              }}
            >
              <Trash2 />
              Delete
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
          ) : null}

          {canAdd && showSelect ? (
            <Button
              type="button"
              variant="outline"
              disabled={selectedCount === 0 || duplicating}
              onClick={onDuplicate}
            >
              <Copy />
              {duplicating ? "Duplicating…" : "Duplicate"}
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
          ) : null}

          {canAdd ? (
            <Button type="button" onClick={openAdd}>
              <Plus />
              {addLabel}
            </Button>
          ) : null}

          {bulkApprove ? (
            <Button
              type="button"
              disabled={approvableCount === 0 || approving}
              onClick={onApprove}
            >
              <CheckCircle2 />
              {approving ? "Approving…" : bulkApprove.label}
              {approvableCount > 0 ? ` (${approvableCount})` : ""}
            </Button>
          ) : null}

          {selectionAction ? (
            <Button
              type="button"
              disabled={sendableCount === 0 || sending}
              onClick={onHermes}
              className="border-0 bg-pink-600 text-white shadow-[0_0_16px_-2px_rgba(236,72,153,0.85)] hover:bg-pink-500 hover:shadow-[0_0_24px_0_rgba(236,72,153,1)]"
            >
              <Send />
              {sending ? "Sending…" : selectionAction.label}
              {!sending && sendableCount > 0 ? ` (${sendableCount})` : ""}
            </Button>
          ) : null}

        </div>
      </div>

      {hermesMessage ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/30 bg-[var(--accent-soft)] px-4 py-2.5 text-sm text-foreground">
          <span>{hermesMessage}</span>
          <button
            type="button"
            onClick={() => setHermesMessage(null)}
            className="text-xs text-muted hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-surface px-4 py-14 text-center shadow-[var(--shadow-card)]">
          <p className="text-sm font-medium text-foreground">
            {query ? "No matching entries." : "No entries yet."}
          </p>
          <p className="text-xs text-muted">
            {query
              ? "Try a different search."
              : "Rows will appear here as soon as there's data."}
          </p>
        </div>
      ) : (
        // overflow-auto keeps the horizontal scroll INSIDE this container.
        <div className="max-h-[calc(100vh-15rem)] w-full overflow-auto rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
          <table
            className="border-collapse text-left text-[13px]"
            style={{ width: table.getTotalSize(), tableLayout: "fixed" }}
          >
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => {
                    const pinned = header.column.getIsPinned();
                    const meta = header.column.columnDef.meta as
                      | ColumnMeta
                      | undefined;
                    const numeric = meta?.variant === "number";
                    const isData =
                      header.column.id !== "select" &&
                      header.column.id !== "actions";
                    return (
                      <th
                        key={header.id}
                        className={`relative border-b border-border bg-surface px-3 py-3 align-top text-xs font-semibold uppercase tracking-wide text-muted ${
                          numeric ? "text-right" : ""
                        }`}
                        onDragOver={isData ? (e) => e.preventDefault() : undefined}
                        onDrop={
                          isData
                            ? (e) => {
                                e.preventDefault();
                                const from =
                                  e.dataTransfer.getData("text/plain");
                                if (from && from !== header.column.id) {
                                  moveColumn(from, header.column.id);
                                }
                              }
                            : undefined
                        }
                        style={{
                          width: header.getSize(),
                          position: "sticky",
                          top: 0,
                          left:
                            pinned === "left"
                              ? header.column.getStart("left")
                              : undefined,
                          right:
                            pinned === "right"
                              ? header.column.getAfter("right")
                              : undefined,
                          zIndex: pinned ? 30 : 20,
                        }}
                      >
                        <div className="flex h-6 items-center gap-1">
                          <span
                            className={`block flex-1 truncate ${
                              isData ? "cursor-grab active:cursor-grabbing" : ""
                            }`}
                            draggable={isData}
                            onDragStart={
                              isData
                                ? (e) =>
                                    e.dataTransfer.setData(
                                      "text/plain",
                                      header.column.id,
                                    )
                                : undefined
                            }
                            title={isData ? "Drag to reorder" : undefined}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                          </span>
                          {isData ? (
                            <ColumnFilter
                              label={meta?.label ?? header.column.id}
                              values={columnValues[header.column.id] ?? []}
                              selected={colFilters[header.column.id] ?? []}
                              onChange={(vals) =>
                                setColumnFilter(header.column.id, vals)
                              }
                            />
                          ) : null}
                        </div>
                        {header.column.getCanResize() ? (
                          <span
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none ${
                              header.column.getIsResizing()
                                ? "bg-accent"
                                : "bg-transparent hover:bg-accent/40"
                            }`}
                          />
                        ) : null}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={(e) => {
                    // Ignore clicks on interactive controls (checkbox, buttons…).
                    if (
                      (e.target as HTMLElement).closest(
                        'button, input, a, [role="checkbox"]',
                      )
                    ) {
                      return;
                    }
                    openEdit(row.original);
                  }}
                  className="group cursor-pointer transition-colors hover:bg-surface-hover/60"
                  data-selected={row.getIsSelected()}
                >
                  {row.getVisibleCells().map((cell) => {
                    const pinned = cell.column.getIsPinned();
                    const meta = cell.column.columnDef.meta as
                      | ColumnMeta
                      | undefined;
                    const numeric = meta?.variant === "number";
                    const isData =
                      cell.column.id !== "select" && cell.column.id !== "actions";
                    return (
                      <td
                        key={cell.id}
                        title={isData ? toText(cell.getValue()) : undefined}
                        className={`${isData ? "truncate" : ""} border-b border-border/60 px-3 py-2.5 text-[13px] text-foreground/90 ${
                          numeric ? "text-right tabular-nums" : ""
                        } ${
                          pinned
                            ? "bg-surface group-hover:bg-surface-hover/60 group-data-[selected=true]:bg-[var(--accent-soft)]"
                            : ""
                        } group-data-[selected=true]:bg-[var(--accent-soft)]`}
                        style={{
                          width: cell.column.getSize(),
                          position: pinned ? "sticky" : undefined,
                          left:
                            pinned === "left"
                              ? cell.column.getStart("left")
                              : undefined,
                          right:
                            pinned === "right"
                              ? cell.column.getAfter("right")
                              : undefined,
                          zIndex: pinned ? 10 : undefined,
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted">
        <p>
          {data.length} {data.length === 1 ? "entry" : "entries"}
          {query ? ` matching "${query}"` : ""}
          {selectedCount > 0 ? ` · ${selectedCount} selected` : ""}
        </p>

        {data.length > pagination.pageSize || pagination.pageIndex > 0 ? (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span>Rows</span>
              <select
                value={pagination.pageSize}
                onChange={(e) =>
                  setPagination({
                    pageIndex: 0,
                    pageSize: Number(e.target.value),
                  })
                }
                className="rounded-md border border-border bg-surface px-1.5 py-1 text-xs text-foreground outline-none focus:border-accent"
              >
                {[50, 100, 200, 500].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <span>
              Page {pagination.pageIndex + 1} of{" "}
              {Math.max(1, table.getPageCount())}
            </span>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
                aria-label="Previous page"
                title="Previous page"
              >
                <ChevronLeft />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
                aria-label="Next page"
                title="Next page"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {dialogs}

      <Dialog
        open={confirmDelete}
        onOpenChange={(o) => {
          if (!deleting) setConfirmDelete(o);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {`Delete ${selectedCount} ${entityLabel}${
                selectedCount === 1 ? "" : "s"
              }?`}
            </DialogTitle>
            <DialogDescription>
              {`This permanently removes the selected ${entityLabel}${
                selectedCount === 1 ? "" : "s"
              }. This action can't be undone.`}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300">
              {deleteError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={deleting}
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={onBulkDelete}
            >
              {deleting ? "Deleting…" : `Delete ${selectedCount}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
