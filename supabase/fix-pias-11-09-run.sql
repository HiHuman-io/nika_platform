-- CORRECT THE ROWS THE 11.09 PIAS RUN WROTE — AND NOTHING ELSE.
--
-- Scope: every statement is filtered on extra->>'source_message_id' = '1a08d4528078a20a', the
-- message the workflow recorded on each row it wrote. Nothing outside that email is touched, and
-- nothing is corrected retroactively anywhere else — the v63 code fixes are forward-looking, this
-- file is the one-off repair of what the run already stored (client, 2026-09-11).
--
-- TYPES: `unit` is a TEXT column here and `release_date` may be date, timestamptz or text, so every
-- comparison below casts explicitly (`unit::text = '2'`, `left(release_date::text, 10)`). Comparing
-- either of them to a bare number or a `date` literal fails with 'operator does not exist'
-- (client hit exactly that, 2026-09-11). Assignments are fine with a plain quoted literal.
--
-- Every block is: LOOK first, then CHANGE. All of it is safe to run top to bottom in one go — each
-- update is a no-op once applied, and the one DELETE refuses to run unless it finds exactly the
-- three rows predicted. In the Supabase editor only the LAST result is shown, so to read a
-- particular select, highlight it and run the selection.
--
-- The defects being repaired, and the v63 rule that stops each one recurring:
--   1  both JAY-Z double LPs stored as single LPs        -> formatDemotes()
--   2  Dave the Diver's release date overwritten with 2023-01-01 -> bareYearDate()
--   3  two sellable NCT 127 CDs marked excluded          -> territoryOnLine()
--   4  three barcode-less repeats of two releases        -> the twice-read merge
--   5  St Germain's note saying the same thing twice     -> appendNote()/noteFlat()
--   6  "BANTON BUJU" — a stage name split as a person    -> no code rule; a judgement call
--
-- One thing deliberately NOT updated here: the label. 24 of the 36 rows carry the house label
-- "PIAS RECORDINGS" instead of the imprint their own line prints, and 5 more carry "PIAS/NVIRGIN",
-- which is the DISTRIBUTOR printed in the one-sheet footers, not a label. Block 7 lists them for
-- you to decide; the label map is yours and I am not rewriting 29 of them on a guess.

-- ════════════════════════════════════════════════════════════════════ 0. WHAT THIS RUN WROTE
select count(*) filter (where ean is not null) as with_barcode,
       count(*) filter (where ean is null)     as without_barcode,
       count(*)                                as rows_total
from public.catalog_lines
where extra->>'source_message_id' = '1a08d4528078a20a';
-- Expected before any fix: 33 / 3 / 36.
-- ⚠ If with_barcode is LESS than 33, the difference is exactly the new lines the database
--   refused as duplicates of an already-sent barcode — run supabase/find-skipped-duplicates.sql
--   to name them, and read the counts in block 8 against this number rather than against 33.


-- ════════════════════════════════════════════════ 1. THE TWO JAY-Z DOUBLE LPs ARE NOT SINGLES
-- The spreadsheet's Format column says 2LP for both. The version cell says "Black LPs" / "White
-- LPs", and a plural carrier with no number beat the column.
select ean, artist, title, format, unit from public.catalog_lines
where extra->>'source_message_id' = '1a08d4528078a20a'
  and ean in ('0810061164906', '0840571800674');

update public.catalog_lines
set format = 'LP2', unit = '2'
where extra->>'source_message_id' = '1a08d4528078a20a'
  and ean in ('0810061164906', '0840571800674')
  and (format is distinct from 'LP2' or unit::text is distinct from '2');


-- ═══════════════════════════════════════════ 2. DAVE THE DIVER'S RELEASE DATE IS 11 SEPT 2026
-- 2023-01-01 came from "Released in 2023" in the one-sheet prose. The spreadsheet line says
-- 9/11/26, and so does the subject of the mail.
select ean, artist, title, release_date from public.catalog_lines
where extra->>'source_message_id' = '1a08d4528078a20a' and ean = '5063176104212';

update public.catalog_lines
set release_date = '2026-09-11'
where extra->>'source_message_id' = '1a08d4528078a20a'
  and ean = '5063176104212'
  and left(release_date::text, 10) is distinct from '2026-09-11';


-- ═════════════════════════════════ 3. TWO NCT 127 CDs ARE SELLABLE HERE AND WERE NOT EXCLUDED
-- Their own line prints Territory "World ex Korea, Democratic People's Republic of|Korea, Republic
-- of|Japan|China" — Slovenia is in it. Three other versions of the same album were NOT excluded,
-- which is the tell.
select ean, artist, title, status, extra->>'exclusion_reason' as reason
from public.catalog_lines
where extra->>'source_message_id' = '1a08d4528078a20a' and artist = 'NCT 127'
order by ean;

