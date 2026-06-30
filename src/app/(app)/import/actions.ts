"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

const BUCKET = "imports";

export type ImportResult = { error: string | null; warning?: string };

/**
 * Handle a manual file import: store the file in Supabase Storage, record a
 * `manual_imports` row, then hand off to n8n (via a webhook) for parsing +
 * extraction. The file is passed to n8n as a short-lived signed URL so n8n
 * never needs storage credentials.
 */
export async function createImport(formData: FormData): Promise<ImportResult> {
  const file = formData.get("file");
  const senderEmail =
    (formData.get("sender_email") as string | null)?.trim() || null;
  const context = (formData.get("context") as string | null)?.trim() || null;

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a file to upload." };
  }

  const supabase = await createClient();

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${randomUUID()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}` };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("manual_imports")
    .insert({
      file_name: file.name,
      file_path: path,
      mime_type: file.type || null,
      sender_email: senderEmail,
      context,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError) {
    return { error: `Could not save import: ${insertError.message}` };
  }

  // Signed URL lets n8n fetch the file without any service credentials.
  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60);

  const webhookUrl = process.env.N8N_IMPORT_WEBHOOK_URL;
  if (!webhookUrl) {
    revalidatePath("/import");
    return {
      error: null,
      warning:
        "Stored, but N8N_IMPORT_WEBHOOK_URL is not set — processing was not triggered.",
    };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        import_id: inserted.id,
        file_name: file.name,
        mime_type: file.type || null,
        sender_email: senderEmail,
        context,
        file_url: signed?.signedUrl ?? null,
      }),
    });
    if (!res.ok) {
      revalidatePath("/import");
      return {
        error: null,
        warning: `Stored, but n8n returned ${res.status}. It stays "pending" for retry.`,
      };
    }
  } catch {
    // Don't fail the upload if n8n is unreachable — the row stays "pending".
    revalidatePath("/import");
    return {
      error: null,
      warning: "Stored, but n8n was unreachable. It stays “pending” for retry.",
    };
  }

  revalidatePath("/import");
  return { error: null };
}
