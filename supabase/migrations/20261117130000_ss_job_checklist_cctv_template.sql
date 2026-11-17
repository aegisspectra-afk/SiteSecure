-- DEMO-4.3: CCTV installation checklist on the existing job_checklist_items.
--
-- New per-item fields: item_key / template_key (which template row it came from), help_he,
-- photo_required, allow_na, not_applicable, notes, photo_document_id.
-- The template itself lives in the API (CCTV_INSTALLATION_TEMPLATE) and is copied into the
-- job's rows when the job is created, like the existing generic list.
--
-- Guard trigger (job_checklist_write lets an assigned technician update their own rows):
--   * who marked and when are set here from the signed-in user, never from the request;
--   * "לא רלוונטי" only where allow_na; never completed and not applicable together;
--   * completing a photo_required item needs photo_document_id, and any photo must be a
--     document of this same job;
--   * structure (label, help, required, photo_required, allow_na, keys, order, job) is
--     server-only.
-- The trusted backend (service role / direct DB) is not restricted.
--
-- Rollback: supabase/rollbacks/rollback_20261117130000_ss_job_checklist_cctv_template.sql

BEGIN;

ALTER TABLE public.job_checklist_items
  ADD COLUMN IF NOT EXISTS item_key text,
  ADD COLUMN IF NOT EXISTS template_key text,
  ADD COLUMN IF NOT EXISTS help_he text,
  ADD COLUMN IF NOT EXISTS photo_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_na boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS not_applicable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS photo_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;

ALTER TABLE public.job_checklist_items DROP CONSTRAINT IF EXISTS job_checklist_items_na_rules;
ALTER TABLE public.job_checklist_items ADD CONSTRAINT job_checklist_items_na_rules
  CHECK ((NOT not_applicable OR allow_na) AND NOT (completed AND not_applicable));

ALTER TABLE public.job_checklist_items DROP CONSTRAINT IF EXISTS job_checklist_items_notes_len;
ALTER TABLE public.job_checklist_items ADD CONSTRAINT job_checklist_items_notes_len
  CHECK (notes IS NULL OR char_length(notes) <= 1000);

CREATE INDEX IF NOT EXISTS job_checklist_items_job_idx ON public.job_checklist_items (job_id, sort_order);

CREATE OR REPLACE FUNCTION public.job_checklist_items_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_trusted boolean := public.ss_is_trusted_backend();
BEGIN
  IF NOT v_trusted AND (
       NEW.job_id IS DISTINCT FROM OLD.job_id
    OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
    OR NEW.label_he IS DISTINCT FROM OLD.label_he
    OR NEW.help_he IS DISTINCT FROM OLD.help_he
    OR NEW.required IS DISTINCT FROM OLD.required
    OR NEW.photo_required IS DISTINCT FROM OLD.photo_required
    OR NEW.allow_na IS DISTINCT FROM OLD.allow_na
    OR NEW.item_key IS DISTINCT FROM OLD.item_key
    OR NEW.template_key IS DISTINCT FROM OLD.template_key
    OR NEW.sort_order IS DISTINCT FROM OLD.sort_order) THEN
    RAISE EXCEPTION 'CHECKLIST_STRUCTURE_SERVER_ONLY' USING ERRCODE = '42501';
  END IF;

  IF NEW.not_applicable AND NOT NEW.allow_na THEN
    RAISE EXCEPTION 'CHECKLIST_NA_NOT_ALLOWED' USING ERRCODE = '23514';
  END IF;
  IF NEW.completed AND NEW.not_applicable THEN
    RAISE EXCEPTION 'CHECKLIST_DONE_AND_NA' USING ERRCODE = '23514';
  END IF;

  IF NEW.photo_document_id IS NOT NULL
     AND NEW.photo_document_id IS DISTINCT FROM OLD.photo_document_id
     AND NOT EXISTS (
       SELECT 1 FROM public.documents d
       WHERE d.id = NEW.photo_document_id
         AND d.workspace_id = NEW.workspace_id
         AND d.entity_type = 'job'
         AND d.entity_id = NEW.job_id
     ) THEN
    RAISE EXCEPTION 'CHECKLIST_PHOTO_NOT_OF_JOB' USING ERRCODE = '23514';
  END IF;
  IF NEW.completed AND NEW.photo_required AND NEW.photo_document_id IS NULL THEN
    RAISE EXCEPTION 'CHECKLIST_PHOTO_REQUIRED' USING ERRCODE = '23514';
  END IF;

  -- Who marked and when: from the signed-in user, never from the request.
  IF (NEW.completed IS DISTINCT FROM OLD.completed OR NEW.not_applicable IS DISTINCT FROM OLD.not_applicable)
     AND NOT v_trusted THEN
    IF NEW.completed OR NEW.not_applicable THEN
      NEW.completed_by := auth.uid();
      NEW.completed_at := now();
    ELSE
      NEW.completed_by := NULL;
      NEW.completed_at := NULL;
    END IF;
  ELSIF NOT v_trusted THEN
    NEW.completed_by := OLD.completed_by;
    NEW.completed_at := OLD.completed_at;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS job_checklist_items_guard ON public.job_checklist_items;
CREATE TRIGGER job_checklist_items_guard
  BEFORE UPDATE ON public.job_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.job_checklist_items_guard();

REVOKE EXECUTE ON FUNCTION public.job_checklist_items_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_checklist_items_guard() TO service_role;

COMMIT;
