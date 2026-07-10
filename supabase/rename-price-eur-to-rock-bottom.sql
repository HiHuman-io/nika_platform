-- Rename price_eur -> rock_bottom (its real meaning) — 2026-07-09.
-- Run in the Supabase SQL editor. Do it together with deploying the matching
-- app + n8n changes (both now read/write "rock_bottom"). Pause the n8n
-- workflows during the switch so no extraction writes the old column name.

alter table public.catalog_lines
  rename column price_eur to rock_bottom;

-- Keep the mandatory-fields rule in sync (it referenced the old name).
update public.mandatory_fields
  set field_name = 'rock_bottom'
  where field_name = 'price_eur';
