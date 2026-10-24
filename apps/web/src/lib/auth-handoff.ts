/** Hash-only session handoff between SITE SECURE and sibling product apps. Never put tokens in the query string. */

export type AuthHandoffTokens = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

export function appendAuthHandoffHash(
  url: string,
  tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    expires_at?: number | null;
  },
): string {
  if (!url || !tokens.access_token || !tokens.refresh_token) return url;
  const params = new URLSearchParams();
  params.set("access_token", tokens.access_token);
  params.set("refresh_token", tokens.refresh_token);
  params.set("token_type", "bearer");
  if (tokens.expires_at) params.set("expires_at", String(tokens.expires_at));
  const base = url.split("#", 1)[0];
  return `${base}#${params.toString()}`;
}

export function parseAuthHandoffHash(hash: string): AuthHandoffTokens | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const access_token = (params.get("access_token") || "").trim();
  const refresh_token = (params.get("refresh_token") || "").trim();
  if (!access_token || !refresh_token) return null;
  const expires_at = Number(params.get("expires_at") || "");
  return {
    access_token,
    refresh_token,
    ...(Number.isFinite(expires_at) && expires_at > 0 ? { expires_at } : {}),
  };
}
