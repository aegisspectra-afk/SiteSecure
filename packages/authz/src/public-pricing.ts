import catalog from "../catalog.json";

export type ExtraSeatTier = {
  min_extra: number;
  max_extra: number | null;
  ils_before_vat: number;
};

export type BillingPublic = {
  currency: string;
  vat_note_he: string;
  pro_launch_active: boolean;
  extra_seat_tiers: ExtraSeatTier[];
  /** @deprecated Annual billing removed — kept optional for older readers. */
  annual_bonus_months?: number;
};

export type PlanCommercial = {
  monthly_ils_before_vat: number | null;
  launch_monthly_ils_before_vat?: number | null;
  allows_extra_seats?: boolean;
  /** @deprecated Flat per-seat rate replaced by extra_seat_tiers. */
  extra_seat_ils_before_vat?: number | null;
  custom_pricing?: boolean;
  audience_he: string;
  highlights_he: string[];
  cta_he: string;
};

export type CatalogPlan = {
  key: string;
  label_he: string;
  features?: string[];
  limits: Record<string, number>;
  capabilities?: Record<string, boolean>;
  commercial?: PlanCommercial;
};

const ORDERED_KEYS = ["free", "pro", "business", "enterprise"] as const;

const DEFAULT_TIERS: ExtraSeatTier[] = [
  { min_extra: 1, max_extra: 2, ils_before_vat: 49 },
  { min_extra: 3, max_extra: 4, ils_before_vat: 39 },
  { min_extra: 5, max_extra: 9, ils_before_vat: 29 },
  { min_extra: 10, max_extra: null, ils_before_vat: 24 },
];

export const PRICING_CAPABILITY_ROWS: { key: string; label_he: string }[] = [
  { key: "quota_display", label_he: "הצעות בחודש" },
  { key: "storage_gb", label_he: "אחסון" },
  { key: "max_members", label_he: "משתמשי משרד" },
  { key: "quotes.alternatives", label_he: "חלופות לוועד בית" },
  { key: "branding.custom_handover", label_he: "תעודת מסירה במותג שלך" },
  { key: "comms.whatsapp", label_he: "שיתוף בוואטסאפ" },
  { key: "quotes.sales_tracking", label_he: "מעקב מכירה" },
  { key: "field.technicians", label_he: "טכנאים בשטח" },
  { key: "jobs.checklist", label_he: "צ׳קליסט וחתימה" },
  { key: "sites.dossier", label_he: "תיק אתר" },
  { key: "service.reminders", label_he: "תזכורות שירות" },
  { key: "quotes.profitability", label_he: "רווחיות להצעות" },
];

export function billingPublic(): BillingPublic {
  const raw = (catalog as { billing_public?: Partial<BillingPublic> }).billing_public;
  const tiers = Array.isArray(raw?.extra_seat_tiers) && raw.extra_seat_tiers.length
    ? (raw.extra_seat_tiers as ExtraSeatTier[])
    : DEFAULT_TIERS;
  return {
    currency: raw?.currency ?? "ILS",
    vat_note_he: raw?.vat_note_he ?? 'המחירים לא כוללים מע״מ.',
    pro_launch_active: Boolean(raw?.pro_launch_active ?? true),
    extra_seat_tiers: tiers,
    annual_bonus_months: 0,
  };
}

export function catalogPlansOrdered(): CatalogPlan[] {
  const plans = (catalog.plans ?? []) as CatalogPlan[];
  return ORDERED_KEYS.map((key) => plans.find((p) => p.key === key)).filter((p): p is CatalogPlan => Boolean(p));
}

/** @deprecated Annual billing removed. */
export function annualMonthlyIls(monthly: number, _bonusMonths = 0): number {
  return monthly <= 0 ? 0 : monthly;
}

export function formatIls(amount: number | null | undefined): string {
  if (amount == null) return "בהתאמה";
  if (amount <= 0) return "₪0";
  return `₪${amount.toLocaleString("he-IL")}`;
}

export function planAllowsExtraSeats(plan: CatalogPlan): boolean {
  if (plan.key === "free" || plan.key === "solo") return false;
  if (plan.key === "enterprise") return false;
  if (plan.commercial?.allows_extra_seats != null) return Boolean(plan.commercial.allows_extra_seats);
  return plan.key === "pro" || plan.key === "business";
}

/**
 * Unit price for every extra seat when buying `extraCount` extras.
 * All extras share the tier rate (not cumulative brackets).
 */
