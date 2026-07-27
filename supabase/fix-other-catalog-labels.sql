-- One-off (2026-07-27): repair lines that should have gone to the OTHER catalog
-- but landed in MAIN with supplier_code '149'.
--
-- Cause: Build Catalog Rows compared the label with exact, case-sensitive
-- literals ('Pias Recordings'), while the AI returns labels in CAPITALS
-- ("PIAS RECORDINGS", the style the prompt uses for WARNER/<sub-label>). The
-- compare never matched, so catalog fell through to 'main' and supplier_code to
-- '149'. Fixed for future runs in the v10 workflows (normalised label key).
--
-- PRODUCTION data — run the preview first, then the UPDATE. Idempotent.
-- Lines already SENT to Hermes are left alone on purpose: supplier_code is what
-- was actually pushed, and rewriting it would falsify the audit trail. Their
-- catalog (Main/Other) is display-only, so they are moved as well — but nothing
-- else about them changes.

-- PREVIEW — everything the label rule considers "other":
select id, label, catalog, supplier_code, artist, title, ean, sent_at
from public.catalog_lines
where regexp_replace(upper(coalesce(label, '')), '[^A-Z0-9]', '', 'g')
      in ('MATRIXMUSIC', 'MATRIX', 'IDIMUSIC', 'IDI', 'PIASRECORDINGS', 'PIAS')
order by label, artist;

-- APPLY 1/2 — catalog for all of them (display-only, safe on sent lines):
update public.catalog_lines
set catalog = 'other'
where regexp_replace(upper(coalesce(label, '')), '[^A-Z0-9]', '', 'g')
      in ('MATRIXMUSIC', 'MATRIX', 'IDIMUSIC', 'IDI', 'PIASRECORDINGS', 'PIAS')
  and catalog is distinct from 'other';

-- APPLY 2/2 — supplier_code, NOT-yet-sent lines only:
--   Matrix Music -> '54', I-DI music / Pias Recordings -> blank.
update public.catalog_lines
set supplier_code = case
      when regexp_replace(upper(coalesce(label, '')), '[^A-Z0-9]', '', 'g')
           in ('MATRIXMUSIC', 'MATRIX') then '54'
      else null
    end
where sent_at is null
  and regexp_replace(upper(coalesce(label, '')), '[^A-Z0-9]', '', 'g')
      in ('MATRIXMUSIC', 'MATRIX', 'IDIMUSIC', 'IDI', 'PIASRECORDINGS', 'PIAS');

-- CHECK — should return no rows:
select id, label, catalog, supplier_code, sent_at
from public.catalog_lines
where regexp_replace(upper(coalesce(label, '')), '[^A-Z0-9]', '', 'g')
      in ('MATRIXMUSIC', 'MATRIX', 'IDIMUSIC', 'IDI', 'PIASRECORDINGS', 'PIAS')
  and (catalog is distinct from 'other'
       or (sent_at is null and supplier_code is not null
           and regexp_replace(upper(coalesce(label, '')), '[^A-Z0-9]', '', 'g') not in ('MATRIXMUSIC', 'MATRIX')));
