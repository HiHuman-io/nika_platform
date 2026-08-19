-- Two import sections instead of one (client, 2026-08-19).
--
--   'releases'  — the section that already existed, renamed "Import - New Releases":
--                 an Excel or PDF a label shared directly, handed to n8n for LlamaParse +
--                 AI extraction into the Main/Other catalog.
--   'processed' — new, "Import - Processed Catalog": Mare's own catalogue workbook, parsed
--                 directly in the app (no LlamaParse, no AI — it is a spreadsheet with a
--                 fixed layout) and written straight into the Processed catalog as approved
--                 and sent, so that tab, and the dedup shield it provides, stays current.
--
-- Run in the Supabase SQL editor before deploying the app.

alter table public.manual_imports
  add column if not exists kind text not null default 'releases';

-- Every row that predates the split is a New Releases upload; the default covers them, and
-- this makes that explicit for anything inserted while the column was still missing.
update public.manual_imports set kind = 'releases' where kind is null;

-- The Import page reads one section per kind.
create index if not exists manual_imports_kind_idx on public.manual_imports (kind, created_at desc);

-- A short summary of what a Processed import did ("24,981 imported, 744 already present")
-- so the client can see the outcome without opening anything.
alter table public.manual_imports
  add column if not exists result text;

-- CHECK:
select kind, count(*) from public.manual_imports group by kind;
