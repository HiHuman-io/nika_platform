-- Schema + seed for the agreed parsing/classification rules.
-- Run in the Supabase SQL editor. The genre column is REQUIRED before the
-- workflows write rows (they now send `genre`).

-- 1) Genre column (hidden in the app + excluded from exports).
alter table public.catalog_lines add column if not exists genre text;

-- 2) Sender -> label map. NOTE: several Warner sub-labels share the mailbox
--    wm-see-licensees@warnermusic.com and are distinguished by DISPLAY NAME,
--    so those rows key on the contact name, not the email.
insert into public.senders (sender, label, supplier_code, active, notes) values
  ('stuart.wheeley@warnermusic.com', 'WARNER - EastWest/Warner UK/Atlantic UK/Parlophone', '149', true, null),
  ('Geneva Gamblin', 'ATLANTIC / FUELED BY RAMEN', '149', true, 'Shared mailbox wm-see-licensees@warnermusic.com — match by display name'),
  ('Vicky Lee',      'ATLANTIC',        '149', true, 'Shared mailbox wm-see-licensees@warnermusic.com — match by display name'),
  ('Crystal Murphy', 'WARNER/RHINO',    '149', true, 'Shared mailbox; uses artist code-names — flag for review'),
  ('Matthew Rankin', 'NONESUCH',        '149', true, 'Watch for release-date changes'),
  ('Katie Havelock', 'NONESUCH',        '149', true, 'Watch for release-date changes'),
  ('Brian Dodd',     'WARNER/RHINO',    '149', true, null),
  ('David Bouchacourt', 'WARNER CLASSICS / ERATO', '149', true, 'Classical naming rules apply'),
  ('david.bouchacourt@warnermusic.com', 'WARNER CLASSICS / ERATO', '149', true, 'Classical naming rules apply');

-- 3) Glossary (acronyms / code-words). Extend as needed.
insert into public.glossary (term, meaning, notes) values
  ('CD',  'Compact Disc', null),
  ('LP',  'Vinyl LP', null),
  ('2LP', 'Double vinyl (2 records)', null),
  ('EP',  'Extended Play', null),
  ('BR',  'Blu-ray', null),
  ('OST', 'Original Soundtrack — use as the artist for soundtracks/compilations with no single artist', null),
  ('PPD', 'Published Price to Dealer', null),
  ('D2C', 'Direct-to-consumer (exclude)', null);

-- 4) Exclusion keywords.
insert into public.exclusions (keyword, active, notes) values
  ('D2C',            true, 'Direct-to-consumer'),
  ('US/CANADA ONLY', true, 'Non-European territory restriction'),
  ('AMAZON',         true, 'Amazon-exclusive vinyl — no Amazon Slovenija'),
  ('WEB STORE',      true, 'Artist web-store-only release');

-- 5) Mandatory fields (required before a line is considered complete).
insert into public.mandatory_fields (field_name) values
  ('artist'), ('title'), ('ean'), ('format'), ('release_date'), ('price_eur'), ('label');

-- 6) Per-label notes.
insert into public.label_notes (label, note) values
  ('WARNER', 'Default supplier_code 149. Prices sometimes arrive in a separate follow-up email — expect incremental updates to the same line.'),
  ('WARNER/RHINO', 'Uses code-names for high-profile artists (e.g. "Skylar"). Never resolve; flag for manual review and contact the label.'),
  ('WARNER CLASSICS / ERATO', 'Classical: performer = artist; composer surname prefixes the title, e.g. "SATIE: 3 GYMNOPEDIES...".'),
  ('NONESUCH', 'Watch for release-date changes — update the existing line rather than creating a new one.');
