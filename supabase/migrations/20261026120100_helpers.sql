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
