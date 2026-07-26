-- DESTRUCTIVE (2026-07): permanently delete Main-catalog lines created before
-- 2026-07-17. PRODUCTION data, NO undo. Run the two previews first and confirm
-- the count/rows are what you expect BEFORE running the DELETE.
--
-- Scope: catalog = 'main' AND created_at < 2026-07-17 (UTC). 'Other' catalog and
-- anything created on/after the 17th are untouched.

-- PREVIEW 1 — how many rows will be deleted:
select count(*) as rows_to_delete
from public.catalog_lines
where catalog = 'main'
  and created_at < '2026-07-17 00:00:00+00';

-- PREVIEW 2 — see them:
select id, artist, title, ean, status, created_at
from public.catalog_lines
where catalog = 'main'
  and created_at < '2026-07-17 00:00:00+00'
order by created_at;

-- APPLY (only after checking the previews). Tip: you can wrap it in a
-- transaction to double-check the reported row count before committing:
--   begin;
--     delete ... ;   -- note "DELETE <n>"
--   -- rollback;  (to abort)  /  commit;  (to keep)
delete from public.catalog_lines
where catalog = 'main'
  and created_at < '2026-07-17 00:00:00+00';
