-- Rollback C2 manual subscription allocation audit log.

DROP POLICY IF EXISTS subscription_allocation_log_select_platform ON public.subscription_allocation_log;
DROP TABLE IF EXISTS public.subscription_allocation_log;