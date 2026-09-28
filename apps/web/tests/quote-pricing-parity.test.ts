import { describe, expect, it } from "vitest";
import {
  applyDiscount,
  lineNet,
  marginStatus,
  recalculateQuotePricing,
} from "../src/lib/quote-pricing";

/**
 * Golden vectors mirrored from apps/api/tests/test_pricing.py.
 * FE preview must match API recalculate() for identical inputs.
 */
describe("quote-pricing FE/API golden parity", () => {
  it("matches line_net amount and percent discounts", () => {
    expect(lineNet({ qty: 2, unit_price: 100, discount: 10, item_type: "catalog" })).toBe(190);
    expect(lineNet({ qty: 1, unit_price: 50, discount: 0, item_type: "note" })).toBe(0);
    expect(lineNet({ qty: 2, unit_price: 700, discount: 0, item_type: "catalog" })).toBe(1400);
    expect(
      lineNet({
        qty: 2,
        unit_price: 100,
        discount: 10,
        item_type: "catalog",
        discount_type: "percent",
      }),
    ).toBe(180);
  });

  it("matches header discount + VAT + margin", () => {
    const result = recalculateQuotePricing(
      [
        { qty: 2, unit_price: 100, discount: 0, cost: 40, item_type: "catalog" },
        { qty: 1, unit_price: 50, discount: 0, cost: 0, item_type: "note" },
      ],
      { vat_percent: 18, discount_type: "percent", discount_value: 10 },
    );
    expect(result.subtotal_net).toBe(180);
    expect(result.vat_amount).toBe(32.4);
    expect(result.total_gross).toBe(212.4);
    expect(result.cost_total).toBe(80);
    expect(result.items[0].line_net).toBe(200);
    expect(result.items[1].line_net).toBe(0);
    expect(result.margin_amount).toBe(100);
    expect(result.margin_percent).toBe(55.56);
  });

  it("matches camera profitability example", () => {
    const result = recalculateQuotePricing(
      [{ qty: 2, unit_price: 700, discount: 0, cost: 400, item_type: "catalog" }],
      { vat_percent: 18, discount_type: null, discount_value: 0 },
    );
    expect(result.subtotal_net).toBe(1400);
    expect(result.cost_total).toBe(800);
    expect(result.margin_amount).toBe(600);
    expect(result.margin_percent).toBe(42.86);
    expect(result.items[0].gross_profit).toBe(600);
  });

  it("applies section discount then quote discount", () => {
    const result = recalculateQuotePricing(
      [
        {
          qty: 1,
          unit_price: 100,
          discount: 0,
          cost: 40,
          item_type: "catalog",
          section_id: "s1",
        },
        {
          qty: 1,
          unit_price: 100,
          discount: 0,
          cost: 40,
          item_type: "catalog",
          section_id: "s1",
        },
      ],
      {
        vat_percent: 0,
        discount_type: "amount",
        discount_value: 10,
        sections: [{ id: "s1", discount_type: "percent", discount_value: 10 }],
      },
    );
    expect(result.lines_subtotal).toBe(180);
    expect(result.section_discount_amount).toBe(20);
    expect(result.quote_discount_amount).toBe(10);
    expect(result.subtotal_net).toBe(170);
  });

  it("ignores client-supplied totals (discount_value ignored when type null)", () => {
    const result = recalculateQuotePricing(
      [{ qty: 1, unit_price: 10, discount: 0, cost: 4, item_type: "free" }],
      { vat_percent: 0, discount_type: null, discount_value: 999 },
    );
    expect(result.total_gross).toBe(10);
    expect(result.cost_total).toBe(4);
    expect(result.margin_amount).toBe(6);
  });

  it("clamps invalid inputs without NaN/negative totals", () => {
    const result = recalculateQuotePricing(
      [
        { qty: -2, unit_price: "nan", discount: -5, cost: "inf", item_type: "catalog" },
        { qty: 1, unit_price: 100, discount: 0, cost: 10, item_type: "catalog" },
      ],
      { vat_percent: 18, discount_type: "percent", discount_value: 150 },
    );
    expect(result.subtotal_net).toBe(0);
    expect(result.vat_amount).toBe(0);
    expect(result.total_gross).toBe(0);
    expect(result.items[0].line_net).toBe(0);
    expect(result.items[1].line_net).toBe(100);
  });

  it("amount discount cannot go negative", () => {
    const result = recalculateQuotePricing(
      [{ qty: 1, unit_price: 50, discount: 0, cost: 10, item_type: "free" }],
      { vat_percent: 0, discount_type: "amount", discount_value: 80 },
    );
    expect(result.subtotal_net).toBe(0);
    expect(result.total_gross).toBe(0);
    expect(result.cost_total).toBe(10);
  });

  it("matches apply_discount and margin_status", () => {
    const [after, amount] = applyDiscount(100, "percent", 25);
    expect(after).toBe(75);
    expect(amount).toBe(25);
    expect(marginStatus(35, { target: 30, minimum: 15 })).toBe("healthy");
    expect(marginStatus(20, { target: 30, minimum: 15 })).toBe("warning");
    expect(marginStatus(10, { target: 30, minimum: 15 })).toBe("critical");
  });

  it("handles decimal prices, large qty, and rounding boundaries (currency-agnostic)", () => {
    const ils = recalculateQuotePricing(
      [{ qty: 3, unit_price: 33.33, discount: 5, cost: 10.11, item_type: "catalog", discount_type: "percent" }],
      { vat_percent: 18, discount_type: "amount", discount_value: 1.5 },
    );
    const usd = recalculateQuotePricing(
      [{ qty: 3, unit_price: 33.33, discount: 5, cost: 10.11, item_type: "catalog", discount_type: "percent" }],
      { vat_percent: 18, discount_type: "amount", discount_value: 1.5 },
    );
    // Engine is currency-agnostic — identical numeric result for ILS/USD inputs.
    expect(ils.total_gross).toBe(usd.total_gross);
    expect(ils.items[0].line_net).toBe(94.99); // 99.99 - 5%
    expect(ils.subtotal_net).toBe(93.49); // 94.99 - 1.5
    expect(ils.vat_amount).toBe(16.83);
    expect(ils.total_gross).toBe(110.32);

    const large = recalculateQuotePricing(
      [{ qty: 10000, unit_price: 0.01, discount: 0, cost: 0, item_type: "catalog" }],
      { vat_percent: 0, discount_type: null, discount_value: 0 },
    );
    expect(large.subtotal_net).toBe(100);
    expect(large.total_gross).toBe(100);
  });

  it("stacks line + section + quote percent discounts", () => {
    const result = recalculateQuotePricing(
      [
        {
          qty: 2,
          unit_price: 100,
          discount: 10,
          discount_type: "percent",
          cost: 20,
          item_type: "catalog",
          section_id: "sec",
        },
      ],
      {
        vat_percent: 17,
        discount_type: "percent",
        discount_value: 5,
        sections: [{ id: "sec", discount_type: "percent", discount_value: 10 }],
      },
    );
    // line: 200 - 10% = 180; section 10% → 162; quote 5% → 153.9; VAT 17% → 26.16; gross 180.06
    expect(result.items[0].line_net).toBe(180);
    expect(result.lines_subtotal).toBe(162);
    expect(result.subtotal_net).toBe(153.9);
    expect(result.vat_amount).toBe(26.16);
    expect(result.total_gross).toBe(180.06);
  });
});
