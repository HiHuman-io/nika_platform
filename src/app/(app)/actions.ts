"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

/**
 * Tables that may be written through these actions, mapped to the route whose
 * data should be revalidated after a change. The allow-list means a client can
 * never coax an action into touching a table the UI doesn't manage; Supabase
 * RLS still enforces what the logged-in user is actually permitted to do.
 */
const TABLE_ROUTES = {
  catalog_lines: "/catalog",
  raw_entries: "/raw-entries",
  manual_imports: "/import",
  senders: "/settings",
  glossary: "/settings",
  exclusions: "/settings",
  mandatory_fields: "/settings",
  label_notes: "/settings",
} as const;

type TableName = keyof typeof TABLE_ROUTES;

export type ActionResult = { error: string | null };

function isAllowed(table: string): table is TableName {
  return Object.prototype.hasOwnProperty.call(TABLE_ROUTES, table);
}

export async function insertRow(
  table: string,
  values: Record<string, unknown>,
): Promise<ActionResult> {
  if (!isAllowed(table)) return { error: `Table "${table}" is not editable.` };

  const supabase = await createClient();
  const { error } = await supabase.from(table).insert(values);
  if (error) return { error: error.message };

  revalidatePath(TABLE_ROUTES[table]);
  return { error: null };
}

export async function updateRow(
  table: string,
  id: string | number,
  values: Record<string, unknown>,
): Promise<ActionResult> {
  if (!isAllowed(table)) return { error: `Table "${table}" is not editable.` };

  const supabase = await createClient();
  const { error } = await supabase.from(table).update(values).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(TABLE_ROUTES[table]);
  return { error: null };
}

export async function bulkUpdateStatus(
  table: string,
  ids: (string | number)[],
  status: string,
): Promise<ActionResult> {
  if (!isAllowed(table)) return { error: `Table "${table}" is not editable.` };
  if (ids.length === 0) return { error: null };

  const supabase = await createClient();
  const { error } = await supabase.from(table).update({ status }).in("id", ids);
  if (error) return { error: error.message };

  revalidatePath(TABLE_ROUTES[table]);
  return { error: null };
}

export async function deleteRow(
  table: string,
  id: string | number,
): Promise<ActionResult> {
  if (!isAllowed(table)) return { error: `Table "${table}" is not editable.` };

  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(TABLE_ROUTES[table]);
  return { error: null };
}

export async function bulkDelete(
  table: string,
  ids: (string | number)[],
): Promise<ActionResult> {
  if (!isAllowed(table)) return { error: `Table "${table}" is not editable.` };
  if (ids.length === 0) return { error: null };

  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().in("id", ids);
  if (error) return { error: error.message };

  revalidatePath(TABLE_ROUTES[table]);
  return { error: null };
}

/**
 * Send the selected catalog lines to the client's Hermes system via the n8n
 * webhook (which authenticates, POSTs to /api/productsCatalogue, and writes back
 * hermes_id/sent_at/status="sent" per line). We re-read the rows server-side and
 * only forward ones that are actually approved/sent — the client never dictates
 * the payload, and Supabase RLS still applies.
 */
export async function sendToHermes(
  ids: (string | number)[],
): Promise<ActionResult> {
  if (ids.length === 0) return { error: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_lines")
    .select("*")
    .in("id", ids)
    .in("status", ["approved", "sent"]);
  if (error) return { error: error.message };

  const lines = data ?? [];
  if (lines.length === 0)
    return { error: "None of the selected lines are approved to send." };

  const webhookUrl = process.env.N8N_HERMES_WEBHOOK_URL;
  if (!webhookUrl)
    return {
      error:
        "Hermes sending is not configured yet (N8N_HERMES_WEBHOOK_URL is unset).",
    };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines }),
    });
    if (!res.ok) {
      return { error: `Hermes service returned ${res.status}.` };
    }
  } catch {
    return { error: "Hermes service was unreachable." };
  }

  revalidatePath("/catalog");
  return { error: null };
}

export async function duplicateRows(
  table: string,
  ids: (string | number)[],
): Promise<ActionResult> {
  if (!isAllowed(table)) return { error: `Table "${table}" is not editable.` };
  if (ids.length === 0) return { error: null };

  const supabase = await createClient();
  const { data, error } = await supabase.from(table).select("*").in("id", ids);
  if (error) return { error: error.message };

  // Drop identity/lifecycle fields so each copy is a fresh, editable line.
  // ean (+ derived code) are cleared too — they're unique and belong to the
  // specific release, so a duplicate needs its own barcode.
  const STRIP = [
    "id",
    "created_at",
    "updated_at",
    "approved_at",
    "approved_by",
    "sent_at",
    "hermes_id",
    "ean",
    "code",
  ];
  const copies = (data ?? []).map((row) => {
    const copy: Record<string, unknown> = { ...row };
    for (const k of STRIP) delete copy[k];
    if (table === "catalog_lines") copy.status = "in_progress";
    return copy;
  });
  if (copies.length === 0) return { error: null };

  const { error: insertError } = await supabase.from(table).insert(copies);
  if (insertError) return { error: insertError.message };

  revalidatePath(TABLE_ROUTES[table]);
  return { error: null };
}
