export const COOKIE_CONSENT_STORAGE_KEY = "ss-cookie-consent-analytics";

export type CookieConsentChoice = "accepted" | "declined";

/** Non-essential analytics cookies (Vercel) only when explicitly enabled in production. */
export function usesNonEssentialCookies(): boolean {
  if (import.meta.env.DEV) return false;
  return import.meta.env.VITE_ENABLE_VERCEL_ANALYTICS === "true";
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
  if (!usesNonEssentialCookies()) return false;
  return readCookieConsent() === "accepted";
}