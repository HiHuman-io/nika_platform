import { SupabaseEditableTable } from "@/components/supabase-editable-table";
import { Tabs } from "@/components/tabs";

export const metadata = { title: "Settings · Nika" };

// Tab order and titles set by the client (2026-07-31): the two that decide whether an
// email is looked at at all come first, then the rules that shape what is extracted.
const SETTINGS_TABLES = [
  {
    table: "senders",
    title: "Senders/Labels",
    entity: "sender",
    helper: "Map a sender email/domain to a label.",
    example: "music@warner.com → Warner, supplier_code 150",
  },
  {
    table: "blocked_emails",
    title: "Emails to Block",
    entity: "block rule",
    helper:
      "Mail that never enters the catalog. Fill in either column or both: sender only blocks everything from them, keyword only blocks that subject from anyone, both blocks just the combination. A sender can be a full address, a whole @domain, or the part left of the @; end a keyword with * to match anything starting with it.",
    example:
      'customerservice → all of them · order form → from anyone · andreea.neumeister@komab.at + pre-order → only that pair',
  },
  {
    table: "exclusions",
    title: "Exclusion Keywords",
    entity: "exclusion",
    helper: "A keyword that auto-rejects an item.",
    example: "D2C",
  },
  {
    table: "glossary",
    title: "Glossary",
    entity: "glossary entry",
    helper: "Define an acronym the emails use.",
    example: "D2C → Direct-to-consumer",
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

      <Tabs
        tabs={SETTINGS_TABLES.map((t) => ({ value: t.table, label: t.title }))}
      >
        {SETTINGS_TABLES.map(({ table, title, entity, helper, example }) => (
          <section key={table} className="space-y-3">
            <p className="text-sm text-muted">
              {helper}
              {example ? (
                <span className="text-muted/70"> e.g. {example}</span>
              ) : null}
            </p>
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
      </Tabs>
    </div>
  );
}
