"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Send, Trash2, EyeOff } from "lucide-react";

import { updateRow } from "@/app/(app)/actions";
import {
  type ColumnDef,
  type Row,
  HIDE_CLASS,
  inferColumns,
  renderCellValue,
  toText,
} from "./table-cells";
import {
  type FieldDef,
  inferFields,
  useRowDialogs,
} from "./row-form";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";

export type { FieldDef, FieldType } from "./row-form";

type SelectionAction = { label: string; pendingMessage: string };

export function EditableTable({
  table,
  rows,
  columns,
  fields: fieldsProp,
  idKey = "id",
  canAdd = false,
  canEdit = false,
  canDelete = false,
  searchPlaceholder = "Search…",
  entityLabel = "row",
  addLabel,
  selectionAction,
  markIgnored = false,
}: {
  table: string;
  rows: Row[];
  columns?: ColumnDef[];
  fields?: FieldDef[];
  idKey?: string;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  searchPlaceholder?: string;
  entityLabel?: string;
  addLabel?: string;
  selectionAction?: SelectionAction;
  markIgnored?: boolean;
}) {
  const router = useRouter();

  const fields = React.useMemo(
    () => fieldsProp ?? inferFields(rows, idKey),
    [fieldsProp, rows, idKey],
  );
  const cols = React.useMemo(
    () => columns ?? inferColumns(rows),
    [columns, rows],
  );

  const { openAdd, openEdit, openDelete, dialogs } = useRowDialogs({
    table,
    fields,
    entityLabel,
    idKey,
  });

  const hasRowActions = canEdit || canDelete || markIgnored;
  const actionCount =
    (canEdit ? 1 : 0) + (markIgnored ? 1 : 0) + (canDelete ? 1 : 0);
  const actionColWidth =
    actionCount >= 3 ? "w-32" : actionCount === 2 ? "w-24" : "w-16";

  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      Object.values(row).some((v) => toText(v).toLowerCase().includes(q)),
    );
  }, [rows, query]);

  // Selection (for the "Send to Hermes" toolbar action).
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const filteredIds = filtered.map((r) => String(r[idKey]));
  const allSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someSelected = filteredIds.some((id) => selected.has(id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });

  const [hermesMessage, setHermesMessage] = React.useState<string | null>(null);
  const onHermes = () => {
    if (!selectionAction) return;
    setHermesMessage(
      `${selectionAction.pendingMessage} (${selected.size} rows selected)`,
    );
  };

  const onMarkIgnored = async (row: Row) => {
    const payload: Record<string, unknown> =
      "ignored" in row
        ? { ignored: true }
        : "status" in row
          ? { status: "ignored" }
          : { ignored: true };
    const result = await updateRow(table, row[idKey] as string | number, payload);
    if (!result.error) router.refresh();
  };

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
          {selectionAction ? (
            <Button
              type="button"
              variant="outline"
              disabled={selected.size === 0}
              onClick={onHermes}
            >
              <Send />
              {selectionAction.label}
              {selected.size > 0 ? ` (${selected.size})` : ""}
            </Button>
          ) : null}
          {canAdd && fields.length > 0 ? (
            <Button type="button" onClick={openAdd}>
              <Plus />
              {addLabel ?? "Add"}
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

      {/* Table */}
      {filtered.length === 0 ? (
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
        <div className="max-h-[calc(100vh-18rem)] w-full overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface">
                {selectionAction ? (
                  <th className="w-10 border-b border-border bg-surface px-4 py-3">
                    <Checkbox
                      checked={
                        allSelected ? true : someSelected ? "indeterminate" : false
                      }
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                ) : null}
                {cols.map((col) => {
                  const numeric = col.variant === "number";
                  const hide = col.hideBelow ? ` ${HIDE_CLASS[col.hideBelow]}` : "";
                  return (
                    <th
                      key={col.key}
                      className={`truncate border-b border-border bg-surface px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted ${
                        numeric ? "text-right" : ""
                      } ${col.width ?? ""}${hide}`}
                    >
                      {col.label}
                    </th>
                  );
                })}
                {hasRowActions ? (
                  <th
                    className={`border-b border-border bg-surface px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted ${actionColWidth}`}
                  >
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const id = String(row[idKey]);
                return (
                  <tr
                    key={id}
                    className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-hover/60"
                  >
                    {selectionAction ? (
                      <td className="px-4 py-2.5">
                        <Checkbox
                          checked={selected.has(id)}
                          onCheckedChange={() => toggleOne(id)}
                          aria-label="Select row"
                        />
                      </td>
                    ) : null}
                    {cols.map((col) => {
                      const variant = col.variant ?? "text";
                      const numeric = variant === "number";
                      const hide = col.hideBelow
                        ? ` ${HIDE_CLASS[col.hideBelow]}`
                        : "";
                      return (
                        <td
                          key={col.key}
                          title={toText(row[col.key])}
                          className={`truncate px-4 py-2.5 text-foreground/90 ${
                            numeric ? "text-right tabular-nums" : ""
                          }${hide}`}
                        >
                          {renderCellValue(row[col.key], variant)}
                        </td>
                      );
                    })}
                    {hasRowActions ? (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted hover:text-foreground"
                              aria-label="Edit"
                              title="Edit"
                              onClick={() => openEdit(row)}
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
                              onClick={() => onMarkIgnored(row)}
                            >
                              <EyeOff />
                            </Button>
                          ) : null}
                          {canDelete ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted hover:bg-red-50 hover:text-red-600"
                              aria-label="Delete"
                              title="Delete"
                              onClick={() => openDelete(row)}
                            >
                              <Trash2 />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="px-1 text-xs text-muted">
        {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
        {query ? ` matching "${query}"` : ""}
        {selectionAction && selected.size > 0
          ? ` · ${selected.size} selected`
          : ""}
      </p>

      {dialogs}
    </div>
  );
}
