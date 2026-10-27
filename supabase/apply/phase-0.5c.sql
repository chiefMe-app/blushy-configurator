-- PartyMuse by Blushy — Phase 0.5c database setup, in one file.
-- Paste the whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once. It adds the private `renders` Storage bucket and
-- its rules: each signed-in customer reaches only their own folder.
-- Generated from supabase/migrations (tests/unit/db.rls.test.ts checks it).

-- ===== 20261027130000_render_storage.sql =====
-- Phase 0.5c — renders kept in the customer's account.
--
-- A private Storage bucket, `renders`. Each customer's renders live under a
-- folder named after their user id (renders/<user id>/<scene key>.jpg). The
-- render API uploads with the customer's own session, so the same rules
-- that let a customer read their renders are the only way in: a signed-in
-- account (not a guest) reads, adds, replaces and deletes files in its own
-- folder only. Nothing is public; the app shows a file through a short-lived
-- signed link.
--
-- Safe to run more than once.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('renders', 'renders', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg'];

drop policy if exists "renders: owner reads" on storage.objects;
create policy "renders: owner reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'renders' and public.is_real_user() and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "renders: owner adds" on storage.objects;
create policy "renders: owner adds" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'renders' and public.is_real_user() and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "renders: owner replaces" on storage.objects;
create policy "renders: owner replaces" on storage.objects
  for update to authenticated
  using (bucket_id = 'renders' and public.is_real_user() and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'renders' and public.is_real_user() and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "renders: owner deletes" on storage.objects;
create policy "renders: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'renders' and public.is_real_user() and (storage.foldername(name))[1] = auth.uid()::text);
