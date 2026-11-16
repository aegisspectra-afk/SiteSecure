import { isProductAvailable } from "./entitlement-revoke";

/** Unauthenticated /app and onboarding send guests to Login. `/` is the public website. */
/** Safe post-auth redirects for invite acceptance (and similar deep links). */

const ALLOWED_NEXT = [/^\/invite\/[A-Za-z0-9_-]{16,}$/];

export function guestEntryPath(): "/login" {
  return "/login";
}

export function sanitizeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return null;
  if (value.includes("?") || value.includes("#")) return null;
  if (!ALLOWED_NEXT.some((re) => re.test(value))) return null;
  return value;
}

export function withNextParam(path: "/login" | "/register", next: string | null | undefined): string {
  const safe = sanitizeNextPath(next);
  if (!safe) return path;
  return `${path}?next=${encodeURIComponent(safe)}`;
}

export function afterAuthPath(hasWorkspace: boolean): "/platform" | "/onboarding";
export function afterAuthPath(hasWorkspace: boolean, next: string | null | undefined): string;
export function afterAuthPath(hasWorkspace: boolean, next?: string | null): string {
  const safe = sanitizeNextPath(next);
  if (safe) return safe;
  return hasWorkspace ? "/platform" : "/onboarding";
}

/** After the 4-step solo setup, enter Site Secure ops — not the product picker. */
export function onboardingEnterPath(): "/app/dashboard" {
  return "/app/dashboard";
}

/**
 * DEMO-4: where a signed-in user lands. A single-workspace user (an owner included) goes
 * straight to Site Secure (/app/dashboard; a technician is sent on to /app/today there).
 * /platform (the product picker) is for platform admins and users with several workspaces,
 * and for a workspace without Site Secure (e.g. SSP only) so nobody lands on a locked shell.
 * A safe ?next= deep link (invites) still wins.
 */
export function landingPathForSession(
  session: {
    has_workspace: boolean;
    is_platform_admin?: boolean | null;
    memberships: { features?: string[] | null }[];
  } | null,
  next?: string | null,
): string {
  const safe = sanitizeNextPath(next);
  if (safe) return safe;
  if (!session?.has_workspace || session.memberships.length === 0) return "/onboarding";
  if (session.is_platform_admin) return "/platform";
  if (session.memberships.length > 1) return "/platform";
  return isProductAvailable("site_secure", session.memberships[0]?.features ?? []) ? "/app/dashboard" : "/platform";
}
