import { describe, expect, it } from "vitest";
import { buildQuoteReadiness } from "../src/lib/quote-readiness";
import { liveQuoteToPublicDocument } from "../src/lib/quote-live-document";
import type { QuoteOut } from "@site-secure/api-client";

describe("quote readiness", () => {
  it("scores completeness without childish progress copy", () => {
    const readiness = buildQuoteReadiness(
      [
        { field: "customer_id", code: "customer", message: "בחרו לקוח." },
        { field: "valid_until", code: "valid_until", message: "חסר תוקף." },
      ],
      {
        pricedCount: 0,
        hasSite: false,
        labels: {
          customer: "לקוח",
          site: "אתר",
          items: "פריטים",
          payment: "תנאי תשלום",
          valid: "תוקף",
        },
      },
    );
    expect(readiness.percent).toBeGreaterThanOrEqual(0);
    expect(readiness.checks.find((c) => c.id === "customer")?.ok).toBe(false);
    expect(readiness.checks.find((c) => c.id === "site")?.warning).toBe(true);
    expect(readiness.canSend).toBe(false);
  });
});

describe("live quote document", () => {
  it("never exposes cost or margin fields", () => {
    const quote = {
      id: "q1",
      workspace_id: "ws",
      number: "Q-1",
      status: "draft",
      customer_id: "c1",
      site_id: null,
      owner_user_id: "u1",
      cost_total: 999,
      margin_percent: 50,
      internal_notes: "secret",
      subtotal_net: 100,
      vat_amount: 18,
      total_gross: 118,
      items: [{ id: "i1", quote_id: "q1", description: "מצלמה", qty: 1, unit_price: 100, cost: 40, line_net: 100 }],
    } as QuoteOut;
    const doc = liveQuoteToPublicDocument(quote, { customerName: "שנידי" });
    expect(doc.customer?.display_name).toBe("שנידי");
    expect(JSON.stringify(doc)).not.toContain("999");
    expect(JSON.stringify(doc)).not.toContain("secret");
    expect((doc.items[0] as { cost?: number }).cost).toBeUndefined();
  });
});
