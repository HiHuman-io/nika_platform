-- WHICH RELEASES ARRIVED BUT NEVER GOT THEIR OWN CATALOG LINE?
--
-- The client asked where to see this (2026-09-11) and the answer was: nowhere. It is worth
-- knowing why, because the silence is deliberate.
--
--   * The matcher in `Build Catalog Rows` loads `catalog_lines` WHERE catalog <> 'processed',
--     so the frozen 25k already-sent set is not in memory (add-processed-dedup.sql, v16).
--   * A barcode that only exists in 'processed' therefore looks new, and the workflow decides
--     action = 'create'.
--   * The INSERT then hits the partial unique index `catalog_lines_code_uniq` on `code`, and
--     `Insert Catalog Line` is set to onError = continueRegularOutput — so the row is dropped
--     and the run continues. That IS the client's rule ("a repeat EAN already sent to Hermes is
--     disregarded"), but nothing records which barcode it happened to.
--
-- These two queries reconstruct it from data that is already stored: `raw_entries.extracted`
-- keeps every item the AI returned for an email, and every catalog line records the message it
-- was written from in `extra->>'source_message_id'`.
--
-- CAVEAT, so the result is not over-read: `raw_entries` is written from the FIRST extraction
-- pass, in parallel with the recovery pass — so a release the second pass recovered is in the
-- catalog but NOT in `extracted`. This report can therefore miss a barcode; it never invents one.

-- `code` is the normalised barcode the unique index is built on: pad to 13, drop the check
-- digit, then keep the last 10 digits when the barcode starts with 0 or 1200, else all 12.
-- (Verified digit-for-digit against toCatalogCode() in Build Catalog Rows.)
with arrived as (
  select r.source_email_id,
         r.received_at,
         r.subject,
         i->>'ean'    as ean,
         i->>'artist' as artist,
         i->>'title'  as title,
         lpad(regexp_replace(i->>'ean', '\D', '', 'g'), 13, '0') as e13
  from public.raw_entries r
       cross join lateral jsonb_array_elements(
         coalesce(r.extracted -> 'result' -> 'items', '[]'::jsonb)) i
  where r.received_at::timestamptz > now() - interval '30 days'   -- <<< widen, or swap for source_email_id =
    -- (the cast is deliberate: received_at is written from the mail's own ISO date string)
    and coalesce(i->>'ean', '') <> ''
),
coded as (
  select *,
         right(left(e13, 12),
               case when left(e13, 1) = '0' or left(e13, 4) = '1200' then 10 else 12 end) as code
  from arrived
)

-- 1) THE REPORT. One row per barcode whose email did NOT end up writing its catalog line.
--    verdict tells you which of the two it is.
select a.received_at::date as arrived,
       a.subject,
       a.ean,
       a.artist,
       a.title,
       case when c.id is null then 'NO LINE AT ALL — a real loss, investigate'
            else 'skipped as a duplicate of an existing line' end as verdict,
       c.id       as existing_line_id,
       c.catalog  as existing_catalog,
       c.sent_at  as existing_sent_at,
       c.extra ->> 'source_message_id' as existing_came_from_message
from coded a
     left join public.catalog_lines c on c.code = a.code
where c.id is null
   or coalesce(c.extra ->> 'source_message_id', '') <> a.source_email_id
order by a.received_at desc, a.ean;

-- 2) ONE EMAIL, FULL ACCOUNTING. Replace the id and run on its own: every barcode the first
--    pass returned for that email, and what became of it.
-- with ... (paste the two CTEs above, with `where r.source_email_id = '1a08d4528078a20a'`)
-- select a.ean, a.artist, a.title,
--        coalesce(c.id::text, '(no line)') as line,
--        c.catalog,
--        (coalesce(c.extra ->> 'source_message_id','') = a.source_email_id) as written_by_this_email
-- from coded a left join public.catalog_lines c on c.code = a.code
-- order by written_by_this_email, a.ean;
