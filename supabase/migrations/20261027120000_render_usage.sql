-- Phase 0.5b — renders need an account, and each account has a daily limit.
--
-- The render API (app/api/generate-controlled-render) calls take_render()
-- with the customer's own session before every paid render. The count is
-- kept here, so the limit holds across every server instance and restart.
-- Nobody reads or writes render_usage directly (no policies); only the
-- function does, for the signed-in caller alone.
--
-- Safe to run more than once.

create table if not exists public.render_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  renders integer not null default 0,
  primary key (user_id, day)
);
alter table public.render_usage enable row level security;
revoke all on public.render_usage from anon, authenticated;

-- Counts one render for the caller and returns how many are left today, or:
--   -1  not a signed-in account (no session, or a guest session)
--   -2  today's limit is reached (nothing is counted)
-- The limit comes from the server. A customer calling this themselves can
-- only use up their own renders.
create or replace function public.take_render(p_daily_limit integer)
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  who   uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  used  integer;
begin
  if not public.is_real_user() then
    return -1;
  end if;
  insert into public.render_usage as u (user_id, day, renders)
  values (who, today, 1)
  on conflict (user_id, day) do update
    set renders = u.renders + 1
    where u.renders < p_daily_limit
  returning u.renders into used;
  if used is null or used > p_daily_limit then
    return -2;
  end if;
  return p_daily_limit - used;
end
$$;
revoke all on function public.take_render(integer) from public, anon;
grant execute on function public.take_render(integer) to authenticated;

-- Old days are no use: keep a week.
create or replace function public.forget_old_render_usage()
  returns void
  language sql
  security definer
  set search_path = public
as $$
  delete from public.render_usage where day < (now() at time zone 'utc')::date - 7;
$$;
revoke all on function public.forget_old_render_usage() from public, anon, authenticated;
