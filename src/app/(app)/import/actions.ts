"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

const BUCKET = "imports";

export type ImportResult = { error: string | null; warning?: string };

/**
 * Record a manual import whose file was already uploaded to Supabase Storage by
 * the browser, then hand off to n8n via a signed URL. The file itself never
 * crosses the server-action boundary (that path is flaky for multipart in
 * dev/Turbopack), so we only take metadata here.
 */
export async function registerImport(input: {
  fileName: string;
  filePath: string;
  mimeType: string | null;
  senderEmail: string | null;
  context: string | null;
}): Promise<ImportResult> {
  const { fileName, filePath, mimeType, senderEmail, context } = input;
  if (!fileName || !filePath) return { error: "Missing file information." };

  const supabase = await createClient();

  const { data: inserted, error: insertError } = await supabase
    .from("manual_imports")
    .insert({
      file_name: fileName,
      file_path: filePath,
      mime_type: mimeType,
      sender_email: senderEmail,
      context,
      status: "pending",
      // The other section ("Import - Processed Catalog") never comes through here: it is
      // parsed in the app and never handed to n8n.
      kind: "releases",
    })
    .select("id")
    .single();
  if (insertError) {
    return { error: `Could not save import: ${insertError.message}` };
  }

  // Signed URL lets n8n fetch the file without any service credentials.
  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60 * 60);

  const webhookUrl = process.env.N8N_IMPORT_WEBHOOK_URL;
  if (!webhookUrl) {
    revalidatePath("/import");
    return {
      error: null,
      warning:
        "Stored, but the processing service is not configured, so processing was not triggered.",
    };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        import_id: inserted.id,
        file_name: fileName,
        mime_type: mimeType,
        sender_email: senderEmail,
        context,
        file_url: signed?.signedUrl ?? null,
      }),
    });
    if (!res.ok) {
      revalidatePath("/import");
      return {
        error: null,
        warning: `Stored, but the processing service returned ${res.status}. It stays "pending" for retry.`,
      };
    }
  } catch {
    revalidatePath("/import");
    return {
      error: null,
      warning:
        "Stored, but the processing service was unreachable. It stays \"pending\" for retry.",
    };
  }

  revalidatePath("/import");
  return { error: null };
}

/* ------------------------------------------------------------------ *
 * Import - Processed Catalog                                          *
 * ------------------------------------------------------------------ */

export type ProcessedImportChunk = {
  /** Rows already mapped by src/lib/katalog-parse.ts. */
  rows: Record<string, unknown>[];
  /** Stamped on every row so one upload shares a single "sent" moment. */
  sentAt: string;
};

export type ProcessedImportResult = {
  inserted: number;
  skipped: number;
  failed: number;
  error: string | null;
};

/** Insert size. Small enough that one bad row costs little, large enough to stay fast. */
const CHUNK_INSERT = 300;

/**
 * Open a Processed Catalog import and return its id, so the client can report progress
 * against it and finish it off with a summary.
 */
export async function startProcessedImport(input: {
  fileName: string;
}): Promise<{ id: string | null; error: string | null }> {
  if (!input.fileName) return { id: null, error: "Missing file name." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("manual_imports")
    .insert({
      file_name: input.fileName,
      // Nothing is uploaded to Storage: the workbook is read in the browser and only the
      // mapped rows are sent, so there is no object to point at.
      file_path: "(parsed in app)",
      mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      status: "processing",
      kind: "processed",
    })
    .select("id")
    .single();
  if (error) return { id: null, error: `Could not start the import: ${error.message}` };
  revalidatePath("/import");
  return { id: data.id as string, error: null };
}

/**
 * Write one chunk of a parsed catalogue workbook into the Processed catalog.
 *
 * A barcode already in the catalog is SKIPPED, never overwritten. That is the client's own
 * rule for this data ("a repeat EAN already sent to Hermes is disregarded") and it is also
 * what makes re-importing a workbook safe: the second run adds only what is new. The check
 * runs as a query first — `catalog_lines_code_uniq` is a PARTIAL unique index, which
 * PostgREST cannot use for on-conflict inference — and the row-at-a-time retry below is the
 * backstop for anything that still collides (a row inserted between the check and the write).
 */
export async function importProcessedRows(
  chunk: ProcessedImportChunk,
): Promise<ProcessedImportResult> {
  const rows = chunk.rows ?? [];
  if (!rows.length) return { inserted: 0, skipped: 0, failed: 0, error: null };
  if (rows.length > CHUNK_INSERT * 4) {
    return { inserted: 0, skipped: 0, failed: rows.length, error: "Chunk too large." };
  }

  const supabase = await createClient();

  const stamped: Record<string, unknown>[] = rows.map((r) => ({
    ...r,
    sent_at: chunk.sentAt,
  }));
  const codes = stamped
    .map((r) => r.code)
    .filter((c): c is string => typeof c === "string" && c !== "");

  let present = new Set<string>();
  if (codes.length) {
    const { data, error } = await supabase
      .from("catalog_lines")
      .select("code")
      .in("code", codes);
    if (error) {
      return { inserted: 0, skipped: 0, failed: rows.length, error: error.message };
    }
    present = new Set((data ?? []).map((r) => String(r.code)));
  }

  const fresh = stamped.filter((r) => !(typeof r.code === "string" && present.has(r.code)));
  const skipped = stamped.length - fresh.length;
  if (!fresh.length) return { inserted: 0, skipped, failed: 0, error: null };

  const { error } = await supabase.from("catalog_lines").insert(fresh);
  if (!error) return { inserted: fresh.length, skipped, failed: 0, error: null };

  // One bad row fails the whole statement, so fall back to one row at a time rather than
  // losing the other 299. Slow, and deliberately only reached when something collided.
  let inserted = 0;
  let failed = 0;
  let extraSkipped = 0;
  for (const row of fresh) {
    const { error: rowError } = await supabase.from("catalog_lines").insert(row);
    if (!rowError) inserted++;
    else if (rowError.code === "23505") extraSkipped++; // unique violation: already present
    else failed++;
  }
  return { inserted, skipped: skipped + extraSkipped, failed, error: null };
}

/** Close a Processed Catalog import with a one-line summary the client can read. */
export async function finishProcessedImport(
  importId: string,
  summary: { inserted: number; skipped: number; failed: number; note?: string | null },
): Promise<ImportResult> {
  const supabase = await createClient();
  const parts = [
    `${summary.inserted.toLocaleString("en-GB")} imported`,
    `${summary.skipped.toLocaleString("en-GB")} already present`,
  ];
  if (summary.failed) parts.push(`${summary.failed.toLocaleString("en-GB")} failed`);
  if (summary.note) parts.push(summary.note);

  const { error } = await supabase
    .from("manual_imports")
    .update({
      status: summary.failed ? "error" : "done",
      result: parts.join(", "),
    })
    .eq("id", importId);

  revalidatePath("/import");
  revalidatePath("/catalog");
  return { error: error ? error.message : null };
}
