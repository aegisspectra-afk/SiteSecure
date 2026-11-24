import catalog from "../catalog.json";

export {
  billingPublic,
  catalogPlansOrdered,
  annualMonthlyIls,
  formatIls,
  comparisonCell,
  publicPricingPayload,
  PRICING_CAPABILITY_ROWS,
} from "./public-pricing";
export type { BillingPublic, PlanCommercial, CatalogPlan } from "./public-pricing";

export type SeatLimitKey = "seats_operator" | "seats_field";
export type ResourceLimitKey = SeatLimitKey | "storage_gb";

export type SeatUsage = {
  key: SeatLimitKey;
  current: number;
  limit: number;
  unlimited: boolean;
  remaining: number | null;
};

export type StorageUsage = {
  key: "storage_gb";
  /** Used bytes when tracked; 0 when empty. */
  current_bytes: number;
  /** Allocated bytes; 0 means unlimited. */
  limit_bytes: number;
  unlimited: boolean;
};

type PlanRow = {
  key: string;
  label_he: string;
  /** Public commercial name — C1 keys match labels: free / pro / business / enterprise. */
  label_en?: string;
  features: string[];
  limits: Record<string, number>;
  assignable_roles?: string[];
  capabilities?: Record<string, boolean>;
};

/** Persisted plan_key → public commercial label (keys == display names after C1). */
export const PLAN_PUBLIC_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
  /** Legacy aliases until all workspaces migrate. */
  solo: "Free",
};

const plans = catalog.plans as PlanRow[];
const seatBuckets = (catalog as { seat_buckets?: Record<string, string[]> }).seat_buckets ?? {
  seats_operator: ["owner", "administrator", "manager", "sales"],
  seats_field: ["technician", "viewer"],
};

export function defaultPlanKey(): string {
  return (catalog as { default_plan_key?: string }).default_plan_key || "free";
}

export function getPlan(planKey: string | undefined): PlanRow | undefined {
  if (!planKey) return undefined;
  const normalized = planKey === "solo" ? "free" : planKey;
  return plans.find((plan) => plan.key === normalized) ?? plans.find((plan) => plan.key === planKey);
}

/**
 * Public plan label for UI (Free / Pro / Business / Enterprise).
 * After C1, keys match display names; `solo` still maps to Free for legacy rows.
 */
export function planLabel(planKey: string | undefined): string {
  if (!planKey) return "";
  const normalized = planKey === "solo" ? "free" : planKey;
  const row = getPlan(normalized) ?? getPlan(planKey);
  if (row?.label_he) return row.label_he;
  return PLAN_PUBLIC_LABELS[planKey] ?? PLAN_PUBLIC_LABELS[normalized] ?? planKey;
}

/** English commercial label; falls back to planLabel. */
export function planLabelEn(planKey: string | undefined): string {
  if (!planKey) return "";
  const row = getPlan(planKey);
  if (row?.label_en) return row.label_en;
  return PLAN_PUBLIC_LABELS[planKey] ?? planLabel(planKey);
}

export function planHasFeature(planKey: string | undefined, feature: string): boolean {
  return Boolean(getPlan(planKey)?.features.includes(feature));
}

export function planLimit(planKey: string | undefined, limitKey: string): number {
  return Number(getPlan(planKey)?.limits[limitKey] ?? 0);
}

export function isUnlimited(limit: number): boolean {
  return limit <= 0;
}

export function seatBucket(roleKey: string | undefined): SeatLimitKey | null {
  if (!roleKey) return null;
  if (seatBuckets.seats_operator?.includes(roleKey)) return "seats_operator";
  if (seatBuckets.seats_field?.includes(roleKey)) return "seats_field";
  return null;
}

export function assignableInviteRoles(planKey: string | undefined): string[] {
  const fromPlan = getPlan(planKey)?.assignable_roles;
  if (fromPlan?.length) return [...fromPlan];
  return ["technician", "viewer"];
}

/**
 * Custom roles + editable permission matrix.
 * Free: fixed roles. Pro+ (`team` feature): custom RBAC.
 */
export function planAllowsCustomRbac(planKey: string | undefined): boolean {
  const key = planKey === "solo" ? "free" : planKey;
  return planHasFeature(key, "team");
}

export function planHasCapability(planKey: string | undefined, capabilityKey: string): boolean {
  const key = planKey === "solo" ? "free" : planKey;
  const row = getPlan(key);
  return Boolean(row?.capabilities?.[capabilityKey]);
}

export function seatUsage(planKey: string | undefined, occupiedRoleKeys: string[]): SeatUsage[] {
  const keys: SeatLimitKey[] = ["seats_operator", "seats_field"];
  return keys.map((key) => {
    const limit = planLimit(planKey, key);
    const unlimited = isUnlimited(limit);
    const current = occupiedRoleKeys.filter((role) => seatBucket(role) === key).length;
    return {
      key,
      current,
      limit,
      unlimited,
      remaining: unlimited ? null : Math.max(0, limit - current),
    };
  });
}

export function seatLimitReached(
  planKey: string | undefined,
  inviteRole: string,
  occupiedRoleKeys: string[],
): boolean {
  const bucket = seatBucket(inviteRole);
  if (!bucket) return false;
  const row = seatUsage(planKey, occupiedRoleKeys).find((item) => item.key === bucket);
  if (!row || row.unlimited) return false;
  return row.current >= row.limit;
}

const BYTES_PER_GB = 1024 ** 3;

/** Workspace storage entitlement from catalog limits.storage_gb (0 = unlimited). */
export function storageUsage(planKey: string | undefined, usedBytes = 0): StorageUsage {
  const limitGb = planLimit(planKey, "storage_gb");
  const unlimited = isUnlimited(limitGb);
  return {
    key: "storage_gb",
    current_bytes: Math.max(0, Math.floor(usedBytes)),
    limit_bytes: unlimited ? 0 : limitGb * BYTES_PER_GB,
    unlimited,
  };
}
