-- Rollback 20261117194500_ss_sites_lat_lng.sql
-- Drops columns only when present. Does not restore prior values.

BEGIN;

ALTER TABLE public.sites DROP COLUMN IF EXISTS latitude;
ALTER TABLE public.sites DROP COLUMN IF EXISTS longitude;

COMMIT;
