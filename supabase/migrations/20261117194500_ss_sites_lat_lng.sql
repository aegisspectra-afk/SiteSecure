-- Align sites geo columns with cloud (rhxqqudlngimhplvndmz).
-- Cloud already has these; local was missing them. Idempotent for all targets.
-- Rollback: supabase/rollbacks/rollback_20261117194500_ss_sites_lat_lng.sql

BEGIN;

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

COMMENT ON COLUMN public.sites.latitude IS 'Optional WGS84 latitude (cloud-aligned).';
COMMENT ON COLUMN public.sites.longitude IS 'Optional WGS84 longitude (cloud-aligned).';

COMMIT;
