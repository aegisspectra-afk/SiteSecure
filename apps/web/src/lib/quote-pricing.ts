/**
 * Frontend mirror of apps/api/app/pricing.py for display parity.
 * Server recalculate() remains the canonical money authority after persist.
 */

export type PricingDiscountType = "percent" | "amount" | string | null | undefined;

export type PricingItemInput = {
  qty?: number | string | null;
  unit_price?: number | string | null;
  discount?: number | string | null;
  discount_type?: PricingDiscountType;
  cost?: number | string | null;
  item_type?: string | null;
  section_id?: string | null;
  is_optional?: boolean | null;
  id?: string;
};

export type PricingSectionInput = {
  id: string;
  discount_type?: PricingDiscountType;
  discount_value?: number | string | null;
};

export type PricingResult = {
  items: Array<
    PricingItemInput & {
      line_net: number;
      line_cost: number;
      gross_profit: number;
      margin_percent: number;
      is_optional?: boolean;
    }
  >;
  lines_subtotal: number;
  section_discount_amount: number;
  quote_discount_amount: number;
  subtotal_net: number;
  vat_amount: number;
  total_gross: number;
  cost_total: number;
  margin_amount: number;
  margin_percent: number;
  revenue: number;
  optional_subtotal: number;
  optional_vat_amount: number;
  optional_total_gross: number;
  optional_cost_total: number;
  total_with_options_gross: number;
};

