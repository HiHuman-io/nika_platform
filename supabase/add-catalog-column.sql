-- Two catalogs (2026-07 client call): a `catalog` discriminator on catalog_lines
-- instead of a duplicated table. Existing rows and new rows default to 'main';
-- the extraction workflow sets 'other' for Matrix Music / I-DI music /
-- Pias Recordings. raw_entries is unaffected (shared). Run in the SQL editor
-- BEFORE importing the v3 workflows (they now write this column).

alter table public.catalog_lines
  add column if not exists catalog text not null default 'main';

-- Handy for filtering the two views.
create index if not exists catalog_lines_catalog_idx on public.catalog_lines (catalog);
