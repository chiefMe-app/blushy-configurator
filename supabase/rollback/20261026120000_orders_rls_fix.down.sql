-- Undo 20261026120000_orders_rls_fix.sql (Phase 0.2 · 1/3): puts back the old
-- policy, under which every signed-in user (anonymous guests included) can
-- read every order. Only use it before anonymous sign-in is switched on.
do $$
begin
  if to_regclass('public.orders') is not null then
    drop policy if exists "staff can read orders" on public.orders;
    drop policy if exists "authenticated can read orders" on public.orders;
    create policy "authenticated can read orders" on public.orders for select to authenticated using (true);
  end if;
end
$$;
drop function if exists public.is_staff();
drop table if exists public.staff;
