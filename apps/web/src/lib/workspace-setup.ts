import { he } from "../i18n/he";
import { can } from "./can";

export type SetupStep = {
  id: string;
  label: string;
  done: boolean;
  current: boolean;
  href?: "/app/customers" | "/app/quotes" | "/app/quotes/new" | "/app/settings/users";
};

/**
 * Business activation progress (workspace → first customer → first quote).
 * Derived from live counts — not invite/team setup.
 * Team invite remains available via liveAdminActions / settings, not as the primary ring.
 *
 * null counts = unknown → step omitted (avoids false incomplete / flicker).
 */
export function workspaceSetup(opts: {
  roleKey: string | undefined;
  features: string[];
  customerCount?: number | null;
  quoteCount?: number | null;
  /** @deprecated Invite is no longer part of activation progress. Ignored. */
  memberCount?: number | null;
  /** @deprecated Ignored — invite is not an activation milestone. */
  pendingInvites?: number;
}): { steps: SetupStep[]; complete: boolean; done: number; total: number; percent: number } {
  const steps: SetupStep[] = [{ id: "workspace", label: he.setupWorkspace, done: true, current: false }];

  const trackCustomers =
    can(opts.roleKey, "crm.create", opts.features) || can(opts.roleKey, "crm.view", opts.features);
  if (trackCustomers && opts.customerCount != null) {
    const done = opts.customerCount > 0;
    steps.push({
      id: "first_customer",
      label: he.setupFirstCustomer,
      done,
      current: false,
      href: "/app/customers",
    });
  }

  const trackQuotes =
    can(opts.roleKey, "quotes.create", opts.features) || can(opts.roleKey, "quotes.view", opts.features);
  if (trackQuotes && opts.quoteCount != null) {
    const done = opts.quoteCount > 0;
    steps.push({
      id: "first_quote",
      label: he.setupFirstQuote,
      done,
      current: false,
      href: can(opts.roleKey, "quotes.create", opts.features) ? "/app/quotes/new" : "/app/quotes",
    });
  }

  const complete = steps.every((step) => step.done);
  const done = steps.filter((step) => step.done).length;
  const total = steps.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  if (complete) {
    return { steps: steps.map((step) => ({ ...step, current: false })), complete, done, total, percent };
  }
  const currentIndex = steps.findIndex((step) => !step.done);
  return {
    steps: steps.map((step, index) => ({ ...step, current: index === currentIndex })),
    complete,
    done,
    total,
    percent,
  };
}

export function liveAdminActions(
  roleKey: string | undefined,
  features: string[] = [],
): { permission: string; label: string; href: "/app/settings" | "/app/settings/users" | "/app/settings/roles" | "/app/settings/security" }[] {
  const out: { permission: string; label: string; href: "/app/settings" | "/app/settings/users" | "/app/settings/roles" | "/app/settings/security" }[] =
    [];
  if (can(roleKey, "users.invite", features)) {
    out.push({ permission: "users.invite", label: he.inviteUser, href: "/app/settings/users" });
  }
  if (can(roleKey, "workspace.edit", features)) {
    out.push({ permission: "workspace.edit", label: he.navSettings, href: "/app/settings" });
  }
  if (can(roleKey, "users.view", features) || can(roleKey, "roles.manage", features)) {
    out.push({ permission: "users.view", label: he.navRoles, href: "/app/settings/roles" });
  }
  if (can(roleKey, "settings.general", features) || can(roleKey, "workspace.edit", features)) {
    out.push({ permission: "settings.general", label: he.navSecurity, href: "/app/settings/security" });
  }
  return out;
}
