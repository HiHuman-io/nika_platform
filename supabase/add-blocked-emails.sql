-- "Emails to Block" — the rules that decide which mail never enters the catalog,
-- moved out of the workflow code and into a table the client maintains in the app
-- (Settings -> Emails to Block). Run this in the Supabase SQL editor BEFORE importing
-- the v30 workflows; v30 reads this table and no longer carries the hardcoded lists.
--
-- MATCHING (both columns are optional — that is the whole point):
--   email only            -> every message from that sender is blocked
--   subject_keyword only  -> every message with that word in the subject is blocked,
--                            whoever sent it
--   both                  -> only the COMBINATION is blocked
--   neither               -> rejected by the check constraint below
--
-- `email` is matched against the sender address AND the display name, and:
--   * "orders@i-di.com"  a full address          -> that address
--   * "@nika.si"         starts with @           -> that whole domain
--   * "customerservice"  no @ at all             -> the part LEFT of the @, or the
--                                                   display name (so "i-di offer" works)
-- On a FORWARDED message the ORIGINAL sender is judged, not whoever forwarded it, and a
-- supplier's reply that quotes our own header back is never blocked by it. That logic
-- stays in the workflow — it is how a rule is matched, not which rules exist.

create table if not exists public.blocked_emails (
  id              uuid primary key default gen_random_uuid(),
  email           text,                 -- address, @domain, local-part or display name
  subject_keyword text,                 -- word to look for in the subject
  active          boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  -- at least one of the two has to say something, or the rule would block everything
  constraint blocked_emails_not_empty check (
    coalesce(nullif(btrim(email), ''), nullif(btrim(subject_keyword), '')) is not null
  )
);

-- One rule per (email, keyword) pair, case-insensitively.
create unique index if not exists blocked_emails_rule_uniq
  on public.blocked_emails (lower(coalesce(btrim(email), '')), lower(coalesce(btrim(subject_keyword), '')));

alter table public.blocked_emails enable row level security;

drop policy if exists "blocked_emails auth all" on public.blocked_emails;
create policy "blocked_emails auth all"
  on public.blocked_emails for all
  to authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Seed. Idempotent: only inserts a rule that isn't there yet, so it is safe to
-- re-run and it will never overwrite an edit the client made in the app.
-- ---------------------------------------------------------------------------
insert into public.blocked_emails (email, subject_keyword, active, notes)
select v.email, v.subject_keyword, true, v.notes
from (values
  -- Blocked senders (client, 2026-07-30). I-Di is a REAL supplier (code 41) whose other
  -- addresses send genuine releases, so this is the address and the display name only —
  -- never the i-di.com domain.
  ('orders@i-di.com', null::text, 'Promotional OFFER catalogues, not new releases (client, 2026-07-30)'),
  ('i-di offer',      null,       'Same sender matched by display name — the client forwards these in'),

  -- Blocked senders (client, 2026-07-31).
  ('customerservice@tcc-services.com', null, 'Client: "restrict everything from customerservice" (2026-07-31)'),
  ('customerservice',                  null, 'Client: block any address with "customerservice" left of the @'),

  -- Periodic mail: these duplicate releases we already receive by other means.
  ('david.windmill@warnermusic.com', 'planner', 'Weekly planner — duplicates releases we already get'),
  ('danutamorawska@mystic.pl',       'stock',   'Periodic stock list — duplicates releases we already get'),

  -- Pre-orders from Komab (client, 2026-07-31). Deliberately SENDER-BOUND: a pre-order
  -- announcement is normally a real release (client decision, v17), so "pre-order" on its
  -- own still passes. Revisit if the client confirms they want it blocked outright.
  ('andreea.neumeister@komab.at', 'pre-order', 'Client, 2026-07-31: "Warner Pre-Orders" mail is not a release list'),

  -- Customer orders never enter the catalog (invoices DO -> Other catalog). Keyword-only:
  -- whoever sends them. "pre-order" / "reorder" / "back-order" are NOT caught by these —
  -- the workflow will not fire a generic "order" rule inside one.
  (null, 'purchase order',     'A customer order is never a release list'),
  (null, 'order no',           'A customer order is never a release list'),
  (null, 'order nr',           'A customer order is never a release list'),
  (null, 'order number',       'A customer order is never a release list'),
  (null, 'order confirmation', 'A customer order is never a release list'),
  (null, 'order form',         'A customer order is never a release list'),
  (null, 'naročilo',           'Slovenian for "order"'),
  (null, 'narocilo',           'Slovenian for "order", unaccented'),

  -- Internal Nika stock mail: a colleague mailing a stock list is house-keeping, not a
  -- release announcement (client, 2026-07-30). Domain-wide on the INTERNAL domain only.
  -- Colleagues also forward GENUINE supplier mail in, which is why this is domain +
  -- keyword and never the domain alone.
  -- "stock" is a whole word on purpose, so "Stockholm" is not a stock list; the two
  -- compounds are spelled out, and the Slovenian forms use the * wildcard because they
  -- inflect (zaloga / zalogi / zaloge, inventarja / inventarju).
  ('@nika.si', 'stock',      'Internal stock list — house-keeping, not a release'),
  ('@nika.si', 'stocklist',  'Same, written as one word'),
  ('@nika.si', 'stock list', 'Same, written as two words'),
  ('@nika.si', 'inventory',  'Internal inventory list'),
  ('@nika.si', 'inventar*',  'Slovenian for "inventory", any ending'),
  ('@nika.si', 'zalog*',     'Slovenian for "stock", any ending (zaloga/zalogi/zaloge)')
) as v(email, subject_keyword, notes)
where not exists (
  select 1 from public.blocked_emails b
  where lower(coalesce(btrim(b.email), '')) = lower(coalesce(btrim(v.email), ''))
    and lower(coalesce(btrim(b.subject_keyword), '')) = lower(coalesce(btrim(v.subject_keyword), ''))
);

-- ---------------------------------------------------------------------------
-- Where a catalog line came from: the sender's address and when they sent it,
-- e.g. "promo@elektra.com — 31.07.2026 10:43". Written by the workflow from v30
-- onward; deliberately NOT backfilled (client, 2026-07-31), so existing rows stay
-- blank. Shown in the app immediately right of "Supplier code".
-- ---------------------------------------------------------------------------
alter table public.catalog_lines add column if not exists source_email text;

-- Check what the seed produced:
-- select email, subject_keyword, active, notes from public.blocked_emails order by email nulls last, subject_keyword;
