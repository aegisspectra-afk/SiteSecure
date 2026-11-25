-- C3 upgrade intake details: extras count, estimated monthly, contact fields.
-- Local-first; do not apply to cloud without explicit approval.

ALTER TABLE public.billing_upgrade_requests
  ADD COLUMN IF NOT EXISTS requested_extra_seats integer NOT NULL DEFAULT 0
    CONSTRAINT billing_upgrade_requests_extra_seats_nonneg CHECK (requested_extra_seats >= 0);

ALTER TABLE public.billing_upgrade_requests
  ADD COLUMN IF NOT EXISTS estimated_monthly_ils_before_vat numeric(12, 2);

ALTER TABLE public.billing_upgrade_requests
  ADD COLUMN IF NOT EXISTS contact_name text;

ALTER TABLE public.billing_upgrade_requests
  ADD COLUMN IF NOT EXISTS contact_phone text;

ALTER TABLE public.billing_upgrade_requests
  ADD COLUMN IF NOT EXISTS contact_email text;

COMMENT ON COLUMN public.billing_upgrade_requests.requested_extra_seats IS
  'Requested seats beyond plan included max_members.';
COMMENT ON COLUMN public.billing_upgrade_requests.estimated_monthly_ils_before_vat IS
  'Client-calculated monthly total before VAT at submit time.';
