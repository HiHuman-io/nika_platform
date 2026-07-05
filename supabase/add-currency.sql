-- Capture the source price + currency so non-EUR prices (e.g. PLN) aren't lost.
-- price_eur is filled only when the source currency is EUR; otherwise the line is
-- flagged for review and a human enters the EUR price. Run in the SQL editor.
alter table public.catalog_lines add column if not exists currency text;
alter table public.catalog_lines add column if not exists price_original numeric;
