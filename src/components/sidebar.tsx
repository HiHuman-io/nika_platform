"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/catalog", label: "Catalog" },
  { href: "/raw-entries", label: "Raw Entries" },
  { href: "/settings", label: "Settings" },
] as const;

export function Sidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-border bg-surface">
      <nav className="flex flex-1 flex-col gap-1 px-3 pt-5">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-[var(--accent-soft)] font-semibold text-accent shadow-[inset_2px_0_0_0_var(--accent)]"
                  : "text-muted hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {userEmail ? (
        <div className="truncate border-t border-border px-5 py-4 text-xs text-muted">
          {userEmail}
        </div>
      ) : null}
    </aside>
  );
}
