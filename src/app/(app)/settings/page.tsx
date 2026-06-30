import { SupabaseEditableTable } from "@/components/supabase-editable-table";

export const metadata = { title: "Settings · Nika" };

const SETTINGS_TABLES = [
  {
    table: "senders",
    title: "Senders",
    entity: "sender",
    helper: "Map a sender email/domain to a label.",
    example: "music@warner.com → Warner, supplier_code 150",
  },
  {
    table: "glossary",
    title: "Glossary",
    entity: "glossary entry",
    helper: "Define an acronym the emails use.",
    example: "D2C → Direct-to-consumer",
  },
  {
    table: "exclusions",
    title: "Exclusions",
    entity: "exclusion",
    helper: "A keyword that auto-rejects an item.",
    example: "D2C",
  },
  {
    table: "mandatory_fields",
    title: "Mandatory Fields",
    entity: "mandatory field",
    helper: "A field that must be present before a line is “ready”.",
    example: "",
  },
  {
    table: "label_notes",
    title: "Label Notes",
    entity: "label note",
    helper: "Free-text quirks for a label.",
    example: 'Warner → “prices arrive in a separate follow-up email”',
  },
] as const;

export default function SettingsPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          The rules the client maintains. Add, edit and remove entries directly.
        </p>
      </div>

      {SETTINGS_TABLES.map(({ table, title, entity, helper, example }) => (
        <section key={table} className="space-y-3">
          <div className="space-y-1">
            <h2 className="font-heading text-xs font-semibold uppercase tracking-wider text-muted">
              {title}
            </h2>
            <p className="text-sm text-muted">
              {helper}
              {example ? (
                <span className="text-muted/70"> e.g. {example}</span>
              ) : null}
            </p>
          </div>
          <SupabaseEditableTable
            table={table}
            canAdd
            canEdit
            canDelete
            searchPlaceholder={`Search ${title.toLowerCase()}…`}
            entityLabel={entity}
            addLabel="Add"
          />
        </section>
      ))}
    </div>
  );
}
