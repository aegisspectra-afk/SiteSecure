import { createApiClient } from "@site-secure/api-client";
import { isHostedBrowser, isSpaApiUrl, requireProductionApiUrl } from "./public-api-url";
import { clearPortalToken, getPortalToken } from "./portal-session";

function portalClientConfig(): { baseUrl: string; sameOriginProxy: boolean } {
  const fromEnv = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").trim().replace(/\/$/, "");
  if (import.meta.env.DEV) {
    return { baseUrl: "", sameOriginProxy: true };
  }
  const hosted = isHostedBrowser();
  const url = requireProductionApiUrl(fromEnv, hosted);
  if (!url || isSpaApiUrl(url)) {
    return { baseUrl: "", sameOriginProxy: false };
  }
  return { baseUrl: url, sameOriginProxy: false };
}

const cfg = portalClientConfig();

export function createPortalApiClient() {
  return createApiClient({
    baseUrl: cfg.baseUrl,
    sameOriginProxy: cfg.sameOriginProxy,
    getAccessToken: async () => getPortalToken(),
    refreshAccessToken: async () => null,
    onAuthFailure: () => {
      clearPortalToken();
      if (!window.location.pathname.startsWith("/portal/login")) {
        window.location.assign("/portal/login");
      }
    },
  });
}