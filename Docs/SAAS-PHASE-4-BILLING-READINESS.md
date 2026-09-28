# SaaS Phase 4 — Billing Readiness

## SELF_SERVICE_BILLING_PROVIDER

**NEEDS PRODUCT DECISION**

Repository application code has **no** live Stripe (or other) checkout/webhook integration suitable for production plan changes. Documentation mentions of Edge checkout are historical/partial and must not be treated as authoritative.

## Safe now (already / Phase 1)

- Provider-neutral `subscriptions` row per workspace  
- `source` ∈ `system | billing | admin_override`  
- `override_expires_at` / `override_reason` columns  
- Opaque `provider_ref` already on subscriptions

## Do not implement until provider selected

- Checkout session creation  
- Customer portal  
- Webhook verification + `billing_events` idempotency  
- Fake successful upgrade

## When a provider is chosen

Adapter boundary only:

- `create_checkout_session`  
- `create_management_session`  
- `verify_webhook`  
- `cancel_subscription`

Domain activation remains: verified provider event → update `subscriptions` → entitlements RPC reflects plan.
