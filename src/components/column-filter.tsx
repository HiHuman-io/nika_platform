"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ListFilter, Search, X } from "lucide-react";

/**
 * Excel-style column filter: a header button that opens a searchable checklist
 * of the column's distinct values. The user can type to narrow the list and
 * tick the values to keep. Portaled to <body> so the table's scroll container
 * never clips it.
 */
export function ColumnFilter({
  label,
  values,
  selected,
  onChange,
}: {
  label: string;
  values: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(
    null,
  );

  const active = selected.length > 0;

  const openPanel = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const left = Math.min(r.left, window.innerWidth - 272);
      setPos({ top: r.bottom + 4, left: Math.max(8, left) });
    }
    setSearch("");
    setOpen(true);
  };

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        btnRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    const close = () => setOpen(false);
    // Close on scroll (the fixed position would otherwise go stale) — but NOT
    // when the scroll happens inside the panel's own value list, otherwise
    // scrolling the checklist would dismiss it.
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const q = search.trim().toLowerCase();
  const shown = q ? values.filter((v) => v.toLowerCase().includes(q)) : values;
  const CAP = 500;
  const capped = shown.slice(0, CAP);
  const selectedSet = new Set(selected);
  const allShownSelected =
    capped.length > 0 && capped.every((v) => selectedSet.has(v));

  const toggle = (v: string) => {
    const next = new Set(selectedSet);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange([...next]);
  };
  const toggleAllShown = () => {
    const next = new Set(selectedSet);
    if (allShownSelected) capped.forEach((v) => next.delete(v));
    else capped.forEach((v) => next.add(v));
    onChange([...next]);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-label={`Filter ${label}`}
        title={`Filter ${label}`}
        className={`inline-flex size-6 shrink-0 items-center justify-center rounded transition-colors ${
          active
            ? "bg-[var(--accent-soft)] text-accent"
            : "text-muted hover:bg-surface-hover hover:text-foreground"
        }`}
      >
        <ListFilter className="size-3.5" />
      </button>

      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              style={{ position: "fixed", top: pos.top, left: pos.left, width: 256 }}
              className="z-[60] rounded-lg border border-border bg-surface p-2 text-foreground shadow-2xl shadow-black/25"
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search values…"
                  className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-sm normal-case tracking-normal outline-none focus:border-accent"
                />
              </div>

              <div className="mt-1.5 flex items-center justify-between px-1 text-xs font-medium normal-case tracking-normal">
                <button
                  type="button"
                  onClick={toggleAllShown}
                  className="text-accent hover:underline"
                >
                  {allShownSelected ? "Clear shown" : "Select all"}
                </button>
                {active ? (
                  <button
                    type="button"
                    onClick={() => onChange([])}
                    className="inline-flex items-center gap-1 text-muted hover:text-foreground"
                  >
                    <X className="size-3" />
                    Reset
                  </button>
                ) : null}
              </div>

              <div className="mt-1 max-h-56 overflow-y-auto">
                {capped.map((v) => (
                  <label
                    key={v}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm font-normal normal-case tracking-normal hover:bg-surface-hover"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSet.has(v)}
                      onChange={() => toggle(v)}
                      className="size-3.5 accent-[var(--accent)]"
                    />
                    <span className="truncate">
                      {v === "" ? (
                        <span className="italic text-muted">(empty)</span>
                      ) : (
                        v
                      )}
                    </span>
                  </label>
                ))}
                {capped.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted">No matches.</p>
                ) : null}
                {shown.length > CAP ? (
                  <p className="px-1 py-1 text-xs text-muted">
                    +{shown.length - CAP} more - refine your search.
                  </p>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
