-- Manual file imports: Excel/PDF files uploaded in the app and processed by n8n.
-- Run this in the Supabase SQL editor.

create table if not exists public.manual_imports (
  id           uuid primary key default gen_random_uuid(),
  file_name    text not null,
  file_path    text not null,          -- object path inside the `imports` bucket
  mime_type    text,
  sender_email text,
  context      text,                   -- free-text notes from the uploader
  status       text not null default 'pending',  -- pending | processing | done | error | ignored
  error        text,
  created_at   timestamptz not null default now()
);

alter table public.manual_imports enable row level security;

-- Adjust to your auth model; this lets any signed-in user manage imports.
drop policy if exists "manual_imports auth all" on public.manual_imports;
create policy "manual_imports auth all"
  on public.manual_imports for all
  to authenticated
  using (true) with check (true);

-- Private storage bucket for the uploaded files.
insert into storage.buckets (id, name, public)
values ('imports', 'imports', false)
on conflict (id) do nothing;

drop policy if exists "imports read" on storage.objects;
create policy "imports read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'imports');

drop policy if exists "imports write" on storage.objects;
create policy "imports write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'imports');
