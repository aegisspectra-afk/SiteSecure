import { hasFeature } from "./can";

export type WorkforceGate = "loading" | "login" | "no-workspace" | "blocked" | "home";

export function membershipHasWorkforce(session: {
  memberships?: Array<{ features?: string[] | null }>;
} | null): boolean {
  if (!session) return false;
  return hasFeature(session.memberships?.[0]?.features ?? [], "workforce");
}

export function workforceGate(opts: {
  loading: boolean;
  hasSession: boolean;
  hasWorkspace: boolean;
  hasWorkforce: boolean;
}): WorkforceGate {
  if (opts.loading) return "loading";
  if (!opts.hasSession) return "login";
  if (!opts.hasWorkspace) return "no-workspace";
  if (!opts.hasWorkforce) return "blocked";
  return "home";
}

export function afterWorkforceLoginPath(gate: WorkforceGate): "/" | "/login" {
  return gate === "home" ? "/" : "/login";
}
