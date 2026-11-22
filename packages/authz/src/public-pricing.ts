import catalog from "../catalog.json";

export type BillingPublic = {
  currency: string;
  annual_bonus_months: number;
  vat_note_he: string;
};

export type PlanCommercial = {
  monthly_ils_before_vat: number | null;
  extra_seat_ils_before_vat?: number | null;
  custom_pricing?: boolean;
  audience_he: string;
  highlights_he: string[];
  cta_he: string;
};

type CatalogPlan = {
  key: string;
  label_he: string;
  limits: Record<string, number>;
  capabilities?: Record<string, boolean>;
  commercial?: PlanCommercial;
};

const ORDERED_KEYS = ["free", "pro", "business", "enterprise"] as const;

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
  const raw = (catalog as { billing_public?: BillingPublic }).billing_public;
  return {
    currency: raw?.currency ?? "ILS",
    annual_bonus_months: raw?.annual_bonus_months ?? 2,
    vat_note_he: raw?.vat_note_he ?? 'המחירים לא כוללים מע״מ.',
  };
}

export function catalogPlansOrdered(): CatalogPlan[] {
  const plans = (catalog.plans ?? []) as CatalogPlan[];
  return ORDERED_KEYS.map((key) => plans.find((p) => p.key === key)).filter((p): p is CatalogPlan => Boolean(p));
}

export function annualMonthlyIls(monthly: number, bonusMonths = billingPublic().annual_bonus_months): number {
  if (monthly <= 0) return 0;
  return Math.round((monthly * 12) / (12 + bonusMonths));
}

export function formatIls(amount: number | null | undefined): string {
  if (amount == null) return "בהתאמה";
  if (amount <= 0) return "₪0";
  return `₪${amount.toLocaleString("he-IL")}`;
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
    const extra = plan.commercial?.extra_seat_ils_before_vat;
    return extra ? `עד ${n} (+₪${extra} נוסף)` : `עד ${n}`;
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
      annual_monthly_ils_before_vat:
        plan.commercial?.custom_pricing || plan.commercial?.monthly_ils_before_vat == null
          ? null
          : annualMonthlyIls(plan.commercial.monthly_ils_before_vat),
    })),
    comparison_rows: PRICING_CAPABILITY_ROWS,
  };
}