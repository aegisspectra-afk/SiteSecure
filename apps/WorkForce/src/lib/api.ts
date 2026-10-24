import { createApiClient } from "@site-secure/api-client";
import { apiBaseUrl } from "./env";
import { getSupabase } from "./supabase";

function apiClientConfig(): { baseUrl: string; sameOriginProxy: boolean } {
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
 * Shared API client. Auth is Bearer from Supabase only.
 * Membership and workforce entitlement are enforced server-side.
 */
export function createWorkforceApi() {
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
