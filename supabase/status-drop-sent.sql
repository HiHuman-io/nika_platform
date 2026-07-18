-- Drop "sent" as a catalog_lines.status value (2026-07-18).
-- New model: status = workflow state (in_progress | approved | excluded), and
-- sent_at alone records whether the line reached Hermes (it drives the derived
-- "Hermes" column in the app). The two no longer duplicate each other.
-- Run in the Supabase SQL editor.

-- 1) Any line previously marked status='sent' goes back to the workflow state
--    it really is: approved. Its sent_at (if any) is preserved by this step.
update public.catalog_lines
set status = 'approved'
where status = 'sent';

-- 2) Clear sent_at left over from the rehearsal runs.
--    SAFE ONLY because no real send to Hermes has happened yet — those rows were
--    marked by a test executed with the "Hermes POST Catalogue" node disabled,
--    so nothing actually reached Hermes. If you have already done a real send,
--    DO NOT run this as-is: narrow it to the rehearsal rows instead.
--    Check first:
--      select id, artist, title, ean, status, sent_at
--      from public.catalog_lines where sent_at is not null;
update public.catalog_lines
set sent_at = null
where sent_at is not null;
