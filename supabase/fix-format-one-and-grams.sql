-- Two corrections to lines that are already in the catalog (client, 2026-08-20).
-- v40 fixes both at the source for everything that arrives from now on; this is only for
-- the rows that went in before it.
--
--   1. THE COUNT "1" IS NEVER WRITTEN INTO A FORMAT. One disc is "LP", "CD", "BR" — never
--      "LP1", "CD1", "BR1". A format the model copied out of a supplier's Fmt column was
--      stored verbatim, which is how "LP1/CD8/BR1" reached the catalog.
--   2. A MIXED-CARRIER FORMAT IS JOINED BY "&", not "/": "LP1/CD8/BR1" -> "LP&CD8&BR".
--   3. A VINYL WEIGHT KEEPS A LOWERCASE g: "(180G)" -> "(180g)".
--
-- Scoped to MAIN and OTHER. The 25k Processed rows came out of the client's own workbook
-- and are their historical record, so they are left exactly as they were imported — the
-- same call as the label casing on 2026-08-19. To include them, delete the
-- `catalog in ('main','other')` line from each statement.

-- ---------------------------------------------------------------------------
-- STEP 1 — PREVIEW. Read this before running anything: it lists every row that
-- would change and what it would become. Nothing is written.
-- ---------------------------------------------------------------------------
with fixed as (
  select
    id, catalog, artist, format, title,
    regexp_replace(
      regexp_replace(format, '\s*/\s*', '&', 'g'),
      '([A-Za-z])1(?![0-9])', '\1', 'g'
    ) as new_format,
    regexp_replace(title, '([0-9])\s*G(R(AMS?)?)?(?![A-Za-z0-9])', '\1g', 'g') as new_title
  from public.catalog_lines
  where catalog in ('main', 'other')
)
select id, catalog, artist,
       format as old_format, new_format,
       title  as old_title,  new_title
from fixed
where (format is not null
       -- only touch a value that is entirely format tokens, so "AV-ACC", '7"' and anything
       -- unexpected is never rewritten
       and format ~ '^\s*\d{0,2}\s*[A-Za-z]+\s*\d{0,2}(\s*[/&]\s*\d{0,2}\s*[A-Za-z]+\s*\d{0,2})*\s*$'
       and format <> new_format)
   or (title is not null and title <> new_title)
order by catalog, artist;

-- ---------------------------------------------------------------------------
-- STEP 2 — APPLY. Both statements are idempotent: running them twice changes
-- nothing the second time.
-- ---------------------------------------------------------------------------

-- 2a) formats: "/" becomes "&", and a lone "1" disappears.
update public.catalog_lines
set format = regexp_replace(
      regexp_replace(format, '\s*/\s*', '&', 'g'),
      '([A-Za-z])1(?![0-9])', '\1', 'g')
where catalog in ('main', 'other')
  and format is not null
  and format ~ '^\s*\d{0,2}\s*[A-Za-z]+\s*\d{0,2}(\s*[/&]\s*\d{0,2}\s*[A-Za-z]+\s*\d{0,2})*\s*$'
  and format <> regexp_replace(
        regexp_replace(format, '\s*/\s*', '&', 'g'),
        '([A-Za-z])1(?![0-9])', '\1', 'g');

-- 2b) titles: the weight loses its capital G. Case-sensitive on purpose, so a title that
--     already reads "180g" is not touched.
update public.catalog_lines
set title = regexp_replace(title, '([0-9])\s*G(R(AMS?)?)?(?![A-Za-z0-9])', '\1g', 'g')
where catalog in ('main', 'other')
  and title is not null
  and title ~ '[0-9]\s*G'
  and title <> regexp_replace(title, '([0-9])\s*G(R(AMS?)?)?(?![A-Za-z0-9])', '\1g', 'g');

-- ---------------------------------------------------------------------------
-- STEP 3 — CHECK. Both counts must be 0.
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.catalog_lines
    where catalog in ('main', 'other') and format ~ '[A-Za-z]1(&|$)')            as formats_still_saying_1,
  (select count(*) from public.catalog_lines
    where catalog in ('main', 'other') and format like '%/%'
      and format ~ '^\s*\d{0,2}\s*[A-Za-z]+\s*\d{0,2}(\s*/\s*\d{0,2}\s*[A-Za-z]+\s*\d{0,2})+\s*$') as formats_still_using_slash,
  (select count(*) from public.catalog_lines
    where catalog in ('main', 'other') and title ~ '[0-9]\s*G(R(AMS?)?)?([^A-Za-z0-9]|$)') as titles_still_shouting_g;
