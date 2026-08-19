"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

import {
  finishProcessedImport,
  importProcessedRows,
  startProcessedImport,
} from "@/app/(app)/import/actions";
import { parseKatalog, type ParseReport } from "@/lib/katalog-parse";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

/** Rows per server round trip. Matches CHUNK_INSERT in the import action. */
const CHUNK = 300;

const n = (v: number) => v.toLocaleString("en-GB");

/**
 * "Import - Processed Catalog": Mare's own catalogue workbook, straight into the Processed
 * tab as approved and sent (client, 2026-08-19).
 *
 * The file is READ IN THE BROWSER and only the mapped rows are sent to the server — no
 * LlamaParse, no AI, no upload to Storage. It is a spreadsheet with a fixed layout, so every
 * value is already in a cell and there is nothing for a model to interpret; running 25k rows
 * through one would be slow, expensive, and would put every barcode at risk of being
 * reformatted. Reading it here also means the client watches the progress bar instead of
 * waiting on a webhook.
 */
export function ProcessedImportDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);

  const reset = () => {
    setError(null);
    setStatus(null);
    setProgress(null);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Please choose the catalogue file.");
      return;
    }

    setBusy(true);
    reset();
    try {
      setStatus("Reading the workbook…");
      // Dynamic import: SheetJS is large and only this dialog needs it.
      const XLSX = await import("xlsx-js-style");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheets: [string, Record<string, unknown>[]][] = wb.SheetNames.map((name) => [
        name,
        // raw:false + defval:'' gives the same strings the proven importer worked from, so
        // leading zeros on barcodes survive and a blank cell is "" rather than missing.
        XLSX.utils.sheet_to_json(wb.Sheets[name], { raw: false, defval: "" }) as Record<
          string,
          unknown
        >[],
      ]);

      const report: ParseReport = parseKatalog(sheets);
      if (!report.rows.length) {
        setBusy(false);
        setError(
          report.missingColumns.length
            ? `No catalogue sheet found. Looked for columns: ${report.missingColumns.join(", ")}.`
            : "That workbook produced no importable rows.",
        );
        return;
      }

      const started = await startProcessedImport({ fileName: file.name });
      if (started.error || !started.id) {
        setBusy(false);
        setError(started.error ?? "Could not start the import.");
        return;
      }

      // One moment shared by every row of one upload, so the whole batch reads as a single
      // event in the catalog rather than smeared across the minutes the import took.
      const sentAt = new Date().toISOString();
      let inserted = 0;
      let skipped = 0;
      let failed = 0;
      const total = report.rows.length;

      for (let i = 0; i < total; i += CHUNK) {
        const slice = report.rows.slice(i, i + CHUNK);
        const res = await importProcessedRows({
          rows: slice as unknown as Record<string, unknown>[],
          sentAt,
        });
        if (res.error) {
          await finishProcessedImport(started.id, {
            inserted,
            skipped,
            failed: failed + slice.length,
            note: `stopped: ${res.error}`,
          });
          setBusy(false);
          setError(`Import stopped after ${n(inserted)} rows: ${res.error}`);
          router.refresh();
          return;
        }
        inserted += res.inserted;
        skipped += res.skipped;
        failed += res.failed;
        setProgress({ done: Math.min(i + CHUNK, total), total });
        setStatus(`${n(inserted)} imported, ${n(skipped)} already present…`);
      }

      const dropped =
        report.droppedD + report.droppedNoId + report.droppedDuplicate;
      await finishProcessedImport(started.id, {
        inserted,
        skipped,
        failed,
        note: dropped
          ? `${n(dropped)} rows not carried over (${n(report.droppedD)} group D, ` +
            `${n(report.droppedNoId)} with no barcode or catalogue number, ` +
            `${n(report.droppedDuplicate)} repeated in the file)`
          : null,
      });

      setBusy(false);
      setStatus(
        `Done — ${n(inserted)} imported, ${n(skipped)} already present` +
          (failed ? `, ${n(failed)} failed` : "") +
          (dropped ? `, ${n(dropped)} not carried over` : "") +
          `. Sheet "${report.sheet}".`,
      );
      router.refresh();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not read that file.");
    }
  };

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Upload />
        Upload catalogue
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          // Closing mid-import would leave the loop running with nothing reporting it.
          if (busy) return;
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import the Processed Catalog</DialogTitle>
            <DialogDescription>
              Upload the catalogue workbook. It is read here in the browser — no extraction
              service, no AI — and every row goes straight into the Processed catalog as
              approved and sent to Hermes. A barcode already in the catalog is skipped, never
              overwritten, so re-uploading the same file only adds what is new.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="processed-file">
                Catalogue file<span className="ml-0.5 text-accent">*</span>
              </Label>
              <input
                id="processed-file"
                name="file"
                type="file"
                required
                disabled={busy}
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                className="block w-full cursor-pointer rounded-md border border-border bg-background/60 text-sm text-foreground file:mr-3 file:cursor-pointer file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-accent-hover disabled:opacity-50"
              />
              <p className="text-xs text-muted">
                Expects the usual columns: Artist, Title, Format, Unit, EAN, label, Catalogue
                no, Release date, COP, PPD, Our price, Calculation group, Hermes ID. Rows in
                calculation group D, and rows with neither a barcode nor a catalogue number,
                are not carried over.
              </p>
            </div>

            {progress ? (
              <div className="space-y-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-200"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-muted">
                  {n(progress.done)} of {n(progress.total)} rows ({pct}%)
                </p>
              </div>
            ) : null}

            {status ? <p className="text-sm text-muted">{status}</p> : null}

            {error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Close
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Importing…" : "Import"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
