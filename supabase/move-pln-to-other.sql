-- One-off (2026-07): move every catalog line whose ORIGINAL currency is PLN
-- into the "Other Catalog". PRODUCTION data — run the preview first, then the
-- UPDATE. Idempotent (safe to re-run).

-- PREVIEW — rows that will move to 'other':
select id, artist, title, currency, catalog
from public.catalog_lines
where upper(trim(currency)) = 'PLN'
order by artist;

-- APPLY:
update public.catalog_lines
set catalog = 'other'
where upper(trim(currency)) = 'PLN';

-- NOTE: this only fixes EXISTING rows. New extractions route to 'other' by LABEL
-- (Matrix Music / I-DI music / Pias Recordings), not by currency. If you also
-- want FUTURE PLN lines to land in 'other' automatically, that's a workflow
-- change (add a currency check to the catalog routing in Build Catalog Rows) —
-- tell me and I'll do it.
