/**
 * Supabase Auth email redirects follow the current browser origin.
 * Never bake localhost, a Vercel alias, or WEB_PUBLIC_URL into the client.
 *
 * Auth only honors these URLs if they appear in Dashboard → Authentication →
 * URL Configuration → Redirect URLs. Otherwise it silently uses Site URL.
 */
export function authRedirectUrl(
  path: "/login" | "/reset-password",
  origin?: string,
): string {
  const base = (origin ?? window.location.origin).replace(/\/$/, "");
  return `${base}${path}`;
}

export function signupVerifyRedirectUrl(origin?: string): string {
  return authRedirectUrl("/login", origin);
}

export function resetPasswordRedirectUrl(origin?: string): string {
  return authRedirectUrl("/reset-password", origin);
}

export function hasAuthCallback(search: string, hash: string): boolean {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const fragment = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return Boolean(
    query.get("code") ||
      fragment.get("access_token") ||
      fragment.get("refresh_token") ||
      fragment.get("type"),
  );
}
