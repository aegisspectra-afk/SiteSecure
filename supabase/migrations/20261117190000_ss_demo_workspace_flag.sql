-- DEMO-6: workspace-scoped demo environment flag (local apply only).
-- Rollback: supabase/rollbacks/rollback_20261117190000_ss_demo_workspace_flag.sql

BEGIN;

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.workspaces.is_demo IS
  'DEMO-6: when true, UI shows a demo banner and hides SSP/Workforce/knowledge/portal surfaces for this workspace.';

COMMIT;
