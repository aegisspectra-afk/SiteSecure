import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { authTokenStorage } from "./remember-device";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required");
}

const globalForSupabase = globalThis as typeof globalThis & { __siteSecureSupabase?: SupabaseClient };

export const supabase =
  globalForSupabase.__siteSecureSupabase ??
  createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: authTokenStorage,
    },
  });

globalForSupabase.__siteSecureSupabase = supabase;