update public.catalog_lines
set status = 'in_progress',
    title  = btrim(replace(title, ' (US EXCLUSIVE)', '')),
    extra  = coalesce(extra, '{}'::jsonb) || '{"exclusion_reason": null}'::jsonb
where extra->>'source_message_id' = '1a08d4528078a20a'
  and ean in ('8800371256806',   -- JET Poster Ver. - HAECHAN
              '8800371256790');  -- JET Poster Ver. - JAEHYUN

-- SMCD503 is YOUR call and is left alone. Its own PDF heading does say "NCT 127 US Exclusive GROUP
-- Version", so excluding it is defensible — but the spreadsheet gives it the same World-ex-Asia
-- territory as the other five. Uncomment to treat it like the rest:
-- update public.catalog_lines
-- set status = 'in_progress',
--     title  = btrim(replace(title, ' (US EXCLUSIVE)', '')),
--     extra  = coalesce(extra, '{}'::jsonb) || '{"exclusion_reason": null}'::jsonb
-- where extra->>'source_message_id' = '1a08d4528078a20a' and ean = '8800371256707';


-- ══════════════════════════════════════ 4. THREE ROWS ARE THE SAME RELEASE READ OFF THE ARTWORK
-- BLOC PARTY / ANATOMY OF A BRIEF ROMANCE (LP) twice and PRETTY SICK / ANARCHY (LP) once, each
-- with no barcode, each already in this same import as a row that HAS one. Read off the album-cover
-- JPGs and a barcode-less one-sheet.
select c.id, c.artist, c.title, c.format, c.ean,
       (select string_agg(d.ean, ', ') from public.catalog_lines d
        where d.extra->>'source_message_id' = c.extra->>'source_message_id'
          and d.ean is not null and d.artist = c.artist and d.title = c.title
          and d.format is not distinct from c.format) as the_barcoded_row_it_repeats
from public.catalog_lines c
where c.extra->>'source_message_id' = '1a08d4528078a20a'
  and c.ean is null
  and exists (select 1 from public.catalog_lines d
              where d.extra->>'source_message_id' = c.extra->>'source_message_id'
                and d.ean is not null and d.artist = c.artist and d.title = c.title
                and d.format is not distinct from c.format);
-- expected: exactly 3 rows. If it returns anything else, STOP and read it before deleting.

-- The delete REFUSES to run unless it finds exactly the three rows predicted above (or none,
-- because it has already been run). If the database disagrees with the analysis, nothing is
-- deleted and it says so — safe to run as part of the whole file without reading the select first.
do $$
declare n integer;
begin
  select count(*) into n
  from public.catalog_lines c
  where c.extra->>'source_message_id' = '1a08d4528078a20a'
    and c.ean is null
    and coalesce(c.status, '') <> 'approved'
    and exists (select 1 from public.catalog_lines d
                where d.extra->>'source_message_id' = c.extra->>'source_message_id'
                  and d.ean is not null and d.artist = c.artist and d.title = c.title
                  and d.format is not distinct from c.format);

  if n = 0 then
    raise notice 'block 4: nothing to delete — already done.';
    return;
  end if;
  if n <> 3 then
    raise exception 'block 4: expected exactly 3 barcode-less repeats, found %. NOTHING deleted — run the select above and look at them first.', n;
  end if;

  delete from public.catalog_lines c
  where c.extra->>'source_message_id' = '1a08d4528078a20a'
    and c.ean is null
    and coalesce(c.status, '') <> 'approved'   -- never delete something a human has already approved
    and exists (select 1 from public.catalog_lines d
                where d.extra->>'source_message_id' = c.extra->>'source_message_id'
                  and d.ean is not null and d.artist = c.artist and d.title = c.title
                  and d.format is not distinct from c.format);
  raise notice 'block 4: deleted % barcode-less repeat(s).', n;
end $$;


-- ═══════════════════════════════════════════════ 5. NOTES THAT SAY THE SAME THING TWICE OVER
-- The update path space-joined this run's notes while the stored copy was newline-joined, so the
-- duplicate check missed and appended the lot again. Collapses a note that is exactly A + "\n" + A
-- once whitespace is normalised — and nothing else.
with split as (
  select c.id, c.notes, p.pos,
         left(c.notes, p.pos - 1)   as head,
         substr(c.notes, p.pos + 1) as tail
  from public.catalog_lines c
       cross join lateral generate_series(1, length(c.notes)) as p(pos)
  where c.extra->>'source_message_id' = '1a08d4528078a20a'
    and c.notes is not null
    and substr(c.notes, p.pos, 1) = chr(10)
),
dupes as (
  select distinct on (id) id, head, tail, notes
  from split
  where regexp_replace(btrim(head), '\s+', ' ', 'g') = regexp_replace(btrim(tail), '\s+', ' ', 'g')
  order by id, length(head) desc
)
select id, head as keeps, tail as drops from dupes;    -- look first

