-- PartyMuse by Blushy — Phase 0.2 database setup, in one file.
-- Paste the whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once. It changes no existing order; it only stops
-- signed-in users other than staff from reading orders, and adds the empty
-- My Party tables (parties, party_items) with their access rules.
-- Generated from supabase/migrations (tests/unit/db.rls.test.ts checks it).

-- ===== 20261026120000_orders_rls_fix.sql =====
-- Phase 0.2 · 1/3 — close the orders read policy before anonymous sign-in.
--
-- supabase/schema.sql let every `authenticated` user read every order (names
-- and WhatsApp numbers). Supabase's anonymous guests are `authenticated` too,
-- so once guest sessions are on, any visitor could read them all. Orders are
-- now readable by staff only. Inserting an order (the configurator's
-- /api/orders, anon key) works exactly as before.
--
-- Safe to run more than once, and on a project that has no orders table yet.

create table if not exists public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
-- No policies: staff are added from the Supabase dashboard (or the service
-- role), never by the app's users.
alter table public.staff enable row level security;

create or replace function public.is_staff()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated;

do $$
begin
  if to_regclass('public.orders') is not null then
    drop policy if exists "authenticated can read orders" on public.orders;
    drop policy if exists "staff can read orders" on public.orders;
    create policy "staff can read orders"
      on public.orders for select
      to authenticated
      using (public.is_staff());
  end if;
end
$$;

-- ===== 20261026120100_helpers.sql =====
-- Phase 0.2 · 2/3 — who is a real (signed-in, not anonymous) user.
--
-- Supabase's anonymous guests have the `authenticated` role, so `to
-- authenticated` alone does not tell a guest from an account. The JWT's
-- is_anonymous claim does. Tables that need an account (orders, purchases,
-- downloads; Phase 1) require is_real_user().

create or replace function public.is_real_user()
  returns boolean
  language sql
  stable
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;
grant execute on function public.is_real_user() to anon, authenticated;

-- Keeps updated_at current on the tables that have one.
create or replace function public.touch_updated_at()
  returns trigger
  language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ===== 20261026120200_parties.sql =====
-- Phase 0.2 · 3/3 — My Party: a party and the things in it.
--
-- A guest (anonymous session) or an account owns its parties; nobody else can
-- read or change them. A party item is a studio design (the backdrop today;
-- the cake, the welcome board later) or a service, with its configuration as
-- JSON. Nothing in the app writes here yet: guest saving is Phase 0.3.
--
-- Item statuses beyond 'draft' (held, requested, confirmed …) belong to the
-- booking flow and are set by the server only; they are added with it.

create table if not exists public.parties (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null default 'My party' check (char_length(title) between 1 and 120),
  -- Party context: theme, date, area, guests … (shared by every studio).
  context    jsonb not null default '{}'::jsonb
               check (jsonb_typeof(context) = 'object' and pg_column_size(context) <= 16384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists parties_owner_idx on public.parties (owner_id, updated_at desc);

create table if not exists public.party_items (
  id          uuid primary key default gen_random_uuid(),
  party_id    uuid not null references public.parties (id) on delete cascade,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('product', 'service')),
  -- What it is, e.g. 'studio.backdrop', 'service.face_painting'.
  ref_id      text not null check (ref_id ~ '^[a-z0-9_.-]{1,80}$'),
  config      jsonb not null default '{}'::jsonb
                check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 262144),
  fulfillment text not null default 'blushy_arranged'
                check (fulfillment in ('digital', 'blushy_arranged', 'partner_direct', 'diy')),
  -- The price as shown when it was added (lines, total, confidence).
  price_snapshot jsonb check (price_snapshot is null or jsonb_typeof(price_snapshot) = 'object'),
  status      text not null default 'draft' check (status in ('draft')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists party_items_party_idx on public.party_items (party_id, created_at);

drop trigger if exists parties_touch on public.parties;
create trigger parties_touch before update on public.parties
  for each row execute function public.touch_updated_at();
drop trigger if exists party_items_touch on public.party_items;
create trigger party_items_touch before update on public.party_items
  for each row execute function public.touch_updated_at();

alter table public.parties enable row level security;
alter table public.party_items enable row level security;

-- Owners only (guests included). The `anon` role (no session) has nothing.
drop policy if exists "owners read their parties" on public.parties;
create policy "owners read their parties" on public.parties
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists "owners create parties" on public.parties;
create policy "owners create parties" on public.parties
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "owners change their parties" on public.parties;
create policy "owners change their parties" on public.parties
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "owners delete their parties" on public.parties;
create policy "owners delete their parties" on public.parties
  for delete to authenticated using (owner_id = auth.uid());

-- An item belongs to its owner and sits in one of that owner's parties.
drop policy if exists "owners read their items" on public.party_items;
create policy "owners read their items" on public.party_items
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists "owners add items to their parties" on public.party_items;
create policy "owners add items to their parties" on public.party_items
  for insert to authenticated with check (
    owner_id = auth.uid()
    and exists (select 1 from public.parties p where p.id = party_id and p.owner_id = auth.uid())
  );
drop policy if exists "owners change their items" on public.party_items;
create policy "owners change their items" on public.party_items
  for update to authenticated using (owner_id = auth.uid()) with check (
    owner_id = auth.uid()
    and exists (select 1 from public.parties p where p.id = party_id and p.owner_id = auth.uid())
  );
drop policy if exists "owners delete their items" on public.party_items;
create policy "owners delete their items" on public.party_items
  for delete to authenticated using (owner_id = auth.uid());

-- Staff read everything (support), through the same is_staff() as orders.
drop policy if exists "staff read parties" on public.parties;
create policy "staff read parties" on public.parties
  for select to authenticated using (public.is_staff());
drop policy if exists "staff read items" on public.party_items;
create policy "staff read items" on public.party_items
  for select to authenticated using (public.is_staff());

-- Never through the anon role (no session).
revoke all on public.parties, public.party_items from anon;
