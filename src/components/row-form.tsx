"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { insertRow, updateRow, deleteRow } from "@/app/(app)/actions";
import { type Row } from "./table-cells";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "textarea"
  | "boolean";

export type FieldDef = {
  key: string;
  label: string;
  type?: FieldType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
};

const SYSTEM_KEYS = new Set(["id", "created_at", "updated_at", "inserted_at"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

export function humanize(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Derive editable form fields from the data when none are supplied. */
export function inferFields(rows: Row[], idKey: string): FieldDef[] {
  const keys = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set()),
  ).filter((k) => k !== idKey && !SYSTEM_KEYS.has(k));

  return keys.map((key) => {
    const sample = rows
      .map((r) => r[key])
      .find((v) => v !== null && v !== undefined);
    let type: FieldType = "text";
    if (typeof sample === "number") type = "number";
    else if (typeof sample === "boolean") type = "boolean";
    else if (typeof sample === "object") type = "textarea";
    else if (typeof sample === "string" && DATE_RE.test(sample)) type = "date";
    else if (/note|description|comment/i.test(key)) type = "textarea";
    return { key, label: humanize(key), type };
  });
}

function initialValues(fields: FieldDef[], row?: Row | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = row?.[f.key];
    if (v === null || v === undefined) {
      out[f.key] = f.type === "boolean" ? "false" : "";
    } else if (f.type === "date" && typeof v === "string") {
      out[f.key] = v.slice(0, 10);
    } else if (typeof v === "object") {
      out[f.key] = JSON.stringify(v);
    } else {
      out[f.key] = String(v);
    }
  }
  return out;
}

/** Convert the string form state into a typed payload for Supabase. */
function buildPayload(fields: FieldDef[], values: Record<string, string>) {
  const payload: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = values[f.key] ?? "";
    if (f.type === "number") {
      payload[f.key] = raw === "" ? null : Number(raw);
    } else if (f.type === "boolean") {
      payload[f.key] = raw === "true";
    } else if (f.type === "textarea") {
      if (raw === "") payload[f.key] = null;
      else {
        try {
          payload[f.key] = JSON.parse(raw);
        } catch {
          payload[f.key] = raw;
        }
      }
    } else {
      payload[f.key] = raw === "" ? null : raw;
    }
  }
  return payload;
}

/**
 * Add / Edit dialog, self-contained. Mount it fresh (via a `key`) each time it
 * opens so its internal form state initialises from the right row.
 */
export function RowFormDialog({
  open,
  onOpenChange,
  mode,
  table,
  fields,
  entityLabel,
  row,
  idKey = "id",
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  table: string;
  fields: FieldDef[];
  entityLabel: string;
  row?: Row | null;
  idKey?: string;
  onSaved: () => void;
}) {
  const [values, setValues] = React.useState(() =>
    initialValues(fields, mode === "edit" ? row : null),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = fields.find(
      (f) => f.required && (values[f.key] ?? "").trim() === "",
    );
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    setPending(true);
    setError(null);
    const payload = buildPayload(fields, values);
    const result =
      mode === "add"
        ? await insertRow(table, payload)
        : await updateRow(table, row?.[idKey] as string | number, payload);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? `Add ${entityLabel}` : `Edit ${entityLabel}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? `Create a new ${entityLabel}. It will be saved to Supabase.`
              : `Update this ${entityLabel} and save your changes.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="grid min-h-0 flex-1 auto-rows-min gap-4 overflow-y-auto pr-1">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={`field-${f.key}`}>
                  {f.label}
                  {f.required ? (
                    <span className="ml-0.5 text-accent">*</span>
                  ) : null}
                </Label>
                <FieldInput
                  field={f}
                  value={values[f.key] ?? ""}
                  onChange={(v) =>
                    setValues((prev) => ({ ...prev, [f.key]: v }))
                  }
                />
              </div>
            ))}
          </div>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Delete confirmation dialog, self-contained. */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  table,
  id,
  entityLabel,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: string;
  id: string | number;
  entityLabel: string;
  onDeleted: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const confirm = async () => {
    setPending(true);
    setError(null);
    const result = await deleteRow(table, id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDeleted();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {entityLabel}?</DialogTitle>
          <DialogDescription>
            This permanently removes the {entityLabel} from Supabase. This action
            can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={confirm}
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Hook that wires up form + delete dialog state for a table component. */
export function useRowDialogs(opts: {
  table: string;
  fields: FieldDef[];
  entityLabel: string;
  idKey?: string;
}) {
  const router = useRouter();
  const idKey = opts.idKey ?? "id";
  const [formState, setFormState] = React.useState<{
    mode: "add" | "edit";
    row: Row | null;
  } | null>(null);
  const [deleteState, setDeleteState] = React.useState<Row | null>(null);

  const openAdd = () => setFormState({ mode: "add", row: null });
  const openEdit = (row: Row) => setFormState({ mode: "edit", row });
  const openDelete = (row: Row) => setDeleteState(row);

  const dialogs = (
    <>
      {formState ? (
        <RowFormDialog
          key={`${formState.mode}:${
            formState.row?.[idKey] != null ? String(formState.row[idKey]) : "new"
          }`}
          open
          onOpenChange={(o) => {
            if (!o) setFormState(null);
          }}
          mode={formState.mode}
          table={opts.table}
          fields={opts.fields}
          entityLabel={opts.entityLabel}
          row={formState.row}
          idKey={idKey}
          onSaved={() => {
            setFormState(null);
            router.refresh();
          }}
        />
      ) : null}

      {deleteState ? (
        <DeleteConfirmDialog
          open
          onOpenChange={(o) => {
            if (!o) setDeleteState(null);
          }}
          table={opts.table}
          id={deleteState[idKey] as string | number}
          entityLabel={opts.entityLabel}
          onDeleted={() => {
            setDeleteState(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );

  return { openAdd, openEdit, openDelete, dialogs };
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === "select" && field.options) {
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={`field-${field.key}`}>
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {humanize(opt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "boolean") {
    return (
      <Select value={value || "false"} onValueChange={onChange}>
        <SelectTrigger id={`field-${field.key}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Yes</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        id={`field-${field.key}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        className="flex w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
      />
    );
  }

  return (
    <Input
      id={`field-${field.key}`}
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      step={field.type === "number" ? "any" : undefined}
      value={value}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
