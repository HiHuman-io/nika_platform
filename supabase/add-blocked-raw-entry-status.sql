-- raw_entries.status is a Postgres ENUM (raw_entry_status). v24 started writing a NEW
-- value, 'blocked', for mail the deterministic screen throws away before LlamaParse and
-- the AI — but the enum was never taught about it, so every one of those audit rows was
-- rejected:
--
--     invalid input value for enum raw_entry_status: "blocked"
--
-- The blocking itself has always worked. "Insert Blocked Entry" carries
-- onError: continueRegularOutput precisely so a failed audit insert can never abort a
-- poll, so the message was still stopped — what was lost is the audit row, and that row
-- is the only thing that makes a misfiring rule visible instead of silent. This is the
-- caveat flagged when v24 was built; it is now confirmed.
--
-- RUN THIS ON ITS OWN. ALTER TYPE ... ADD VALUE commits the new label, and a statement in
-- the SAME transaction cannot use it yet — do not bundle it with an INSERT writing
-- 'blocked'.

alter type public.raw_entry_status add value if not exists 'blocked';

-- If that errors with "type raw_entry_status does not exist", it lives in another schema;
-- find it with:
--   select n.nspname, t.typname
--   from pg_type t join pg_namespace n on n.oid = t.typnamespace
--   where t.typname = 'raw_entry_status';

-- Check:
--   select unnest(enum_range(null::public.raw_entry_status));
-- Then confirm the next blocked mail lands on the Raw Entries page:
--   select received_at, sender, subject, extracted->>'blocked_reason' as reason
--   from public.raw_entries where status = 'blocked' order by received_at desc limit 20;
