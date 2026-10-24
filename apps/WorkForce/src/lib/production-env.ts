/** Production WorkForce builds must bake public HTTPS origins. Never localhost. Never service_role. */

export function isLoopbackUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(value);
  }
}

export function looksLikeServerSecret(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  return value.startsWith("sb_secret_") || /service_role/i.test(value);
}

export type WorkforceProductionEnv = {
  VITE_API_URL?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_PLATFORM_HOME_URL?: string;
};

function requiredPublicUrl(name: string, raw: string | undefined): string {
  const value = (raw ?? "").trim().replace(/\/$/, "");
  if (!value) {
    throw new Error(`${name} is required for production WorkForce builds`);
  }
  if (isLoopbackUrl(value)) {
    throw new Error(`${name} must not point at localhost in a production WorkForce build`);
  }
  return value;
}

export function assertWorkforceProductionEnv(env: WorkforceProductionEnv): {
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnon: string;
  platformHome: string;
} {
  const supabaseUrl = requiredPublicUrl("VITE_SUPABASE_URL", env.VITE_SUPABASE_URL);
  const supabaseAnon = (env.VITE_SUPABASE_ANON_KEY ?? "").trim();
  if (!supabaseAnon) {
    throw new Error("VITE_SUPABASE_ANON_KEY is required for production WorkForce builds");
  }
  if (looksLikeServerSecret(supabaseAnon)) {
    throw new Error("VITE_SUPABASE_ANON_KEY must be the anon/publishable key, never service_role");
  }
  return {
    apiUrl: requiredPublicUrl("VITE_API_URL", env.VITE_API_URL),
    supabaseUrl,
    supabaseAnon,
    platformHome: requiredPublicUrl("VITE_PLATFORM_HOME_URL", env.VITE_PLATFORM_HOME_URL),
  };
}
