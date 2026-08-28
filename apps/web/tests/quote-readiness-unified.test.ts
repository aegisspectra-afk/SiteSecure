import { describe, expect, it } from "vitest";
import { buildQuoteReadiness, buildUnifiedReadinessItems } from "../src/lib/quote-readiness";

describe("buildUnifiedReadinessItems", () => {
  const labels = {
    customer: "לקוח",
    site: "אתר",
    items: "פריטים",
    payment: "תנאי תשלום",
    valid: "תוקף",
  };

  it("maps core checks to focusable fields", () => {
    const readiness = buildQuoteReadiness(
      [
        { field: "customer_id", code: "customer", message: "בחרו לקוח." },
        { field: "items", code: "items", message: "הוסיפו פריטים." },
      ],
      { pricedCount: 0, hasSite: false, labels },
    );
    const items = buildUnifiedReadinessItems(readiness, readiness.critical, 0);
    expect(items.find((item) => item.id === "customer")).toMatchObject({
      field: "customer_id",
      status: "critical",
    });
    expect(items.find((item) => item.id === "site")).toMatchObject({
      field: "site_id",
      status: "warning",
    });
    expect(items.find((item) => item.id === "items")).toMatchObject({
      field: "items",
      status: "critical",
    });
  });
});
