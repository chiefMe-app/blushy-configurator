-- PartyMuse by Blushy — the orders table, for a project that does not have it.
-- Paste the whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once, and on a project that already has the table
-- (nothing in it changes). Run phase-0.2.sql first or after — either order.
--
-- The same table as supabase/schema.sql, without its old "authenticated can
-- read orders" rule: orders are created by the configurator (anon key) and
-- read by staff only (public.is_staff(), from phase-0.2.sql).

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
create index if not exists orders_created_at_idx on public.orders (created_at desc);

alter table public.orders enable row level security;

drop policy if exists "anon can create orders" on public.orders;
create policy "anon can create orders"
  on public.orders for insert
  to anon
  with check (true);

-- Never the old rule that let every signed-in user (guests too) read orders.
drop policy if exists "authenticated can read orders" on public.orders;

-- Staff read orders, once phase-0.2.sql has added is_staff().
do $$
begin
  if to_regprocedure('public.is_staff()') is not null then
    drop policy if exists "staff can read orders" on public.orders;
    create policy "staff can read orders"
      on public.orders for select
      to authenticated
      using (public.is_staff());
  end if;
end
$$;
