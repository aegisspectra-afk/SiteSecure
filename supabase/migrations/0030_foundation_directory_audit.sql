-- Member directory email + audit writes from the authenticated API (JWT).
-- Does not change Auth, RBAC catalog, or create_workspace owner assignment.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

UPDATE public.profiles AS p
SET email = u.email
FROM auth.users AS u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '')
  AND u.email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_workspace_id uuid,
  p_action text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF p_action IS NULL OR length(trim(p_action)) < 2 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;
  IF NOT public.auth_is_member(p_workspace_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  INSERT INTO public.audit_logs (
    workspace_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    p_workspace_id,
    v_uid,
    trim(p_action),
    NULLIF(p_entity_type, ''),
    p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit_log(uuid, text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.write_audit_log(uuid, text, text, uuid, jsonb) TO authenticated;