with split as (
  select c.id, c.notes, p.pos,
         left(c.notes, p.pos - 1)   as head,
         substr(c.notes, p.pos + 1) as tail
  from public.catalog_lines c
       cross join lateral generate_series(1, length(c.notes)) as p(pos)
  where c.extra->>'source_message_id' = '1a08d4528078a20a'
    and c.notes is not null
    and substr(c.notes, p.pos, 1) = chr(10)
),
dupes as (
  select distinct on (id) id, head
  from split
  where regexp_replace(btrim(head), '\s+', ' ', 'g') = regexp_replace(btrim(tail), '\s+', ' ', 'g')
  order by id, length(head) desc
)
update public.catalog_lines c
set notes = d.head
from dupes d
where c.id = d.id and c.notes is distinct from d.head;


-- ══════════════════════════════════════════════════════════ 6. "BANTON BUJU" IS "BUJU BANTON"
-- The AI read the stage name as a person (family "Banton", given "Buju"), so the SURNAME-FIRSTNAME
-- rule reordered it — while the same artist's other rows in this import, which came through the
-- recovery pass, correctly say BUJU BANTON.
select ean, artist, title from public.catalog_lines
where extra->>'source_message_id' = '1a08d4528078a20a' and artist like 'BANTON%';

update public.catalog_lines
set artist = 'BUJU BANTON'
where extra->>'source_message_id' = '1a08d4528078a20a'
  and ean = '0054645750172'
  and artist = 'BANTON BUJU';


-- ════════════════════════════════════════════ 7. THE LABELS — LOOK, DECIDE, THEN TELL ME (no update)
-- What each row carries against what its own line in the spreadsheet prints. "PIAS RECORDINGS" is
-- the house label the row fell back to; "PIAS/NVIRGIN" and "PIAS/GARGAMEL MUSIC PRESENTS" came off
-- a one-sheet footer and a promo banner, which are a distributor and a marketing line, not labels.
select c.ean, c.artist, c.label as stored_now, v.printed_in_the_spreadsheet
from public.catalog_lines c
     join (values
       ('0720841306924','Partisan Records/VMG'), ('0720841306931','Partisan Records/VMG'),
       ('0720841306955','Partisan Records/VMG'), ('5400863207236','[PIAS] Recordings Catalogue'),
       ('0823375111597','Contagious/VMG'),       ('0823375111566','Contagious/VMG'),
       ('0823375111559','Contagious/VMG'),       ('5054429212044','Ninja Tune'),
       ('5054429212037','Ninja Tune'),           ('5054429212372','Ninja Tune'),
       ('5400863207670','F Communications'),     ('0054645284226','Vp/Believe'),
       ('0054645284219','Vp/Believe'),           ('5063176104212','Laced Records'),
       ('4251267725281','High Roller Records/Believe'), ('4251267725267','High Roller Records/Believe'),
       ('5060257966370','Dirty Hit/VMG'),        ('5060257966387','Dirty Hit/VMG'),
       ('8800371256806','SM Entertainment/VMG'), ('8800371256790','SM Entertainment/VMG'),
       ('8800371256776','SM Entertainment/VMG'), ('8800371256707','SM Entertainment/VMG'),
       ('8800371256783','SM Entertainment/VMG'), ('8800371256769','SM Entertainment/VMG'),
       ('0810061164906','Diggers Factory'),      ('0810061165866','Diggers Factory'),
       ('0810061165859','Diggers Factory'),      ('0840571800674','Diggers Factory'),
       ('4260307012519','Spirit Of The Streets Records/Believe'),
       ('5051083237925','Aparté'),               ('3149020958179','harmonia mundi'),
       ('3760213657657','Paraty'),
       ('0054645750172','(NOT in the spreadsheet — read off the Buju Banton one-sheet and the barcode in a file name)')
     ) as v(ean, printed_in_the_spreadsheet) on v.ean = c.ean
where c.extra->>'source_message_id' = '1a08d4528078a20a'
order by c.label, c.artist;


-- ══════════════════════════════════════════════════════════════════════ 8. AFTERWARDS, CHECK
select count(*) filter (where ean is not null)  as with_barcode,      -- same as block 0 (33 if none were refused)
       count(*) filter (where ean is null)      as without_barcode,   -- want 0
       count(*) filter (where status = 'excluded') as excluded,       -- want 1 (SMCD503) or 0
       count(*) filter (where unit::text = '2') as double_carriers    -- want 9, of which 2 are the JAY-Z LPs
from public.catalog_lines
where extra->>'source_message_id' = '1a08d4528078a20a';
