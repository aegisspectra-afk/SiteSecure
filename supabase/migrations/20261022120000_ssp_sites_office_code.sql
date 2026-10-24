-- Optional human office/ops-center code on ssp_sites (kind=office already models offices).
-- Does not create a duplicate offices table.

ALTER TABLE public.ssp_sites
  ADD COLUMN IF NOT EXISTS code text;

COMMENT ON COLUMN public.ssp_sites.code IS
  'Optional operator-facing office/unit code. Distinct from auto site_id.';

CREATE UNIQUE INDEX IF NOT EXISTS ssp_sites_workspace_code_uidx
  ON public.ssp_sites (workspace_id, lower(code))
  WHERE code IS NOT NULL AND length(trim(code)) > 0;
