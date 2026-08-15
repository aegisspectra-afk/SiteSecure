import { can } from "./can";

export type HomeVariant = "ops" | "sales" | "today" | "observe";

export function homeVariant(roleKey: string | undefined): HomeVariant {
  switch (roleKey) {
    case "sales":
      return "sales";
    case "technician":
    case "founding_technician":
      return "today";
    case "viewer":
      return "observe";
    default:
      return "ops";
  }
}

export function hasFeature(features: string[], feature: string): boolean {
  return features.includes(feature);
}

/** Product screens that exist as click-through. */
export function moduleHref(
  kind: "customer.create" | "quote.create" | "job.create" | "quote" | "job" | "service",
  id?: string,
): string | null {
  if (kind === "quote.create") return "/app/quotes/new";
  if (kind === "quote" && id) return `/app/quotes/${id}`;
  return null;
}

export function quickActions(
  roleKey: string | undefined,
  features: string[] = [],
): { permission: string; label: string; href: string }[] {
  const candidates: {
    permission: string;
    feature?: string;
    kind: "customer.create" | "quote.create" | "job.create";
    label: string;
  }[] = [{ permission: "quotes.create", feature: "quotes", kind: "quote.create", label: "הצעת מחיר חדשה" }];
  const out: { permission: string; label: string; href: string }[] = [];
  for (const item of candidates) {
    const href = moduleHref(item.kind);
    if (!href) continue;
    if (item.feature && !hasFeature(features, item.feature)) continue;
    if (!can(roleKey, item.permission, features)) continue;
    out.push({ permission: item.permission, label: item.label, href });
  }
  return out;
}

export function itemHref(entityType: string, entityId: string): string | null {
  if (entityType === "quote") return moduleHref("quote", entityId);
  if (entityType === "job") return moduleHref("job", entityId);
  return null;
}
