-- Undo 20261026120200_parties.sql (Phase 0.2 · 3/3). Deletes every party and item.
drop table if exists public.party_items;
drop table if exists public.parties;
