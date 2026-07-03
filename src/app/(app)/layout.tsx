import Image from "next/image";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/utils/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already gates these routes; this is defense-in-depth.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* Full-width brand bar across the entire top of the screen. */}
      <header className="flex h-14 shrink-0 items-center justify-between px-6 [background:var(--header-gradient)] [box-shadow:inset_0_-1px_0_0_rgba(255,255,255,0.12)]">
        <div className="flex items-center gap-2.5">
          <Image
            src="/nika-logo.jpg"
            alt="Nika"
            width={32}
            height={32}
            priority
            className="rounded-sm"
          />
          <span className="font-heading text-base font-semibold tracking-tight text-white">
            Nika Catalog
          </span>
        </div>

        <div className="flex items-center gap-4">
          {user.email ? (
            <span className="hidden text-sm text-white/80 sm:inline">
              {user.email}
            </span>
          ) : null}
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-white/25 px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:border-white/50 hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar userEmail={user.email} />
        <main className="flex-1 overflow-auto px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
