"use client";

import Image from "next/image";
import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import nikaLogo from "../../../public/nika.jpg";
import hihumanLogo from "../../../public/hihuman.png";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div
      className="relative flex flex-1 items-center justify-center bg-background bg-cover bg-center px-4 py-16"
      style={{ backgroundImage: "url(/ljubljana.jpg)" }}
    >
      {/* Light wash so the photo stays bright and visible. */}
      <div className="absolute inset-0 bg-black/25" />

      <div className="relative w-full max-w-sm">
        {/* Localized scrim just behind the card keeps the form readable
            without dimming the whole image. */}
        <div className="pointer-events-none absolute -inset-8 rounded-[2.5rem] bg-background/75 blur-2xl" />

        <form
          action={formAction}
          className="relative space-y-4 rounded-2xl border border-border bg-surface/90 p-7 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <div className="mb-2 flex flex-col items-center text-center">
            <Image
              src={nikaLogo}
              alt="Nika"
              priority
              className="mb-5 h-auto w-[120px] rounded-md"
            />
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
              Nika Catalog
            </h1>
            <p className="mt-2 text-sm text-muted">
              Sign in to review catalog updates
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>

          {state.error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-8 flex flex-col items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted/70">
            Powered by
          </span>
          <Image
            src={hihumanLogo}
            alt="HiHuman"
            className="h-auto w-[90px] opacity-50 transition-opacity hover:opacity-80"
          />
        </div>
      </div>
    </div>
  );
}
