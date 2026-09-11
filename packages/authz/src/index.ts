import catalog from "../catalog.json";

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
  /** Public commercial name (Free / Pro / Enterprise). Keys remain solo/business/enterprise. */
  label_en?: string;
  features: string[];
  limits: Record<string, number>;
  assignable_roles?: string[];
};

/** Persisted plan_key → public commercial label. Keys are never renamed here. */
export const PLAN_PUBLIC_LABELS: Record<string, string> = {
  solo: "Free",
  business: "Pro",
  enterprise: "Enterprise",
};

const plans = catalog.plans as PlanRow[];
const seatBuckets = (catalog as { seat_buckets?: Record<string, string[]> }).seat_buckets ?? {
  seats_operator: ["owner", "administrator", "manager", "sales"],
  seats_field: ["technician", "viewer"],
};

export function defaultPlanKey(): string {
  return (catalog as { default_plan_key?: string }).default_plan_key || "solo";
}

export function getPlan(planKey: string | undefined): PlanRow | undefined {
  if (!planKey) return undefined;
  return plans.find((plan) => plan.key === planKey);
}

/**
 * Public plan label for UI (Free / Pro / Enterprise).
 * Persisted keys remain solo / business / enterprise — never gate features on these strings.
 */
export function planLabel(planKey: string | undefined): string {
  if (!planKey) return "";
  const row = getPlan(planKey);
  if (row?.label_he) return row.label_he;
  return PLAN_PUBLIC_LABELS[planKey] ?? planKey;
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
 * Maps SaaS FREE→solo (fixed roles), PRO+→business/enterprise (`team` feature).
 */
export function planAllowsCustomRbac(planKey: string | undefined): boolean {
  return planHasFeature(planKey, "team");
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
