-- Rollback for 20261117130000_ss_job_checklist_cctv_template (local only).
-- Drops the guard and the new columns (notes, N/A marks and photo links on items are lost).
BEGIN;
DROP TRIGGER IF EXISTS job_checklist_items_guard ON public.job_checklist_items;
DROP FUNCTION IF EXISTS public.job_checklist_items_guard();
DROP INDEX IF EXISTS public.job_checklist_items_job_idx;
ALTER TABLE public.job_checklist_items DROP CONSTRAINT IF EXISTS job_checklist_items_na_rules;
ALTER TABLE public.job_checklist_items DROP CONSTRAINT IF EXISTS job_checklist_items_notes_len;
ALTER TABLE public.job_checklist_items
  DROP COLUMN IF EXISTS item_key,
  DROP COLUMN IF EXISTS template_key,
  DROP COLUMN IF EXISTS help_he,
  DROP COLUMN IF EXISTS photo_required,
  DROP COLUMN IF EXISTS allow_na,
  DROP COLUMN IF EXISTS not_applicable,
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS photo_document_id;
COMMIT;
