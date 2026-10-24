/** Consume a hash-only Auth handoff from SITE SECURE. Tokens must never be read from the query string. */

export type AuthHandoffTokens = {
  access_token: string;
  refresh_token: string;
};

export function parseAuthHandoffHash(hash: string): AuthHandoffTokens | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const access_token = (params.get("access_token") || "").trim();
  const refresh_token = (params.get("refresh_token") || "").trim();
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

export function stripAuthHandoffHash(href: string): string {
  try {
    const url = new URL(href);
    return `${url.pathname}${url.search}`;
  } catch {
    return href.split("#", 1)[0] || "/";
  }
}
