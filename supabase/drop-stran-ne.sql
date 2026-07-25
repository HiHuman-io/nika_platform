-- Drop the unused `stran` and `ne` columns from catalog_lines (2026-07 client
-- call). They were never populated by the extraction workflow and are not used
-- anywhere. Run in the Supabase SQL editor.

alter table public.catalog_lines drop column if exists stran;
alter table public.catalog_lines drop column if exists ne;
