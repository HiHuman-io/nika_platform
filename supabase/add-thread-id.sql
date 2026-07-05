-- Thread linking: store the source email thread so follow-ups can be matched
-- back to the same catalog line (as a HINT — identity is still confirmed by
-- EAN/catalogue no/artist+title). Run in the Supabase SQL editor.
alter table public.catalog_lines add column if not exists thread_id text;
