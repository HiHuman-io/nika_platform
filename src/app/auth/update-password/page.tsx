"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AuthShell } from "@/components/auth-shell";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);

  // The recovery session arrives via the URL when the user clicks the email
  // link; the client picks it up. Wait for it before allowing a password change.
  const [ready, setReady] = React.useState(false);
  const [linkInvalid, setLinkInvalid] = React.useState(false);

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setReady(true);
    });
    // If no recovery session appears, the link is bad/expired.
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (active && !data.session) setLinkInvalid(true);
    }, 4000);
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [supabase]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (error) {
      setError(
        error.message.toLowerCase().includes("session")
          ? "This reset link is invalid or has expired. Request a new one."
          : error.message,
      );
      return;
    }
    router.replace("/catalog");
  };

  if (linkInvalid) {
    return (
      <AuthShell title="Link expired" subtitle="This reset link is invalid or has expired">
        <div className="space-y-4 text-center">
          <Link
            href="/auth/forgot"
            className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Request a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a new password for your account"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground"
          >
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            disabled={!ready}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="confirm"
            className="block text-sm font-medium text-foreground"
          >
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            disabled={!ready}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
          />
        </div>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !ready}
          className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {!ready ? "Verifying link…" : pending ? "Saving…" : "Update password"}
        </button>

        <div className="text-center">
          <Link
            href="/auth/forgot"
            className="text-xs text-muted hover:text-foreground"
          >
            Request a new link
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
