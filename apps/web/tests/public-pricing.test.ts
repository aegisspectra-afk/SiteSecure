import { describe, expect, it } from "vitest";
import {
  billingPublic,
  catalogPlansOrdered,
  comparisonCell,
  extraSeatUnitPrice,
  extraSeatsTotalIls,
  monthlyTotalIls,
  planDisplayBaseIls,
  planRegularBaseIls,
  publicPricingPayload,
} from "@site-secure/authz";

const EXTRA_CASES = [1, 2, 3, 4, 5, 9, 10, 20] as const;
const EXPECTED_UNIT: Record<number, number> = {
  1: 49,
  2: 49,
  3: 39,
  4: 39,
  5: 29,
  9: 29,
  10: 24,
  20: 24,
};

describe("public pricing (C1 catalog)", () => {
  it("reads Pro launch/regular and Business base from catalog", () => {
    const plans = catalogPlansOrdered();
    const free = plans.find((p) => p.key === "free")!;
    const pro = plans.find((p) => p.key === "pro")!;
    const business = plans.find((p) => p.key === "business")!;
    expect(planRegularBaseIls(pro)).toBe(129);
    expect(planDisplayBaseIls(pro)).toBe(99);
    expect(planRegularBaseIls(business)).toBe(349);
    expect(planDisplayBaseIls(business)).toBe(349);
    expect(free.commercial?.allows_extra_seats).toBe(false);
    expect(pro.commercial?.allows_extra_seats).toBe(true);
    expect(business.commercial?.extra_seat_ils_before_vat).toBeUndefined();
  });

  it("has no annual bonus months", () => {
    expect(billingPublic().annual_bonus_months ?? 0).toBe(0);
    expect(billingPublic().extra_seat_tiers).toHaveLength(4);
  });

  it("tiers unit + total for planned extra counts", () => {
    for (const n of EXTRA_CASES) {
      expect(extraSeatUnitPrice(n)).toBe(EXPECTED_UNIT[n]);
      expect(extraSeatsTotalIls(n)).toBe(n * EXPECTED_UNIT[n]);
    }
  });

  it("monthly totals for Pro and Business across extra counts", () => {
    const plans = catalogPlansOrdered();
    const pro = plans.find((p) => p.key === "pro")!;
    const business = plans.find((p) => p.key === "business")!;
    for (const n of EXTRA_CASES) {
      expect(monthlyTotalIls({ plan: pro, extraSeats: n })).toBe(99 + n * EXPECTED_UNIT[n]);
      expect(monthlyTotalIls({ plan: business, extraSeats: n })).toBe(349 + n * EXPECTED_UNIT[n]);
      expect(monthlyTotalIls({ plan: pro, extraSeats: n, preferLaunch: false })).toBe(
        129 + n * EXPECTED_UNIT[n],
      );
    }
    expect(monthlyTotalIls({ plan: pro, lockedPriceIlsBeforeVat: 99, extraSeats: 2 })).toBe(99 + 98);
  });

  it("comparison cells reflect capabilities matrix", () => {
    const free = catalogPlansOrdered().find((p) => p.key === "free")!;
    const pro = catalogPlansOrdered().find((p) => p.key === "pro")!;
    expect(comparisonCell(free, "quotes.alternatives")).toBe("—");
    expect(comparisonCell(pro, "quotes.alternatives")).toBe("כן");
    expect(comparisonCell(free, "quota_display")).toBe("עד 10");
    expect(comparisonCell(pro, "max_members")).toMatch(/מדרגות/);
  });

  it("public payload includes four commercial plans without annual", () => {
    const payload = publicPricingPayload();
    expect(payload.plans).toHaveLength(4);
    expect(payload.comparison_rows.length).toBeGreaterThan(5);
    expect(payload.billing.vat_note_he).toMatch(/מע/);
    expect(payload.plans.find((p) => p.key === "pro")?.display_monthly_ils_before_vat).toBe(99);
  });
});
