-- Removes the access rules. The bucket and its files are left in place:
-- Supabase deletes stored files only through the Storage API.
drop policy if exists "renders: owner deletes" on storage.objects;
drop policy if exists "renders: owner replaces" on storage.objects;
drop policy if exists "renders: owner adds" on storage.objects;
drop policy if exists "renders: owner reads" on storage.objects;
