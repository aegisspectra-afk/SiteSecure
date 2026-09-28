import { describe, expect, it } from "vitest";
import { recalculateQuotePricing } from "../src/lib/quote-pricing";
import { quoteScopeBreakdown } from "../src/lib/quote-cpq";

describe("Q4 commercial pricing mirror", () => {
  it("excludes optional lines from base total and VAT", () => {
    const result = recalculateQuotePricing(
      [
        { qty: 1, unit_price: 1000, discount: 0, cost: 400, item_type: "catalog", is_optional: false },
        { qty: 1, unit_price: 250, discount: 0, cost: 80, item_type: "catalog", is_optional: true },
      ],
      { vat_percent: 18, discount_type: null, discount_value: 0 },
    );
    expect(result.subtotal_net).toBe(1000);
    expect(result.total_gross).toBe(1180);
    expect(result.optional_subtotal).toBe(250);
    expect(result.optional_total_gross).toBe(295);
    expect(result.total_with_options_gross).toBe(1475);
    expect(result.cost_total).toBe(400);
  });

  it("applies line → section → quote discount only on required lines", () => {
    const result = recalculateQuotePricing(
      [
        {
          qty: 1,
          unit_price: 200,
          discount: 10,
          discount_type: "percent",
          cost: 50,
          item_type: "catalog",
          section_id: "s1",
          is_optional: false,
        },
        {
          qty: 1,
          unit_price: 100,
          discount: 0,
          cost: 20,
          item_type: "catalog",
          section_id: "s1",
          is_optional: true,
        },
      ],
      {
        vat_percent: 0,
        discount_type: "amount",
        discount_value: 10,
        sections: [{ id: "s1", discount_type: "percent", discount_value: 10 }],
      },
    );
    expect(result.lines_subtotal).toBe(162);
    expect(result.section_discount_amount).toBe(18);
    expect(result.quote_discount_amount).toBe(10);
    expect(result.subtotal_net).toBe(152);
    expect(result.optional_subtotal).toBe(100);
  });

  it("scope breakdown ignores optional lines", () => {
    const scope = quoteScopeBreakdown([
      {
        id: "a",
        quote_id: "q",
        description: "cam",
        qty: 1,
        unit_price: 100,
        line_net: 100,
        item_type: "catalog",
        is_optional: false,
      },
      {
        id: "b",
        quote_id: "q",
        description: "opt",
        qty: 1,
        unit_price: 50,
        line_net: 50,
        item_type: "catalog",
        is_optional: true,
      },
    ]);
    expect(scope.equipment).toBe(100);
  });
});
