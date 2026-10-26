-- Undo 20261026120100_helpers.sql (Phase 0.2 · 2/3). Run after the parties rollback.
drop function if exists public.touch_updated_at();
drop function if exists public.is_real_user();
