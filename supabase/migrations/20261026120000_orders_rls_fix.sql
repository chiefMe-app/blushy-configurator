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
