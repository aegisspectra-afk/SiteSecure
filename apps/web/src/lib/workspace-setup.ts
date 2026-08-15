import { he } from "../i18n/he";
import { can } from "./can";

export type SetupStep = {
  id: string;
  label: string;
  done: boolean;
  href?: "/app/settings/users";
};

export function workspaceSetup(opts: {
  roleKey: string | undefined;
  features: string[];
  memberCount: number | null;
}): { steps: SetupStep[]; percent: number; complete: boolean } {
  const steps: SetupStep[] = [{ id: "workspace", label: he.setupWorkspace, done: true }];
  if (can(opts.roleKey, "users.invite", opts.features) || can(opts.roleKey, "users.view", opts.features)) {
    steps.push({
      id: "invite",
      label: he.setupInvite,
      done: (opts.memberCount ?? 1) > 1,
      href: "/app/settings/users",
    });
  }
  const doneCount = steps.filter((step) => step.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);
  return { steps, percent, complete: doneCount === steps.length };
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
