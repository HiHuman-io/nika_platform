import { type ReactNode } from "react";

export type Row = Record<string, unknown>;

export type ColumnVariant = "text" | "code" | "number" | "date" | "status";

export type ColumnDef = {
  key: string;
  label: string;
  variant?: ColumnVariant;
  /** Tailwind width class used with the fixed table layout, e.g. "w-[14%]". */
  width?: string;
  /** Hide the column below this breakpoint (secondary columns on narrow screens). */
  hideBelow?: "sm" | "md" | "lg";
};

// Light-tinted background with darker same-colour text — legible on light.
const STATUS_STYLES: Record<string, string> = {
  in_progress:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300",
  ready:
    "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-400/25 dark:bg-teal-400/10 dark:text-teal-300",
  approved:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300",
  sent:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-300",
  excluded:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-300",
  ignored:
    "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-500/30 dark:bg-zinc-500/10 dark:text-zinc-300",
};

export const HIDE_CLASS: Record<NonNullable<ColumnDef["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

export function StatusBadge({ value }: { value: string }) {
  const key = value.toLowerCase();
  const style =
    STATUS_STYLES[key] ?? "border-border-strong bg-surface-hover text-muted";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

const CODE_COLUMN = /(^|_)(ean|gtin|sku|barcode|upc|code)s?($|_)/i;

/** Infer a sensible variant when no explicit column config is supplied. */
export function inferVariant(key: string, rows: Row[]): ColumnVariant {
  if (key.toLowerCase() === "status") return "status";
  if (CODE_COLUMN.test(key)) return "code";
  const values = rows
    .map((r) => r[key])
    .filter((v) => v !== null && v !== undefined);
  if (values.length > 0 && values.every((v) => typeof v === "number")) {
    return "number";
  }
  return "text";
}

export function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function renderCellValue(
  value: unknown,
  variant: ColumnVariant,
): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-border-strong">—</span>;
  }
  if (variant === "status" && typeof value === "string") {
    return <StatusBadge value={value} />;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "object") {
    return (
      <span className="font-mono text-xs text-muted">
        {JSON.stringify(value)}
      </span>
    );
  }
  if (variant === "code") {
    return <span className="font-mono text-xs">{String(value)}</span>;
  }
  return String(value);
}

/** Build display columns from the union of keys across rows. */
export function inferColumns(rows: Row[]): ColumnDef[] {
  return Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set()),
  ).map((key) => ({ key, label: key, variant: inferVariant(key, rows) }));
}
