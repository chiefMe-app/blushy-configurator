-- Blushy configurator — orders table
-- Run this in the Supabase SQL editor.

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  theme         text not null,
  shape         text not null,
  garland       text not null,
  extras        jsonb not null default '{}'::jsonb,
  custom_text   text,
  total_price   numeric(10, 2) not null,
  status        text not null default 'pending'
                  check (status in ('pending', 'confirmed')),
  customer_name  text not null,
  customer_phone text not null
);

-- Row Level Security: allow public (anon) inserts from the configurator,
-- but keep reads restricted to authenticated staff.
alter table public.orders enable row level security;

create policy "anon can create orders"
  on public.orders for insert
  to anon
  with check (true);

create policy "authenticated can read orders"
  on public.orders for select
  to authenticated
  using (true);

create index if not exists orders_created_at_idx
  on public.orders (created_at desc);
