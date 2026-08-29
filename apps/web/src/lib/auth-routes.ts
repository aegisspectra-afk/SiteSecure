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

export function afterAuthPath(hasWorkspace: boolean): "/app" | "/onboarding";
export function afterAuthPath(hasWorkspace: boolean, next: string | null | undefined): string;
export function afterAuthPath(hasWorkspace: boolean, next?: string | null): string {
  const safe = sanitizeNextPath(next);
  if (safe) return safe;
  return hasWorkspace ? "/app" : "/onboarding";
}
