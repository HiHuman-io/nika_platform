-- Import the client's historical Excel catalog (~25.9k rows) into catalog_lines as the
-- frozen "Processed" dedup shield. The CSV (catalog-import.csv) is produced from
-- "Katalog 2026 07 03.xlsx" by scripts/import-katalog.mjs: cleaned, deduped on the
-- normalised barcode `code`, and stamped catalog='processed', status='approved', sent_at.
--
-- Loaded via a STAGING table so a product that already exists in your live Main/Other
-- catalog is skipped (ON CONFLICT on the `code` unique index) instead of erroring.
-- Run add-processed-dedup.sql FIRST (it creates that index).

-- STEP 1 — create the staging table (all TEXT, so the CSV imports with leading zeros intact):
drop table if exists public.catalog_import_staging;
create table public.catalog_import_staging (
  ean text, code text, catalogue_no text, artist text, title text, format text,
  unit text, label text, release_date text, cop text, ppd text, our_price text,
  supplier_code text, calculation_group text, hermes_id text, catalog text, status text, sent_at text
);

-- STEP 2 — In the Supabase Table Editor: open `catalog_import_staging` ->
--          "Insert" -> "Import data from CSV" -> pick Downloads/catalog-import.csv.
--          (Its header row matches the columns above.) Then come back and run the rest.

-- STEP 3 — move staging -> catalog_lines, skipping any barcode already present:
insert into public.catalog_lines
  (ean, code, catalogue_no, artist, title, format, unit, label, release_date,
   cop, ppd, our_price, supplier_code, calculation_group, hermes_id, catalog, status, sent_at)
select
  nullif(ean,''), nullif(code,''), nullif(catalogue_no,''), nullif(artist,''), nullif(title,''),
  nullif(format,''), nullif(unit,'')::int, nullif(label,''), nullif(release_date,'')::date,
  nullif(cop,'')::numeric, nullif(ppd,''), nullif(our_price,'')::numeric,
  nullif(supplier_code,''), nullif(calculation_group,''), nullif(hermes_id,''),
  catalog, status, nullif(sent_at,'')::timestamptz
from public.catalog_import_staging
on conflict (code) where (code is not null and code <> '') do nothing;

-- STEP 4 — check: how many landed, and how many were skipped as already-present:
select
  (select count(*) from public.catalog_lines where catalog = 'processed') as processed_now,
  (select count(*) from public.catalog_import_staging)                     as staged,
  (select count(*) from public.catalog_import_staging) -
  (select count(*) from public.catalog_lines where catalog = 'processed')  as skipped_as_existing;

-- STEP 5 — clean up:
drop table public.catalog_import_staging;
