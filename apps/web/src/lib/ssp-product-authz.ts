/**
 * SSP product-role grants (UI only — server re-checks via product_authz.py).
 * Mirrors apps/ssp/src/lib/productAuthz.ts and apps/api/app/ssp/product_authz.py.
 * Does not change catalog.json.
 */

export type SspProductRole = "org_admin" | "patrol_manager" | "patrol_officer";

const OPS_MANAGER = [
  "ssp.dashboard.view",
  "ssp.officers.view",
  "ssp.patrols.view",
  "ssp.patrols.edit",
  "ssp.checkpoints.view",
  "ssp.checkpoints.edit",
  "ssp.scans.view",
  "ssp.scans.create",
  "ssp.events.view",
  "ssp.events.edit",
  "ssp.events.create",
  "ssp.distributions.view",
  "ssp.distributions.manage",
] as const;

const OPS_OFFICER = [
  "ssp.dashboard.view",
  "ssp.patrols.view",
  "ssp.checkpoints.view",
  "ssp.scans.create",
  "ssp.events.view",
  "ssp.events.create",
  "ssp.distributions.view",
] as const;

export const PRODUCT_ROLE_GRANTS: Record<SspProductRole, readonly string[]> = {
  org_admin: [
    "ssp.org.view",
    "ssp.org.manage",
    "ssp.members.view",
    "ssp.members.manage",
    "ssp.forms.view",
    "ssp.forms.edit",
    "ssp.forms.publish",
    "ssp.assignments.manage",
    "ssp.submissions.view",
    "ssp.forms.submit",
    "ssp.settings.view",
    "ssp.sites.view",
    "ssp.sites.edit",
    ...OPS_MANAGER,
  ],
  patrol_manager: [
    "ssp.org.view",
    "ssp.members.view",
    "ssp.members.manage_department",
    "ssp.forms.view",
    "ssp.forms.edit",
    "ssp.forms.publish",
    "ssp.assignments.manage",
    "ssp.submissions.view",
    "ssp.sites.view",
    "ssp.sites.edit",
    ...OPS_MANAGER,
  ],
  patrol_officer: [
    "ssp.org.view",
    "ssp.forms.view",
    "ssp.forms.submit",
    "ssp.submissions.view_own",
    "ssp.sites.view",
    ...OPS_OFFICER,
  ],
};

export function productCan(productRole: string | null | undefined, action: string): boolean {
  if (!productRole || !(productRole in PRODUCT_ROLE_GRANTS)) return false;
  return PRODUCT_ROLE_GRANTS[productRole as SspProductRole].includes(action);
}

export function productRoleLabelHe(role: string | null | undefined): string {
  if (role === "org_admin") return "מנהל ארגון";
  if (role === "patrol_manager") return "מנהל סיור";
  if (role === "patrol_officer") return "קצין סיור";
  return "ללא תפקיד מוצר";
}