/** ROUND_HALF_UP to 2 decimal places (matches Decimal quantize). */
export function moneyRound(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function money(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return moneyRound(n);
}

function discountType(raw: PricingDiscountType): "percent" | "amount" {
  const value = String(raw || "amount").toLowerCase().trim();
  if (value === "percent" || value === "%") return "percent";
  return "amount";
}

/** Return [after_discount, discount_amount]. Never negative. */
export function applyDiscount(
  base: number,
  dtype: PricingDiscountType,
  dvalue: unknown,
): [number, number] {
  if (base <= 0) return [0, 0];
  const kind = discountType(dtype);
  let amount = money(dvalue);
  if (kind === "percent") {
    if (amount > 100) amount = 100;
    amount = moneyRound((base * amount) / 100);
  }
  if (amount > base) amount = base;
  let after = moneyRound(base - amount);
  if (after < 0) {
    after = 0;
    amount = base;
  }
  return [after, amount];
}

export function lineGross(input: {
  qty?: unknown;
  unit_price?: unknown;
  item_type?: string | null;
}): number {
  if ((input.item_type || "catalog") === "note") return 0;
  return moneyRound(money(input.qty) * money(input.unit_price));
}

export function lineNet(input: {
  qty?: unknown;
  unit_price?: unknown;
  discount?: unknown;
  item_type?: string | null;
  discount_type?: PricingDiscountType;
}): number {
  if ((input.item_type || "catalog") === "note") return 0;
  const gross = lineGross(input);
  const [after] = applyDiscount(gross, input.discount_type ?? "amount", input.discount);
  return after;
}

export function lineProfitability(input: {
  qty?: unknown;
  unit_price?: unknown;
  cost?: unknown;
  discount?: unknown;
  item_type?: string | null;
  discount_type?: PricingDiscountType;
}): { line_net: number; line_cost: number; gross_profit: number; margin_percent: number } {
  const net = lineNet(input);
  const itemType = input.item_type || "catalog";
  const lineCost = itemType === "note" ? 0 : moneyRound(money(input.qty) * money(input.cost));
  const gp = moneyRound(net - lineCost);
  const margin = net > 0 ? moneyRound((gp / net) * 100) : 0;
  return { line_net: net, line_cost: lineCost, gross_profit: gp, margin_percent: margin };
}

export function marginStatus(
  marginPercent: unknown,
  opts?: { target?: unknown; minimum?: unknown },
): "healthy" | "warning" | "critical" {
  const pct = money(marginPercent);
  let tgt = money(opts?.target ?? 30);
  let mn = money(opts?.minimum ?? 15);
  if (mn > tgt) mn = tgt;
  if (pct >= tgt) return "healthy";
  if (pct >= mn) return "warning";
  return "critical";
}

/**
 * Canonical order (mirrors pricing.recalculate):
 * 1) line net  2) section discount on required  3) quote discount  4) VAT  5) cost/margin
 * Optional lines are excluded from base totals.
 */
export function recalculateQuotePricing(
  items: PricingItemInput[],
  opts: {
    vat_percent?: unknown;
    discount_type?: PricingDiscountType;
    discount_value?: unknown;
    sections?: PricingSectionInput[] | null;
  },
): PricingResult {
  const sectionMap = new Map(
    (opts.sections || []).filter((s) => s.id).map((s) => [String(s.id), s] as const),
  );
  const sectionSubtotals = new Map<string | null, number>();
  let costTotal = 0;
  let optionalSubtotal = 0;
  let optionalCostTotal = 0;
  const computedItems: PricingResult["items"] = [];

  for (const item of items) {
    const itemType = item.item_type || "catalog";
    const optional = Boolean(item.is_optional) && itemType !== "note";
    const profit = lineProfitability({
      qty: item.qty,
      unit_price: item.unit_price,
      cost: item.cost,
      discount: item.discount,
      item_type: itemType,
      discount_type: item.discount_type || "amount",
    });
    if (optional) {
      optionalSubtotal += profit.line_net;
      if (itemType !== "note") optionalCostTotal += money(item.qty) * money(item.cost);
    } else {
      if (itemType !== "note") {
        costTotal += money(item.qty) * money(item.cost);
      }
      const key = item.section_id ? String(item.section_id) : null;
      sectionSubtotals.set(key, (sectionSubtotals.get(key) ?? 0) + profit.line_net);
    }
    computedItems.push({ ...item, ...profit, is_optional: Boolean(item.is_optional) });
  }

  let linesSubtotal = 0;
  let sectionDiscountTotal = 0;
  for (const [key, sub] of sectionSubtotals) {
    if (key && sectionMap.has(key)) {
      const section = sectionMap.get(key)!;
      const [after, disc] = applyDiscount(sub, section.discount_type, section.discount_value);
      linesSubtotal += after;
      sectionDiscountTotal += disc;
    } else {
      linesSubtotal += sub;
    }
  }

  linesSubtotal = moneyRound(linesSubtotal);
  let quoteDiscountAmount = 0;
  let afterDiscount = linesSubtotal;
  if (opts.discount_type) {
    [afterDiscount, quoteDiscountAmount] = applyDiscount(
      linesSubtotal,
      opts.discount_type,
      opts.discount_value,
    );
  }

  const vatRate = money(opts.vat_percent);
  const vat = moneyRound((afterDiscount * vatRate) / 100);
  const totalGross = moneyRound(afterDiscount + vat);
  costTotal = moneyRound(costTotal);
  const marginAmount = moneyRound(afterDiscount - costTotal);
  const marginPercent =
    afterDiscount > 0 ? moneyRound((marginAmount / afterDiscount) * 100) : 0;
  optionalSubtotal = moneyRound(optionalSubtotal);
  const optionalVat = moneyRound((optionalSubtotal * vatRate) / 100);
  const optionalTotalGross = moneyRound(optionalSubtotal + optionalVat);
  optionalCostTotal = moneyRound(optionalCostTotal);

  return {
    items: computedItems,
    lines_subtotal: linesSubtotal,
    section_discount_amount: moneyRound(sectionDiscountTotal),
    quote_discount_amount: quoteDiscountAmount,
    subtotal_net: afterDiscount,
    vat_amount: vat,
    total_gross: totalGross,
    cost_total: costTotal,
    margin_amount: marginAmount,
    margin_percent: marginPercent,
    revenue: afterDiscount,
    optional_subtotal: optionalSubtotal,
    optional_vat_amount: optionalVat,
    optional_total_gross: optionalTotalGross,
    optional_cost_total: optionalCostTotal,
    total_with_options_gross: moneyRound(totalGross + optionalTotalGross),
  };
}
