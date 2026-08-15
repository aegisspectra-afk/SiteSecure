import { he } from "../i18n/he";
import { can } from "./can";

export type SetupStep = {
  id: string;
  label: string;
  done: boolean;
  current: boolean;
  href?: "/app/settings/users";
};

export function workspaceSetup(opts: {
  roleKey: string | undefined;
  features: string[];
  memberCount: number | null;
}): { steps: SetupStep[]; complete: boolean } {
  const steps: SetupStep[] = [{ id: "workspace", label: he.setupWorkspace, done: true, current: false }];
  if (can(opts.roleKey, "users.invite", opts.features) || can(opts.roleKey, "users.view", opts.features)) {
    const invited = (opts.memberCount ?? 1) > 1;
    steps.push({
      id: "invite",
      label: he.setupInvite,
      done: invited,
      current: !invited,
      href: "/app/settings/users",
    });
  }
  const complete = steps.every((step) => step.done);
  if (complete) {
    return { steps: steps.map((step) => ({ ...step, current: false })), complete };
  }
  const currentIndex = steps.findIndex((step) => !step.done);
  return {
    steps: steps.map((step, index) => ({ ...step, current: index === currentIndex })),
    complete,
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
