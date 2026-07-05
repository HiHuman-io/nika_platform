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
