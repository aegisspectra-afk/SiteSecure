-- C1 commercial seats: purchased extras + Pro launch locked list price (ILS before VAT).
-- Local-first; do not apply to cloud without explicit approval.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS extra_seats integer NOT NULL DEFAULT 0
    CONSTRAINT subscriptions_extra_seats_nonneg CHECK (extra_seats >= 0);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS locked_price_ils_before_vat numeric(12, 2)
    CONSTRAINT subscriptions_locked_price_nonneg
      CHECK (locked_price_ils_before_vat IS NULL OR locked_price_ils_before_vat >= 0);

COMMENT ON COLUMN public.subscriptions.extra_seats IS
  'Purchased seats beyond plan max_members (Pro/Business). Ignored for Free.';

COMMENT ON COLUMN public.subscriptions.locked_price_ils_before_vat IS
  'Workspace-locked list price (e.g. Pro launch ₪99). NULL = use catalog list/launch.';
