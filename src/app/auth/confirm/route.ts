import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * Handles email links (password recovery, invites) by verifying the one-time
 * token and establishing a session, then redirecting to `next`. Uses token_hash
 * (not a PKCE code), so it works even when the link is opened on another device.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/catalog";

  // Build an absolute URL from the forwarded host (correct behind the proxy).
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const base = host ? `${proto}://${host}` : new URL(request.url).origin;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${base}${next}`);
    }
  }

  return NextResponse.redirect(`${base}/auth/forgot?error=link`);
}
