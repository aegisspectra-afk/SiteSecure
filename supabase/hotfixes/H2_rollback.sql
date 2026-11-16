-- מחזיר את הפרצה. להריץ רק אם H2 שבר משהו.
--
-- ROLLBACK for H2: removes the role guard trigger and the two functions H2 added
-- (the cloud had neither before H2).
BEGIN;
DROP TRIGGER IF EXISTS workspace_memberships_guard_role ON public.workspace_memberships;
DROP FUNCTION IF EXISTS public.workspace_memberships_guard_role();
DROP FUNCTION IF EXISTS public.ss_is_trusted_backend();
COMMIT;
