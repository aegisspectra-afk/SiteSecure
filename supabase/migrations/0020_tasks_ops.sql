CREATE TYPE public.task_type AS ENUM (
  'follow_up', 'call', 'visit', 'review_request', 'service_followup', 'maintenance', 'other'
);

CREATE TYPE public.task_status AS ENUM ('open', 'done', 'cancelled');

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  type public.task_type NOT NULL DEFAULT 'other',
  status public.task_status NOT NULL DEFAULT 'open',
  title text NOT NULL,
  due_at timestamptz,
  assignee_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers (id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.sites (id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads (id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes (id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs (id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tasks_workspace_due_idx ON public.tasks (workspace_id, due_at);
CREATE INDEX tasks_assignee_idx ON public.tasks (workspace_id, assignee_id, status);

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  key text NOT NULL,
  name_he text NOT NULL,
  UNIQUE (workspace_id, key)
);

CREATE TABLE public.checklist_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.checklist_templates (id) ON DELETE CASCADE,
  label_he text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.job_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  label_he text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.site_readiness (
  site_id uuid PRIMARY KEY REFERENCES public.sites (id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  cctv smallint,
  alarm smallint,
  access_control smallint,
  network smallint,
  power smallint,
  recording smallint,
  connectivity smallint,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.after_action_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  narrative text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER knowledge_articles_set_updated_at
  BEFORE UPDATE ON public.knowledge_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.job_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_checklist_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.site_readiness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_readiness FORCE ROW LEVEL SECURITY;
ALTER TABLE public.after_action_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.after_action_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_articles FORCE ROW LEVEL SECURITY;

CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated
  USING (
    public.auth_is_managerial(workspace_id)
    OR assignee_id = auth.uid()
    OR created_by = auth.uid()
  );

CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_member(workspace_id));

CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated
  USING (public.auth_is_managerial(workspace_id) OR assignee_id = auth.uid())
  WITH CHECK (public.auth_is_managerial(workspace_id) OR assignee_id = auth.uid());

CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated
  USING (public.auth_is_managerial(workspace_id));

CREATE POLICY checklist_templates_select ON public.checklist_templates FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY checklist_templates_write ON public.checklist_templates FOR ALL TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));

CREATE POLICY checklist_template_items_select ON public.checklist_template_items FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY checklist_template_items_write ON public.checklist_template_items FOR ALL TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));

CREATE POLICY job_checklist_select ON public.job_checklist_items FOR SELECT TO authenticated
  USING (public.auth_job_visible(workspace_id, job_id));

CREATE POLICY job_checklist_write ON public.job_checklist_items FOR ALL TO authenticated
  USING (public.auth_job_visible(workspace_id, job_id))
  WITH CHECK (public.auth_job_visible(workspace_id, job_id));

CREATE POLICY site_readiness_select ON public.site_readiness FOR SELECT TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY site_readiness_write ON public.site_readiness FOR ALL TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id))
  WITH CHECK (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY aar_select ON public.after_action_reports FOR SELECT TO authenticated
  USING (public.auth_job_visible(workspace_id, job_id));

CREATE POLICY aar_insert ON public.after_action_reports FOR INSERT TO authenticated
  WITH CHECK (public.auth_job_visible(workspace_id, job_id));

CREATE POLICY knowledge_select ON public.knowledge_articles FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY knowledge_write ON public.knowledge_articles FOR ALL TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));
