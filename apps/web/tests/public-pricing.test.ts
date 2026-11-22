import { describe, expect, it } from "vitest";
import {
  annualMonthlyIls,
  billingPublic,
  catalogPlansOrdered,
  comparisonCell,
  publicPricingPayload,
} from "@site-secure/authz";

describe("public pricing (C1 catalog)", () => {
  it("reads monthly prices from catalog commercial block", () => {
    const plans = catalogPlansOrdered();
    const pro = plans.find((p) => p.key === "pro");
    const business = plans.find((p) => p.key === "business");
    expect(pro?.commercial?.monthly_ils_before_vat).toBe(129);
    expect(business?.commercial?.monthly_ils_before_vat).toBe(349);
    expect(business?.commercial?.extra_seat_ils_before_vat).toBe(49);
  });

  it("annual toggle uses two bonus months", () => {
    const bonus = billingPublic().annual_bonus_months;
    expect(bonus).toBe(2);
    expect(annualMonthlyIls(129, bonus)).toBe(Math.round((129 * 12) / 14));
  });

  it("comparison cells reflect capabilities matrix", () => {
    const free = catalogPlansOrdered().find((p) => p.key === "free")!;
    const pro = catalogPlansOrdered().find((p) => p.key === "pro")!;
    expect(comparisonCell(free, "quotes.alternatives")).toBe("—");
    expect(comparisonCell(pro, "quotes.alternatives")).toBe("כן");
    expect(comparisonCell(free, "quota_display")).toBe("עד 10");
  });

  it("public payload includes four commercial plans", () => {
    const payload = publicPricingPayload();
    expect(payload.plans).toHaveLength(4);
    expect(payload.comparison_rows.length).toBeGreaterThan(5);
    expect(payload.billing.vat_note_he).toMatch(/מע/);
  });
});