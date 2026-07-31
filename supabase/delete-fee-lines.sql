-- DESTRUCTIVE (2026-07-31): permanently delete FEE / SERVICE-CHARGE lines that the
-- extraction let into the catalog before v25. PRODUCTION data, NO undo. Run the two
-- previews first and confirm the rows are what you expect BEFORE running the DELETE.
--
-- What these are: a supplier invoice bills more than the records. Warner's invoices end
-- with LINEFEE "Charge per shipped order line" and UNITFEE "Charge per shipped unit"
-- (Config. column "Service Charge"), and other suppliers add freight / handling / postage
-- lines. They are accounting lines, never products — no barcode, no artist, nothing that
-- can be stocked, priced or sent to Hermes.
--
-- v25 of the n8n workflows stops these at extraction, so this file is a ONE-OFF cleanup of
-- what already got in. Every condition below requires ean IS NULL, so a real record can
-- never be caught by it.
--
-- SAFETY: sent lines (sent_at is not null) are left alone — they are already at Hermes and
-- deleting them here would hide that. PREVIEW 2 lists any so you can see them; handle
-- those by hand.

-- PREVIEW 1 — the rows this will delete:
select id, catalog, status, artist, title, catalogue_no, ean, cop, rock_bottom, created_at
from public.catalog_lines
where ean is null
  and sent_at is null
  and (
        upper(coalesce(catalogue_no, '')) in ('LINEFEE', 'UNITFEE')
     or (artist is null and upper(coalesce(title, '')) ~
         '(CHARGE PER |SERVICE CHARGE|SERVICE FEE|HANDLING (FEE|CHARGE)|FREIGHT|SHIPPING (FEE|CHARGE|COST)|POSTAGE|CARRIAGE|PALLET (FEE|CHARGE)|DELIVERY (FEE|CHARGE)|ADMIN(ISTRATION)? (FEE|CHARGE)|SURCHARGE|ROUNDING|CREDIT NOTE|GRAND TOTAL|TOTAL QTY|NET VALUE|SUBTOTAL)')
  )
order by created_at desc;

-- PREVIEW 2 — the same junk on lines ALREADY SENT to Hermes. The DELETE below skips
-- these on purpose; review them by hand.
select id, catalog, status, artist, title, catalogue_no, sent_at
from public.catalog_lines
where ean is null
  and sent_at is not null
  and (
        upper(coalesce(catalogue_no, '')) in ('LINEFEE', 'UNITFEE')
     or (artist is null and upper(coalesce(title, '')) ~ '(CHARGE PER |SERVICE CHARGE|FREIGHT|POSTAGE|CARRIAGE|SURCHARGE)')
  )
order by sent_at desc;

-- APPLY (only after checking the previews). Tip: wrap it in a transaction so you can
-- read the reported row count before committing:
--   begin;
--     delete ... ;   -- note "DELETE <n>"
--   -- rollback;  (to abort)  /  commit;  (to keep)
delete from public.catalog_lines
where ean is null
  and sent_at is null
  and (
        upper(coalesce(catalogue_no, '')) in ('LINEFEE', 'UNITFEE')
     or (artist is null and upper(coalesce(title, '')) ~
         '(CHARGE PER |SERVICE CHARGE|SERVICE FEE|HANDLING (FEE|CHARGE)|FREIGHT|SHIPPING (FEE|CHARGE|COST)|POSTAGE|CARRIAGE|PALLET (FEE|CHARGE)|DELIVERY (FEE|CHARGE)|ADMIN(ISTRATION)? (FEE|CHARGE)|SURCHARGE|ROUNDING|CREDIT NOTE|GRAND TOTAL|TOTAL QTY|NET VALUE|SUBTOTAL)')
  );
