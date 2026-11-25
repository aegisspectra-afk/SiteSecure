ALTER TABLE public.billing_upgrade_requests DROP COLUMN IF EXISTS contact_email;
ALTER TABLE public.billing_upgrade_requests DROP COLUMN IF EXISTS contact_phone;
ALTER TABLE public.billing_upgrade_requests DROP COLUMN IF EXISTS contact_name;
ALTER TABLE public.billing_upgrade_requests DROP COLUMN IF EXISTS estimated_monthly_ils_before_vat;
ALTER TABLE public.billing_upgrade_requests DROP COLUMN IF EXISTS requested_extra_seats;
