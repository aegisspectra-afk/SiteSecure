import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasPublicSupabaseConfig } from "./env";

let client: SupabaseClient | null = null;

/** Anon browser client only. Never initialize with service_role. */
export function getSupabase(): SupabaseClient | null {
  if (!hasPublicSupabaseConfig()) return null;
  if (client) return client;
  client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
