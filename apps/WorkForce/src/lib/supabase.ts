import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseAuthHandoffHash, stripAuthHandoffHash } from "./auth-handoff";
import { hasPublicSupabaseConfig } from "./env";

export const WORKFORCE_AUTH_STORAGE_KEY = "ss-workforce-auth";

/** Hash handoff is applied explicitly. Do not also let GoTrue parse the same URL. */
export function workforceAuthClientOptions() {
  return {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: WORKFORCE_AUTH_STORAGE_KEY,
  };
}

const globalForSupabase = globalThis as typeof globalThis & {
  __workforceSupabase?: SupabaseClient | null;
  __workforceHandoffReady?: Promise<void>;
};

async function applyAuthHandoff(supabase: SupabaseClient): Promise<void> {
  if (typeof window === "undefined") return;
  const tokens = parseAuthHandoffHash(window.location.hash);
  if (!tokens) return;
  window.history.replaceState(null, "", stripAuthHandoffHash(window.location.href));
  await supabase.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });
}

/** Anon browser client only. Never initialize with service_role. */
export function getSupabase(): SupabaseClient | null {
  if (!hasPublicSupabaseConfig()) return null;
  if (globalForSupabase.__workforceSupabase) return globalForSupabase.__workforceSupabase;
  const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: workforceAuthClientOptions(),
  });
  globalForSupabase.__workforceSupabase = client;
  globalForSupabase.__workforceHandoffReady = applyAuthHandoff(client).catch(() => undefined);
  return client;
}

export function workforceHandoffReady(): Promise<void> {
  getSupabase();
  return globalForSupabase.__workforceHandoffReady ?? Promise.resolve();
}
