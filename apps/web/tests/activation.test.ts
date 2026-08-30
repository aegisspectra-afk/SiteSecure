import { describe, expect, it } from "vitest";
import {
  deriveActivation,
  quoteCountFromSummary,
  resolveCustomerCount,
  shouldShowActivationCard,
} from "../src/lib/activation";

describe("activation derivation", () => {
  it("derives incomplete activation from zero counts when ready", () => {
    const state = deriveActivation({ customerCount: 0, quoteCount: 0, countsReady: true });
    expect(state.complete).toBe(false);
    expect(state.hasCustomer).toBe(false);
    expect(shouldShowActivationCard({ activation: state, canCreateQuote: true, canCreateCustomer: true })).toBe(
      true,
    );
  });

  it("completes when a quote exists even without customers", () => {
    const state = deriveActivation({ customerCount: 0, quoteCount: 1, countsReady: true });
    expect(state.complete).toBe(true);
    expect(shouldShowActivationCard({ activation: state, canCreateQuote: true, canCreateCustomer: true })).toBe(
      false,
    );
  });

  it("does not show activation while counts are loading", () => {
    const state = deriveActivation({ customerCount: null, quoteCount: 0, countsReady: false });
    expect(shouldShowActivationCard({ activation: state, canCreateQuote: true, canCreateCustomer: true })).toBe(
      false,
    );
  });

  it("hides quote CTA path when user cannot create quotes or customers", () => {
    const state = deriveActivation({ customerCount: 0, quoteCount: 0, countsReady: true });
    expect(shouldShowActivationCard({ activation: state, canCreateQuote: false, canCreateCustomer: false })).toBe(
      false,
    );
  });

  it("reads quote totals from dashboard summary", () => {
    expect(
      quoteCountFromSummary({
        quotes_draft: 1,
        quotes_sent: 2,
        quotes_viewed: 0,
        quotes_approved: 1,
        quotes_rejected: 0,
        quotes_open: 2,
        quotes_approved_value: 0,
        jobs_open: 0,
        jobs_overdue: 0,
        jobs_unassigned: 0,
      }),
    ).toBe(4);
  });

  it("prefers usage meter for customer count", () => {
    expect(
      resolveCustomerCount({
        usage: {
          workspace_id: "w",
          plan_key: "solo",
          active_members: 1,
          pending_invites: 0,
          meters: [
            {
              key: "quota_clients",
              label_he: "לקוחות",
              current: 3,
              limit: 30,
              unlimited: false,
              unit: "customers",
              at_limit: false,
            },
          ],
        },
        probedCount: 1,
      }),
    ).toBe(3);
    expect(resolveCustomerCount({ usage: null, probedCount: 2 })).toBe(2);
  });
});
