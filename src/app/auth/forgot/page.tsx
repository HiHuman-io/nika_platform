"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { AuthShell } from "@/components/auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent">(
    "idle",
  );
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }
    setStatus("sent");
  };

  return (
    <AuthShell
      title="Reset password"
      subtitle={
        status === "sent"
          ? undefined
          : "Enter your email and we'll send you a reset link"
      }
    >
      {status === "sent" ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-foreground">
            If an account exists for <strong>{email}</strong>, a reset link is on
            its way. Check your inbox (and spam).
          </p>
          <Link
            href="/login"
            className="inline-block text-sm text-accent hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Send reset link"}
          </button>

          <div className="text-center">
            <Link
              href="/login"
              className="text-xs text-muted hover:text-foreground"
            >
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
