import { createApiClient } from "@site-secure/api-client";
import { apiBaseUrl } from "./env";
import { getSupabase } from "./supabase";

function apiClientConfig(): { baseUrl: string; sameOriginProxy: boolean } {
  // Local Vite: prefer same-origin `/api` proxy (avoids CORS). Mirrors apps/web session config.
  if (import.meta.env.DEV) {
    return { baseUrl: "", sameOriginProxy: true };
  }
  const url = apiBaseUrl();
  if (!url) {
    return { baseUrl: "", sameOriginProxy: false };
  }
  return { baseUrl: url, sameOriginProxy: false };
}

/**
 * Controlled reuse of the shared API client.
 * Auth: Bearer from Supabase session only — membership / ssp entitlement enforced server-side.
 */
export function createSspApi() {
  const supabase = getSupabase();
  const cfg = apiClientConfig();
  return createApiClient({
    baseUrl: cfg.baseUrl,
    sameOriginProxy: cfg.sameOriginProxy,
    getAccessToken: async () => {
      if (!supabase) return null;
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    },
  });
}
