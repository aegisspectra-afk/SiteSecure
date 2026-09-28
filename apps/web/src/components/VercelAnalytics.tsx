import { Analytics, type BeforeSendEvent } from "@vercel/analytics/react";
import { useRouterState } from "@tanstack/react-router";

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
 * Passes TanStack Router pathname so client navigations count as page views.
 * Uses `@vercel/analytics/react` (not `/next`).
 */
export function VercelAnalytics() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return <Analytics route={pathname} path={pathname} beforeSend={beforeSend} />;
}
