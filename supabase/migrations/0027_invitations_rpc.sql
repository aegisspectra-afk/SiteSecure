-- Invitee is not yet a member, so acceptance cannot go through table RLS.
-- Token is hashed at rest; raw token is never stored.

CREATE OR REPLACE FUNCTION public.token_sha256(p_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.peek_invitation(p_token text)
RETURNS TABLE (
  workspace_id uuid,
  workspace_name text,
  role_key text,
  email text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text := public.token_sha256(p_token);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  RETURN QUERY
  SELECT i.workspace_id, w.name, i.role_key, i.email, i.expires_at
  FROM public.invitations i
  JOIN public.workspaces w ON w.id = i.workspace_id
  WHERE i.token_hash = v_hash
    AND i.accepted_at IS NULL
    AND i.expires_at > now();
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text := public.token_sha256(p_token);
  v_inv public.invitations%ROWTYPE;
  v_email text;
  v_code text;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT COALESCE(u.email, '') INTO v_email
  FROM auth.users u
  WHERE u.id = v_uid;

  SELECT * INTO v_inv
  FROM public.invitations i
  WHERE i.token_hash = v_hash
    AND i.accepted_at IS NULL
    AND i.expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_INVALID';
  END IF;

  IF lower(v_inv.email) <> lower(v_email) THEN
    RAISE EXCEPTION 'INVITE_EMAIL_MISMATCH';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workspace_memberships m
    WHERE m.workspace_id = v_inv.workspace_id AND m.user_id = v_uid
  ) THEN
    UPDATE public.invitations SET accepted_at = now() WHERE id = v_inv.id;
    RETURN v_inv.workspace_id;
  END IF;

  IF v_inv.role_key = 'founding_technician' THEN
    v_code := 'SS-FT-' || lpad(public.next_code(v_inv.workspace_id, 'ft')::text, 3, '0');
  END IF;

  INSERT INTO public.workspace_memberships (
    workspace_id, user_id, role_key, technician_code, program_type, program_started_at
  )
  VALUES (
    v_inv.workspace_id,
    v_uid,
    v_inv.role_key,
    v_code,
    CASE WHEN v_inv.role_key = 'founding_technician' THEN 'founding_technician' ELSE NULL END,
    CASE WHEN v_inv.role_key = 'founding_technician' THEN now() ELSE NULL END
  );

  UPDATE public.invitations SET accepted_at = now() WHERE id = v_inv.id;

  UPDATE public.profiles
  SET last_workspace_id = COALESCE(last_workspace_id, v_inv.workspace_id)
  WHERE id = v_uid;

  RETURN v_inv.workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.token_sha256(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.peek_invitation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;
