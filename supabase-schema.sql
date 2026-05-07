create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text default '',
  email text default '',
  phone text not null,
  source text default 'Web',
  status text not null default 'nuevo' check (status in ('nuevo', 'contactado', 'seguimiento', 'presupuesto', 'cerrado')),
  message text not null,
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contacts enable row level security;

drop policy if exists "Authenticated users can read contacts" on public.contacts;
drop policy if exists "Authenticated users can insert contacts" on public.contacts;
drop policy if exists "Authenticated users can update contacts" on public.contacts;
drop policy if exists "Authenticated users can delete contacts" on public.contacts;

create policy "Authenticated users can read contacts"
on public.contacts
for select
to authenticated
using (true);

create policy "Authenticated users can insert contacts"
on public.contacts
for insert
to authenticated
with check (true);

create policy "Authenticated users can update contacts"
on public.contacts
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete contacts"
on public.contacts
for delete
to authenticated
using (true);
