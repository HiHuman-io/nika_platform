-- Prices rework (2026-07-09 client feedback):
--   * ppd now holds a MERGED string "PPD_EUR/RockBottom" (e.g. "30,5/24,25"),
--     so it must be text, not numeric.
--   * price_original is only filled when the email has NO euro prices (the raw
--     amount in its original currency), and may carry non-numeric formatting,
--     so it becomes text too.
-- Existing numeric values are preserved (cast to text). Run in the Supabase SQL editor.

alter table public.catalog_lines
  alter column ppd type text using ppd::text;

alter table public.catalog_lines
  alter column price_original type text using price_original::text;
