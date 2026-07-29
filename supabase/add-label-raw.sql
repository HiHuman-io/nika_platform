-- v15: the senders table becomes the single label-mapping source. Besides
-- sender -> label it now also holds RAW LABEL -> label, so a "Label" column printed
-- inside a canvass (e.g. "Rhino Atlantic") maps to the client's canonical name
-- ("WARNER/RHINO/ATLANTIC") from a row the client maintains, instead of a hardcoded
-- map in the workflow.
--
--   * `label_raw`  : the label exactly as a source prints it (nullable).
--   * `sender`     : made NULLABLE — a row may map by sender, by raw label, or both.
--   * `label`      : the canonical output (still the thing we store on the line).
--
-- Run before importing the v15 workflows.

alter table public.senders add column if not exists label_raw text;
alter table public.senders alter column sender drop not null;

comment on column public.senders.label_raw is
  'Raw label as printed in a source (e.g. a canvass "Label" column). Mapped to `label`. Optional — a row can map by sender, by label_raw, or both.';

-- Seed the raw->canonical rows from the client''s "READ THIS" supplement (WMIS Canvass
-- 0474). Idempotent: only inserts a raw name that is not already present.
insert into public.senders (sender, label_raw, label, active, notes)
select null, v.label_raw, v.label, true, 'Raw label mapping (client supplement)'
from (values
  ('WM France Back Catalogue',      'WARNER'),
  ('Warner Records Label',          'WARNER'),
  ('Vapor P&D',                     'WARNER'),
  ('Warner Strategic Marketing UK', 'WARNER'),
  ('WM Australia',                  'WARNER'),
  ('Warner Nashville',              'WARNER'),
  ('Rhino Warner',                  'WARNER/RHINO'),
  ('Rhino Atlantic',                'WARNER/RHINO/ATLANTIC'),
  ('Atlantic Records',              'WARNER/ATLANTIC'),
  ('PLG UK Frontline',              'PARLOPHONE'),
  ('PLG UK Catalog',                'PARLOPHONE')
) as v(label_raw, label)
where not exists (
  select 1 from public.senders s
  where lower(regexp_replace(coalesce(s.label_raw,''), '[^a-z0-9]', '', 'gi'))
      = lower(regexp_replace(v.label_raw,               '[^a-z0-9]', '', 'gi'))
);

-- CHECK:
select sender, label_raw, label from public.senders where label_raw is not null order by label, label_raw;
