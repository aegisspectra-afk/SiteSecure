-- Company Document System foundation:
-- branding stays in workspace_settings.branding (canonical company profile JSON)
-- generated_documents: immutable metadata for finalized customer PDFs
-- accounting_documents: issuance records (provider-backed; not a PDF-only fake invoice)
-- document_entity_type: allow workspace-scoped logo assets

ALTER TYPE public.document_entity_type ADD VALUE IF NOT EXISTS 'workspace';

CREATE TABLE IF NOT EXISTS public.generated_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  document_type text NOT NULL,
  template_version text NOT NULL DEFAULT 'quote-v2',
  source_entity_type text,
  source_entity_id uuid,
  revision int NOT NULL DEFAULT 1,
  storage_bucket text,
  storage_key text,
  company_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_snapshot jsonb,
  totals_snapshot jsonb,
  status text NOT NULL DEFAULT 'generated'
    CHECK (status IN ('draft_preview', 'generated', 'sent', 'superseded', 'void')),
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generated_documents_workspace_idx
  ON public.generated_documents (workspace_id, document_type, generated_at DESC);
CREATE INDEX IF NOT EXISTS generated_documents_source_idx
  ON public.generated_documents (workspace_id, source_entity_type, source_entity_id);

ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS generated_documents_select ON public.generated_documents;
CREATE POLICY generated_documents_select ON public.generated_documents
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

DROP POLICY IF EXISTS generated_documents_insert ON public.generated_documents;
CREATE POLICY generated_documents_insert ON public.generated_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','sales']
    )
  );

-- Accounting issuance boundary (provider-owned legality; SITE SECURE stores linkage)
CREATE TABLE IF NOT EXISTS public.accounting_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  document_type text NOT NULL
    CHECK (document_type IN (
      'tax_invoice', 'receipt', 'tax_invoice_receipt', 'credit', 'proforma'
    )),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'preview', 'pending_provider', 'issued', 'void', 'error'
    )),
  provider_key text,
  external_document_id text,
  document_number text,
  issued_at timestamptz,
  allocation_number text,
  allocation_status text
    CHECK (allocation_status IS NULL OR allocation_status IN (
      'not_required', 'pending', 'allocated', 'failed', 'unavailable'
    )),
  allocation_requested_at timestamptz,
  allocation_provider text,
  allocation_error text,
  company_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_id uuid REFERENCES public.customers (id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.sites (id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes (id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  generated_document_id uuid REFERENCES public.generated_documents (id) ON DELETE SET NULL,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounting_documents_workspace_idx
  ON public.accounting_documents (workspace_id, document_type, created_at DESC);
CREATE INDEX IF NOT EXISTS accounting_documents_quote_idx
  ON public.accounting_documents (workspace_id, quote_id)
  WHERE quote_id IS NOT NULL;

ALTER TABLE public.accounting_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_documents_select ON public.accounting_documents;
CREATE POLICY accounting_documents_select ON public.accounting_documents
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

DROP POLICY IF EXISTS accounting_documents_write ON public.accounting_documents;
CREATE POLICY accounting_documents_write ON public.accounting_documents
  FOR ALL TO authenticated
  USING (
    public.auth_is_privileged(workspace_id)
  )
  WITH CHECK (
    public.auth_is_privileged(workspace_id)
  );

COMMENT ON TABLE public.accounting_documents IS
  'Foundation for provider-backed statutory documents. PDF renderer alone must not mark rows as issued.';

COMMENT ON COLUMN public.workspace_settings.branding IS
  'Canonical Company Profile JSON: displayName/legalName/businessNumber/taxStatus/address/contact/logo/brand/payment.';
