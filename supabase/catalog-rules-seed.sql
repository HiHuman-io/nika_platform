-- Schema + seed for the agreed parsing/classification rules.
-- Idempotent: safe to re-run. Inserts only rows that don't already exist
-- (keyed on each table's natural key), so it won't duplicate or collide.
-- The genre column is REQUIRED before the workflows write rows.

-- 1) Genre column (hidden in the app + excluded from exports).
alter table public.catalog_lines add column if not exists genre text;

-- 2) Sender -> label map. Several Warner sub-labels share the mailbox
--    wm-see-licensees@warnermusic.com and are distinguished by DISPLAY NAME,
--    so those rows key on the contact name, not the email.
insert into public.senders (sender, label, supplier_code, active, notes)
select v.sender, v.label, v.supplier_code, v.active, v.notes
from (values
  ('stuart.wheeley@warnermusic.com', 'WARNER - EastWest/Warner UK/Atlantic UK/Parlophone', '149', true, null::text),
  ('Geneva Gamblin', 'ATLANTIC / FUELED BY RAMEN', '149', true, 'Shared mailbox wm-see-licensees@warnermusic.com — match by display name'),
  ('Vicky Lee',      'ATLANTIC',     '149', true, 'Shared mailbox wm-see-licensees@warnermusic.com — match by display name'),
  ('Crystal Murphy', 'WARNER/RHINO', '149', true, 'Shared mailbox; uses artist code-names — flag for review'),
  ('Matthew Rankin', 'NONESUCH',     '149', true, 'Watch for release-date changes'),
  ('Katie Havelock', 'NONESUCH',     '149', true, 'Watch for release-date changes'),
  ('Brian Dodd',     'WARNER/RHINO', '149', true, null),
  ('David Bouchacourt', 'WARNER CLASSICS / ERATO', '149', true, 'Classical naming rules apply'),
  ('david.bouchacourt@warnermusic.com', 'WARNER CLASSICS / ERATO', '149', true, 'Classical naming rules apply')
) as v(sender, label, supplier_code, active, notes)
where not exists (select 1 from public.senders s where s.sender = v.sender);

-- 3) Glossary (acronyms / code-words).
insert into public.glossary (term, meaning, notes)
select v.term, v.meaning, v.notes
from (values
  ('CD',  'Compact Disc', null::text),
  ('LP',  'Vinyl LP', null),
  ('2LP', 'Double vinyl (2 records)', null),
  ('EP',  'Extended Play', null),
  ('BR',  'Blu-ray', null),
  ('OST', 'Original Soundtrack — use as the artist for soundtracks/compilations with no single artist', null),
  ('PPD', 'Published Price to Dealer', null),
  ('D2C', 'Direct-to-consumer (exclude)', null)
) as v(term, meaning, notes)
where not exists (select 1 from public.glossary g where g.term = v.term);

-- 4) Exclusion keywords.
insert into public.exclusions (keyword, active, notes)
select v.keyword, v.active, v.notes
from (values
  ('D2C',            true, 'Direct-to-consumer'),
  ('US/CANADA ONLY', true, 'Non-European territory restriction'),
  ('AMAZON',         true, 'Amazon-exclusive vinyl — no Amazon Slovenija'),
  ('WEB STORE',      true, 'Artist web-store-only release')
) as v(keyword, active, notes)
where not exists (select 1 from public.exclusions e where e.keyword = v.keyword);

-- 5) Mandatory fields.
insert into public.mandatory_fields (field_name)
select v.field_name
from (values ('artist'), ('title'), ('ean'), ('format'), ('release_date'), ('rock_bottom'), ('label')) as v(field_name)
where not exists (select 1 from public.mandatory_fields m where m.field_name = v.field_name);

-- 6) Per-label notes.
insert into public.label_notes (label, note)
select v.label, v.note
from (values
  ('WARNER', 'Default supplier_code 149. Prices sometimes arrive in a separate follow-up email — expect incremental updates to the same line.'),
  ('WARNER/RHINO', 'Uses code-names for high-profile artists (e.g. "Skylar"). Never resolve; flag for manual review and contact the label.'),
  ('WARNER CLASSICS / ERATO', 'Classical: performer = artist; composer surname prefixes the title, e.g. "SATIE: 3 GYMNOPEDIES...".'),
  ('NONESUCH', 'Watch for release-date changes — update the existing line rather than creating a new one.')
) as v(label, note)
where not exists (select 1 from public.label_notes l where l.label = v.label);
