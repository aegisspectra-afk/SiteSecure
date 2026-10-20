-- SSP V1: digital forms, published versions, tablet assignments, submissions.
-- Distinct product domain; tenant = workspaces.id. No patrol/GPS/workforce.

-- ── Feature + permissions ────────────────────────────────────────────────────

INSERT INTO public.features (key) VALUES ('ssp')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.plan_features (plan_key, feature_key)
SELECT p.plan_key, 'ssp'
FROM (VALUES ('solo'), ('business'), ('enterprise')) AS p(plan_key)
ON CONFLICT DO NOTHING;

INSERT INTO public.permissions (key, group_key)
VALUES
  ('ssp.forms.view', 'ssp'),
  ('ssp.forms.edit', 'ssp'),
  ('ssp.forms.publish', 'ssp'),
  ('ssp.assignments.manage', 'ssp'),
  ('ssp.submissions.view', 'ssp')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT role_key, permission_key
FROM (
  VALUES
    ('owner', 'ssp.forms.view'),
    ('owner', 'ssp.forms.edit'),
    ('owner', 'ssp.forms.publish'),
    ('owner', 'ssp.assignments.manage'),
    ('owner', 'ssp.submissions.view'),
    ('administrator', 'ssp.forms.view'),
    ('administrator', 'ssp.forms.edit'),
    ('administrator', 'ssp.forms.publish'),
    ('administrator', 'ssp.assignments.manage'),
    ('administrator', 'ssp.submissions.view'),
    ('manager', 'ssp.forms.view'),
    ('manager', 'ssp.forms.edit'),
    ('manager', 'ssp.forms.publish'),
    ('manager', 'ssp.assignments.manage'),
    ('manager', 'ssp.submissions.view'),
    ('viewer', 'ssp.forms.view'),
    ('viewer', 'ssp.submissions.view')
) AS seed(role_key, permission_key)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  r record;
  keys text[];
BEGIN
  FOR r IN
    SELECT id, key, grants
    FROM public.workspace_roles
    WHERE is_system
      AND key IN ('administrator', 'manager', 'viewer')
      AND jsonb_typeof(grants) = 'array'
      AND jsonb_array_length(grants) > 0
      AND NOT (grants @> '["*"]'::jsonb)
  LOOP
    IF r.key IN ('administrator', 'manager') THEN
      keys := ARRAY[
        'ssp.forms.view', 'ssp.forms.edit', 'ssp.forms.publish',
        'ssp.assignments.manage', 'ssp.submissions.view'
      ];
    ELSE
      keys := ARRAY['ssp.forms.view', 'ssp.submissions.view'];
    END IF;

    UPDATE public.workspace_roles
    SET grants = (
      SELECT jsonb_agg(to_jsonb(item) ORDER BY item)
      FROM (
        SELECT DISTINCT item
        FROM (
          SELECT jsonb_array_elements_text(r.grants) AS item
          UNION ALL
          SELECT unnest(keys)
        ) u
      ) d
    )
    WHERE id = r.id;
  END LOOP;
END $$;

-- ── Forms ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ssp_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  latest_published_version integer,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT ssp_forms_title_len CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT ssp_forms_id_workspace_uid UNIQUE (id, workspace_id)
);

CREATE INDEX IF NOT EXISTS ssp_forms_workspace_idx
  ON public.ssp_forms (workspace_id, status, updated_at DESC);

CREATE TRIGGER ssp_forms_set_updated_at
  BEFORE UPDATE ON public.ssp_forms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ssp_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_forms FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_forms_select ON public.ssp_forms
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_forms_insert ON public.ssp_forms
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
  );

CREATE POLICY ssp_forms_update ON public.ssp_forms
  FOR UPDATE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
  )
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
  );

-- ── Form versions (immutable once published) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ssp_form_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  form_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  definition jsonb NOT NULL DEFAULT '{"fields":[]}'::jsonb,
  published_at timestamptz,
  published_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_id, version),
  CONSTRAINT ssp_form_versions_form_workspace_fk
    FOREIGN KEY (form_id, workspace_id)
    REFERENCES public.ssp_forms (id, workspace_id)
);

CREATE INDEX IF NOT EXISTS ssp_form_versions_form_idx
  ON public.ssp_form_versions (workspace_id, form_id, version DESC);

ALTER TABLE public.ssp_form_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_form_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_form_versions_select ON public.ssp_form_versions
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_form_versions_insert ON public.ssp_form_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
  );

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
  );

-- ── Assignments ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ssp_form_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  form_id uuid NOT NULL,
  form_version_id uuid NOT NULL REFERENCES public.ssp_form_versions (id),
  label text NOT NULL DEFAULT '',
  token_hash text NOT NULL,
  access_code_hash text,
  require_account boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'expired', 'revoked')),
  expires_at timestamptz,
  max_submissions integer CHECK (max_submissions IS NULL OR max_submissions >= 1),
  submission_count integer NOT NULL DEFAULT 0 CHECK (submission_count >= 0),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  completed_at timestamptz,
  UNIQUE (token_hash),
  CONSTRAINT ssp_assignments_form_workspace_fk
    FOREIGN KEY (form_id, workspace_id)
    REFERENCES public.ssp_forms (id, workspace_id)
);

CREATE INDEX IF NOT EXISTS ssp_assignments_workspace_idx
  ON public.ssp_form_assignments (workspace_id, form_id, created_at DESC);

ALTER TABLE public.ssp_form_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_form_assignments FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_assignments_select ON public.ssp_form_assignments
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_assignments_insert ON public.ssp_form_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
  );

CREATE POLICY ssp_assignments_update ON public.ssp_form_assignments
  FOR UPDATE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
  )
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
  );

REVOKE ALL ON TABLE public.ssp_form_assignments FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_form_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_form_assignments TO service_role;

COMMENT ON TABLE public.ssp_form_assignments IS
  'Tablet form assignments. token_hash + optional access_code_hash only; plaintext never stored.';

-- ── Submissions ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ssp_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  form_id uuid NOT NULL,
  form_version_id uuid NOT NULL REFERENCES public.ssp_form_versions (id),
  assignment_id uuid NOT NULL REFERENCES public.ssp_form_assignments (id),
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted')),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent jsonb NOT NULL DEFAULT '[]'::jsonb,
  definition_snapshot jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ssp_submissions_form_workspace_fk
    FOREIGN KEY (form_id, workspace_id)
    REFERENCES public.ssp_forms (id, workspace_id)
);

-- Partial unique: idempotency when key provided
CREATE UNIQUE INDEX IF NOT EXISTS ssp_submissions_idempotency_uid
  ON public.ssp_form_submissions (assignment_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ssp_submissions_workspace_idx
  ON public.ssp_form_submissions (workspace_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS ssp_submissions_form_idx
  ON public.ssp_form_submissions (workspace_id, form_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS ssp_submissions_assignment_idx
  ON public.ssp_form_submissions (assignment_id);

ALTER TABLE public.ssp_form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_form_submissions FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_submissions_select ON public.ssp_form_submissions
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager', 'viewer'])
  );

REVOKE ALL ON TABLE public.ssp_form_submissions FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.ssp_form_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_form_submissions TO service_role;

COMMENT ON TABLE public.ssp_form_submissions IS
  'SSP form submissions. Server timestamps; definition_snapshot freezes questions/consent at submit time.';

GRANT SELECT, INSERT, UPDATE ON TABLE public.ssp_forms TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ssp_form_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_forms TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_form_versions TO service_role;
