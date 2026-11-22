export const COOKIE_CONSENT_STORAGE_KEY = "ss-cookie-consent-analytics";

export type CookieConsentChoice = "accepted" | "declined";

const LOCAL_WEB_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** True on localhost / loopback — Vercel Web Analytics returns 400 without a deployed project. */
export function isLocalWebHost(hostname?: string): boolean {
  const host = (hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")).toLowerCase();
  if (!host) return import.meta.env.DEV;
  return LOCAL_WEB_HOSTS.has(host);
}

/**
 * Vercel Web Analytics may load only when explicitly enabled, not in dev/local,
 * and (for consent UX) treated as non-essential cookies.
 */
export function vercelWebAnalyticsEnabled(): boolean {
  if (import.meta.env.DEV) return false;
  if (import.meta.env.VITE_ENABLE_VERCEL_ANALYTICS !== "true") return false;
  if (isLocalWebHost()) return false;
  return true;
}

/** Non-essential analytics cookies (Vercel) only when analytics is eligible in production. */
export function usesNonEssentialCookies(): boolean {
  return vercelWebAnalyticsEnabled();
}

export function readCookieConsent(): CookieConsentChoice | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  if (raw === "accepted" || raw === "declined") return raw;
  return null;
}

export function writeCookieConsent(choice: CookieConsentChoice): void {
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice);
}

export function mayLoadAnalytics(): boolean {
  if (!vercelWebAnalyticsEnabled()) return false;
  return readCookieConsent() === "accepted";
}