import { describe, expect, it } from "vitest";
import { he } from "../src/i18n/he";
import {
  PAYMENT_PROCESSING_ENABLED,
  billingHonestyNote,
  hasForbiddenPaymentClaim,
  isComparisonPlanOnly,
  subscriptionAccessKind,
  subscriptionAccessLabel,
} from "../src/lib/billing-honesty";
import { planQuotaMessage } from "../src/lib/plan-quota";
import { ApiClientError } from "@site-secure/api-client";

describe("billing honesty", () => {
  it("keeps payment processing disabled until Phase 7", () => {
    expect(PAYMENT_PROCESSING_ENABLED).toBe(false);
  });

  it("labels missing or active subscription status as process-active, not billed", () => {
    expect(subscriptionAccessKind(undefined)).toBe("process_active");
    expect(subscriptionAccessKind("active")).toBe("process_active");
    expect(subscriptionAccessKind("manual")).toBe("process_active");
    expect(subscriptionAccessLabel("active")).toBe(he.billingAccessProcessActive);
    expect(hasForbiddenPaymentClaim(subscriptionAccessLabel("active"))).toBe(false);
  });

  it("labels canceled or unpaid access as inactive", () => {
    expect(subscriptionAccessKind("canceled")).toBe("inactive");
    expect(subscriptionAccessKind("past_due")).toBe("inactive");
    expect(subscriptionAccessLabel("unpaid")).toBe(he.billingAccessInactive);
  });

  it("treats a demo picker value as comparison-only when it differs from the workspace plan", () => {
    expect(isComparisonPlanOnly("business", "solo")).toBe(true);
    expect(isComparisonPlanOnly("solo", "solo")).toBe(false);
  });

  it("does not claim Stripe, checkout, or a completed payment", () => {
    const surfaces = [
      he.billingAccessProcessActive,
      he.billingNoProviderNote,
      he.platformPathNoPayment,
      he.platformPathReviewPlanNotApplied,
      he.onboardingReadyBody,
      he.upgradeToIncreaseClients,
      he.upgradeToIncreaseQuotes,
      he.upgradeToIncreaseSeats,
      he.storageQuotaReached,
      he.planLimitHint,
      billingHonestyNote(),
    ];
    for (const text of surfaces) {
      expect(hasForbiddenPaymentClaim(text), text).toBe(false);
    }
  });

  it("quota errors ask for operator help instead of a paid upgrade", () => {
    const clients = planQuotaMessage(
      new ApiClientError(409, "PLAN_LIMIT_REACHED", "x", { resource: "customers" }),
    );
    expect(clients).toContain("לקוחות");
    expect(clients).not.toMatch(/שדרגו/);
    expect(hasForbiddenPaymentClaim(clients ?? "")).toBe(false);
  });
});
