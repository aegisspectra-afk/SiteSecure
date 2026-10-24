import { he } from "../i18n/he";

/**
 * Payment providers are Phase 7 and not present in application source.
 * Until this flag is true, subscription.status=active means process-granted access.
 */
export const PAYMENT_PROCESSING_ENABLED = false;

const INACTIVE_STATUSES = new Set([
  "canceled",
  "cancelled",
  "past_due",
  "unpaid",
  "inactive",
  "expired",
]);

export type SubscriptionAccessKind = "process_active" | "inactive";

export function subscriptionAccessKind(status?: string | null): SubscriptionAccessKind {
  const normalized = (status || "active").trim().toLowerCase();
  return INACTIVE_STATUSES.has(normalized) ? "inactive" : "process_active";
}

export function subscriptionAccessLabel(status?: string | null): string {
  if (subscriptionAccessKind(status) === "inactive") return he.billingAccessInactive;
  return he.billingAccessProcessActive;
}

export function billingHonestyNote(): string {
  return he.billingNoProviderNote;
}

/** sessionStorage comparison pick — never the billed/effective plan. */
export function isComparisonPlanOnly(preferred: string, actualPlanKey: string): boolean {
  return preferred.trim().toLowerCase() !== actualPlanKey.trim().toLowerCase();
}

const FORBIDDEN_PAYMENT_CLAIMS = [
  /stripe/i,
  /checkout/i,
  /pay now/i,
  /שלמו עכשיו/,
  /תשלום בוצע/,
  /שולם דרך/,
];

export function hasForbiddenPaymentClaim(text: string): boolean {
  return FORBIDDEN_PAYMENT_CLAIMS.some((pattern) => pattern.test(text));
}
