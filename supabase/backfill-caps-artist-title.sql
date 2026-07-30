-- Force ALL CAPS on artist + title for rows already stored (client, 2026-07-30:
-- "180g" must be "180G", "14th" -> "14TH", "2nd" -> "2ND" — everything capitalised).
--
-- New rows already comply from both sides: the extraction workflow uppercases
-- everything it writes, and the app now uppercases artist/title on add/edit
-- (insertRow/updateRow). This only repairs rows typed or edited by hand BEFORE that
-- change — and `backfill-title-caps.sql` only ever covered `title`, never `artist`.
--
-- Run in the Supabase SQL editor. Idempotent: the WHERE guard skips anything already
-- upper-case, so re-running changes nothing. Covers all three catalogs (main / other /
-- processed) — the imported historical rows were uppercased at import, so they are a
-- no-op here.

-- 1) PREVIEW — exactly what would change. Check this list first.
select id, catalog, artist, upper(artist) as artist_new, title, upper(title) as title_new
from public.catalog_lines
where (artist is not null and artist <> upper(artist))
   or (title  is not null and title  <> upper(title))
order by catalog, artist, title;

-- 2) APPLY.
update public.catalog_lines
set artist = upper(artist)
where artist is not null and artist <> upper(artist);

update public.catalog_lines
set title = upper(title)
where title is not null and title <> upper(title);

-- 3) CHECK — must return 0.
select count(*) as still_mixed_case
from public.catalog_lines
where (artist is not null and artist <> upper(artist))
   or (title  is not null and title  <> upper(title));
