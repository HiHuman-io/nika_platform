-- Repair existing catalog lines whose ARTIST (or title) ended up with a trailing
-- "THE" — the model reordered a band like "The Shadows" as if it were a person, giving
-- "SHADOWS THE" / "DARKNESS THE". v14 prevents this going forward (dropThe now strips a
-- trailing THE too); this fixes rows already stored. Idempotent, safe to re-run.
--
-- The pattern needs a space or comma BEFORE "THE", so a real word ending in those three
-- letters ("BREATHE", "SCYTHE") is never touched, and an artist that is only "THE" is left
-- alone rather than emptied.

-- PREVIEW — exactly what will change (run this first):
select id, artist,
       regexp_replace(artist, '[[:space:],]+THE[[:space:]]*$', '', 'i') as artist_fixed,
       title,
       regexp_replace(title,  '[[:space:],]+THE[[:space:]]*$', '', 'i') as title_fixed
from public.catalog_lines
where artist ~* '[[:space:],]+THE[[:space:]]*$'
   or title  ~* '[[:space:],]+THE[[:space:]]*$'
order by artist;

-- APPLY:
update public.catalog_lines
set artist = regexp_replace(artist, '[[:space:],]+THE[[:space:]]*$', '', 'i'),
    title  = regexp_replace(title,  '[[:space:],]+THE[[:space:]]*$', '', 'i')
where artist ~* '[[:space:],]+THE[[:space:]]*$'
   or title  ~* '[[:space:],]+THE[[:space:]]*$';

-- CHECK — should return 0 rows afterwards:
select count(*) as still_trailing_the
from public.catalog_lines
where artist ~* '[[:space:],]+THE[[:space:]]*$'
   or title  ~* '[[:space:],]+THE[[:space:]]*$';
