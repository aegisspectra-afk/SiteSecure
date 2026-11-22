-- Rollback C3 billing upgrade requests.

DROP POLICY IF EXISTS billing_upgrade_requests_update_platform ON public.billing_upgrade_requests;
DROP POLICY IF EXISTS billing_upgrade_requests_insert ON public.billing_upgrade_requests;
DROP POLICY IF EXISTS billing_upgrade_requests_select ON public.billing_upgrade_requests;
DROP TRIGGER IF EXISTS billing_upgrade_requests_set_updated_at ON public.billing_upgrade_requests;
DROP TABLE IF EXISTS public.billing_upgrade_requests;