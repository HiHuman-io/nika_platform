import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Uses the PUBLISHABLE key, which is safe to
 * expose to the browser because access is gated by Row Level Security.
 * Use this from Client Components.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
