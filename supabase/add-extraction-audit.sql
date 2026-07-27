-- RUN THIS BEFORE IMPORTING THE v12 WORKFLOWS.
--
-- The v12 extraction splits a long source into parts and then checks, in code,
-- that every barcode printed in the source came back from the AI as an item.
-- When some did not, the reason lands here — the only place a release the model
-- silently skipped leaves any trace at all. Null means the extraction was
-- complete, so the column is empty on a healthy run and reads as an alarm list.
--
-- `Insert Raw Entry` auto-maps its input to real columns, so the workflow FAILS
-- if this column does not exist. Idempotent (safe to re-run).

alter table public.raw_entries
  add column if not exists extraction_audit text;

comment on column public.raw_entries.extraction_audit is
  'Set by the n8n extraction when the AI returned fewer items than the source contains: source row count, item count, and the barcodes that were not extracted. Null = complete.';

-- CHECK — the column exists and is empty on existing rows:
select count(*) as rows_total, count(extraction_audit) as rows_flagged
from public.raw_entries;
