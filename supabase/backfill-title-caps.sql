-- Backfill client formatting rules onto EXISTING catalog lines (2026-07-08 feedback):
--   * titles in ALL CAPS
--   * drop a single leading "THE " from titles (leading "THE" on bands is already
--     handled at extraction time; this covers titles + historical rows)
-- New rows get this from the extraction prompt; this only fixes rows already stored.
--
-- Run in the Supabase SQL editor. Idempotent: once titles are uppercased and their
-- leading "THE " is stripped, re-running changes nothing (the WHERE guard skips them).
-- Only a leading "THE" followed by whitespace is removed, so "THEORY", "THEM" etc.
-- are left untouched. Review a sample afterwards before approving/sending anything.

update public.catalog_lines
set title = upper(regexp_replace(title, '^\s*[Tt][Hh][Ee]\s+', ''))
where title is not null
  and title <> upper(regexp_replace(title, '^\s*[Tt][Hh][Ee]\s+', ''));
