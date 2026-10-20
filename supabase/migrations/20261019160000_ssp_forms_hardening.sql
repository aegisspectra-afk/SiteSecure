-- SSP V1 hardening: published-version immutability + atomic public submit.
-- Additive. Does not modify FleetMaster. Do not apply without explicit staging approval.

-- ── 1) Form version immutability ─────────────────────────────────────────────
-- Authenticated JWT may only UPDATE draft rows and must leave status = draft.
-- Publish (draft → published) is service_role only (bypasses RLS) and is allowed
-- by the trigger below. Published rows cannot be mutated by anyone.

DROP POLICY IF EXISTS ssp_form_versions_update ON public.ssp_form_versions;
CREATE POLICY ssp_form_versions_update ON public.ssp_form_versions
  FOR UPDATE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
    AND status = 'draft'
  )
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
    AND status = 'draft'
  );

CREATE OR REPLACE FUNCTION public.ssp_form_versions_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'published' THEN
      RAISE EXCEPTION 'SSP_VERSION_IMMUTABLE'
        USING ERRCODE = 'check_violation',
              HINT = 'Published SSP form versions cannot be modified';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (OLD.status = 'draft' AND NEW.status = 'published') THEN
      RAISE EXCEPTION 'SSP_VERSION_STATUS_INVALID'
        USING ERRCODE = 'check_violation',
              HINT = 'Only draft→published status transition is allowed';
    END IF;
    IF OLD.status = 'draft' AND NEW.status = 'published' THEN
      IF NEW.definition IS NULL THEN
        RAISE EXCEPTION 'SSP_VERSION_DEFINITION_REQUIRED';
      END IF;
      IF NEW.published_at IS NULL THEN
        NEW.published_at := now();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ssp_form_versions_immutability_trg ON public.ssp_form_versions;
CREATE TRIGGER ssp_form_versions_immutability_trg
  BEFORE UPDATE ON public.ssp_form_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.ssp_form_versions_immutability();

COMMENT ON FUNCTION public.ssp_form_versions_immutability() IS
  'Blocks edits to published SSP form versions; allows draft→published publish path only.';

-- ── 2) Atomic public submission (concurrency-safe limits + idempotency) ──────
-- Called by FastAPI service role after token/access-code validation and answer
-- validation. Client cannot supply workspace_id/status/count/submitted_at.

CREATE OR REPLACE FUNCTION public.ssp_public_submit(
  p_assignment_id uuid,
  p_answers jsonb,
  p_consent jsonb,
  p_definition_snapshot jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.ssp_form_assignments%ROWTYPE;
  existing_id uuid;
  existing_status text;
  existing_submitted_at timestamptz;
  new_id uuid;
  new_submitted_at timestamptz;
  v_key text := NULLIF(trim(COALESCE(p_idempotency_key, '')), '');
BEGIN
  IF p_assignment_id IS NULL THEN
    RAISE EXCEPTION 'SSP_ASSIGNMENT_REQUIRED' USING ERRCODE = 'check_violation';
  END IF;
  IF p_definition_snapshot IS NULL THEN
    RAISE EXCEPTION 'SSP_DEFINITION_REQUIRED' USING ERRCODE = 'check_violation';
  END IF;

  -- Serialize concurrent submits for the same assignment.
  SELECT * INTO a
  FROM public.ssp_form_assignments
  WHERE id = p_assignment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SSP_ASSIGNMENT_NOT_FOUND' USING ERRCODE = 'no_data_found';
  END IF;

  IF a.status = 'revoked' OR a.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'SSP_ASSIGNMENT_REVOKED' USING ERRCODE = 'check_violation';
  END IF;
  IF a.status = 'expired' THEN
    RAISE EXCEPTION 'SSP_ASSIGNMENT_EXPIRED' USING ERRCODE = 'check_violation';
  END IF;
  IF a.status = 'completed' THEN
    RAISE EXCEPTION 'SSP_ASSIGNMENT_COMPLETED' USING ERRCODE = 'check_violation';
  END IF;
  IF a.expires_at IS NOT NULL AND a.expires_at < now() THEN
    RAISE EXCEPTION 'SSP_ASSIGNMENT_EXPIRED' USING ERRCODE = 'check_violation';
  END IF;

  -- Idempotency: same key → return original row; do not increment again.
  IF v_key IS NOT NULL THEN
    SELECT s.id, s.status, s.submitted_at
      INTO existing_id, existing_status, existing_submitted_at
    FROM public.ssp_form_submissions s
    WHERE s.assignment_id = a.id
      AND s.idempotency_key = v_key
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'id', existing_id,
        'status', existing_status,
        'submitted_at', existing_submitted_at,
        'replayed', true
      );
    END IF;
  END IF;

  IF a.max_submissions IS NOT NULL AND a.submission_count >= a.max_submissions THEN
    RAISE EXCEPTION 'SSP_ASSIGNMENT_LIMIT' USING ERRCODE = 'check_violation';
  END IF;

  new_submitted_at := now();

  INSERT INTO public.ssp_form_submissions (
    workspace_id,
    form_id,
    form_version_id,
    assignment_id,
    status,
    answers,
    consent,
    definition_snapshot,
    submitted_at,
    idempotency_key
  ) VALUES (
    a.workspace_id,
    a.form_id,
    a.form_version_id,
    a.id,
    'submitted',
    COALESCE(p_answers, '{}'::jsonb),
    COALESCE(p_consent, '[]'::jsonb),
    p_definition_snapshot,
    new_submitted_at,
    v_key
  )
  RETURNING id INTO new_id;

  UPDATE public.ssp_form_assignments
  SET
    submission_count = submission_count + 1,
    status = CASE
      WHEN max_submissions IS NOT NULL AND submission_count + 1 >= max_submissions THEN 'completed'
      ELSE status
    END,
    completed_at = CASE
      WHEN max_submissions IS NOT NULL AND submission_count + 1 >= max_submissions THEN new_submitted_at
      ELSE completed_at
    END
  WHERE id = a.id;

  RETURN jsonb_build_object(
    'id', new_id,
    'status', 'submitted',
    'submitted_at', new_submitted_at,
    'replayed', false
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Concurrent duplicate idempotency_key: return the winner's row.
    IF v_key IS NOT NULL THEN
      SELECT s.id, s.status, s.submitted_at
        INTO existing_id, existing_status, existing_submitted_at
      FROM public.ssp_form_submissions s
      WHERE s.assignment_id = p_assignment_id
        AND s.idempotency_key = v_key
      LIMIT 1;
      IF existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
          'id', existing_id,
          'status', existing_status,
          'submitted_at', existing_submitted_at,
          'replayed', true
        );
      END IF;
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.ssp_public_submit(uuid, jsonb, jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ssp_public_submit(uuid, jsonb, jsonb, jsonb, text) TO service_role;

COMMENT ON FUNCTION public.ssp_public_submit(uuid, jsonb, jsonb, jsonb, text) IS
  'Atomic SSP public submit: FOR UPDATE assignment, idempotent by (assignment, key), server submitted_at, concurrency-safe max_submissions.';
