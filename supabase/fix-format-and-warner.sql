-- One-off cleanup of EXISTING catalog_lines (2026-07). PRODUCTION data — run the
-- SELECT previews first, eyeball them, then run the UPDATEs. Both UPDATEs are
-- idempotent (safe to re-run).

------------------------------------------------------------------------------
-- 1) Format: move a leading number to the END (Hermes convention).
--    "2LP" -> "LP2", "3CD" -> "CD3", "1CD" -> "CD1", "3CD/DVD" -> "CD/DVD3".
--    Formats already correct ("LP", "CD", "LP4", "Vinyl", "MC", ...) are untouched.
------------------------------------------------------------------------------

-- PREVIEW — what will change:
select id, artist, title, format as old_format,
       regexp_replace(format, '^([0-9]+)(.+)$', '\2\1') as new_format
from public.catalog_lines
where format ~ '^[0-9]+[A-Za-z]'
order by format;

-- APPLY:
update public.catalog_lines
set format = regexp_replace(format, '^([0-9]+)(.+)$', '\2\1')
where format ~ '^[0-9]+[A-Za-z]';

------------------------------------------------------------------------------
-- 2) Any line whose label contains "warner" (case-insensitive) -> supplier_code
--    149 and calculation_group 1.
------------------------------------------------------------------------------

-- PREVIEW — rows that will be set:
select id, artist, title, label, supplier_code, calculation_group
from public.catalog_lines
where label ilike '%warner%'
order by label;

-- APPLY:
update public.catalog_lines
set supplier_code = '149',
    calculation_group = '1'
where label ilike '%warner%';

-- NOTE: single-disc formats become "CD1"/"LP1" here (literal "move the number").
-- If instead you want single discs to drop the "1" (matching the extraction rule
-- where a single disc has no number), tell me and I'll add a second step:
--   update public.catalog_lines set format = regexp_replace(format, '^([A-Za-z/]+)1$', '\1')
--   where format ~ '^[A-Za-z/]+1$';
