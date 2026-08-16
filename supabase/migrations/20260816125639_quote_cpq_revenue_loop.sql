-- CPQ commercial fields, catalog snapshots, and hashed public quote access.
-- Live quote row stays the current version; history lives in quote_versions.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_kind_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_kind_check
  CHECK (kind IN ('product', 'service', 'bundle'));

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS project_name text,
  ADD COLUMN IF NOT EXISTS project_address text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS key_points text,
  ADD COLUMN IF NOT EXISTS warranty text,
  ADD COLUMN IF NOT EXISTS general_terms text,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.quote_templates (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_name text,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS catalog_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.quote_public_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE,
  version integer NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS quote_public_access_quote_idx
  ON public.quote_public_access (workspace_id, quote_id, version);

ALTER TABLE public.quote_public_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_public_access FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.quote_public_access FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quote_public_access TO service_role;

COMMENT ON TABLE public.quote_public_access IS
  'Hashed customer-access tokens. Service role only; plaintext never stored.';
