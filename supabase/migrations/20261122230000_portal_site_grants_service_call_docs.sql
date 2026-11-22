-- Portal: site-scoped grants + service_call documents for customer photos.

ALTER TABLE public.customer_portal_access
  DROP CONSTRAINT IF EXISTS customer_portal_access_scope_chk;

ALTER TABLE public.customer_portal_access
  ADD CONSTRAINT customer_portal_access_scope_chk CHECK (
    scope IN ('customer', 'sites') AND site_id IS NULL
  );

CREATE TABLE public.customer_portal_site_grants (
  access_id uuid NOT NULL REFERENCES public.customer_portal_access (id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (access_id, site_id)
);

CREATE INDEX customer_portal_site_grants_site_idx
  ON public.customer_portal_site_grants (site_id);

ALTER TABLE public.customer_portal_site_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_site_grants FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.customer_portal_site_grants FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_portal_site_grants TO service_role;

ALTER TYPE public.document_entity_type ADD VALUE IF NOT EXISTS 'service_call';