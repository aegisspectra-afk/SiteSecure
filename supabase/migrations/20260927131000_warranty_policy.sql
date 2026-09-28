-- Structured customer warranty policy. PDF remains an output of this record.
-- site_id may be null when the warranty is tied only to the customer.
-- auth_site_visible already returns true for non-assigned members when site_id is null,
-- and false for assignment-scoped technicians, so existing RLS stays in place.

ALTER TYPE public.warranty_status ADD VALUE IF NOT EXISTS 'draft';
