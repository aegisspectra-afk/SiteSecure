-- Allow archived PDF templates; expose updated_at via API (column already exists).

ALTER TABLE public.pdf_document_templates
  DROP CONSTRAINT IF EXISTS pdf_document_templates_status_check;

ALTER TABLE public.pdf_document_templates
  ADD CONSTRAINT pdf_document_templates_status_check
  CHECK (status IN ('active', 'draft', 'archived'));

-- Archived templates cannot remain the default quote template.
UPDATE public.pdf_document_templates
SET is_default = false
WHERE status = 'archived' AND is_default = true;