export function extraSeatUnitPrice(
  extraCount: number,
  tiers: ExtraSeatTier[] = billingPublic().extra_seat_tiers,
): number {
  const n = Math.max(0, Math.floor(Number(extraCount) || 0));
  if (n <= 0) return 0;
  for (const tier of tiers) {
    const max = tier.max_extra;
    if (n >= tier.min_extra && (max == null || n <= max)) {
      return tier.ils_before_vat;
    }
  }
  const last = tiers[tiers.length - 1];
  return last?.ils_before_vat ?? 0;
}

export function extraSeatsTotalIls(
  extraCount: number,
  tiers: ExtraSeatTier[] = billingPublic().extra_seat_tiers,
): number {
  const n = Math.max(0, Math.floor(Number(extraCount) || 0));
  if (n <= 0) return 0;
  return n * extraSeatUnitPrice(n, tiers);
}

/** List / launch display base for a plan (ignores workspace locked_price). */
export function planDisplayBaseIls(
  plan: CatalogPlan,
  opts?: { preferLaunch?: boolean },
): number | null {
  const c = plan.commercial;
  if (!c || c.custom_pricing || c.monthly_ils_before_vat == null) return null;
  const preferLaunch = opts?.preferLaunch !== false;
  if (
    preferLaunch &&
    billingPublic().pro_launch_active &&
    c.launch_monthly_ils_before_vat != null
  ) {
    return c.launch_monthly_ils_before_vat;
  }
  return c.monthly_ils_before_vat;
}

export function planRegularBaseIls(plan: CatalogPlan): number | null {
  const c = plan.commercial;
  if (!c || c.custom_pricing || c.monthly_ils_before_vat == null) return null;
  return c.monthly_ils_before_vat;
}

/**
 * Monthly total before VAT = base (locked or list/launch) + extras tier total.
 * Custom / enterprise returns null.
 */
export function monthlyTotalIls(opts: {
  plan: CatalogPlan;
  extraSeats?: number;
  lockedPriceIlsBeforeVat?: number | null;
  preferLaunch?: boolean;
}): number | null {
  const { plan, lockedPriceIlsBeforeVat } = opts;
  if (plan.commercial?.custom_pricing) return null;
  const extras = Math.max(0, Math.floor(Number(opts.extraSeats) || 0));
  if (extras > 0 && !planAllowsExtraSeats(plan)) return null;

  let base: number | null;
  if (lockedPriceIlsBeforeVat != null && Number.isFinite(lockedPriceIlsBeforeVat)) {
    base = Number(lockedPriceIlsBeforeVat);
  } else {
    base = planDisplayBaseIls(plan, { preferLaunch: opts.preferLaunch });
  }
  if (base == null) return null;
  return base + extraSeatsTotalIls(extras);
}

/** Effective member cap: max_members + extra_seats (0 max_members = unlimited). */
export function effectiveMemberCap(maxMembers: number, extraSeats = 0): number {
  const max = Math.floor(Number(maxMembers) || 0);
  if (max <= 0) return 0;
  const extras = Math.max(0, Math.floor(Number(extraSeats) || 0));
  return max + extras;
}

export function extrasNeededForUsers(plan: CatalogPlan, totalUsers: number): number {
  const max = plan.limits?.max_members ?? 0;
  if (max <= 0) return 0;
  const need = Math.max(0, Math.floor(totalUsers) - max);
  if (need > 0 && !planAllowsExtraSeats(plan)) return -1;
  return need;
}

export function comparisonCell(plan: CatalogPlan, rowKey: string): string {
  const limits = plan.limits ?? {};
  if (rowKey === "quota_display") {
    const q = limits.quota_quotes ?? 0;
    return q <= 0 ? "ללא הגבלה" : `עד ${q}`;
  }
  if (rowKey === "storage_gb") {
    const gb = limits.storage_gb ?? 0;
    return gb <= 0 ? "ללא הגבלה" : `${gb}GB`;
  }
  if (rowKey === "max_members") {
    const n = limits.max_members ?? 0;
    if (n <= 0) return "ללא הגבלה";
    if (planAllowsExtraSeats(plan)) return `עד ${n} + מדרגות`;
    return `עד ${n}`;
  }
  const caps = plan.capabilities ?? {};
  const on = Boolean(caps[rowKey]);
  return on ? "כן" : "—";
}

export function publicPricingPayload() {
  const billing = billingPublic();
  const plans = catalogPlansOrdered();
  return {
    billing,
    plans: plans.map((plan) => ({
      key: plan.key,
      label_he: plan.label_he,
      limits: plan.limits,
      capabilities: plan.capabilities ?? {},
      commercial: plan.commercial,
      display_monthly_ils_before_vat: planDisplayBaseIls(plan),
      regular_monthly_ils_before_vat: planRegularBaseIls(plan),
      allows_extra_seats: planAllowsExtraSeats(plan),
    })),
    comparison_rows: PRICING_CAPABILITY_ROWS,
  };
}
