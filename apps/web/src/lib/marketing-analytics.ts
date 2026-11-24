/**
 * Central marketing analytics events.
 * GA4 only when VITE_GA_MEASUREMENT_ID is set; never sends PII field values.
 */

export type MarketingEventName =
  | "page_view"
  | "cta_click"
  | "pricing_view"
  | "demo_start"
  | "beta_submit"
  | "signup_start"
  | "signup_complete"
  | "subscription_start"
  | "enterprise_lead"
  | "calculator_complete";

type EventParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function gaId(): string {
  return ((import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) ?? "").trim();
}

export function trackMarketingEvent(name: MarketingEventName, params: EventParams = {}) {
  const safe: EventParams = { ...params };
  // Never forward free-text that might contain personal data.
  delete safe.email;
  delete safe.phone;
  delete safe.full_name;
  delete safe.name;

  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function" && gaId()) {
      window.gtag("event", name, safe);
    }
  } catch {
    /* ignore analytics failures */
  }

  if (import.meta.env.DEV) {
    console.debug("[mkt-analytics]", name, safe);
  }
}

/** Inject GA4 bootstrap once when measurement id is configured. */
export function ensureGaBootstrap() {
  const id = gaId();
  if (!id || typeof document === "undefined") return;
  if (document.getElementById("ss-ga4")) return;

  const s = document.createElement("script");
  s.id = "ss-ga4";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", id, { anonymize_ip: true });
}
