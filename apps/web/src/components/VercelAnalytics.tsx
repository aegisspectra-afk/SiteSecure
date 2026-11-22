import { Analytics, type BeforeSendEvent } from "@vercel/analytics/react";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { mayLoadAnalytics, usesNonEssentialCookies } from "../lib/cookie-consent";

/** Query keys that must never appear in Vercel Analytics URLs. */
const REDACT_KEYS = new Set([
  "token",
  "access_token",
  "refresh_token",
  "code",
  "invitation",
  "invite",
  "password",
  "key",
  "api_key",
  "apikey",
]);

function scrubAnalyticsUrl(raw: string): string {
  try {
    const url = new URL(raw, typeof window !== "undefined" ? window.location.origin : "https://local");
    for (const key of [...url.searchParams.keys()]) {
      if (REDACT_KEYS.has(key.toLowerCase()) || /token|secret|password|key/i.test(key)) {
        url.searchParams.set(key, "[redacted]");
      }
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return raw;
  }
}

function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  return { ...event, url: scrubAnalyticsUrl(event.url) };
}

/**
 * Vercel Web Analytics for the Vite SPA.
 * Loads only in production when explicitly enabled and after cookie consent (if analytics cookies apply).
 */
export function VercelAnalytics() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [allowed, setAllowed] = useState(() =>
    !usesNonEssentialCookies() ? import.meta.env.VITE_ENABLE_VERCEL_ANALYTICS === "true" : mayLoadAnalytics(),
  );

  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (usesNonEssentialCookies()) {
      setAllowed(mayLoadAnalytics());
      const onConsent = () => setAllowed(mayLoadAnalytics());
      window.addEventListener("ss-cookie-consent", onConsent);
      return () => window.removeEventListener("ss-cookie-consent", onConsent);
    }
    setAllowed(import.meta.env.VITE_ENABLE_VERCEL_ANALYTICS === "true");
  }, []);

  if (import.meta.env.DEV) return null;
  if (!allowed) return null;

  return <Analytics route={pathname} path={pathname} beforeSend={beforeSend} />;
}