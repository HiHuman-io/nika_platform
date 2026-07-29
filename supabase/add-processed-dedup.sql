-- Scalability for the 25k "Processed" catalog import (v16).
--
-- The n8n matcher no longer loads the Processed catalog into memory on every email run
-- (it now filters `catalog != 'processed'`), so dedup against that frozen set has to
-- happen at INSERT time instead. `code` is the NORMALISED barcode (leading zeros and the
-- check digit removed), so a UNIQUE index on it rejects a repeat EAN even when the two
-- copies differ only in leading zeros — and `Insert Catalog Line`
-- (onError=continueRegularOutput) then skips the duplicate silently. That is exactly the
-- client's rule: "a repeat EAN already sent to Hermes is disregarded."
--
-- Run BEFORE importing the 25k (and re-import the v16 workflows). The import must also
-- populate `code` on every row (the importer does this with the same normalisation).

-- 1) PREVIEW — existing `code` collisions. This MUST return 0 rows before step 2, or the
--    unique index cannot be created. (Clean any duplicates by hand first — a non-empty
--    result means two lines already share a normalised barcode.)
select code, count(*) as copies, array_agg(id) as ids, array_agg(distinct catalog) as catalogs
from public.catalog_lines
where code is not null and code <> ''
group by code
having count(*) > 1
order by copies desc;

-- 2) APPLY — partial unique index (empty/na barcodes are skipped, so no-EAN lines are
--    unaffected). Idempotent.
create unique index if not exists catalog_lines_code_uniq
  on public.catalog_lines (code)
  where code is not null and code <> '';

-- CHECK — the index exists:
select indexname from pg_indexes
where schemaname = 'public' and tablename = 'catalog_lines' and indexname = 'catalog_lines_code_uniq';
