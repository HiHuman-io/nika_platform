"use client";

import * as React from "react";

/**
 * Lightweight tabs. Panels are passed as children in the same order as `tabs`
 * and are all rendered (so server-fetched content loads once); only the active
 * one is shown.
 */
export function Tabs({
  tabs,
  children,
}: {
  tabs: { value: string; label: string }[];
  children: React.ReactNode;
}) {
  const [active, setActive] = React.useState(tabs[0]?.value);
  const panels = React.Children.toArray(children);

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {tabs.map((t) => {
          const isActive = t.value === active;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.value)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tabs.map((t, i) => (
        <div key={t.value} hidden={t.value !== active}>
          {panels[i]}
        </div>
      ))}
    </div>
  );
}
