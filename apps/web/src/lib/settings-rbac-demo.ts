/**
 * Investor-demo RBAC configuration model.
 * Seeds from the live authz catalog; toggles stay local (do not mutate runtime enforcement).
 */

import catalog from "@site-secure/authz/catalog.json";
import { roleGranted } from "./role-catalog";

export const RBAC_MODULES = [
  "customers",
  "leads",
  "quotes",
  "catalog",
  "projects",
  "site_files",
  "service_calls",
  "team",
  "settings",
  "security",
  "analytics",
] as const;

export type RbacModule = (typeof RBAC_MODULES)[number];

export const RBAC_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve_send",
  "export",
] as const;

export type RbacAction = (typeof RBAC_ACTIONS)[number];

/** Primary demo roles (Ops maps to manager). */
export const RBAC_DEMO_ROLES = [
  { key: "owner", descriptionKey: "owner" as const, locked: true },
  { key: "administrator", descriptionKey: "admin" as const, locked: false },
  { key: "manager", descriptionKey: "ops" as const, locked: false },
  { key: "sales", descriptionKey: "sales" as const, locked: false },
  { key: "technician", descriptionKey: "technician" as const, locked: false },
  { key: "viewer", descriptionKey: "viewer" as const, locked: false },
] as const;

export type RbacDemoRoleKey = (typeof RBAC_DEMO_ROLES)[number]["key"];

/** Map matrix cell → catalog permission key (null = N/A for that module/action). */
export const RBAC_PERMISSION_MAP: Record<RbacModule, Partial<Record<RbacAction, string | string[]>>> = {
  customers: {
    view: "crm.view",
    create: "crm.create",
    edit: "crm.edit",
    delete: "crm.delete",
    export: "crm.export",
  },
  leads: {
    view: "leads.view",
    create: "leads.create",
    edit: "leads.edit",
    delete: "leads.delete",
  },
  quotes: {
    view: "quotes.view",
    create: "quotes.create",
    edit: "quotes.edit",
    delete: "quotes.delete",
    approve_send: ["quotes.send", "quotes.approve"],
    export: "quotes.export",
  },
  catalog: {
    view: "catalog.view",
    edit: "catalog.edit",
  },
  projects: {
    view: "projects.view",
    create: "projects.create",
    edit: "projects.edit",
    delete: "projects.delete",
  },
  site_files: {
    view: "sites.view",
    create: "sites.create",
    edit: "sites.edit",
    delete: "sites.delete",
  },
  service_calls: {
    view: "service.view",
    create: "service.create",
    edit: "service.edit",
    delete: "service.close",
  },
  team: {
    view: "users.view",
    create: "users.invite",
    edit: "users.manage",
  },
  settings: {
    view: "settings.view",
    edit: "workspace.edit",
  },
  security: {
    view: "audit.view",
    edit: "settings.general",
  },
  analytics: {
    view: "reports.view",
    export: "reports.export",
  },
};

export type GrantMatrix = Record<string, Record<RbacModule, Record<RbacAction, boolean | null>>>;

function cellFromCatalog(roleKey: string, module: RbacModule, action: RbacAction): boolean | null {
  const mapping = RBAC_PERMISSION_MAP[module][action];
  if (!mapping) return null;
  const keys = Array.isArray(mapping) ? mapping : [mapping];
  return keys.every((key) => roleGranted(roleKey, key));
}

export function buildGrantMatrixFromCatalog(roleKeys: string[] = RBAC_DEMO_ROLES.map((r) => r.key)): GrantMatrix {
  const matrix: GrantMatrix = {};
  for (const roleKey of roleKeys) {
    matrix[roleKey] = {} as GrantMatrix[string];
    for (const module of RBAC_MODULES) {
      matrix[roleKey][module] = {} as Record<RbacAction, boolean | null>;
      for (const action of RBAC_ACTIONS) {
        if (roleKey === "owner") {
          const mapping = RBAC_PERMISSION_MAP[module][action];
          matrix[roleKey][module][action] = mapping ? true : null;
        } else {
          matrix[roleKey][module][action] = cellFromCatalog(roleKey, module, action);
        }
      }
    }
  }
  return matrix;
}

export function catalogRoleKeys(): string[] {
  return catalog.roles.map((role) => role.key);
}

export type DemoAssignedUser = { id: string; name: string; email: string };

/** Deterministic demo assignees for investor walkthrough. */
export function demoUsersForRole(roleKey: string): DemoAssignedUser[] {
  const pool: Record<string, DemoAssignedUser[]> = {
    owner: [{ id: "u-owner", name: "יובל כהן", email: "owner@aegis.demo" }],
    administrator: [{ id: "u-admin", name: "נועה לוי", email: "admin@aegis.demo" }],
    manager: [
      { id: "u-ops-1", name: "איתי מזרחי", email: "ops@aegis.demo" },
      { id: "u-ops-2", name: "שירה דהן", email: "field-lead@aegis.demo" },
    ],
    sales: [
      { id: "u-sales-1", name: "דניאל אברהם", email: "sales@aegis.demo" },
      { id: "u-sales-2", name: "מיכל פרץ", email: "quotes@aegis.demo" },
    ],
    technician: [
      { id: "u-tech-1", name: "אורי בן-דוד", email: "tech1@aegis.demo" },
      { id: "u-tech-2", name: "רועי שמעון", email: "tech2@aegis.demo" },
      { id: "u-tech-3", name: "ליאור חדד", email: "tech3@aegis.demo" },
    ],
    viewer: [{ id: "u-view", name: "הדס גולן", email: "viewer@aegis.demo" }],
  };
  return pool[roleKey] ?? [];
}
