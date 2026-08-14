-- Last-owner protection + grants. Catalog tables stay read-only to clients.

CREATE OR REPLACE FUNCTION public.protect_last_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid;
  v_count integer;
BEGIN
  v_ws := COALESCE(OLD.workspace_id, NEW.workspace_id);

  IF TG_OP = 'DELETE' AND OLD.role_key = 'owner' AND OLD.status = 'active' THEN
    SELECT count(*) INTO v_count
    FROM public.workspace_memberships
    WHERE workspace_id = v_ws
      AND role_key = 'owner'
      AND status = 'active'
      AND id <> OLD.id;
    IF v_count = 0 THEN
      RAISE EXCEPTION 'LAST_OWNER';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.role_key = 'owner' AND OLD.status = 'active'
     AND (NEW.role_key <> 'owner' OR NEW.status <> 'active') THEN
    SELECT count(*) INTO v_count
    FROM public.workspace_memberships
    WHERE workspace_id = v_ws
      AND role_key = 'owner'
      AND status = 'active'
      AND id <> OLD.id;
    IF v_count = 0 THEN
      RAISE EXCEPTION 'LAST_OWNER';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER memberships_protect_last_owner
  BEFORE UPDATE OR DELETE ON public.workspace_memberships
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_owner();

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;

-- anon: no tenant tables
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
